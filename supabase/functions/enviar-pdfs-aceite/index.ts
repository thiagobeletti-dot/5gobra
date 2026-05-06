// Edge Function: enviar-pdfs-aceite
//
// Gera PDFs dos aceites contratuais (Termos de Uso + Politica de Privacidade)
// de uma empresa e envia por e-mail ao admin que aceitou.
//
// CHAMADA:
//   POST /functions/v1/enviar-pdfs-aceite
//   Headers: Authorization: Bearer <user JWT>
//   Body:    { "empresaId": "uuid", "force": false }
//
// COMPORTAMENTO:
//   - Lista os aceites de tipo termos_uso e politica_privacidade dessa empresa
//   - Por padrao envia apenas os que ainda nao foram enviados (email_enviado=false)
//     Se force=true, reenviar TODOS os 2 aceites mais recentes (independente do flag)
//   - Gera 1 PDF por aceite, com cabecalho de auditoria (data, IP, hash, versao)
//   - Envia 1 unico e-mail com os 2 PDFs anexados (se houver os 2; se so um, manda so)
//   - Marca email_enviado=true e email_enviado_em=now() nos aceites enviados
//
// MODO DRY-RUN:
//   Se RESEND_API_KEY nao estiver configurada, gera os PDFs e retorna
//   { ok: true, dryRun: true, pdfs: [{ filename, sizeBytes }] } sem enviar e-mail.
//   Util pra testar a geracao antes de configurar Resend.
//
// SECRETS NECESSARIOS:
//   - RESEND_API_KEY        (do Resend.com — free tier 100 e-mails/dia)
//   - EMAIL_FROM            (default: 'G Obra <onboarding@resend.dev>')
//                           Em prod, configurar 'G Obra <noreply@5gobra.com.br>'
//                           apos verificar dominio no Resend (DKIM + SPF).

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'
import { corsHeaders } from '../_shared/cors.ts'

interface AceiteRow {
  id: string
  tipo: string
  documento_versao: string
  documento_hash: string
  documento_snapshot: { texto?: string; versao?: string } | null
  ip: string | null
  user_agent: string | null
  contato_identificador: string | null
  created_at: string
  email_enviado: boolean
  empresa_id: string
}

interface EmpresaRow {
  id: string
  nome: string
  cnpj: string | null
}

const TITULOS: Record<string, string> = {
  termos_uso: 'Termos de Uso',
  politica_privacidade: 'Politica de Privacidade',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResp({ error: 'Method not allowed' }, 405)
  }

  try {
    const { empresaId, force } = await req.json().catch(() => ({}))
    if (!empresaId || typeof empresaId !== 'string') {
      return jsonResp({ error: 'empresaId e obrigatorio' }, 400)
    }

    // Cliente Supabase com a service role pra ler tudo (a edge function
    // valida a auth pelo JWT do usuario via header).
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResp({ error: 'Sem auth' }, 401)

    // Cliente "como usuario" pra confirmar que o solicitante pertence a empresa
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: empresaCheck, error: errCheck } = await userClient
      .from('empresas')
      .select('id, nome, cnpj')
      .eq('id', empresaId)
      .single()
    if (errCheck || !empresaCheck) {
      return jsonResp({ error: 'Empresa nao encontrada ou sem permissao' }, 403)
    }
    const empresa = empresaCheck as EmpresaRow

    // Cliente service role pra ler os aceites e fazer update do email_enviado
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY)

    // Pega os 2 aceites mais recentes (1 termos + 1 privacidade) dessa empresa
    let q = adminClient
      .from('aceites')
      .select('*')
      .eq('empresa_id', empresaId)
      .in('tipo', ['termos_uso', 'politica_privacidade'])
      .order('created_at', { ascending: false })
    if (!force) q = q.eq('email_enviado', false)
    const { data: aceitesRaw, error: errAceites } = await q
    if (errAceites) return jsonResp({ error: errAceites.message }, 500)
    const aceites = (aceitesRaw ?? []) as AceiteRow[]

    if (aceites.length === 0) {
      return jsonResp({ ok: true, message: 'Nada a enviar (todos os aceites ja foram enviados ou nao existem)' })
    }

    // Pega o mais recente de cada tipo
    const maisRecentes = new Map<string, AceiteRow>()
    for (const a of aceites) {
      if (!maisRecentes.has(a.tipo)) maisRecentes.set(a.tipo, a)
    }
    const aceitesParaEnviar = Array.from(maisRecentes.values())

    // Gera 1 PDF por aceite
    const pdfs: { filename: string; bytes: Uint8Array; aceiteId: string }[] = []
    for (const a of aceitesParaEnviar) {
      const texto = a.documento_snapshot?.texto ?? '(snapshot indisponivel)'
      const titulo = TITULOS[a.tipo] ?? a.tipo
      const bytes = await gerarPdf({
        titulo,
        texto,
        empresa,
        aceite: a,
      })
      const filename = `${a.tipo}_v${a.documento_versao}_${empresa.id.slice(0, 8)}.pdf`
      pdfs.push({ filename, bytes, aceiteId: a.id })
    }

    // Determina destinatario: contato_identificador do aceite mais recente
    // (ele guarda o e-mail do admin que aceitou)
    const destinatario = aceitesParaEnviar
      .map((a) => a.contato_identificador)
      .find((x) => !!x && x.includes('@')) as string | undefined
    if (!destinatario) {
      return jsonResp({ error: 'Aceite nao tem e-mail de destinatario' }, 400)
    }

    // Modo dry-run: sem RESEND_API_KEY, retorna os PDFs gerados sem enviar
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return jsonResp({
        ok: true,
        dryRun: true,
        message: 'PDFs gerados em modo dry-run (RESEND_API_KEY nao configurada)',
        pdfs: pdfs.map((p) => ({ filename: p.filename, sizeBytes: p.bytes.byteLength })),
        destinatario,
      })
    }

    // Envia via Resend
    const FROM = Deno.env.get('EMAIL_FROM') ?? 'G Obra <onboarding@resend.dev>'
    const attachments = pdfs.map((p) => ({
      filename: p.filename,
      content: bytesToBase64(p.bytes),
    }))
    const html = htmlEmail(empresa.nome, aceitesParaEnviar)

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [destinatario],
        subject: `Copia dos contratos aceitos — ${empresa.nome}`,
        html,
        attachments,
      }),
    })
    const respJson = await r.json().catch(() => ({}))
    if (!r.ok) {
      return jsonResp({ error: 'Erro do Resend', resend: respJson }, 502)
    }

    // Marca email_enviado=true nos aceites
    const ids = aceitesParaEnviar.map((a) => a.id)
    await adminClient
      .from('aceites')
      .update({ email_enviado: true, email_enviado_em: new Date().toISOString() })
      .in('id', ids)

    return jsonResp({
      ok: true,
      destinatario,
      messageId: respJson?.id ?? null,
      enviados: pdfs.map((p) => p.filename),
    })
  } catch (err) {
    console.error('enviar-pdfs-aceite erro:', err)
    return jsonResp({ error: String(err?.message ?? err) }, 500)
  }
})

// =============== Helpers ===============

function jsonResp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[])
  }
  return btoa(s)
}

async function gerarPdf(opts: {
  titulo: string
  texto: string
  empresa: EmpresaRow
  aceite: AceiteRow
}): Promise<Uint8Array> {
  const { titulo, texto, empresa, aceite } = opts
  const pdf = await PDFDocument.create()
  const fontRegular = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdf.embedFont(StandardFonts.Courier)

  const PAGE_W = 595 // A4
  const PAGE_H = 842
  const MARGIN = 50
  const LINE_H = 12
  const FONT_SIZE = 9
  // (sem HEADER_H reservado — y avanca dinamicamente conforme o conteudo)

  // ---- Pagina 1: cabecalho de auditoria + comeco do texto ----
  let page = pdf.addPage([PAGE_W, PAGE_H])
  let y = PAGE_H - MARGIN

  // Titulo
  page.drawText(titulo, {
    x: MARGIN,
    y: y - 16,
    size: 18,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  y -= 28
  page.drawText(`G Obra · 5gobra.com.br`, {
    x: MARGIN,
    y: y - 4,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  })
  y -= 18

  // Linha separadora
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 14

  // Bloco de auditoria
  const auditoria: [string, string][] = [
    ['Empresa', empresa.nome + (empresa.cnpj ? ` (CNPJ ${empresa.cnpj})` : '')],
    ['E-mail aceitante', aceite.contato_identificador ?? '(nao informado)'],
    ['Data e hora do aceite', formatarDataIso(aceite.created_at)],
    ['IP de origem', aceite.ip ?? '(nao registrado)'],
    ['Versao do documento', `v${aceite.documento_versao}`],
    ['Hash SHA-256', aceite.documento_hash],
  ]
  for (const [k, v] of auditoria) {
    page.drawText(k + ':', { x: MARGIN, y: y - 4, size: 8, font: fontBold, color: rgb(0.3, 0.3, 0.3) })
    const value = String(v)
    const isHash = k.startsWith('Hash')
    if (isHash) {
      // Hash em monospace, quebra em 2 linhas se preciso
      const half = Math.ceil(value.length / 2)
      page.drawText(value.slice(0, half), { x: MARGIN + 110, y: y - 4, size: 7, font: fontMono, color: rgb(0.2, 0.2, 0.2) })
      y -= 9
      page.drawText(value.slice(half), { x: MARGIN + 110, y: y - 4, size: 7, font: fontMono, color: rgb(0.2, 0.2, 0.2) })
      y -= LINE_H
    } else {
      page.drawText(value, { x: MARGIN + 110, y: y - 4, size: 8, font: fontRegular, color: rgb(0.1, 0.1, 0.1) })
      y -= LINE_H
    }
  }
  y -= 6
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  })
  y -= 18

  // Texto do documento
  const linhas = quebrarLinhas(texto, fontRegular, FONT_SIZE, PAGE_W - MARGIN * 2)
  for (const linha of linhas) {
    if (y < MARGIN + LINE_H) {
      page = pdf.addPage([PAGE_W, PAGE_H])
      y = PAGE_H - MARGIN
    }
    page.drawText(linha, { x: MARGIN, y: y - FONT_SIZE, size: FONT_SIZE, font: fontRegular, color: rgb(0.15, 0.15, 0.15) })
    y -= LINE_H
  }

  // Footer com numero de paginas (em todas)
  const total = pdf.getPageCount()
  for (let i = 0; i < total; i++) {
    const p = pdf.getPage(i)
    p.drawText(`${i + 1} / ${total}`, {
      x: PAGE_W - MARGIN - 30,
      y: 22,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    })
    p.drawText(`G Obra — ${titulo} v${aceite.documento_versao}`, {
      x: MARGIN,
      y: 22,
      size: 8,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    })
  }

  return await pdf.save()



}

function quebrarLinhas(texto: string, font: any, size: number, maxWidth: number): string[] {
  const linhasRaw = texto.split('\n')
  const out: string[] = []
  for (const linha of linhasRaw) {
    if (linha === '') { out.push(''); continue }
    let atual = ''
    const palavras = linha.split(' ')
    for (const p of palavras) {
      const tentativa = atual ? atual + ' ' + p : p
      const w = font.widthOfTextAtSize(tentativa, size)
      if (w > maxWidth && atual) {
        out.push(atual)
        atual = p
      } else {
        atual = tentativa
      }
    }
    if (atual) out.push(atual)
  }
  return out
}

function formatarDataIso(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'medium', timeZone: 'America/Sao_Paulo' }) + ' (BRT)'
  } catch {
    return iso
  }
}

function htmlEmail(empresaNome: string, aceites: AceiteRow[]): string {
  const itens = aceites.map((a) => `<li>${TITULOS[a.tipo] ?? a.tipo} v${a.documento_versao} — aceito em ${formatarDataIso(a.created_at)}</li>`).join('')
  return `<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, sans-serif; color: #1f2937; max-width: 560px; margin: 0 auto; padding: 24px;">
  <h1 style="font-size: 18px; margin: 0 0 8px;">Copia dos contratos aceitos</h1>
  <p style="color: #6b7280; margin: 0 0 16px; font-size: 14px;">${empresaNome}</p>
  <p>Este e-mail confirma o aceite eletronico dos seguintes documentos no G Obra:</p>
  <ul>${itens}</ul>
  <p>Os PDFs em anexo trazem cabecalho de auditoria com data, hora, IP e hash SHA-256 do conteudo aceito — prova juridica do aceite, com forca de contrato escrito conforme a MP 2.200-2/2001.</p>
  <p>Voce pode reler os documentos a qualquer momento em:</p>
  <ul>
    <li><a href="https://5gobra.com.br/termos">5gobra.com.br/termos</a></li>
    <li><a href="https://5gobra.com.br/privacidade">5gobra.com.br/privacidade</a></li>
  </ul>
  <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Duvidas? Responda esse e-mail ou fale com a gente no WhatsApp oficial.</p>
  <p style="color: #9ca3af; font-size: 11px; margin-top: 24px;">5G Gerenciamento · G Obra · 5gobra.com.br</p>
</body></html>`
}

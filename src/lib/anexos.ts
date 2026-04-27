import { supabase } from './supabase'

export interface Anexo {
  id: string
  card_id: string
  historico_id: string | null
  storage_path: string
  url: string
  nome_arquivo: string | null
  tamanho_bytes: number | null
  content_type: string | null
  created_at: string
}

const BUCKET = 'obra-anexos'

/**
 * Lista anexos de um card.
 */
export async function listarAnexos(cardId: string): Promise<Anexo[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    card_id: row.card_id,
    historico_id: row.historico_id ?? null,
    storage_path: row.storage_path,
    url: urlPublica(row.storage_path),
    nome_arquivo: row.nome_arquivo ?? null,
    tamanho_bytes: row.tamanho_bytes ?? null,
    content_type: row.content_type ?? null,
    created_at: row.created_at,
  }))
}

/**
 * Lista anexos de varios cards de uma vez (otimizacao pra carga inicial).
 */
export async function listarAnexosDeVariosCards(cardIds: string[]): Promise<Record<string, Anexo[]>> {
  if (!supabase || cardIds.length === 0) return {}
  const { data, error } = await supabase
    .from('anexos')
    .select('*')
    .in('card_id', cardIds)
    .order('created_at', { ascending: false })
  if (error) throw error
  const porCard: Record<string, Anexo[]> = {}
  for (const row of (data ?? [])) {
    const anexo: Anexo = {
      id: row.id,
      card_id: row.card_id,
      historico_id: row.historico_id ?? null,
      storage_path: row.storage_path,
      url: urlPublica(row.storage_path),
      nome_arquivo: row.nome_arquivo ?? null,
      tamanho_bytes: row.tamanho_bytes ?? null,
      content_type: row.content_type ?? null,
      created_at: row.created_at,
    }
    ;(porCard[anexo.card_id] ??= []).push(anexo)
  }
  return porCard
}

/**
 * Sobe um File pro Storage e cria a row em anexos.
 */
export async function uploadFoto(opts: {
  arquivo: File
  obraId: string
  cardId: string
}): Promise<Anexo> {
  if (!supabase) throw new Error('Supabase nao configurado')

  // Comprime antes de subir (max 1920px largura, JPEG 85%)
  const arquivoComprimido = await comprimirImagem(opts.arquivo)

  // Path: {obra_id}/{card_id}/{timestamp}-{rand}.jpg
  const ext = 'jpg'
  const nomeArquivo = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`
  const path = `${opts.obraId}/${opts.cardId}/${nomeArquivo}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arquivoComprimido, {
      contentType: 'image/jpeg',
      upsert: false,
    })
  if (upErr) throw upErr

  const { data, error: insertErr } = await supabase
    .from('anexos')
    .insert({
      card_id: opts.cardId,
      storage_path: path,
      nome_arquivo: opts.arquivo.name,
      tamanho_bytes: arquivoComprimido.size,
      content_type: 'image/jpeg',
    })
    .select()
    .single()
  if (insertErr) {
    // tenta limpar o arquivo do storage se a row falhou
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {})
    throw insertErr
  }

  return {
    id: data.id,
    card_id: data.card_id,
    historico_id: data.historico_id ?? null,
    storage_path: data.storage_path,
    url: urlPublica(data.storage_path),
    nome_arquivo: data.nome_arquivo ?? null,
    tamanho_bytes: data.tamanho_bytes ?? null,
    content_type: data.content_type ?? null,
    created_at: data.created_at,
  }
}

/**
 * Apaga um anexo (storage + row).
 */
export async function removerAnexo(anexo: Anexo): Promise<void> {
  if (!supabase) throw new Error('Supabase nao configurado')
  await supabase.storage.from(BUCKET).remove([anexo.storage_path]).catch(() => {})
  const { error } = await supabase.from('anexos').delete().eq('id', anexo.id)
  if (error) throw error
}

function urlPublica(path: string): string {
  if (!supabase) return ''
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Comprime imagem usando canvas. Mantem proporcao, max 1920px no lado maior.
 */
async function comprimirImagem(arquivo: File): Promise<Blob> {
  // Se ja for pequeno, nem comprime
  if (arquivo.size < 200 * 1024) return arquivo

  const img = await carregarImagem(arquivo)
  const MAX = 1920
  let { width, height } = img
  if (width > MAX || height > MAX) {
    if (width > height) {
      height = Math.round((height * MAX) / width)
      width = MAX
    } else {
      width = Math.round((width * MAX) / height)
      height = MAX
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return arquivo
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85)
  )
  return blob ?? arquivo
}

function carregarImagem(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao carregar imagem')) }
    img.src = url
  })
}

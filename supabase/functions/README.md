# Edge Functions do G Obra

## enviar-pdfs-aceite

Gera PDFs dos aceites contratuais (Termos + Política de Privacidade) de uma empresa
e envia por e-mail ao admin que aceitou. Roda em Deno.

### Como deployar

Pré-requisitos:
- `supabase` CLI instalado (`npm i -g supabase` ou `brew install supabase/tap/supabase`)
- Logado no projeto: `supabase link --project-ref <ref>`

Deploy:

```bash
supabase functions deploy enviar-pdfs-aceite
```

### Secrets necessários

```bash
# Obrigatório: API key do Resend (https://resend.com — free tier 100 e-mails/dia)
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx

# Opcional: e-mail de origem. Default: 'G Obra <onboarding@resend.dev>'.
# Em produção, use seu próprio domínio APÓS verificar no painel Resend
# (DKIM + SPF do 5gobra.com.br). Senão o Resend só permite enviar pra você mesmo.
supabase secrets set EMAIL_FROM='G Obra <noreply@5gobra.com.br>'
```

### Modo dry-run

Se `RESEND_API_KEY` não estiver configurada, a função GERA os PDFs mas NÃO envia e-mail.
Retorna `{ ok: true, dryRun: true, pdfs: [...] }`. Útil pra testar a geração sem custo.

A UI em `Configurações → Contratos aceitos` mostra um aviso amarelo quando o retorno é dry-run.

### Configurando o domínio no Resend (produção)

Antes de fazer envios em massa:

1. Painel Resend → Domains → Add Domain → `5gobra.com.br`
2. Copiar os registros DNS que o Resend mostrar (1 TXT pra SPF, 3 CNAME pra DKIM)
3. Adicionar no DNS da Hostinger / Cloudflare / onde o domínio está hospedado
4. Aguardar verificação (em geral < 1h)
5. Atualizar o secret `EMAIL_FROM` pra `noreply@5gobra.com.br`

Sem essa verificação, o Resend só permite enviar pro e-mail dono da conta — o cadastro
de outros clientes vai falhar com 403.

### Como a função é chamada

Frontend (`src/lib/email-aceites.ts`):

```ts
import { enviarPdfsDeAceite } from './email-aceites'

// Pós-cadastro: fire-and-forget
enviarPdfsDeAceite(empresaId).catch(() => {})

// Reenvio manual em /app/configuracoes
const r = await enviarPdfsDeAceite(empresaId, /* force */ true)
```

A flag `force=true` reenvia mesmo aceites que já foram enviados antes.

### Permissões / RLS

A função usa duas conexões Supabase:
- Como **usuário** (com o JWT do Authorization header): valida que o solicitante
  é dono da empresa via `select * from empresas where id = empresaId`. RLS garante
  que ele só vê a própria empresa.
- Como **service role** (para ler `aceites` e fazer update de `email_enviado`).
  Não precisa abrir RLS pra leitura cross-empresa porque a etapa anterior já validou.

### O que vai no PDF

Cada PDF tem:
- Cabeçalho com título + identificação G Obra
- Bloco de auditoria: empresa, e-mail aceitante, data/hora (BRT), IP de origem,
  versão do documento, hash SHA-256 (em duas linhas Courier)
- Texto integral do snapshot que foi aceito (mesmo conteúdo cuja versão e hash
  foram registrados em `aceites.documento_snapshot`)
- Footer com paginação `1/N` e identificação do documento

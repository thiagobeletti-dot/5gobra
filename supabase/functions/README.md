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

---

## criar-assinatura-asaas + webhook-asaas

Integração de cobrança recorrente com Asaas. 2 funções:
- **`criar-assinatura-asaas`**: cliente clica "Ativar plano" no app → função cria
  cliente no Asaas + assinatura mensal → retorna `invoiceUrl` pra redirect.
- **`webhook-asaas`**: Asaas envia eventos (PAYMENT_CONFIRMED, PAYMENT_OVERDUE etc) →
  função atualiza tabela `assinaturas` no Supabase.

### Pré-requisitos pra deploy

1. **Rodar SQL** `supabase/asaas-assinaturas.sql` no SQL Editor do Supabase Dashboard.
2. **Conta Asaas** (sandbox primeiro): https://sandbox.asaas.com — criar conta de teste.
3. **API Key Asaas**: painel Asaas → Integrações → Chave API → Gerar nova chave API.
   - Sandbox começa com `$aact_hmlg_`
   - Produção começa com `$aact_prod_`
4. **Token de webhook personalizado**: gerar string aleatória forte (ex: `openssl rand -hex 32`)
   pra usar como `ASAAS_WEBHOOK_TOKEN`. A mesma string vai no painel Asaas E no secret.

### Secrets no Supabase

Via Dashboard → Edge Functions → Secrets, adicionar:

```
ASAAS_API_KEY        = $aact_hmlg_xxxxxxxxxxxxxxxx
ASAAS_API_URL        = https://api-sandbox.asaas.com/v3
ASAAS_WEBHOOK_TOKEN  = <gerar string forte com openssl rand -hex 32>
```

Em produção, troca `ASAAS_API_KEY` pra `$aact_prod_...` e `ASAAS_API_URL` pra `https://api.asaas.com/v3`.

### Deploy das funções

Via Dashboard (sem CLI), pra cada função:

1. Edge Functions → Deploy a new function → Via Editor
2. Nome: `criar-assinatura-asaas` (depois repete pra `webhook-asaas`)
3. Cola o conteúdo de `supabase/functions/<nome>/index.ts`
4. Deploy → status verde "Active"

### Configurar webhook no painel Asaas

Painel Asaas → Integrações → Webhooks → Adicionar webhook:

- **URL**: `https://romublbgvlmjuwazuqqu.supabase.co/functions/v1/webhook-asaas`
- **E-mail pra notificações de erro**: thiagobeletti@gmail.com
- **Token**: cole o mesmo `ASAAS_WEBHOOK_TOKEN` que pôs no Supabase
- **Eventos a enviar**: marca todos os `PAYMENT_*` (CREATED, CONFIRMED, RECEIVED, OVERDUE, REFUNDED, DELETED) e `SUBSCRIPTION_INACTIVATED`
- **Ativar fila**: sim
- **Tipo de envio**: SEQUENTIALLY (evita duplicar processamento)

### Testar fluxo (sandbox)

1. App em produção (Vercel) → `/app/configuracoes` → bloco "Plano e cobrança" → "Ativar plano"
2. Redireciona pra página Asaas em nova aba
3. Pagar com cartão de teste: `4444 4444 4444 4444`, CVV `123`, qualquer data futura
4. Volta pro app → status muda pra "Plano ativo" (via webhook em ~5s)

### Quando ir pra produção

1. Troca os 2 secrets (`ASAAS_API_KEY` pra `$aact_prod_` e `ASAAS_API_URL` pra `https://api.asaas.com/v3`)
2. Cria webhook novo no painel **de produção** do Asaas (não no sandbox)
3. Solicita ao gerente Asaas a habilitação de tokenização de cartão se um dia quiser checkout transparente (não precisa pra página hospedada)

---

## comprar-publico + ativar-pre-cadastro + pre-cadastro-por-token

Fluxo de **compra pública pela landing** (visitante anônimo). 3 funções:

- **`comprar-publico`** (anon): visitante clica "Comprar" na landing → função
  cria customer + subscription no Asaas (com cupom aplicado se válido) → grava
  `pre_cadastros` → retorna `invoiceUrl` pra redirect.
- **`pre-cadastro-por-token`** (anon, leitura): chamada pela página `/cadastro`
  pra validar o token e pré-preencher email/nome.
- **`ativar-pre-cadastro`** (anon, escrita autorizada via token): cliente que
  já pagou clica no link do email → função cria user + empresa + assinatura
  **ATIVA** vinculada à subscription paga no Asaas.

E o **`webhook-asaas`** foi estendido pra reconhecer pagamentos vindos do fluxo
público (busca em `pre_cadastros` antes de `assinaturas`):
1. Marca `pre_cadastro.status='pago'`
2. Atualiza value da subscription no Asaas pra R$ 349 (remove desconto do 1º mês)
3. Dispara email Resend com link `/cadastro?token=X` pro cliente terminar

### Pré-requisitos extras pra deploy

1. **Rodar SQL** `supabase/pre-cadastros.sql` (cria tabela) e
   `supabase/pre-cadastros-extras.sql` (adiciona colunas de auditoria) no SQL Editor.
2. **Rodar SQL** `supabase/cupons.sql` se ainda não rodou.

### Secrets adicionais

Os mesmos do bloco anterior (`ASAAS_API_KEY`, `ASAAS_API_URL`, `ASAAS_WEBHOOK_TOKEN`,
`RESEND_API_KEY`, `EMAIL_FROM`). Acrescentar:

```
APP_URL = https://5gobra.com.br
```

(Usado pra montar o link `/cadastro?token=X` no email pós-pagamento.)

### Deploy das funções

Via Dashboard, deploy de cada uma:
- `comprar-publico`
- `pre-cadastro-por-token`
- `ativar-pre-cadastro`

E **redeployar** `webhook-asaas` (mudou pra reconhecer pre_cadastros).

### Teste end-to-end (sandbox)

1. Acessa landing → clica "Comprar"
2. Preenche modal (nome, email, whatsapp, CPF/CNPJ, cupom OBRA10)
3. Redireciona pra página Asaas — paga com cartão `4444 4444 4444 4444`
4. ~5s depois, webhook processa: pre_cadastro vira 'pago' e email chega
5. Clica link do email → abre `/cadastro?token=X` com email pré-preenchido
6. Cria senha + aceita termos → empresa criada + login automático
7. Cai em `/app/obras` já com plano ativo

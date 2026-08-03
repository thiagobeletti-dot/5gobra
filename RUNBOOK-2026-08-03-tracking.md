# RUNBOOK — Correção do rastreamento (03/08/2026)

Origem: auditoria ao vivo do pixel em produção. Diagnóstico completo em
`Sessões/2026-08-03 - Diagnóstico funil G Obra — auditoria ao vivo do pixel.md`.

**Resumo do que muda:** o pixel para de contar o app como visitante, todo evento de
conversão ganha `event_id` e espelho server-side, e passam a existir os dois eventos
que faltavam — `Contact` (WhatsApp) e `Schedule` (agendamento).

---

## Arquivos

| Arquivo | O quê |
|---|---|
| `src/lib/meta-pixel.ts` | **Reescrito.** Isolamento de rota, `event_id`, Advanced Matching, espelho CAPI, `Contact` e `Schedule` |
| `supabase/functions/meta-capi/index.ts` | **Novo.** Espelho server-side genérico, com hash SHA-256 no servidor |
| `src/main.tsx` | Calendly passa a disparar `Schedule` além de `Lead` |
| `src/pages/Landing.tsx` | `Contact` nos 5 botões de WhatsApp (com origem) + `InitiateCheckout` na abertura do modal |
| `src/components/ModalComprar.tsx` | `AddPaymentInfo` no submit, com nome/e-mail/telefone/CPF |
| `src/components/PopupSaida.tsx` | `Lead` agora leva o telefone digitado |

Nenhum arquivo do app (`/app/*`, `/obra/*`, `/tec/*`) foi tocado.

---

## Como o funil fica medido

| Momento | Evento | `event_id` | CAPI |
|---|---|---|---|
| Carregou a landing | `PageView` | — | não (evita duplicar) |
| Clicou em qualquer WhatsApp | `Contact` + custom `whatsapp_click` | `contact_<uuid>` | sim |
| Agendou demo no Calendly | `Schedule` + `Lead` | `calendly_sched_<uuid>` / `calendly_<uuid>` | `Schedule` sim; `Lead` pelo webhook |
| Deixou WhatsApp no pop-up | `Lead` | `lead_<uuid>` | sim, com telefone |
| Abriu o modal de contratação | `InitiateCheckout` | `checkout_<uuid>` | sim |
| Enviou o formulário → Asaas | `AddPaymentInfo` | `payinfo_<uuid>` | sim, com 4 campos de match |
| Pagou (`/cadastro?token=`) | `Purchase` | `purchase_<uuid>` | sim |
| Terminou o cadastro | `CompleteRegistration` | `signup_<uuid>` | sim |

`InitiateCheckout` menos `AddPaymentInfo` = abandono de formulário. É esse número que
vai dizer se pedir CPF/CNPJ antes do pagamento está custando venda.

---

## Passos de deploy

### 1. Edge Function

```bash
supabase functions deploy meta-capi
```

Com verificação de JWT **ligada** (o padrão) — quem chama é o browser com a anon key.
Diferente da `calendly-capi`, que precisa de `--no-verify-jwt` por ser chamada externa.

Secrets necessários (o `META_CAPI_TOKEN` já existe desde 18/06):

```bash
supabase secrets list | grep META
```

A função reusa a tabela `capi_events_sent` que a `calendly-capi` já criou. Nenhuma
migration nova.

### 2. 🔴 Desativar a integração automática no painel do Meta

**Este passo é o que resolve a duplicação do PageView, e ele não está no código.**

Os 2.307 eventos de servidor que hoje duplicam cada PageView não vêm do repositório —
vêm de uma integração automática ligada no painel (aparece como `ob3_plugin-set` nas
requisições, e como "API de Conversões · Pixel da Meta" nas Integrações do dataset).
Ela espelha os eventos do browser sem dado de correspondência próprio, o que produz
volume duplicado e EMQ baixo ao mesmo tempo.

Caminho: **Gerenciador de Eventos → dataset GObra → Configurações → Integrações /
Configuração automática** — desativar o envio automático de eventos do site.

Deixe rodar o CAPI do código, que manda `event_id` e dados hasheados de verdade.

### 3. Redeploy do front

O Vercel não rebuilda sozinho ao mexer em env var. Se nada mudou nas variáveis, o
push normal já dispara o deploy.

---

## Validação

### Antes de subir (local)

```bash
npm run build     # precisa passar limpo
npm run dev
```

No console, navegando:

- em `/` → `[meta-pixel] inicializado {pixel: ..., rota: "/"}`
- em `/app/demo` → `[meta-pixel] rota de produto (/app/demo) — pixel NAO carregado, de proposito`

Sem `VITE_META_PIXEL_ID` em dev, tudo vira `(dry-run)` no console — dá pra conferir
que cada evento sai no lugar certo sem sujar o dataset de produção.

### Em produção, com Test Events

1. Gerenciador de Eventos → dataset GObra → **Testar eventos** → copie o código
2. `supabase secrets set META_TEST_EVENT_CODE=TESTXXXXX`
3. Faça o percurso: abrir a landing → clicar no WhatsApp → abrir o modal → agendar
4. Cada evento deve aparecer **uma vez só**, com "Navegador e servidor" no lado
5. **`supabase secrets unset META_TEST_EVENT_CODE`** quando terminar

### Depois de 48h

| Indicador | Antes | Meta |
|---|---|---|
| Qualidade da correspondência | 6,1/10 | ≥ 8,0 |
| Desduplicação | não atende | atende |
| PageView/dia | ~164 (inflado) | ~10 (real) |
| `Contact` | não existia | > 0 |

---

## ⚠️ O PageView vai despencar — e isso é o certo

Quando o pixel sair do app, o PageView cai de ~4.600/mês para umas poucas centenas.
Não é regressão: é o painel parando de contar cliente pagante como visitante. O número
real de visitas na landing hoje é ~114/mês, e é esse que precisa subir.

Enquanto o tráfego não voltar, nenhum desses eventos vai ter volume. A correção não
traz lead nenhum sozinha — ela garante que, quando o lead vier, você consiga ver de
onde veio.

---

## O que NÃO entrou nesta rodada, e por quê

- **Header com 2 CTAs.** Você reintroduziu "Contratar" e "Entre em Contato" em
  05/07 por um motivo concreto — o caminho de compra não estava visível. Não desfiz
  uma decisão sua sem conversar.
- **Variante B da headline.** Já existe e está rodando: o sorteio 50/50 está no
  `Landing.tsx` e o `headline_variant_shown` dispara certo. Eu tinha te dito que
  faltava subir — estava errado. Com 114 visitas/mês, o que falta pro teste concluir
  é volume, não código.
- **CPF/CNPJ fora do passo 1.** Mexe no contrato da `comprar-publico` com o Asaas.
  Depois do `AddPaymentInfo` rodando por duas semanas, o número de abandono vai dizer
  se vale.

---

## Verificação feita

- ✅ **`npm run build` completo passou** (`tsc -b && vite build`, 372 módulos, 12s).
  Zero erro de tipo. Os dois avisos que aparecem — tamanho de chunk e o import
  dinâmico do `api.ts` — já existiam antes desta mudança.
- ✅ Isolamento de rota testado contra as **19 rotas** declaradas no `App.tsx` — 19/19
- ✅ Bundle de produção conferido com as env vars reais: `connect.facebook.net`,
  `eventID`, `functions/v1/meta-capi`, `Contact`, `Schedule`, `AddPaymentInfo`,
  `whatsapp_click` e a guarda de rota (`/app`, `/obra/`, `/tec/`, …) todos presentes
- ✅ `trackLead` mantém compatibilidade com a forma antiga (`trackLead('calendly_x')`)

**Detalhe que vale saber:** buildando *sem* `VITE_META_PIXEL_ID`, o Vite elimina o
código do pixel inteiro por dead-code elimination — `CONFIGURADO` vira constante
`false` e nada do rastreamento entra no bundle. É o comportamento desejado (dev não
suja o dataset), mas significa que **um preview do Vercel sem a env var não tem
pixel nenhum**. Só o Production tem.

### O que ainda não dá pra verificar

Os eventos só podem ser conferidos ao vivo depois do deploy — o site em produção
ainda roda o código antigo. Assim que subir, faço o percurso no seu Chrome com o
Test Events ligado e confiro um por um.

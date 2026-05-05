# Phase 9 — Onboarding interno + Aceite contratual

Código preparado em sessão de dev de **05/05/2026**. Compilou limpo no `tsc --noEmit`. Este documento é o passo a passo pra você aplicar e testar localmente.

## O que foi entregue

### Arquivos novos

- `supabase/onboarding-aceites.sql` — migration: coluna `empresas.onboarding_status` (jsonb) + tabela `aceites` + RLS + função helper `marcar_onboarding`.
- `src/components/BannerOnboarding.tsx` — banner condicional pra empresa com 0 obras.
- `src/components/TourGuiado.tsx` — tour de 6 passos com `react-joyride`.
- `src/components/FaqUso.tsx` — FAQ de uso (11 perguntas redigidas, accordion `<details>`).
- `src/pages/Ajuda.tsx` — rota `/app/ajuda` com 4 blocos (Tour, Vídeos, FAQ, WhatsApp).

### Arquivos modificados

- `package.json` — adiciona `react-joyride@^2.9.3`.
- `src/App.tsx` — registra rota `/app/ajuda`.
- `src/pages/Obras.tsx` — integra banner condicional + dispara tour + auto-tour via `?tour=1`.
- `src/pages/Obra.tsx` — adiciona link "Ajuda" na sidebar.
- `src/pages/Cadastro.tsx` — vira wizard de 3 etapas: Dados → Aceite contratual obrigatório (Termos + Política) → Confirmação.
- `src/lib/api.ts` — helpers `pegarOnboardingStatus`, `marcarOnboardingFlag`, `gravarAceite`, `hashSha256`, types `OnboardingStatus`, `TipoAceite`, `AceiteInput`.

## Passo a passo pra aplicar

### 1. Instalar a nova dependência

No terminal local (PowerShell ou Git Bash), na raiz do `5gobra`:

```bash
npm install
```

Isso vai instalar o `react-joyride` que já está no `package.json`.

### 2. Rodar a migration no Supabase

Abre o **Supabase Dashboard → SQL Editor** do projeto G Obra, cola o conteúdo de `supabase/onboarding-aceites.sql` inteiro e clica em **Run**. É idempotente — pode rodar várias vezes sem erro.

A migration faz:
- Adiciona coluna `onboarding_status` (jsonb) na tabela `empresas` com defaults
- Cria enum `tipo_aceite`
- Cria tabela `aceites` com índices
- Habilita RLS na `aceites` (empresa autenticada vê só os próprios; anon pode inserir aceite de cliente final/técnico, mas nunca ler)
- Cria função SQL `marcar_onboarding(p_flag)` pra bater flags do jsonb sem race condition

### 3. Rodar o app local

```bash
npm run dev
```

Vai subir em `http://localhost:5173` (porta default do Vite).

### 4. Testes funcionais que valem fazer

**Test 1 — Banner + tour pra empresa nova**
1. Crie uma empresa de teste no Supabase (ou use uma existente sem obras).
2. Logue como essa empresa.
3. Em `/app/obras`, deve aparecer o banner laranja "Vamos criar sua primeira obra juntos?".
4. Clica "Iniciar tour" → react-joyride dispara com 6 passos.
5. Pula ou conclui o tour. Recarrega a página: banner some (flag `tour_dispensado` ou `tour_visto` foi marcada).
6. Crie uma obra: banner some na próxima carga (flag `primeira_obra_criada` foi marcada).

**Test 2 — Rota `/app/ajuda`**
1. Clica no link "Ajuda" no header de `/app/obras` ou na sidebar de uma obra.
2. Veja os 4 blocos: Tour interativo, Vídeos rápidos (placeholders "Em breve"), FAQ (11 accordions), Falar com a gente.
3. Clica "Iniciar tour" → volta pra `/app/obras?tour=1` e o tour dispara automaticamente.
4. Clica "Abrir WhatsApp" → abre conversa com prefixo `[SUPORTE G OBRA - {nome empresa}]`.

**Test 3 — Cadastro com aceite contratual**
1. `/cadastro` em janela anônima.
2. Etapa 1: dados básicos (nome empresa, CNPJ opcional, telefone opcional, email, senha).
3. Clica "Continuar — ler contratos".
4. Etapa 2: vê dois `<pre>` com os textos de Termos de Uso e Política de Privacidade. Checkbox "Li e aceito" obrigatório.
5. Marca o checkbox. Clica "Aceitar e criar conta".
6. Sistema cria conta no Supabase Auth, cria empresa, grava 2 aceites na tabela `aceites` (verifique no Supabase Dashboard → Table Editor → aceites).
7. Etapa 3: tela de sucesso. Clica "Entrar no sistema" → vai pra `/app/obras`.

## Pendências da Phase 9 (não estão neste código)

Coisas que ficaram fora deste push e que entram em sessões futuras:

### Curto prazo (Thiago providencia em paralelo)

- [ ] **Gravar 7 vídeos tutoriais** (lista priorizada em `/app/ajuda` → bloco 2). Hospedar em **YouTube unlisted**. Quando estiverem prontos, atualizar a constante `videos[]` em `src/pages/Ajuda.tsx` adicionando o `youtubeId` de cada um.
- [ ] **Contratar advogado especializado em direito digital** pra redigir **Termos de Uso** + **Política de Privacidade** em versão final. Custo médio R$ 500–1.500. Quando os textos chegarem:
    - Substituir as constantes `DOC_TERMOS_USO` e `DOC_POLITICA_PRIVACIDADE` em `src/pages/Cadastro.tsx`
    - Bumpar `TERMOS_VERSAO` e `PRIVACIDADE_VERSAO` (ex: `'1.0'` → `'1.0-final'`)
    - Hospedar texto público em `/privacidade` e `/termos` (rotas novas) e linkar do rodapé dos sites

### Médio prazo (próxima sessão de dev)

- [ ] **Geração de PDF dos contratos no momento do aceite** + envio por e-mail (com anexo). Stack sugerida: Edge Function do Supabase + `pdf-lib` ou `puppeteer` + Resend/SendGrid pro envio. Endpoint dedicado: `POST /functions/v1/dispatch-aceite-email`.
- [ ] **Webhook do Asaas** em `/api/asaas-webhook` que ativa empresa automaticamente após pagamento confirmado. Vercel Function (Next.js-style) ou Edge Function do Supabase.
- [ ] **Aceite final da obra** com e-mail automático contendo snapshot do dossiê. Reutiliza tabela `aceites` (tipo `aceite_final_obra`) e infra de e-mail acima.

### Decisão técnica adiada

- **2FA WhatsApp em aceites críticos** — adiado em 05/05 por causa do custo de mensagem. E-mail pós-aceite cobre o trilho probatório independente sem custo. Reabrir quando volume crescer ou aparecer contestação real.

## Observações sobre o desenvolvimento

- O componente `<TourGuiado>` usa `target='body' + placement='center'` em alguns passos (3, 4, 5) porque eles falam de elementos da **página de uma obra específica** (abas, convidar técnico, link cliente) — esses elementos não existem na lista de obras. Ao invés de navegar mid-tour (gera flickering), os passos viraram explicações textuais centralizadas. O cliente encontra os elementos na prática quando criar a primeira obra.
- O `<BannerOnboarding>` foi desenhado pra ser independente — pode ser reutilizado em outras telas se quisermos nudge contextual no futuro (ex: "convide um técnico" depois que primeira obra é criada).
- A função `marcar_onboarding` no banco usa `security definer` pra evitar race conditions ao mexer no jsonb. O fallback no `marcarOnboardingFlag` em `api.ts` faz update direto se a função não existir (caso a migration não tenha rodado ainda).
- A tabela `aceites` tem RLS estrito: empresa autenticada vê só os próprios; anon pode inserir aceite (cliente final / técnico via link mágico) mas **nunca ler**. Privacidade preservada.

## Em caso de problema

Se algo der errado depois do `npm install` ou da migration:

1. **Erro de import `react-joyride`**: confirme `npm install` rodou na raiz e que `node_modules/react-joyride` existe.
2. **Coluna `onboarding_status` não existe**: a migration não rodou. Volte ao SQL Editor e rode `supabase/onboarding-aceites.sql`.
3. **Tour não aparece em `?tour=1`**: confirme que `react-router-dom` está atualizado (≥6.26) — `useSearchParams` é dele.
4. **Aceite não é gravado no cadastro**: provavelmente a tabela `aceites` não foi criada. Roda a migration. Se erro persistir, abre console do navegador (F12) e me manda o erro do Supabase.

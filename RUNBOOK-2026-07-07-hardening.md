# Runbook — Hardening de segurança do G Obra (2026-07-07)

O que o Fable já mexeu no repo e o que **você** precisa fazer pra colocar no ar
com segurança. A parte de código está pronta e o frontend **compila limpo**
(`tsc --noEmit` = 0 erros). Falta aplicar no Supabase/Vercel e **testar num
Preview antes da produção** — porque as mudanças mexem no coração do link mágico
(cliente e técnico), que é o que a Windoor está avaliando.

---

## 1. O que mudou no código (já feito)

**A correção crítica (RLS anon).** Até aqui, qualquer pessoa com a anon key
(pública no site) conseguia baixar nome/telefone/endereço de TODOS os clientes de
TODAS as empresas chamando a API direto. Agora o link mágico manda o token num
header `x-obra-token` e o banco só devolve/aceita dados da obra daquele token.

- `supabase/2026-07-07-hardening-rls-anon.sql` — **novo**. Troca todas as policies
  anon `using(true)` por versões escopadas pelo token. Também escopa a **escrita**
  no Storage (anon só grava foto na obra do token).
- `src/lib/supabase.ts` — nova função `clientePublicoComToken(token)` que injeta o
  header. `src/pages/ObraCliente.tsx` e `src/pages/ObraTecnico.tsx` passaram a usar
  ela. **Nenhuma outra parte do app muda** (os helpers de dados continuam iguais).

**Correções médias (já no código, é só aplicar o SQL):**
- `supabase/cupons.sql` — anon não lê mais a tabela de cupons (validação segue pela
  função `validar_cupom`).
- `supabase/leads-quentes.sql` — empresas logadas não leem mais a base de leads da 5G.
- `supabase/functions/_shared/cors.ts` + `comprar-publico/index.ts` — CORS restrito
  aos domínios da 5G (+ previews Vercel) e validação de e-mail/CPF/WhatsApp no checkout.

**Defensivo:**
- `supabase/schema.sql` e `rls-tecnico-anon.sql` ganharam `to anon` nas policies —
  re-rodar não reabre mais o vazamento entre empresas.
- `.gitattributes` novo (estanca o ruído de fim-de-linha), `README-ORDEM.md` com a
  ordem das migrations, `PHASE9-APLICAR.md` marcado como arquivado.

---

## 2. Aplicar no Supabase (ordem)

No **SQL Editor** do projeto 5gobra, rode nesta ordem (todos idempotentes):

1. `supabase/cupons.sql`
2. `supabase/leads-quentes.sql`
3. **`supabase/2026-07-07-hardening-rls-anon.sql`** ← a principal

E faça o **deploy da Edge Function** com o CORS novo:

```
supabase functions deploy comprar-publico
```

> Dica: se preferir, dá pra testar tudo primeiro num projeto Supabase de staging.

---

## 3. Publicar o frontend — via Preview primeiro

1. Suba o código numa **branch** (não direto na `main`) → o Vercel gera um Preview.
2. No Preview, teste o fluxo inteiro do link mágico:
   - **Cliente** (`/obra/<token>`): abre a obra, vê os cards, confirma um item,
     marca vão pronto, manda mensagem, vê fotos, vê o cronograma.
   - **Técnico** (`/tec/<token>`): abre o link, salva uma M1 e uma M2, sobe uma
     foto, remove uma foto.
   - **Empresa logada**: cria/edita card, sobe foto — tudo normal.
3. **Teste de ataque** (confirma que o furo fechou): sem o header, a API não pode
   devolver nada. No terminal:

   ```
   curl "https://SEU-PROJETO.supabase.co/rest/v1/obras?select=*" \
     -H "apikey: SUA_ANON_KEY" -H "Authorization: Bearer SUA_ANON_KEY"
   ```
   Deve voltar `[]` (vazio). Com `-H "x-obra-token: <token-de-uma-obra>"` deve
   voltar **só aquela obra**.
4. Deu tudo certo no Preview → **merge na `main`** (produção).

Se algo no link mágico quebrar no Preview, me chama — o mecanismo é o header
`x-obra-token`; provável causa seria uma policy escopada que precisa de ajuste
fino, e dá pra corrigir só no SQL sem mexer no app.

---

## 4. Coisas manuais (rápidas)

- **`.git/index.lock` preso**: tem um lock travado no git. No PowerShell, com o
  app fechado: `del "C:\Users\thiag\OneDrive\Documentos\GitHub\5gobra\.git\index.lock"`
- **Ruído de fim-de-linha**: depois de aplicar o `.gitattributes`, pra normalizar
  de vez (opcional, num commit separado): `git add --renormalize .` e commitar.
- **Deploy pendente antigo**: `ativar-pre-cadastro` (fix do P0 Asaas de 02/07)
  ainda não foi deployada — `supabase functions deploy ativar-pre-cadastro`.

---

## 5. Ficou pra depois (staged, com plano)

- **Bucket de fotos privado + signed URLs.** A **escrita** anon já foi fechada. Falta
  fechar a **leitura**: hoje a foto é acessível por URL direta se a URL vazar (paths
  são UUID, não dá pra adivinhar). Fechar exige trocar `getPublicUrl()` por
  `createSignedUrl()` (assíncrono) em `lib/anexos.ts`, nas duas páginas e nos PDFs —
  é um refactor que merece sua própria rodada + teste. Ver o aviso no topo de
  `supabase/storage-public.sql`.
- **Migrations no supabase CLI** (pasta numerada) pra o banco ser reproduzível do
  repo. Hoje é aplicação manual guiada pelo `README-ORDEM.md`.

# Ordem de aplicação das migrations (SQL) — G Obra

Os `.sql` desta pasta são aplicados **manualmente** no SQL Editor do Supabase
(não há supabase CLI/pasta `migrations/` versionada ainda). Todos são
idempotentes. Esta é a ordem canônica pra reconstruir o banco do zero.

## Ordem

1. `schema.sql` — tabelas base (empresas, obras, cards, historico_card, anexos) + RLS bootstrap
2. `storage.sql` — bucket `obra-anexos`
3. `checklist.sql` — checklists (M1/M2/item)
4. `aba-tecnica.sql`
5. `historico-interno.sql`
6. `sub-status.sql`
7. `card-dimensoes.sql`
8. `tecnico-obra.sql` — técnicos por obra (link mágico)
9. `rls-tecnico-anon.sql`
10. `cronograma.sql` + `cronograma-limpeza.sql`
11. `empresa-dados.sql` + `empresa-logo.sql`
12. `pre-cadastros.sql` + `pre-cadastros-extras.sql`
13. `cupons.sql`
14. `asaas-assinaturas.sql` + `trial-system.sql` + `sync-empresa-assinatura.sql`
15. `parceiros.sql`
16. `leads-quentes.sql` + `leads-quentes-lgpd.sql`
17. `onboarding-aceites.sql`
18. `interacao-cliente.sql`
19. `calendly-capi.sql`
20. `fix-rls-isolamento-empresa.sql` — fix cross-tenant entre empresas autenticadas
21. **`2026-07-07-hardening-rls-anon.sql`** — ⭐ fecha o vazamento anon (escopo por token `x-obra-token`). **Rodar por último e SEMPRE depois de qualquer re-run de `schema.sql`/`rls-tecnico-anon.sql`/`cronograma.sql`**, porque ele substitui as policies anon permissivas pelas escopadas.

## Regras

- **Nunca** deixe uma tabela com policy anon `using (true)` sem `to anon`. Sem
  `to anon` a policy vale pra `authenticated` também e reabre o cross-tenant.
- Depois de re-rodar qualquer arquivo que recria policies anon (schema, cronograma,
  rls-tecnico), **re-rode `2026-07-07-hardening-rls-anon.sql`** pra voltar ao estado seguro.
- `storage-public.sql` deixa o bucket de fotos público — só rode com consciência
  (ver o aviso no topo do arquivo; o alvo é bucket privado + signed URLs).

## Futuro

Migrar pra `supabase` CLI com pasta `migrations/` numerada por timestamp, pra o
estado do banco ser reproduzível a partir do repo (hoje é aplicação manual).

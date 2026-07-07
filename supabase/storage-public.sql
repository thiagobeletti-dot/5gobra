-- ⚠️ NAO RODAR MAIS ESTE ARQUIVO EM PRODUCAO SEM O REFACTOR DE SIGNED URLS.
--
-- Este script torna o bucket "obra-anexos" PUBLICO — qualquer um com a URL
-- (obraId/cardId/arquivo) le a foto sem assinatura. Como os paths sao UUIDs,
-- nao da pra enumerar, mas a foto vaza se a URL vazar.
--
-- A ESCRITA anon ja foi fechada em 2026-07-07-hardening-rls-anon.sql (so o
-- token da obra escreve). Falta fechar a LEITURA: tornar o bucket privado e
-- trocar getPublicUrl() por createSignedUrl() no front (lib/anexos.ts +
-- ObraCliente/ObraTecnico/PDFs). Enquanto esse refactor async nao acontece, o
-- bucket segue publico. Ver runbook 2026-07-07.
--
-- Quando fizer o refactor, rode:
--   update storage.buckets set public = false where id = 'obra-anexos';

update storage.buckets set public = true where id = 'obra-anexos';

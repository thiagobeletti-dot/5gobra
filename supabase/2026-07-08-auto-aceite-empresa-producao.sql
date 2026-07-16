-- =============================================================
-- G Obra — Auto-aceite do cronograma pela EMPRESA (2026-07-08)
-- =============================================================
-- Decisão do Thiago: quando a empresa já está PRODUZINDO uma obra, a linha do
-- tempo do cronograma deve arrancar mesmo que o cliente não tenha clicado
-- "aceitar" no link mágico.
--
-- Causa do bug: a inferência do cronograma (previsões, datas, status das fases)
-- só roda depois de `cronogramas.aceito_em` estar preenchido, e isso só era
-- gravado pelo aceite do CLIENTE. Obra com produção liberada mas cliente que
-- nunca aceitou ficava sem previsão → sumia do calendário e ficava enterrada
-- no dashboard (diasRestantes nulo → ordenada por último).
--
-- ESTE SCRIPT (backfill): marca como aceite AUTOMÁTICO os cronogramas de obras
-- que JÁ estão em produção mas cujo cliente não aceitou. O `aceito_user_agent`
-- guarda a origem 'auto:empresa-producao' pra o dossiê distinguir do aceite
-- real do cliente (peso jurídico preservado). A inferência recalcula as
-- previsões na próxima leitura — não precisa mexer nas fases aqui.
--
-- Idempotente (só toca cronograma sem aceite). Rodar no SQL Editor (Role postgres).
-- =============================================================

update cronogramas c
set
  aceito_em = now(),
  aceito_user_agent = 'auto:empresa-producao'
where c.aceito_em is null
  and exists (
    select 1
    from cards k
    where k.obra_id = c.obra_id
      and k.aba in ('emandamento', 'conclusao')
      and coalesce(k.encerrado, false) = false
  );

notify pgrst, 'reload schema';

-- Conferência: quantos cronogramas foram auto-aceitos agora
-- select count(*) from cronogramas where aceito_user_agent = 'auto:empresa-producao';

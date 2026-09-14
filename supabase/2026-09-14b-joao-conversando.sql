-- =============================================================
-- G Obra — corrige o estado do João Paulo (Grupo Verginassi)
-- =============================================================
-- Erro meu no script do dia 11: o Thiago disse que falou com ele em 22/08 e
-- que ele QUER VER o sistema. Eu traduzi isso como `decidindo`. Não é —
-- decidindo é depois de testar, e ele nem viu o sistema ainda. O lugar dele
-- é `conversando`, igual ao Petterson.
--
-- O contador de toque fica como está: mexer nele agora seria inventar outro
-- número sem base.
--
-- Idempotente.
-- =============================================================

update vendas_leads
   set estado = 'conversando',
       proximo_em = current_date
 where lower(nome) = 'joão paulo'
   and estado = 'decidindo';

-- ---------- conferência
-- select nome, estado, toque, proximo_em from vendas_leads
--  where lower(nome) = 'joão paulo';

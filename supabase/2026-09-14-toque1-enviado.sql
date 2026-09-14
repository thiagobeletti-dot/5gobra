-- =============================================================
-- G Obra — registra o toque 1 dos 20 enviados no Direct em 14/09/2026
-- =============================================================
-- O Thiago disparou a mensagem da importação (Wvetro/CEM) pra 20 contatos
-- do Instagram. Print da caixa de entrada às 16:42.
--
-- A maioria não estava no funil — vieram da lista grande do Direct, não do
-- Tier 1. Então aqui acontecem duas coisas: quem não existia é criado já
-- com o toque 1 dado, e quem já existia recebe o registro sem mudar de
-- estado (quem estava em Conversando continua em Conversando: ele já tinha
-- respondido antes, e mandar conteúdo não desfaz isso).
--
-- Prazo do próximo: +2 dias, que é o espaçamento do toque 1 pro 2.
-- Idempotente.
-- =============================================================

-- ---------- 1) os que ainda não estavam no funil
insert into vendas_leads
  (nome, instagram, canal, origem, estado, toque, proximo_em,
   ultimo_contato_em, resumo, gancho)
select v.* from (values
 ('Ponto Firme Vidros',      'ponto_firmevidros'),
 ('SS Vidraçaria',           'ss__vidracaria'),
 ('Marcelo Vianna',          'marcevnna'),
 ('Inova Esquadrias',        'inovaesquadrias'),
 ('Luxs Glass',              'luxs_glass'),
 ('Spurio Esquadrias',       'spurioesquadrias'),
 ('ProGlass Esquadrias',     'proglass_esquadrias'),
 ('Bruno Samuel',            'brunooliveiray'),
 ('Estevan Henn',            'estevanhennn'),
 ('Filipe Cabral',           'filipearaujoc'),
 ('Silva Telas Mosquiteiras','silvatelasmosquiteiras'),
 ('VM Esquadrias',           'vmvidroseesquadrias'),
 ('Vini Fin Esquadrias',     'vinifinesquadrias'),
 ('Vidraçaria Santa Luzia',  'vidracariasantaluzia'),
 ('Campglass',               'campglass_'),
 ('Viana Esquadrias',        'viana_esquadrias'),
 ('Alframe Alumínio',        'alframealuminio'),
 ('Lucas Ferraz',            'lucasferraz_fs')
) as t(nome, instagram)
cross join lateral (values (
  t.nome, t.instagram, 'instagram', 'direct', 'cadencia', 1,
  current_date + 2, now(),
  'Toque 1 (importação Wvetro/CEM) enviado em 14/09/2026.',
  'Veio da lista grande do Direct, não do Tier 1.'
)) as v(nome, instagram, canal, origem, estado, toque, proximo_em,
        ultimo_contato_em, resumo, gancho)
where not exists (
  select 1 from vendas_leads l
   where lower(l.instagram) = lower(t.instagram) or lower(l.nome) = lower(t.nome)
);

-- ---------- 2) quem já estava no funil: registra sem mudar de estado
-- Anderson Dudek e Nobreline já tinham respondido antes; mandar conteúdo
-- não os devolve pra cadência fria.
update vendas_leads
   set toque = greatest(toque, 1),
       proximo_em = current_date + 2,
       ultimo_contato_em = now(),
       mensagem_proxima = null,
       resumo = coalesce(resumo, '') || ' · Toque 1 (importação) enviado em 14/09.'
 where lower(instagram) in ('andersonmigueldudek','nobrelineesquadrias');

-- ---------- 3) histórico: uma linha por envio
insert into vendas_toques (lead_id, numero, tipo, canal, direcao, conteudo)
select l.id, 1, 'texto', 'instagram', 'enviado',
       'Toque 1 — importação do orçamento (Wvetro/CEM), link raiox.5gobra.com.br/?quem=t1#e1'
  from vendas_leads l
 where lower(l.instagram) in (
   'ponto_firmevidros','ss__vidracaria','andersonmigueldudek','marcevnna',
   'inovaesquadrias','luxs_glass','spurioesquadrias','proglass_esquadrias',
   'brunooliveiray','estevanhennn','filipearaujoc','silvatelasmosquiteiras',
   'vmvidroseesquadrias','vinifinesquadrias','vidracariasantaluzia','campglass_',
   'nobrelineesquadrias','viana_esquadrias','alframealuminio','lucasferraz_fs')
   and not exists (
     select 1 from vendas_toques t
      where t.lead_id = l.id and t.numero = 1 and t.direcao = 'enviado'
   );

-- ---------- conferência
-- select count(*) from vendas_leads;
-- select nome, estado, toque, proximo_em from vendas_leads where toque >= 1 order by nome;

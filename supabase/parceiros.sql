-- ============================================================
-- G Obra — Estrutura de indicacao por parceiros (afiliados) MVP
--
-- Cada parceiro tem um slug em kebab-case que vai no link rastreavel:
--   https://5gobra.com.br/?ref={slug}
--
-- A Edge Function `comprar-publico` captura o ?ref= da URL e salva
-- em pre_cadastros.ref_parceiro. A view abaixo cruza tudo.
--
-- Modelo de comissao no MVP: padrao_60_60_200
--   R$ 60 quando cliente paga a 1a mensalidade
--   R$ 60 quando cliente paga a 2a mensalidade
--   R$ 200 de bonus se trouxer 5+ vendas em 60 dias
--   Total por venda recorrente: R$ 120
--
-- Comissao SOMENTE pra pagantes confirmados. Se cliente cancelar
-- na garantia de 14 dias, ninguem recebe.
--
-- Atribuicao: last-touch, janela de 30 dias. Indicacao de boca
-- pode ser editada manualmente em pre_cadastros.ref_parceiro
-- antes do pagamento.
--
-- Documentacao completa em vault: Projetos/Lancamento G-Obra/Afiliados.md
--
-- Idempotente — pode rodar varias vezes.
-- ============================================================

-- 1) Tabela de cadastro
create table if not exists public.parceiros (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  nome text not null,
  contato text,
  comissao_modelo text not null default 'padrao_60_60_200',
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  constraint parceiros_slug_kebab check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.parceiros is 'Cadastro de parceiros que indicam G-Obra via link rastreavel ?ref={slug}';
comment on column public.parceiros.slug is 'Identificador no link: 5gobra.com.br/?ref={slug}. kebab-case (a-z, 0-9, -).';
comment on column public.parceiros.comissao_modelo is 'MVP: padrao_60_60_200 = R$60 1a mensalidade + R$60 2a + R$200 bonus por 5 vendas em 60 dias.';

-- 2) Index pra acelerar o lookup de pre_cadastros.ref_parceiro
create index if not exists idx_pre_cadastros_ref_parceiro
  on public.pre_cadastros (ref_parceiro)
  where ref_parceiro is not null;

-- 3) RLS — so service role le. Quando criar painel pro parceiro
--    (Fase 3, ver Afiliados.md na vault), adicionar policy.
alter table public.parceiros enable row level security;

-- 4) View pronta de consulta
create or replace view public.vw_vendas_por_parceiro as
select
  p.nome as parceiro,
  p.slug,
  pc.email as cliente_email,
  pc.whatsapp as cliente_whatsapp,
  pc.created_at as lead_criado_em,
  pc.pago_em,
  pc.convertido_em,
  a.status as status_assinatura,
  a.id as assinatura_id
from public.parceiros p
left join public.pre_cadastros pc on pc.ref_parceiro = p.slug
left join public.assinaturas a on a.empresa_id = pc.empresa_id
where p.ativo = true
order by pc.created_at desc nulls last;

comment on view public.vw_vendas_por_parceiro is 'Para ver vendas por parceiro: select * from vw_vendas_por_parceiro;';

notify pgrst, 'reload schema';

-- Feature: toggle "medição pelo sistema" por obra.
-- Quando false, a medição (M1/M2) vira opcional: a empresa não é obrigada a
-- preencher os formulários e pode mover os cards livremente pelas abas.
-- Opt-in por padrão LIGADO (true) — zero impacto nas obras existentes.
alter table obras
  add column if not exists medicao_sistema boolean not null default true;

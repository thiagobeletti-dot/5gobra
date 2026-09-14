-- =============================================================
-- G Obra — mensagem sob medida por lead + correções
-- =============================================================
-- Três coisas, todas achadas pelo Thiago usando o sistema em 14/09/2026:
--
--   1. Ele abriu o Petterson e NÃO TINHA MENSAGEM. Motivo: a tela só
--      mostrava texto pra quem estava em Novo/Em cadência, e 7 dos 10
--      atrasados estão em Conversando. Ou seja, ele abria pra trabalhar e
--      a maioria dos cards não dava nada pra mandar.
--      Correção: coluna `mensagem_proxima`, que vale em qualquer estado.
--
--   2. Ele clicou em "Avançar" e o Petterson pulou pra Testando sem ter
--      criado conta. O botão foi corrigido no código (diz pra onde vai e
--      pede confirmação); aqui devolvemos o Petterson pro lugar.
--
--   3. (só código) O banner de "assine o G Obra" aparecia pra ele, dono.
--
-- Idempotente.
-- =============================================================

alter table vendas_leads
  add column if not exists mensagem_proxima text;

comment on column vendas_leads.mensagem_proxima is
  'Texto pronto pra mandar PARA ESTE lead. Marcadores: {nome}, raiox.5gobra.com.br/?quem=t1#e1, {whats}. Some sozinho depois que o toque é registrado.';


-- ---------- 1b) A VIEW PRECISA SER RECRIADA
-- vendas_fila foi criada com "select l.*", e o Postgres congela a lista de
-- colunas no momento da criação. Sem recriar, a coluna nova existe na tabela
-- mas NÃO aparece pra tela — que lê da view. Rodaria tudo e continuaria sem
-- mensagem nenhuma. Pego em 14/09/2026 testando antes de entregar.
drop view if exists vendas_fila;
create view vendas_fila
with (security_invoker = on)
as
select
  l.*,
  (l.proximo_em - current_date)                      as dias,
  (l.proximo_em is not null and l.proximo_em <= current_date) as na_fila,
  case
    when l.estado in ('cliente','perdido')                       then null
    when l.proximo_em is null                                    then null
    when l.proximo_em <  current_date                            then 'atrasado'
    when l.proximo_em =  current_date                            then 'hoje'
    else 'em_dia'
  end                                                as situacao,
  (l.estado not in ('novo','cadencia'))              as e_conversa_fria,
  (select count(*) from vendas_toques t where t.lead_id = l.id) as qtd_toques
from vendas_leads l;

-- ---------- 2) desfaz o avanço acidental
update vendas_leads
   set estado = 'conversando',
       proximo_em = current_date
 where lower(nome) = 'petterson gustavo'
   and estado = 'testando';

-- ---------- 3) a mensagem de abertura, aprovada pelo Thiago em 14/09
-- Todos os dez recebem o mesmo corpo. O que muda é a PRIMEIRA LINHA de quem
-- já conversou: chegar com "olá, tudo bem?" em quem te fez uma pergunta
-- semana passada soa como se você tivesse esquecido dele.
update vendas_leads set mensagem_proxima =
'{nome}, você faz seus orçamentos no Wvetro ou no CEM?

Se sim, você joga o PDF do orçamento no G Obra e ele vira card pro seu gerenciamento — peça por peça, com medida, vidro e cor.

Dá uma olhada, não precisa cadastrar nada:
raiox.5gobra.com.br/?quem=t1#e1

E se quiser, me chama no WhatsApp que eu te mostro rodando:
{whats}'
where lower(nome) in ('vagner','guto milan','fernando','rafael arambrul',
                      'petterson gustavo','eduardo de padua','sene esquadrias');

-- Gfends: ele parou porque ouviu que precisava contratar pra testar. Hoje
-- isso está errado, e corrigir é o melhor motivo de mensagem da lista.
update vendas_leads set mensagem_proxima =
'{nome}, voltando naquela dúvida sua: hoje o teste é grátis por 14 dias e NÃO pede cartão. Mudou depois que a gente falou.

E sobre começar: você joga o PDF do orçamento do Wvetro ou do CEM no G Obra e ele vira card, peça por peça.

raiox.5gobra.com.br/?quem=t1#e1

Se quiser, me chama que eu te mostro rodando: {whats}'
where lower(nome) = 'gfends';

-- Mikael: pediu vídeo de demonstração em 19/08 e não existia.
update vendas_leads set mensagem_proxima =
'{nome}, você tinha me pedido um vídeo mostrando o sistema. Ficou melhor que vídeo: montei uma página que mostra tela por tela.

Começa pela parte que mais trava todo mundo — a obra entrar no sistema sem ninguém digitar:
raiox.5gobra.com.br/?quem=t1#e1

Qualquer coisa me chama: {whats}'
where lower(nome) = 'mikael batista';

-- Sidinei: a conversa morreu numa pergunta que o Thiago fez.
update vendas_leads set mensagem_proxima =
'{nome}, ficou faltando você me dizer quantas obras vocês tocam hoje — e eu sumi também, desculpa.

Enquanto isso, dá uma olhada em como a obra entra no sistema sem ninguém digitar peça por peça:
raiox.5gobra.com.br/?quem=t1#e1

Se preferir, a gente fala por aqui mesmo: {whats}'
where lower(nome) = 'sidinei';

-- João Paulo: já disse que quer ver. Não precisa de conteúdo, precisa de data.
update vendas_leads set mensagem_proxima =
'{nome}, você tinha me falado que queria ver o sistema. Bora marcar?

São 20 minutos e eu subo uma obra sua junto com você — não é apresentação, é a sua obra na tela.

Me diz um dia e horário que funcione: {whats}'
where lower(nome) = 'joão paulo';

-- ---------- 4) o Tier 2 leva o mesmo corpo
-- Eles também estão na fila de hoje. Sem isso, o Thiago abre amanhã e cai no
-- mesmo card vazio que o fez reclamar hoje.
update vendas_leads set mensagem_proxima =
'{nome}, você faz seus orçamentos no Wvetro ou no CEM?

Se sim, você joga o PDF do orçamento no G Obra e ele vira card pro seu gerenciamento — peça por peça, com medida, vidro e cor.

Dá uma olhada, não precisa cadastrar nada:
raiox.5gobra.com.br/?quem=t1#e1

E se quiser, me chama no WhatsApp que eu te mostro rodando:
{whats}'
where mensagem_proxima is null
  and estado not in ('cliente','perdido','gelado');


-- ---------- conferência
-- select nome, estado, left(mensagem_proxima, 40) from vendas_leads
--  where mensagem_proxima is not null order by nome;

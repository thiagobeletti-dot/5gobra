-- =============================================================
-- G Obra — carga inicial dos leads na máquina de venda
-- =============================================================
-- Origem dos dados:
--   - 13 prints de conversas do WhatsApp, mandados pelo Thiago em 10/09/2026
--   - planilha contatos_direct_raiox.xlsx (127 contatos do Direct, 10/09/2026)
--
-- Critério do corte, conferido com ele em 11/09:
--   TIER 1  conversa com assunto em aberto — entra na fila hoje
--   TIER 2  interesse real, sinal mais fraco — entra daqui a 3 dias, pra não
--           afogar os primeiros dias e estourar o teto do Instagram
--
-- Ficaram FORA, por decisão dele:
--   - contas do próprio Thiago (Tatiana, Marli, Fabricadaesquadria, Giba)
--   - prospecção errada de 2024 (MAV, Esquad System, Filipe Cabral, Estevan)
--   - ~90 contatos cuja última mensagem é só curtida ou emoji
--
-- Idempotente: roda quantas vezes quiser, não duplica (on conflict do nothing
-- nos índices únicos de telefone e instagram).
-- =============================================================

-- Por que não é um INSERT ... VALUES direto:
-- o índice único é PARCIAL (só vale quando tem telefone ou @). O Mikael não
-- tem nenhum dos dois, então "on conflict do nothing" não o protegia e ele
-- entrou duas vezes quando rodei o script duas vezes. Aqui a trava é por
-- NOME, que cobre inclusive quem não tem contato ainda.
insert into vendas_leads
  (nome, empresa, telefone, instagram, cidade, canal, origem, estado, toque,
   proximo_em, passou_pela_giulia, resumo, gancho)
select v.* from (values
-- ---------------------------------------------- TIER 1 — falar essa semana
('Vagner', null, '5511972250378', null, null, 'whatsapp', 'direct', 'novo', 0,
 current_date, true,
 'Escreveu "Vim do Instagram. Quero conhecer o G Obra" em 28/08. Respondido pela Giulia, sem retorno humano.',
 'Digitou o nome do produto e falou com o atendimento. Um contato seu, de gente, vale mais que a sequência inteira.'),

('Guto Milan', null, '5516997788201', null, null, 'whatsapp', 'direct', 'novo', 0,
 current_date, true,
 'Escreveu "Vim do Instagram. Quero conhecer o G Obra" em 29/08. Respondido pela Giulia.',
 'Mesmo caso do Vagner: levantou a mão e foi atendido pelo automático.'),

('Fernando', null, '5511978886251', null, null, 'whatsapp', 'direct', 'novo', 0,
 current_date, true,
 'Escreveu "Vim do Instagram. Quero conhecer o G Obra". A Giulia respondeu e mandou o vídeo do YouTube.',
 'Recebeu vídeo genérico. A página nova mostra tela por tela e ainda mede se ele abriu.'),

('Gfends', 'Gfends Esquadrias de Alumínio', '5511947845189', null, null, 'whatsapp', 'direct', 'conversando', 1,
 current_date, false,
 'Em 28/07 perguntou "Precisa contratar pra fazer o teste?" e ouviu que sim, com garantia de devolução. Parou aí.',
 'A resposta MUDOU: hoje são 14 dias grátis sem cartão. É correção de informação, não follow-up.'),

('Mikael Batista', 'MP Esquadrias', null, null, null, 'whatsapp', 'direct', 'conversando', 2,
 current_date, false,
 'Vários áudios em 18/08. Disse "Ajuda muito" e "Vou analisar sim". No dia 19 pediu vídeo de demonstração do sistema.',
 'Pediu demonstração quando não existia. Agora existe.'),

('Sidinei', null, '5514997141702', null, null, 'whatsapp', 'direct', 'conversando', 2,
 current_date, false,
 'Em 28/08 confirmou interesse no G Obra e aceitou explicação por WhatsApp. Thiago perguntou quantas obras tocam e a conversa parou.',
 'Retomar exatamente na pergunta que ficou sem resposta.'),

('João Paulo', 'Grupo Verginassi', '5519989584060', 'grupoverginassi', null, 'whatsapp', 'direct', 'decidindo', 3,
 current_date, false,
 'Thiago falou com ele em 22/08/2026 e ele disse que QUER VER O SISTEMA. No Direct, em 2024, já tinha dito "Vou ir conhecer o sistema de vcs".',
 'Não precisa de gancho: ele já pediu. É marcar a demo.'),

('Rafael Arambrul', null, null, 'rafael.arambrul', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date, false,
 'Respondeu "Aproximadamente 15" quando perguntado quantas obras toca. Recebeu o raio-x em 04/09 e não voltou.',
 'Único que se qualificou sozinho: 15 obras é exatamente o tamanho de cliente do G Obra.'),

('Petterson Gustavo', null, null, 'pettersongustavo', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date, false,
 'Respondeu "O conjunto, organização de obra e o...". Recebeu o raio-x em 04/09 e não voltou.',
 'Nomeou a dor com as palavras dele: organização de obra.'),

('Eduardo De Padua', null, null, 'eduardodepadua', null, 'instagram', 'direct', 'conversando', 1,
 current_date, false,
 'A última mensagem dele é literalmente "G obra". Recebeu o raio-x e não voltou.',
 'Escreveu o nome do produto. Não é curiosidade genérica.'),

-- ---------------------------------------------- TIER 2 — entra em 3 dias
('Anderson Dudek', null, null, 'andersonmigueldudek', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date + 3, false,
 'Respondeu "Os dois mas a parte de organizar a..." em 28/08.', 'Nomeou a dor.'),

('Batele Vidros e Esquadrias', null, null, 'batelevidros', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date + 3, false, 'Respondeu "Organização da obra" em 31/08.', 'Disse a dor em três palavras.'),

('Durand Esquadrias', null, null, 'durand.esquadrias', 'São José do Rio Preto', 'instagram', 'comentou_video', 'conversando', 1,
 current_date + 3, false, 'Respondeu "As duas coisas" em 28/08.', 'Respondeu a pergunta de qualificação.'),

('Jose Luis Lopes', null, null, 'joseluislopes1910', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date + 3, false, 'Respondeu "Tudo no geral" em 28/08.', 'Respondeu, mas genérico — precisa de uma pergunta melhor.'),

('José Rafael', null, null, 'nunesarrieta', null, 'instagram', 'direct', 'conversando', 1,
 current_date + 3, false, 'Escreveu "Bom dia, poderia me passar mais informações" em 29/08.', 'Pediu informação e nunca recebeu nada sob medida.'),

('Fabriano Klaumann', null, null, 'fabrianoklaumann', 'Curitiba', 'instagram', 'direct', 'conversando', 1,
 current_date + 3, false, 'Perguntou "Vocês tem clientes em Curitiba?" em 26/03.', 'Pergunta de quem avalia comprar, não de curioso.'),

('Paulo', 'Johta Vidros e Esquadrias', null, 'paulo_johta_vidros_esquadrias', null, 'instagram', 'direct', 'conversando', 1,
 current_date + 3, false, 'Escreveu "Como conseguir" em 27/08.', 'Perguntou como adquirir e ficou sem resposta prática.'),

('Federal Esquadrias', null, null, 'federalesquadrias', 'Vale do Aço', 'instagram', 'direct', 'conversando', 1,
 current_date + 3, false,
 'O ÚNICO dos 120 que se manifestou depois do raio-x — por ligação de WhatsApp, em 05/09.',
 'É o único sinal positivo de toda a campanha do raio-x. Merece contato direto.'),

('LCK Esquadrias', null, null, 'lckesquadrias', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date + 3, false, 'Respondeu com dúvida sobre o produto em 04/09. Não chegou a receber o raio-x.', 'Ficou com dúvida sem resposta.'),

('World Vidros', 'World Vidros', null, 'world.vidros', null, 'instagram', 'direct', 'conversando', 1,
 current_date + 3, false, 'Gabriel Nunciaroni respondeu se apresentando em 05/09, mesmo dia do raio-x.', 'Se apresentou e não teve continuidade.'),

('Nobreline Esquadrias', null, null, 'nobrelineesquadrias', null, 'instagram', 'direct', 'conversando', 1,
 current_date + 3, false, 'Respondeu "Ainda dá pra melhorar, estamos no ca..." em 12/03.', 'Admitiu que dá pra melhorar — é abertura.'),

('Diego Nascimento', null, null, 'diegonascimento', null, 'instagram', 'comentou_video', 'conversando', 1,
 current_date + 3, false, 'Houve ligação de WhatsApp.', 'Já falou por voz, é mais quente que texto.'),

('Alexsandro Leitzke', null, '5547917639163', null, null, 'whatsapp', 'anuncio', 'conversando', 2,
 current_date + 3, false,
 'Em 18/08 pediu pra saber mais do produto. Perguntado se era sistema ou perfil, respondeu "Sobre tudo". Ficaram só nos áudios.',
 'Quis saber de tudo e não ficou com nada pra ver depois.'),

('Gustavo', null, '5554993560900', null, null, 'whatsapp', 'direct', 'conversando', 1,
 current_date + 3, false,
 'Em 30/07 pediu mais informações do sistema. Recebeu convite pra reunião e sumiu.',
 'Pediu informação e recebeu pedido de reunião — pular etapa trava.'),

('Sene Esquadrias', 'Sene Esquadrias Personalizadas', '5534997773480', null, null, 'whatsapp', 'direct', 'novo', 0,
 current_date + 3, false,
 'Mandou "Olá" às 19:33 de 19/08 e recebeu "Boa noite" às 20:20. Nunca virou conversa.',
 'Na prática nunca houve conversa — é primeiro contato, não retomada.')
) as v(nome, empresa, telefone, instagram, cidade, canal, origem, estado, toque,
       proximo_em, passou_pela_giulia, resumo, gancho)
where not exists (
  select 1 from vendas_leads l where lower(l.nome) = lower(v.nome)
);


-- =============================================================
-- CONFERÊNCIA — rode depois e confira os números
-- =============================================================
-- select estado, count(*) from vendas_leads group by estado order by 1;
-- select nome, estado, toque, dias, situacao from vendas_fila where na_fila order by dias;

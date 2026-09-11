-- =============================================================
-- G Obra — texto dos 7 toques da cadência
-- =============================================================
-- Sem isso a tela mostra "mensagem ainda não escrita" e a máquina não
-- serve pra nada no dia a dia.
--
-- Escritas curtas de propósito. Thiago, 11/09/2026: "suas msgs estão longas
-- demais, lead frio não lê muito". Cada uma cabe na tela do celular sem
-- rolar, e termina no link.
--
-- É SÓ UPDATE: dá pra rodar de novo depois de editar, e dá pra editar
-- direto na tabela sem deploy nenhum.
-- =============================================================

update vendas_cadencia set mensagem =
'{nome}, aqui é o Thiago da 5G. Tenho fábrica de esquadria há 16 anos.

Vou te mandar nos próximos dias uma coisa por vez que o G Obra resolve dentro da fábrica. Sem responder nada, só olhar.

A primeira é a que mais trava todo mundo: começar.'
where numero = 1;

update vendas_cadencia set mensagem =
'{nome}, essa é a que mais me incomodava na minha fábrica.

Você só sabe o que aconteceu na obra quando o funcionário volta.

No G Obra o técnico registra na hora, pelo celular, com foto obrigatória do vão. A tela dele é essa:'
where numero = 2;

update vendas_cadencia set mensagem =
'O técnico foi na obra e o vão não estava liberado.

No WhatsApp isso vira foto perdida no meio de 300 mensagens. No G Obra vira registro com data, foto e autor — e o prazo nem começa a contar.

Na hora da cobrança, a conta não sobra pra você:'
where numero = 3;

update vendas_cadencia set mensagem =
'{nome}, essa costuma ser a preferida.

Cada obra tem um link só dela pro seu cliente. Ele vê peça por peça, sem app e sem senha.

E acordo fica registrado com valor e aprovação. Você não discute mais — você abre:'
where numero = 4;

update vendas_cadencia set mensagem =
'"Está atrasado" é sensação. Quando vira número, já é tarde.

No G Obra o prazo conta sozinho a partir do gatilho certo e mostra o estouro antes dele acontecer.

E aproveito pra ser honesto: se não for pra você, me diz que eu paro. Sem ressentimento.'
where numero = 5;

update vendas_cadencia set mensagem =
'{nome}, pergunta difícil: quanto sua fábrica produziu esse mês, e quanto foi instalado?

São duas contas diferentes, e é a distância entre elas que mostra onde está o gargalo.

No G Obra as duas ficam na tela, atualizadas sozinhas:'
where numero = 6;

update vendas_cadencia set mensagem =
'{nome}, esse é o último que eu te mando.

Se alguma dessas coisas resolveria um problema seu, me deixa te mostrar rodando: 20 minutos, eu subo uma obra sua junto com você.

Se não for a hora, sem problema — paro por aqui e fico à disposição.'
where numero = 7;

-- conferência
-- select numero, titulo, left(mensagem, 50) as inicio from vendas_cadencia order by numero;

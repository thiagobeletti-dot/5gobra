// Contratos do G Obra — fonte unica de verdade
//
// Os textos abaixo sao usados em 3 lugares:
//   1. /cadastro (etapa 2) — usuario le e aceita antes de criar a conta
//   2. /termos e /privacidade — paginas publicas pra clientes existentes
//      relerem a qualquer momento
//   3. /app/configuracoes — bloco "Contratos aceitos" mostra a versao que
//      cada empresa aceitou (usando o snapshot gravado em aceites.documento_snapshot)
//
// Quando atualizar:
//   - editar DOC_TERMOS_USO ou DOC_POLITICA_PRIVACIDADE
//   - bumpar TERMOS_VERSAO ou PRIVACIDADE_VERSAO (ex: '1.0' -> '1.1')
//   - hash SHA-256 e recalculado automaticamente em hashSha256()
//   - aceites antigos ficam preservados com o hash da versao que foi aceita
//
// Documentos foram redigidos em 06/05/2026 com fundamento em LGPD (13.709/2018),
// Marco Civil (12.965/2014), CDC (8.078/1990), Decreto 7.962/2013, Lei do Software
// (9.609/1998), Lei de Direito Autoral (9.610/1998), MP 2.200-2/2001.
//
// Recomenda-se passada de revisao por advogado especializado em direito digital
// antes de escala >50 clientes.

export const TERMOS_VERSAO = '1.0'
export const PRIVACIDADE_VERSAO = '1.0'

export const DOC_TERMOS_USO = `TERMOS DE USO DO G OBRA — versao ${TERMOS_VERSAO}

Vigencia: 06/05/2026
Contratada: 5G GERENCIAMENTO, com sede em Jundiai/SP, doravante "5G".
Plataforma: G Obra (5gobra.com.br).

1. DEFINICOES

1.1. G OBRA: software como servico (SaaS) disponibilizado em 5gobra.com.br que permite a CONTRATANTE registrar, organizar e formalizar a comunicacao entre ela e seus clientes finais durante a execucao de obras de esquadria e congeneres.

1.2. CONTRATANTE: pessoa juridica que adere a estes Termos por meio do cadastro na plataforma e contrata o servico para uso proprio.

1.3. USUARIO ADMINISTRADOR: pessoa fisica, vinculada a CONTRATANTE, titular do login que administra a conta da CONTRATANTE no G Obra. Cada assinatura comporta 1 (um) Usuario Administrador.

1.4. CLIENTE FINAL: pessoa fisica ou juridica contratante da CONTRATANTE, cuja obra e registrada e gerida no G Obra, e a quem a CONTRATANTE concede acesso por link magico para acompanhar o andamento da obra.

1.5. CONTEUDO DA CONTRATANTE: todo dado, texto, imagem, documento, anotacao ou informacao que a CONTRATANTE, seus tecnicos ou clientes finais inserem na plataforma.

1.6. PLANO: modalidade contratada pela CONTRATANTE, conforme tabela vigente em 5gobra.com.br/planos no momento da adesao.

2. OBJETO E ACEITE

2.1. Estes Termos regem a contratacao e o uso do G Obra pela CONTRATANTE.

2.2. Ao concluir o cadastro e marcar a opcao de aceite, a CONTRATANTE declara, por meio do seu Usuario Administrador, ter lido, compreendido e aceito integralmente estes Termos e a Politica de Privacidade, em versao e hash registrados eletronicamente, com forca de contrato escrito (Lei 10.406/2002, art. 425; MP 2.200-2/2001, art. 10, §2).

2.3. O aceite eletronico, com data, hora, IP, versao do documento e hash SHA-256 do conteudo aceito, e registrado em base de dados auditavel e pode ser fornecido a CONTRATANTE mediante solicitacao.

3. CADASTRO E CONTA

3.1. O cadastro requer e-mail valido, senha de no minimo 6 caracteres, nome empresarial e, opcionalmente, CNPJ e telefone.

3.2. A CONTRATANTE garante a veracidade das informacoes fornecidas e responsabiliza-se por mante-las atualizadas.

3.3. O acesso a conta e pessoal e intransferivel. O Usuario Administrador e o unico responsavel pela guarda das credenciais e por todas as acoes realizadas em sua conta.

3.4. A 5G recomenda o uso de senhas fortes e o nao compartilhamento de credenciais. Em caso de suspeita de uso nao autorizado, a CONTRATANTE deve trocar a senha imediatamente e comunicar a 5G.

3.5. Cada assinatura comporta 1 (um) Usuario Administrador. Acessos adicionais ocorrem exclusivamente por meio de links magicos a tecnicos e clientes finais, conforme funcionalidades da plataforma, sem que estes constituam usuarios administradores.

4. PLANO E PAGAMENTO

4.1. O plano vigente e cobrado em mensalidades, conforme valor publicado em 5gobra.com.br no momento da adesao. A versao deste contrato pressupoe o valor mensal de R$ 349,00 (trezentos e quarenta e nove reais), sem fidelidade, sem multa de cancelamento e sem carencia.

4.2. O pagamento e processado por gateway parceiro (Asaas), nas formas disponiveis (cartao de credito recorrente, boleto, PIX). A 5G nao armazena dados de cartao.

4.3. O ciclo de cobranca e mensal, com renovacao automatica enquanto a assinatura estiver ativa.

4.4. Eventuais reajustes de mensalidade serao comunicados com antecedencia minima de 30 (trinta) dias por e-mail. A CONTRATANTE pode cancelar a assinatura sem qualquer onus antes da entrada em vigor do reajuste.

4.5. Em caso de inadimplencia superior a 7 (sete) dias, a 5G podera suspender o acesso a plataforma apos notificacao por e-mail. Apos 60 (sessenta) dias de inadimplencia, a conta podera ser bloqueada e os dados marcados para exclusao conforme Clausula 11.

5. GARANTIA DE 14 (CATORZE) DIAS

5.1. A 5G oferece garantia incondicional de satisfacao durante os primeiros 14 (catorze) dias corridos contados da confirmacao do primeiro pagamento.

5.2. Para exercer a garantia, basta a CONTRATANTE solicitar o reembolso pelo canal oficial de suporte (WhatsApp), independentemente de justificativa. O valor pago e devolvido integralmente em ate 7 (sete) dias uteis, no mesmo meio de pagamento utilizado.

5.3. A garantia da Clausula 5.1 abrange tambem o direito de arrependimento previsto no art. 49 da Lei 8.078/1990 (CDC) e no Decreto 7.962/2013, quando aplicavel a CONTRATANTE pessoa fisica consumidora.

6. CANCELAMENTO E RENOVACAO

6.1. A CONTRATANTE pode cancelar a assinatura a qualquer momento, sem multa, diretamente pela plataforma ou por meio do canal oficial de suporte.

6.2. O cancelamento produz efeito imediato sobre a renovacao. Nao ha reembolso proporcional do periodo em curso, exceto na hipotese da Clausula 5 ou de descontinuidade do servico por iniciativa da 5G.

6.3. Apos o cancelamento, os dados da CONTRATANTE permanecem disponiveis para exportacao por 90 (noventa) dias, findos os quais podem ser definitivamente eliminados, conforme a Politica de Privacidade.

7. DIREITOS E OBRIGACOES DA CONTRATANTE

7.1. A CONTRATANTE compromete-se a:

a) utilizar a plataforma em conformidade com a legislacao vigente, em especial a LGPD (Lei 13.709/2018), o Marco Civil da Internet (Lei 12.965/2014) e a legislacao consumerista;

b) obter o consentimento ou apresentar outra base legal adequada perante seus clientes finais e tecnicos para o tratamento dos dados pessoais inseridos na plataforma, na qualidade de Controladora desses dados;

c) responder integralmente pelo Conteudo da Contratante e por sua adequacao a finalidade contratada;

d) nao inserir, transmitir ou armazenar conteudo ilicito, ofensivo, discriminatorio, que viole direitos de terceiros ou que configure crime;

e) manter a confidencialidade das credenciais de acesso;

f) nao realizar engenharia reversa, descompilacao, tentativas de exploracao de vulnerabilidades, scraping massivo ou qualquer acao que comprometa a integridade ou disponibilidade da plataforma.

7.2. E vedada a sublocacao, sublicenciamento, revenda ou cessao da assinatura a terceiros sem autorizacao previa e expressa da 5G.

8. DIREITOS E OBRIGACOES DA 5G

8.1. A 5G compromete-se a:

a) envidar esforcos razoaveis para manter a plataforma disponivel 24x7, ressalvadas paradas programadas, manutencao corretiva, eventos de forca maior e indisponibilidades de provedores de infraestrutura;

b) fornecer suporte tecnico no canal oficial (WhatsApp) em horario comercial (segunda a sexta, das 9h as 18h, exceto feriados);

c) proteger os dados pessoais tratados na plataforma conforme a Politica de Privacidade e a LGPD, na qualidade de Operadora;

d) comunicar previamente, com antecedencia minima de 30 (trinta) dias, alteracoes que afetem materialmente o servico contratado.

8.2. A 5G podera realizar atualizacoes, correcoes e melhorias na plataforma a qualquer tempo, com objetivo de aprimorar o servico, sem que tais mudancas configurem alteracao do objeto contratual.

9. PROPRIEDADE INTELECTUAL

9.1. O software, o nome G Obra, o nome 5G, as marcas, logotipos, layouts, codigo-fonte, banco de dados estrutural e demais elementos da plataforma sao de propriedade exclusiva da 5G ou de seus licenciadores, protegidos pela Lei 9.609/1998, pela Lei 9.610/1998 e por tratados internacionais.

9.2. O presente contrato concede a CONTRATANTE licenca nao-exclusiva, intransferivel e revogavel de uso da plataforma, restrita ao periodo de vigencia da assinatura e a finalidade prevista nestes Termos.

9.3. O Conteudo da Contratante permanece de titularidade da CONTRATANTE. A 5G recebe licenca limitada de uso do Conteudo da Contratante apenas para os fins de operar, hospedar e dar suporte a plataforma.

9.4. Sugestoes, comentarios e feedbacks enviados pela CONTRATANTE poderao ser livremente utilizados pela 5G no aprimoramento do produto, sem qualquer onus.

10. LIMITACAO DE RESPONSABILIDADE

10.1. A 5G nao se responsabiliza por:

a) decisoes comerciais, tecnicas ou juridicas tomadas pela CONTRATANTE com base em informacoes registradas na plataforma;

b) perdas decorrentes do uso indevido das credenciais de acesso pela CONTRATANTE ou por terceiros autorizados por ela;

c) insercao de informacoes incorretas pela CONTRATANTE, seus tecnicos ou clientes finais;

d) indisponibilidades resultantes de forca maior, caso fortuito, falhas de provedores de infraestrutura ou de internet;

e) lucros cessantes, danos indiretos, morais ou reflexos decorrentes do uso ou da impossibilidade de uso da plataforma, ressalvada a hipotese de dolo ou culpa grave.

10.2. Em qualquer hipotese, a responsabilidade total e agregada da 5G perante a CONTRATANTE limita-se ao valor efetivamente pago pela CONTRATANTE nos 12 (doze) meses imediatamente anteriores ao evento que originou a responsabilizacao.

11. SUSPENSAO E RESCISAO

11.1. A 5G podera suspender o acesso ou rescindir a assinatura, mediante comunicacao previa, nos casos de:

a) inadimplencia, conforme Clausula 4.5;
b) violacao destes Termos ou da legislacao aplicavel;
c) uso da plataforma para fins ilicitos ou que coloque em risco terceiros, a integridade do servico ou a reputacao da 5G;
d) ordem judicial ou determinacao de autoridade competente.

11.2. Apos a rescisao, observa-se o disposto na Clausula 6.3 quanto a preservacao e eliminacao dos dados.

11.3. A CONTRATANTE pode rescindir a assinatura unilateralmente, a qualquer tempo, conforme Clausula 6.1.

12. CONFIDENCIALIDADE

12.1. Cada parte compromete-se a manter sigilo sobre informacoes confidenciais a que tenha acesso em razao deste contrato, utilizando-as apenas para os fins contratuais e respondendo perante a outra parte por seu uso indevido.

12.2. A obrigacao de confidencialidade subsiste por 5 (cinco) anos apos o termino da relacao contratual.

12.3. Nao se enquadram como confidenciais informacoes de dominio publico, conhecidas previamente pela parte recebedora ou desenvolvidas independentemente.

13. COMUNICACOES

13.1. As comunicacoes relativas a este contrato sao realizadas preferencialmente por e-mail (para o endereco cadastrado pela CONTRATANTE) e pelo canal oficial de suporte (WhatsApp).

13.2. Notificacoes dirigidas a 5G devem ser enviadas para suporte@5gobra.com.br ou pelo canal oficial WhatsApp.

13.3. A CONTRATANTE responsabiliza-se por manter o e-mail cadastrado atualizado.

14. ALTERACOES DOS TERMOS

14.1. A 5G podera alterar estes Termos a qualquer tempo, mediante comunicacao previa por e-mail e indicacao da nova versao na plataforma, com antecedencia minima de 30 (trinta) dias para alteracoes materiais.

14.2. A continuidade do uso da plataforma apos a entrada em vigor da nova versao importa em aceite tacito. A CONTRATANTE que nao concordar com a nova versao podera rescindir a assinatura sem onus, conforme Clausula 6.

14.3. Cada versao destes Termos e mantida em arquivo proprio, com hash SHA-256, possibilitando a CONTRATANTE consultar a integra do texto vigente em cada momento de aceite.

15. DISPOSICOES GERAIS

15.1. Caso qualquer clausula destes Termos seja considerada invalida ou inexequivel, as demais permanecem em pleno vigor.

15.2. A tolerancia de uma parte com relacao ao descumprimento de obrigacao pela outra nao importa em renuncia ou novacao.

15.3. Estes Termos representam o entendimento integral entre as partes, prevalecendo sobre quaisquer ajustes anteriores, verbais ou escritos, sobre o mesmo objeto.

15.4. A relacao juridica estabelecida entre as partes e de prestacao de servico de software, sem carater de relacao trabalhista, societaria ou de mandato.

16. LEI APLICAVEL E FORO

16.1. Estes Termos regem-se pelas leis da Republica Federativa do Brasil.

16.2. Fica eleito o foro da Comarca de Jundiai/SP para dirimir controversias decorrentes deste contrato, com renuncia a qualquer outro, por mais privilegiado que seja, ressalvado o direito do consumidor pessoa fisica de optar pelo foro do seu domicilio (CDC, art. 101, I).

5G GERENCIAMENTO — suporte@5gobra.com.br
Documento versao ${TERMOS_VERSAO} — 06/05/2026`

export const DOC_POLITICA_PRIVACIDADE = `POLITICA DE PRIVACIDADE DO G OBRA — versao ${PRIVACIDADE_VERSAO}

Vigencia: 06/05/2026
Operadora: 5G GERENCIAMENTO, com sede em Jundiai/SP, doravante "5G".
Plataforma: G Obra (5gobra.com.br).

Esta Politica de Privacidade descreve como a 5G coleta, utiliza, armazena, compartilha e protege os dados pessoais tratados no G Obra, em estrita observancia a Lei 13.709/2018 (LGPD), a Lei 12.965/2014 (Marco Civil da Internet) e a legislacao correlata.

1. DEFINICOES (LGPD, art. 5)

1.1. Dado pessoal: informacao relacionada a pessoa natural identificada ou identificavel.
1.2. Dado pessoal sensivel: dado pessoal sobre origem racial ou etnica, conviccao religiosa, opiniao politica, filiacao a sindicato, dado referente a saude, vida sexual, dado genetico ou biometrico.
1.3. Tratamento: toda operacao realizada com dados pessoais.
1.4. Titular: pessoa natural a quem se referem os dados pessoais.
1.5. Controlador: pessoa a quem competem as decisoes referentes ao tratamento de dados pessoais.
1.6. Operador: pessoa que realiza o tratamento de dados pessoais em nome do controlador.
1.7. Encarregado (DPO): canal de comunicacao entre o controlador, os titulares e a ANPD.

2. PAPEIS DAS PARTES — OPERADOR E CONTROLADOR

2.1. A 5G atua em duas qualidades distintas:

a) Como CONTROLADORA, em relacao aos dados pessoais coletados diretamente da CONTRATANTE e do seu Usuario Administrador (cadastro, faturamento, suporte). Cabe a 5G definir finalidades e bases legais para esses dados.

b) Como OPERADORA, em relacao aos dados pessoais que a CONTRATANTE insere ou faz circular pela plataforma sobre seus clientes finais, tecnicos e demais participantes da obra. Nesse caso, a CONTRATANTE e a CONTROLADORA, definindo as finalidades, as bases legais e respondendo perante os titulares.

2.2. A 5G, na qualidade de Operadora, trata dados conforme instrucoes da CONTRATANTE Controladora, fornecidas pela operacao contratada da plataforma. A 5G nao utiliza tais dados para finalidades proprias estranhas ao contrato.

2.3. Em caso de incidente de seguranca envolvendo dados sob operacao, a 5G comunicara a CONTRATANTE Controladora em prazo razoavel, fornecendo as informacoes necessarias para que esta possa cumprir suas obrigacoes perante a ANPD e os titulares (LGPD, arts. 39, IV; 48).

3. DADOS COLETADOS

3.1. Dados da CONTRATANTE e do Usuario Administrador (5G como Controladora):

a) Cadastrais: nome empresarial, CNPJ (opcional), nome do administrador, e-mail, telefone (opcional);
b) De pagamento: gerenciados integralmente pelo Asaas (gateway parceiro). A 5G nao armazena dados de cartao de credito;
c) De acesso: endereco IP, registros de login, agente de usuario (browser/dispositivo), data e hora dos acessos (Marco Civil, art. 15);
d) De interacao: cliques, telas visitadas, recursos utilizados, mensagens enviadas pelo canal de suporte.

3.2. Dados inseridos pela CONTRATANTE na plataforma (5G como Operadora):

a) Sobre clientes finais: nome, telefone, e-mail, endereco da obra, observacoes;
b) Sobre tecnicos e demais colaboradores: nome, telefone, e-mail;
c) Sobre as obras: descricao, fotografias, anotacoes, historicos de comunicacao, datas, marcos contratuais;
d) Aceites e registros: data, hora, IP, hash do documento aceito por usuario administrador, tecnico ou cliente final.

3.3. A plataforma nao solicita ativamente dados pessoais sensiveis. Caso a CONTRATANTE opte por inserir tais dados, ela responde, na qualidade de Controladora, pelas obrigacoes reforcadas previstas na LGPD para essa categoria.

4. FINALIDADES DO TRATAMENTO

4.1. Os dados sao tratados para:

a) cadastro, autenticacao e administracao de contas;
b) processamento de pagamentos da assinatura;
c) prestacao dos servicos contratados (operacao do G Obra);
d) suporte tecnico, atendimento e cobranca;
e) cumprimento de obrigacoes legais e regulatorias;
f) prevencao a fraudes e seguranca da plataforma;
g) registro de aceites contratuais com valor probatorio;
h) melhoria do produto, com base em metricas agregadas e, quando aplicavel, anonimizadas;
i) comunicacoes operacionais e contratuais (avisos de cobranca, alteracoes nestes documentos, atualizacoes relevantes);
j) comunicacoes de marketing direto, exclusivamente apos consentimento especifico e mediante possibilidade de descadastramento simples.

5. BASES LEGAIS (LGPD, art. 7 e 11)

5.1. O tratamento de dados pelo G Obra fundamenta-se em:

a) execucao de contrato (art. 7, V): para operar a plataforma e cumprir o contratado pela CONTRATANTE;
b) cumprimento de obrigacao legal ou regulatoria (art. 7, II): inclusive guarda de logs prevista no Marco Civil;
c) legitimo interesse (art. 7, IX): para prevencao a fraudes, melhoria do produto e seguranca da plataforma, sempre observados os direitos e liberdades do titular;
d) consentimento (art. 7, I): apenas quando expressamente solicitado, como em comunicacoes de marketing direto;
e) exercicio regular de direitos (art. 7, VI): em eventuais demandas judiciais, administrativas ou arbitrais.

6. COMPARTILHAMENTO DE DADOS

6.1. A 5G nao comercializa nem compartilha dados pessoais com terceiros estranhos ao servico.

6.2. O compartilhamento ocorre apenas com:

a) Provedores de infraestrutura estritamente necessarios para a operacao da plataforma:
   - Supabase (banco de dados e autenticacao): infraestrutura hospedada em AWS, regiao Sao Paulo (sa-east-1), com criptografia em transito (TLS) e em repouso (AES-256);
   - Asaas (processamento de pagamentos);
   - Vercel (hospedagem do front-end);

b) Autoridades competentes, mediante ordem judicial, requisicao do Ministerio Publico ou de autoridade administrativa nos termos da legislacao aplicavel;

c) Outras pessoas vinculadas a mesma obra, no escopo da propria funcionalidade da plataforma — por exemplo, ao gerar um link magico, a CONTRATANTE compartilha o conteudo da obra com o cliente final ou tecnico daquela obra, sob sua responsabilidade enquanto Controladora.

6.3. Em todos os casos, a 5G adota clausulas contratuais e medidas tecnicas adequadas para preservar a seguranca e a confidencialidade dos dados.

7. TRANSFERENCIA INTERNACIONAL DE DADOS

7.1. Os dados primarios da plataforma sao armazenados em data centers localizados no Brasil (AWS sa-east-1).

7.2. Caso, eventualmente, ocorra transferencia internacional para paises que nao oferecam grau de protecao adequado, a 5G adotara uma das hipoteses do art. 33 da LGPD, em especial clausulas contratuais especificas e garantia de cumprimento dos principios e direitos previstos na lei.

8. PRAZO DE ARMAZENAMENTO

8.1. Os dados sao mantidos durante a vigencia da assinatura.
8.2. Apos cancelamento, os dados permanecem disponiveis por 90 (noventa) dias para fins de exportacao pela CONTRATANTE, podendo entao ser eliminados.
8.3. Logs de acesso a sistemas autonomos sao mantidos por, no minimo, 6 (seis) meses, conforme art. 15 do Marco Civil.
8.4. Dados fiscais e financeiros sao mantidos pelos prazos exigidos pela legislacao tributaria (em regra, 5 anos).
8.5. Registros de aceite contratual sao mantidos pelo prazo de 5 (cinco) anos apos o termino da relacao contratual, para fins de exercicio regular de direitos.
8.6. Findos os prazos legais e contratuais, os dados pessoais sao eliminados ou anonimizados de forma segura.

9. SEGURANCA DA INFORMACAO

9.1. A 5G adota medidas tecnicas e administrativas apropriadas para proteger os dados, incluindo:

a) criptografia em transito (TLS 1.2+) e em repouso (AES-256);
b) Row-Level Security (RLS) no banco de dados, garantindo isolamento logico entre empresas — uma CONTRATANTE jamais acessa dados de outra;
c) armazenamento de senhas com algoritmo de hash unidirecional bcrypt com salt;
d) controle de acesso por principio do menor privilegio;
e) backups automaticos diarios;
f) registro auditavel de eventos relevantes (logins, alteracoes de configuracao, aceites);
g) monitoramento continuo de incidentes de seguranca.

9.2. Apesar dos esforcos de seguranca, nenhum sistema e absolutamente imune a falhas. Em caso de incidente de seguranca que possa acarretar risco ou dano relevante aos titulares, a 5G comunicara a ANPD e os titulares afetados, conforme art. 48 da LGPD, fornecendo as informacoes exigidas pela autoridade.

10. DIREITOS DO TITULAR (LGPD, art. 18)

10.1. O titular pode, a qualquer tempo, requerer:

a) Confirmacao da existencia de tratamento;
b) Acesso aos dados;
c) Correcao de dados incompletos, inexatos ou desatualizados;
d) Anonimizacao, bloqueio ou eliminacao de dados desnecessarios, excessivos ou tratados em desconformidade com a LGPD;
e) Portabilidade dos dados a outro fornecedor de servico ou produto;
f) Eliminacao dos dados pessoais tratados com consentimento, ressalvadas as hipoteses do art. 16 da LGPD;
g) Informacao sobre as entidades publicas e privadas com as quais a 5G compartilha os dados;
h) Informacao sobre a possibilidade de nao fornecer consentimento e sobre as consequencias da negativa;
i) Revogacao do consentimento, quando esta for a base legal aplicavel.

10.2. Os pedidos do titular relativos a dados em que a 5G atua como Operadora sao enderecados primariamente a CONTRATANTE Controladora. A 5G prestara o suporte necessario ao atendimento, conforme art. 39, IV, da LGPD.

10.3. Os pedidos relativos a dados em que a 5G atua como Controladora podem ser feitos diretamente ao Encarregado (Clausula 13). A resposta e fornecida em ate 15 (quinze) dias do recebimento, prorrogavel conforme circunstancias justificadas.

11. COOKIES E TECNOLOGIAS SEMELHANTES

11.1. O G Obra utiliza cookies estritamente necessarios ao funcionamento da plataforma (sessao, autenticacao, preferencias de exibicao).

11.2. Cookies analiticos, quando empregados, tem fins exclusivos de melhoria do produto e podem ser configurados em modo agregado/anonimizado.

11.3. Cookies de marketing dependem de consentimento expresso, manifestado em interface especifica.

11.4. O titular pode, a qualquer tempo, gerenciar cookies por meio das configuracoes do navegador. A desativacao de cookies estritamente necessarios pode comprometer o funcionamento da plataforma.

12. CRIANCAS E ADOLESCENTES

12.1. A plataforma destina-se a uso empresarial por adultos. A 5G nao coleta, conscientemente, dados de criancas e adolescentes (LGPD, art. 14).

12.2. Caso seja identificado tratamento de dados de crianca ou adolescente, este sera imediatamente cessado e os dados eliminados, ressalvada hipotese de melhor interesse do titular ou base legal especifica devidamente fundamentada.

13. ENCARREGADO DE DADOS (DPO)

Encarregado: Thiago Beletti
E-mail: dpo@5gobra.com.br
Canal alternativo: WhatsApp oficial de suporte indicado em 5gobra.com.br

14. ALTERACOES DESTA POLITICA

14.1. Esta Politica podera ser atualizada a qualquer tempo. Alteracoes materiais serao comunicadas com antecedencia minima de 30 (trinta) dias por e-mail e por aviso na plataforma.

14.2. Cada versao desta Politica e mantida em arquivo proprio, com hash SHA-256 e identificacao de versao, possibilitando ao titular consultar a integra vigente em cada aceite.

15. CANAL DE COMUNICACAO

Para exercer direitos, esclarecer duvidas ou denunciar incidentes:
E-mail: dpo@5gobra.com.br | suporte@5gobra.com.br
WhatsApp: canal oficial indicado em 5gobra.com.br

16. LEI APLICAVEL

Esta Politica rege-se pelas leis brasileiras, em especial a LGPD (Lei 13.709/2018), o Marco Civil da Internet (Lei 12.965/2014) e o Decreto 7.962/2013, sendo competente o foro da Comarca de Jundiai/SP, ressalvado o direito do consumidor pessoa fisica de optar pelo foro do seu domicilio.

5G GERENCIAMENTO
Documento versao ${PRIVACIDADE_VERSAO} — 06/05/2026`

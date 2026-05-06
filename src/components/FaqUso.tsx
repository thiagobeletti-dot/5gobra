// FAQ de Uso — perguntas operacionais pra cliente que ja tem conta no G Obra.
//
// Diferente do FAQ Comercial da landing (que trata de objecoes de venda),
// esse FAQ vive dentro do sistema, na rota /app/ajuda. Foco em "como uso?"
// nao "vale a pena assinar?".
//
// Conjunto de 11 perguntas decididas em sessao de produto (05/05/2026).
// Usa <details>/<summary> nativo pra acessibilidade e funcionar sem JS.

interface PerguntaResposta {
  pergunta: string
  resposta: string | JSX.Element
}

const faq: PerguntaResposta[] = [
  {
    pergunta: 'O cliente final precisa criar conta?',
    resposta:
      'Nao. O cliente recebe um link magico no celular (gerado pra cada obra) e abre direto no navegador. Sem login, sem app pra baixar, sem decorar senha.',
  },
  {
    pergunta: 'E se a equipe nao usar celular?',
    resposta:
      'A equipe precisa de celular pra usar o link magico do tecnico. Se um tecnico em particular nao usar, voce pode fazer o apontamento "como tecnico" pelo desktop a partir do painel da empresa. Mas o ideal e a equipe apontar diretamente — a fluencia mobile foi pensada pra isso.',
  },
  {
    pergunta: 'Posso importar do Alumisoft? E de outros sistemas como o CEM?',
    resposta:
      'Alumisoft sim — basta exportar o XML e subir pelo importador. CEM e outros sistemas: estamos no roadmap, com previsao de planilha padrao .xlsx que voce baixa, preenche e sobe.',
  },
  {
    pergunta: 'Quantas obras posso ter ao mesmo tempo?',
    resposta: 'Sem limite. Pode criar quantas obras quiser, simultaneas ou nao.',
  },
  {
    pergunta: 'Tem limite de usuarios na minha empresa?',
    resposta: 'Cada assinatura inclui 1 usuario administrador (voce). A equipe tecnica e o cliente final acessam o sistema sem precisar de conta — pelo link magico no celular. Se sua empresa precisar de mais usuarios administradores no futuro, fala comigo no WhatsApp pra a gente combinar.',
  },
  {
    pergunta: 'Quem ve o historico interno? E o cliente, ve?',
    resposta:
      'O historico tem duas camadas. O historico INTERNO e visivel so pra empresa (registros tecnicos crus, observacoes da equipe). O historico do CLIENTE e a versao filtrada — so o que faz sentido pro cliente final ver. Na pratica, voce escreve uma vez no internamente e marca o que vai pra fora.',
  },
  {
    pergunta: 'Como funciona o aceite com peso juridico?',
    resposta: (
      <span>
        Quando o cliente clica "Aceito" (em qualquer aceite — final da obra,
        mudanca de tipologia, acordo), o sistema registra IP, dispositivo
        (user-agent) e timestamp. Esses dados, junto com o hash do documento
        aceito, formam um registro que tem peso probatorio segundo o Marco
        Civil da Internet e a Lei do Comercio Eletronico. Aceites criticos
        (tipo aceite final da obra) ganham um e-mail automatico com snapshot
        do dossie — e esse e-mail vira prova adicional independente, ja que
        fica na caixa do proprio cliente com timestamp do provedor.
      </span>
    ),
  },
  {
    pergunta: 'Como funciona o link magico do tecnico?',
    resposta:
      'Cada tecnico cadastrado recebe um link unico (token UUID na URL). Ele abre no celular, ve so as tarefas dele (medicoes pendentes, fotos a tirar, checklists), aponta direto na tela. Sem login, sem instalacao, sem perigo de ele ver dados de outras empresas.',
  },
  {
    pergunta: 'Os dados ficam onde? Sao seguros?',
    resposta:
      'Os dados ficam armazenados no Supabase (infraestrutura AWS), com criptografia em transito (TLS) e em repouso (AES-256). Cada empresa tem seus dados isolados — empresas diferentes nunca enxergam dados umas das outras. Senhas sao armazenadas com bcrypt (criptografia irreversivel). Backups automaticos diarios. Operamos em conformidade com a LGPD; consulte nossa Politica de Privacidade.',
  },
  {
    pergunta: 'Quando lancam o G Estoque, G Vendas, G Producao e G Instalacao?',
    resposta: (
      <span>
        Lista de espera aberta no <a href="https://gerenciamento5g.com.br" className="text-laranja-dark underline" target="_blank" rel="noopener">gerenciamento5g.com.br</a>.
        Vamos lancar um modulo por vez, aprofundado, em vez de varios rasos
        — aprendizado da tentativa anterior. Quem entra no Programa Pioneiros
        ganha condicoes especiais nos modulos novos quando lancarem.
      </span>
    ),
  },
  {
    pergunta: 'Como falo com voces se travar?',
    resposta:
      'Use o botao "Falar com a gente" aqui embaixo da pagina de Ajuda. Abre WhatsApp direto comigo (Thiago). Antes de mandar, da uma olhada nos videos rapidos e nessa lista de perguntas — provavelmente sua duvida ja esta respondida e voce resolve em 30 segundos sem precisar esperar resposta.',
  },
]

export default function FaqUso() {
  return (
    <div className="space-y-2">
      {faq.map((item, i) => (
        <details
          key={i}
          className="group bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-slate-300 transition"
        >
          <summary className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer list-none font-semibold text-slate-900 select-none">
            <span className="text-sm md:text-base">{item.pergunta}</span>
            <span className="text-slate-400 group-open:rotate-180 transition-transform flex-shrink-0">
              ▼
            </span>
          </summary>
          <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed">
            {item.resposta}
          </div>
        </details>
      ))}
    </div>
  )
}

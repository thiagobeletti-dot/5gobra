// FAQ de Uso — perguntas operacionais pra cliente que ja tem conta no G Obra.
//
// Diferente do FAQ Comercial da landing (que trata de objecoes de venda),
// esse FAQ vive dentro do sistema, na rota /app/ajuda. Foco em "como uso?"
// nao "vale a pena assinar?".
//
// Conjunto de 11 perguntas decididas em sessao de produto (05/05/2026).
// Revisao 18/05/2026: corrigidos acentos (textos visiveis pro usuario)
// e clarificado que Alumisoft e empresa parceira (grupo Esquadgroup) e
// CEM e o sistema dela — antes a pergunta tratava CEM como concorrente.
// Usa <details>/<summary> nativo pra acessibilidade e funcionar sem JS.

interface PerguntaResposta {
  pergunta: string
  resposta: string | JSX.Element
}

const faq: PerguntaResposta[] = [
  {
    pergunta: 'O cliente final precisa criar conta?',
    resposta:
      'Não. O cliente recebe um link mágico no celular (gerado pra cada obra) e abre direto no navegador. Sem login, sem app pra baixar, sem decorar senha.',
  },
  {
    pergunta: 'E se a equipe não usar celular?',
    resposta:
      'A equipe precisa de celular pra usar o link mágico do técnico. Se um técnico em particular não usar, você pode fazer o apontamento "como técnico" pelo desktop a partir do painel da empresa. Mas o ideal é a equipe apontar diretamente — a fluência mobile foi pensada pra isso.',
  },
  {
    pergunta: 'Posso importar do CEM? E de outros sistemas?',
    resposta:
      'Sim, duas formas. (1) CEM direto — exporta o XML pelo sistema da Alumisoft e sobe pelo nosso importador. (2) Planilha genérica — pra qualquer fábrica que não usa CEM (sistema próprio, planilha existente, outro software), basta baixar nosso template .xlsx, preencher em Excel/Google Sheets e subir de volta. Aceita .xlsx, .xls e .csv. Tudo na tela "Importar itens em massa" dentro da obra.',
  },
  {
    pergunta: 'Quantas obras posso ter ao mesmo tempo?',
    resposta: 'Sem limite. Pode criar quantas obras quiser, simultâneas ou não.',
  },
  {
    pergunta: 'Tem limite de usuários na minha empresa?',
    resposta:
      'Cada assinatura inclui 1 usuário administrador (você). A equipe técnica e o cliente final acessam o sistema sem precisar de conta — pelo link mágico no celular. Se sua empresa precisar de mais usuários administradores no futuro, fala comigo no WhatsApp pra a gente combinar.',
  },
  {
    pergunta: 'Quem vê o histórico interno? E o cliente, vê?',
    resposta:
      'O histórico tem duas camadas. O histórico INTERNO é visível só pra empresa (registros técnicos crus, observações da equipe). O histórico do CLIENTE é a versão filtrada — só o que faz sentido pro cliente final ver. Na prática, você escreve uma vez internamente e marca o que vai pra fora.',
  },
  {
    pergunta: 'Como funciona o aceite com peso jurídico?',
    resposta: (
      <span>
        Quando o cliente clica "Aceito" (em qualquer aceite — final da obra,
        mudança de tipologia, acordo), o sistema registra IP, dispositivo
        (user-agent) e timestamp. Esses dados, junto com o hash do documento
        aceito, formam um registro que tem peso probatório segundo o Marco
        Civil da Internet e a Lei do Comércio Eletrônico. Aceites críticos
        (tipo aceite final da obra) ganham um e-mail automático com snapshot
        do dossiê — e esse e-mail vira prova adicional independente, já que
        fica na caixa do próprio cliente com timestamp do provedor.
      </span>
    ),
  },
  {
    pergunta: 'Como funciona o link mágico do técnico?',
    resposta:
      'Cada técnico cadastrado recebe um link único (token UUID na URL). Ele abre no celular, vê só as tarefas dele (medições pendentes, fotos a tirar, checklists), aponta direto na tela. Sem login, sem instalação, sem perigo de ele ver dados de outras empresas.',
  },
  {
    pergunta: 'Os dados ficam onde? São seguros?',
    resposta:
      'Os dados ficam armazenados no Supabase (infraestrutura AWS), com criptografia em trânsito (TLS) e em repouso (AES-256). Cada empresa tem seus dados isolados — empresas diferentes nunca enxergam dados umas das outras. Senhas são armazenadas com bcrypt (criptografia irreversível). Backups automáticos diários. Operamos em conformidade com a LGPD; consulte nossa Política de Privacidade.',
  },
  {
    pergunta: 'Quando lançam o G Estoque, G Vendas, G Produção e G Instalação?',
    resposta: (
      <span>
        Lista de espera aberta no <a href="https://gerenciamento5g.com.br" className="text-laranja-dark underline" target="_blank" rel="noopener">gerenciamento5g.com.br</a>.
        Vamos lançar um módulo por vez, aprofundado, em vez de vários rasos
        — aprendizado da tentativa anterior. Quem entra no Programa Pioneiros
        ganha condições especiais nos módulos novos quando lançarem.
      </span>
    ),
  },
  {
    pergunta: 'Como falo com vocês se travar?',
    resposta:
      'Use o botão "Falar com a gente" aqui embaixo da página de Ajuda. Abre WhatsApp direto comigo (Thiago). Antes de mandar, dá uma olhada nos vídeos rápidos e nessa lista de perguntas — provavelmente sua dúvida já está respondida e você resolve em 30 segundos sem precisar esperar resposta.',
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

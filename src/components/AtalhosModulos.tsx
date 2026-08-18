// Atalho pro G Instalação — logo pequeno no cabeçalho, ao lado de "Configurações".
// Abre em NOVA ABA (o Thiago mantém as telas abertas).
// (G Estoque saiu por ora — voltará quando o login estiver ajustado.)
//
// Logo em `public/logo-instalacao.png` (versão horizontal).

export default function AtalhosModulos({ altura = 26 }: { altura?: number }) {
  return (
    <a
      href="https://5ginstalacao.com.br"
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir G Instalação em nova aba"
      className="inline-flex items-center opacity-80 hover:opacity-100 transition shrink-0"
    >
      <img
        src="/logo-instalacao.png"
        alt="G Instalação"
        style={{ height: altura, width: 'auto', display: 'block' }}
      />
    </a>
  )
}

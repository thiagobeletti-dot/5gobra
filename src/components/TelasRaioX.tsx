// Telas do sistema recriadas em HTML/CSS para a página /raio-x.
//
// Por que recriar em vez de usar print (decisão 02/09/2026):
//   - 86% das demos interativas que mais convertem usam a tela em HTML,
//     não screenshot. Print de tela de desktop no celular vira borrão,
//     mesmo com zoom.
//   - O texto continua legível em qualquer tamanho e a página carrega leve.
//   - Não depende de tirar print nem de trocar dado real por fictício.
//
// Os dados aqui são TODOS fictícios de propósito. Obra "Residencial Vila
// Bela", cliente "João Silva". Nada de cliente real.

/* ---------- moldura de navegador ---------- */
function Moldura({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <div className="flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" />
          <span className="w-2 h-2 rounded-full bg-amber-300" />
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 ml-1 bg-white border border-slate-200 rounded px-2 py-0.5 text-[9.5px] text-slate-400 font-mono truncate">
          {url}
        </div>
      </div>
      {children}
    </div>
  )
}

function Cabecalho({ titulo, sub }: { titulo: string; sub: string }) {
  return (
    <div className="px-3.5 py-2.5 border-b border-slate-200">
      <div className="text-[13.5px] font-bold text-slate-900 leading-tight">{titulo}</div>
      <div className="text-[10.5px] text-slate-500 mt-0.5">{sub}</div>
    </div>
  )
}

/* ---------- 1. painel de obras (a tela da abertura) ---------- */
export function TelaPainel() {
  const obras = [
    { n: 'Residencial Vila Bela', s: 'Medição aprovada há 12 dias · produção não iniciou', b: '6 dias de atraso', cor: 'bg-status-erro', badge: 'bg-red-100 text-red-800' },
    { n: 'Sobrado Alto da Serra', s: 'Vão liberado · aguardando visita técnica', b: 'vence hoje', cor: 'bg-status-aguarda', badge: 'bg-amber-100 text-amber-800' },
    { n: 'Edifício Aurora — 4º andar', s: '32 peças prontas · entrega agendada', b: 'no prazo', cor: 'bg-status-andamento', badge: 'bg-emerald-100 text-emerald-800' },
  ]
  return (
    <Moldura url="5gobra.com.br/app/obras">
      <Cabecalho titulo="Suas obras" sub="Ordenadas por criticidade — a que está pegando fogo vem primeiro" />
      <div className="p-3 grid gap-2 bg-slate-50">
        {obras.map((o) => (
          <div key={o.n} className="bg-white border border-slate-200 rounded-lg p-2.5 pl-3 grid grid-cols-[1fr_auto] gap-2 items-center relative overflow-hidden">
            <span className={'absolute left-0 top-0 bottom-0 w-1 ' + o.cor} />
            <div>
              <div className="text-[12.5px] font-semibold text-slate-900 leading-tight">{o.n}</div>
              <div className="text-[10px] text-slate-500 mt-0.5">{o.s}</div>
            </div>
            <span className={'text-[9.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ' + o.badge}>{o.b}</span>
          </div>
        ))}
      </div>
    </Moldura>
  )
}

/* ---------- 2. o que o cliente vê ---------- */
export function TelaCliente() {
  return (
    <Moldura url="5gobra.com.br/obra/vila-bela">
      <Cabecalho titulo="Residencial Vila Bela" sub="Rua das Palmeiras, 450 · Cliente: João Silva" />
      <div className="flex gap-4 px-3.5 border-b border-slate-200 text-[11px] font-semibold overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {[
          { l: 'Cliente', n: 4, a: true },
          { l: 'Em andamento', n: 8, a: false },
          { l: 'Conclusão', n: 3, a: false },
        ].map((t) => (
          <div key={t.l} className={'py-2.5 flex items-center gap-1.5 border-b-2 -mb-px flex-shrink-0 ' + (t.a ? 'text-laranja-dark border-laranja' : 'text-slate-500 border-transparent')}>
            {t.l}
            <span className={'text-[9.5px] font-bold px-1.5 rounded-full ' + (t.a ? 'bg-laranja-soft text-laranja-dark' : 'bg-slate-100 text-slate-500')}>{t.n}</span>
          </div>
        ))}
      </div>
      <div className="p-3 grid grid-cols-1 min-[420px]:grid-cols-2 gap-2.5 bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-md p-2.5 relative overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-peca" />
          <div className="flex items-center justify-between mb-1">
            <span className="bg-peca-soft text-peca-dark border border-peca-border px-1.5 py-0.5 rounded text-[9px] font-bold">J1</span>
            <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Item</span>
          </div>
          <div className="text-[11.5px] font-semibold text-slate-900 leading-tight">Janela sala 1</div>
          <div className="text-[9.5px] text-slate-500 leading-snug mt-0.5">Alumínio 1,20 × 1,00 m · 2 folhas de correr</div>
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-status-aguarda" />
            <span className="text-[9.5px] text-slate-500 font-medium">Aguardando liberação do vão</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-md p-2.5 relative overflow-hidden">
          <span className="absolute left-0 top-0 bottom-0 w-1 bg-acordo" />
          <div className="flex items-center justify-between mb-1">
            <span className="bg-acordo-soft text-acordo-dark border border-acordo-border px-1.5 py-0.5 rounded text-[9px] font-bold">A1</span>
            <span className="text-[8px] text-slate-400 uppercase tracking-wider font-bold">Acordo</span>
          </div>
          <div className="text-[11.5px] font-semibold text-slate-900 leading-tight">Cor da janela master</div>
          <div className="text-[9.5px] text-slate-500 leading-snug mt-0.5">Cliente optou por preto fosco · acréscimo R$ 480,00</div>
          <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100">
            <span className="w-1.5 h-1.5 rounded-full bg-status-concluido" />
            <span className="text-[9.5px] text-slate-500 font-medium">Aprovado por João Silva</span>
          </div>
        </div>
      </div>
    </Moldura>
  )
}

/* ---------- 3. histórico da peça ---------- */
export function TelaHistorico() {
  const eventos = [
    { p: '✓', cor: 'bg-slate-400', t: 'Peça cadastrada', d: '14/08 · 09:12 · importada do orçamento' },
    { p: '!', cor: 'bg-status-erro', t: 'Vão não liberado — contramarco fora de prumo', d: '21/08 · 14:38 · Carlos (técnico) · 2 fotos', x: 'Aguardando correção pelo responsável da obra. A contagem do prazo não iniciou.' },
    { p: '✓', cor: 'bg-status-andamento', t: 'Correção confirmada pelo cliente', d: '26/08 · 08:05 · João Silva · 1 foto' },
  ]
  return (
    <Moldura url="5gobra.com.br/app/obra/vila-bela/j1">
      <Cabecalho titulo="J1 · Janela sala 1" sub="Histórico da peça" />
      <div className="p-3.5 grid">
        {eventos.map((e, i) => (
          <div key={e.t} className="grid grid-cols-[20px_1fr] gap-3 relative pb-4 last:pb-0">
            {i < eventos.length - 1 && <span className="absolute left-[9px] top-[18px] bottom-0 w-[1.5px] bg-slate-200" />}
            <span className={'w-5 h-5 rounded-full grid place-items-center text-[10px] text-white z-10 ' + e.cor}>{e.p}</span>
            <div>
              <div className="text-[12px] font-semibold text-slate-900 leading-tight">{e.t}</div>
              <div className="text-[9.5px] text-slate-400 font-mono mt-0.5">{e.d}</div>
              {e.x && <div className="text-[11px] text-slate-500 mt-1 leading-snug">{e.x}</div>}
            </div>
          </div>
        ))}
      </div>
    </Moldura>
  )
}

/* ---------- 4. aceite + dossiê ---------- */
export function TelaAceite() {
  return (
    <Moldura url="5gobra.com.br/obra/vila-bela/aceite">
      <Cabecalho titulo="Aceite final da obra" sub="Residencial Vila Bela · 38 peças" />
      <div className="p-3.5 grid gap-3">
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 text-[11.5px] text-slate-600 leading-relaxed">
          Declaro que recebi e conferi as esquadrias listadas, de acordo com o histórico registrado nesta obra.
        </div>
        <div>
          <div className="text-[12.5px] font-semibold text-slate-900">João Silva</div>
          <div className="font-mono text-[10px] text-slate-400 leading-relaxed mt-1">
            Aceite registrado em 02/09/2026 às 16:41<br />
            Dispositivo: iPhone · IP 187.xx.xx.xx<br />
            Documento gerado: dossie-vila-bela.pdf
          </div>
        </div>
        <div className="bg-laranja-soft border border-laranja-border rounded-lg p-3 text-[11.5px] text-laranja-dark font-semibold">
          ⬇ Dossiê da obra — 14 páginas com histórico, fotos e assinaturas
        </div>
      </div>
    </Moldura>
  )
}

/* ---------- 5. link do técnico (celular) ---------- */
export function TelaTecnico() {
  return (
    <div className="max-w-[230px] mx-auto bg-slate-900 rounded-[22px] p-[7px] shadow-xl">
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="bg-laranja text-white px-3 py-2">
          <b className="text-[12px] block leading-tight">Medição — Vila Bela</b>
          <span className="text-[9.5px] opacity-90">J1 · Janela sala 1</span>
        </div>
        <div className="p-3 grid gap-2">
          {[
            { t: 'Paredes acabadas e em nível', ok: true },
            { t: 'Piso ou soleira em prumo', ok: true },
            { t: 'Viga superior acabada e em prumo', ok: false },
          ].map((c) => (
            <div key={c.t} className="grid grid-cols-[16px_1fr] gap-2 items-start text-[11px] leading-snug text-slate-700">
              <span className={'w-4 h-4 rounded grid place-items-center text-[10px] text-white mt-px ' + (c.ok ? 'bg-status-andamento' : 'bg-white border-[1.5px] border-slate-300')}>
                {c.ok ? '✓' : ''}
              </span>
              <span>{c.t}</span>
            </div>
          ))}
          <div className="bg-slate-100 border border-dashed border-slate-300 rounded-lg p-3 text-center text-[10px] text-slate-400">
            📷 Foto obrigatória do vão
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="border border-slate-200 rounded-md p-2">
              <div className="text-[9px] text-slate-400">Largura</div>
              <div className="font-mono text-[12px] font-medium text-slate-900">1.204 mm</div>
            </div>
            <div className="border border-slate-200 rounded-md p-2">
              <div className="text-[9px] text-slate-400">Altura</div>
              <div className="font-mono text-[12px] font-medium text-slate-900">1.008 mm</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- 6. cronograma por gatilho ---------- */
export function TelaCronograma() {
  const etapas = [
    { n: 'Medição técnica', c: 'concluída', cc: 'text-status-andamento', w: '100%', b: 'bg-status-andamento', g: 'Gatilho: vão liberado · prazo 3 dias · levou 2' },
    { n: 'Produção', c: '6 dias de atraso', cc: 'text-status-erro', w: '100%', b: 'bg-status-erro', g: 'Gatilho: medição aprovada · prazo 10 dias · corre há 16' },
    { n: 'Instalação', c: 'não iniciou', cc: 'text-slate-400', w: '0%', b: 'bg-slate-300', g: 'Gatilho: entrega em obra · prazo 4 dias' },
  ]
  return (
    <Moldura url="5gobra.com.br/app/cronograma/vila-bela">
      <Cabecalho titulo="Cronograma — Residencial Vila Bela" sub="Contagem iniciada na liberação do vão · 26/08" />
      <div className="p-3 grid gap-2.5 bg-slate-50">
        {etapas.map((e) => (
          <div key={e.n} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex justify-between items-baseline gap-2 mb-2">
              <span className="text-[12px] font-semibold text-slate-900">{e.n}</span>
              <span className={'font-mono text-[11px] font-medium ' + e.cc}>{e.c}</span>
            </div>
            <div className="h-[7px] rounded-full bg-slate-100 overflow-hidden">
              <span className={'block h-full rounded-full ' + e.b} style={{ width: e.w }} />
            </div>
            <div className="text-[9.5px] text-slate-400 mt-1.5">{e.g}</div>
          </div>
        ))}
      </div>
    </Moldura>
  )
}

/* ---------- 7. metas: produção e instalação são DUAS contas ---------- */
//
// Duas métricas de propósito (confirmado pelo Thiago em 09/09/2026): o que
// saiu da fábrica e o que foi instalado na obra. Somar as duas num número só
// esconde de que lado está o gargalo — produzir 112 e instalar 65 no mesmo
// mês é a informação que faz o dono agir.
export function TelaMetas() {
  const grupos = [
    {
      rot: 'Produção — peças fabricadas',
      total: '112/150',
      linhas: [
        { p: 1, n: 'Serralheria — Léo e Ari', w: '84%', v: '63/75' },
        { p: 2, n: 'Envidraçamento — Marcos', w: '65%', v: '49/75' },
      ],
    },
    {
      rot: 'Instalação — peças instaladas',
      total: '65/110',
      linhas: [
        { p: 1, n: 'Equipe A — Carlos e Tiago', w: '73%', v: '41/56' },
        { p: 2, n: 'Equipe B — Rafael', w: '44%', v: '24/54' },
      ],
    },
  ]
  return (
    <Moldura url="5gobra.com.br/app/metas">
      <Cabecalho titulo="Metas de setembro" sub="Produção e instalação · atualizado há 4 minutos" />
      <div className="p-3 grid gap-2.5 bg-slate-50">
        {grupos.map((g, gi) => (
          <div
            key={g.rot}
            className={'grid gap-2.5' + (gi > 0 ? ' pt-3 mt-0.5 border-t border-dashed border-slate-300' : '')}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-mono text-[9.5px] tracking-[.1em] uppercase text-slate-400">{g.rot}</span>
              <span className="font-mono text-[10px] text-slate-500">{g.total}</span>
            </div>
            {g.linhas.map((e) => (
              <div key={e.n} className="bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-[26px_1fr_auto] gap-2.5 items-center">
                <span className={'w-[26px] h-[26px] rounded-lg grid place-items-center text-[12px] font-bold ' + (e.p === 1 ? 'bg-laranja text-white' : 'bg-slate-100 text-slate-500')}>
                  {e.p}
                </span>
                <div>
                  <div className="text-[12.5px] font-semibold text-slate-900">{e.n}</div>
                  <div className="h-[5px] rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                    <span className="block h-full bg-laranja rounded-full" style={{ width: e.w }} />
                  </div>
                </div>
                <span className="font-mono text-[11.5px] font-medium text-slate-600">{e.v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Moldura>
  )
}

/* ---------- 8. importação do orçamento ---------- */
//
// Existe pra responder, logo na primeira etapa da página, a objeção que mais
// trava a decisão: "começar dá trabalho". O PDF do Wvetro/CEM entra e sai
// card. É a ponte com o concorrente, nunca a comparação.
export function TelaImportacao() {
  const cards = [
    { t: 'J1 · Janela sala 1', d: '1,20 × 1,00 m · 2 folhas · branco' },
    { t: 'J2 · Janela sala 2', d: '1,20 × 1,00 m · 2 folhas · branco' },
    { t: 'P1 · Porta balcão', d: '2,00 × 2,10 m · 4 folhas · verde 8mm' },
  ]
  return (
    <Moldura url="5gobra.com.br/app/importar-orcamento">
      <Cabecalho titulo="Importar orçamento" sub="Residencial Vila Bela · 38 peças reconhecidas" />
      <div className="p-3 grid grid-cols-1 min-[430px]:grid-cols-[1fr_26px_1fr] gap-3 items-center bg-slate-50">
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
            orcamento-vila-bela.pdf
            <span className="bg-red-100 text-red-800 text-[8px] font-bold px-1.5 py-0.5 rounded tracking-wide">PDF</span>
          </div>
          <div className="font-mono text-[9px] text-slate-400 leading-loose mt-2">
            J1&nbsp;&nbsp;JAN 2F CORRER 1200×1000<br />
            J2&nbsp;&nbsp;JAN 2F CORRER 1200×1000<br />
            P1&nbsp;&nbsp;PORTA BALCÃO 4F 2000×2100<br />
            V1&nbsp;&nbsp;VIDRO VERDE 8MM<br />
            …
          </div>
        </div>
        <div className="text-[19px] font-bold text-laranja text-center rotate-90 min-[430px]:rotate-0">→</div>
        <div className="grid gap-1.5">
          {cards.map((c) => (
            <div key={c.t} className="bg-white border border-slate-200 rounded-md py-2 px-2.5 pl-3 relative overflow-hidden">
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-peca" />
              <div className="text-[10.5px] font-semibold text-slate-900 leading-tight">{c.t}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </Moldura>
  )
}

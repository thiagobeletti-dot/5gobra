// Mapeia erros tecnicos pra mensagens humanas.
//
// Em vez de mostrar "UNIQUE constraint failed: empresas.cnpj" pro usuario,
// mostra "Esse CNPJ ja esta cadastrado".
//
// Como o Supabase, o navegador e o JS nativo soltam mensagens em ingles ou
// em codigos crus (PGRST116, 23505, etc), centralizamos a traducao aqui.
//
// Integrar em todos os catches que renderizam mensagem pro usuario.

export interface ErroFormatado {
  /** Mensagem amigavel pra exibir no UI. */
  mensagem: string
  /** Tipo do erro pra logging/categorizacao. */
  tipo: 'rede' | 'autenticacao' | 'permissao' | 'duplicata' | 'validacao' | 'banco' | 'desconhecido'
  /** Erro original, pra logar no console se quiser debugar. */
  original: unknown
}

export function formatarErro(err: unknown): ErroFormatado {
  const original = err
  const raw = stringify(err).toLowerCase()
  const code = (err as any)?.code as string | undefined
  const status = (err as any)?.status as number | undefined

  // ---- Rede / fetch ----
  if (raw.includes('network') || raw.includes('failed to fetch') || raw.includes('typeerror: load failed')) {
    return { mensagem: 'Sem conexao com o servidor. Verifique sua internet e tente de novo.', tipo: 'rede', original }
  }
  if (raw.includes('timeout') || raw.includes('timed out')) {
    return { mensagem: 'A operacao demorou demais. Tente novamente em alguns segundos.', tipo: 'rede', original }
  }

  // ---- HTTP status ----
  if (status === 401 || raw.includes('jwt expired') || raw.includes('invalid jwt')) {
    return { mensagem: 'Sua sessao expirou. Saia e entre de novo, por favor.', tipo: 'autenticacao', original }
  }
  if (status === 403 || raw.includes('permission denied') || raw.includes('row level security')) {
    return { mensagem: 'Voce nao tem permissao pra fazer isso.', tipo: 'permissao', original }
  }
  if (status === 404) {
    return { mensagem: 'Recurso nao encontrado. Pode ter sido apagado ou movido.', tipo: 'banco', original }
  }
  if (status === 429) {
    return { mensagem: 'Muitas tentativas em pouco tempo. Aguarde alguns segundos.', tipo: 'rede', original }
  }
  if (status === 500 || status === 502 || status === 503) {
    return { mensagem: 'O servidor teve um problema. Tenta de novo em alguns minutos.', tipo: 'rede', original }
  }

  // ---- Postgres / Supabase ----
  if (code === '23505' || raw.includes('duplicate key') || raw.includes('unique constraint')) {
    if (raw.includes('email')) return { mensagem: 'Esse e-mail ja esta cadastrado.', tipo: 'duplicata', original }
    if (raw.includes('cnpj')) return { mensagem: 'Esse CNPJ ja esta cadastrado.', tipo: 'duplicata', original }
    if (raw.includes('sigla')) return { mensagem: 'Ja existe um item com essa sigla nessa obra.', tipo: 'duplicata', original }
    return { mensagem: 'Esse registro ja existe.', tipo: 'duplicata', original }
  }
  if (code === '23503' || raw.includes('foreign key')) {
    return { mensagem: 'Esse item depende de outro registro que nao foi encontrado.', tipo: 'banco', original }
  }
  if (code === '23502' || raw.includes('not null violation') || raw.includes('null value')) {
    return { mensagem: 'Faltou preencher um campo obrigatorio.', tipo: 'validacao', original }
  }
  if (code === '22P02' || raw.includes('invalid input syntax')) {
    return { mensagem: 'Formato de dado invalido.', tipo: 'validacao', original }
  }
  if (code === 'PGRST116') {
    return { mensagem: 'Registro nao encontrado.', tipo: 'banco', original }
  }

  // ---- Supabase Auth ----
  if (raw.includes('invalid login') || raw.includes('invalid credentials')) {
    return { mensagem: 'E-mail ou senha incorretos.', tipo: 'autenticacao', original }
  }
  if (raw.includes('user already registered') || raw.includes('email already')) {
    return { mensagem: 'Esse e-mail ja esta cadastrado. Tente entrar em vez de criar conta.', tipo: 'duplicata', original }
  }
  if (raw.includes('email not confirmed')) {
    return { mensagem: 'Voce precisa confirmar seu e-mail antes de entrar. Veja sua caixa de entrada.', tipo: 'autenticacao', original }
  }
  if (raw.includes('password should be at least')) {
    return { mensagem: 'A senha precisa ter pelo menos 6 caracteres.', tipo: 'validacao', original }
  }

  // ---- Storage Supabase ----
  if (raw.includes('payload too large') || raw.includes('exceeded the maximum')) {
    return { mensagem: 'Arquivo muito grande. Tente um menor que 8 MB.', tipo: 'validacao', original }
  }

  // ---- Fallback: pega a mensagem original mas nao expoe codigos tecnicos ----
  const msgOriginal = (err as any)?.message
  if (typeof msgOriginal === 'string' && msgOriginal.length > 0 && msgOriginal.length < 200 && !msgOriginal.match(/[\{\}\[\]]/) && !msgOriginal.match(/^[A-Z]+\d+:/)) {
    return { mensagem: msgOriginal, tipo: 'desconhecido', original }
  }

  return { mensagem: 'Algo deu errado. Tente de novo, e se persistir, fale com o suporte.', tipo: 'desconhecido', original }
}

// Helper menor pra quando voce so quer a string de erro, sem o objeto.
export function mensagemDeErro(err: unknown): string {
  return formatarErro(err).mensagem
}

function stringify(err: unknown): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const m = (err as any).message
    if (typeof m === 'string') return m
    try { return JSON.stringify(err) } catch { return String(err) }
  }
  return String(err)
}

const niveis = { debug: 10, info: 20, warn: 30, error: 40 };

export function criarLogger(nivel = 'info') {
  const minimo = niveis[nivel] ?? niveis.info;
  const escrever = (tipo, evento, dados = {}) => {
    if (niveis[tipo] < minimo) return;
    const linha = JSON.stringify({ timestamp: new Date().toISOString(), level: tipo, event: evento, ...dados });
    (tipo === 'error' ? console.error : console.log)(linha);
  };
  return {
    debug: (evento, dados) => escrever('debug', evento, dados),
    info: (evento, dados) => escrever('info', evento, dados),
    warn: (evento, dados) => escrever('warn', evento, dados),
    error: (evento, dados) => escrever('error', evento, dados),
  };
}

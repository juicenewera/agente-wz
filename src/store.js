export function criarStoreMemoria({ maxHistoryMessages = 20 } = {}) {
  const historicos = new Map();
  const processadas = new Set();
  return {
    jaProcessada(id) {
      if (!id) return false;
      if (processadas.has(id)) return true;
      processadas.add(id);
      if (processadas.size > 10_000) processadas.delete(processadas.values().next().value);
      return false;
    },
    historico(contato) {
      return [...(historicos.get(contato) || [])];
    },
    adicionar(contato, mensagem) {
      const atual = [...(historicos.get(contato) || []), mensagem].slice(-maxHistoryMessages);
      historicos.set(contato, atual);
    },
  };
}

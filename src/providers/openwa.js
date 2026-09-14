import { assinaturaHmacValida } from '../security.js';

export function criarOpenWA(config) {
  return {
    webhookPath: '/webhooks/openwa',
    verificarRequisicao(req) {
      return assinaturaHmacValida({
        rawBody: req.rawBody,
        secret: config.webhookSecret,
        received: req.get('X-OpenWA-Signature'),
      });
    },
    extrairMensagens(body = {}) {
      if (body.event !== 'message.received' || !body.data || body.data.fromMe) return [];
      const data = body.data;
      const text = String(data.body || '').trim();
      if (!text) return [];
      return [{
        id: data.id || `${data.from}:${data.timestamp || Date.now()}:${text}`,
        from: data.from,
        text,
        name: data.notifyName || data.sender?.pushname || null,
        timestamp: Number(data.timestamp || 0),
      }];
    },
    async enviarTexto(to, text) {
      const resposta = await fetch(`${config.url}/api/sessions/${encodeURIComponent(config.sessionId)}/messages/send-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}) },
        body: JSON.stringify({ chatId: to, text }),
      });
      if (!resposta.ok) throw new Error(`OpenWA HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 300)}`);
      return resposta.json().catch(() => ({}));
    },
  };
}

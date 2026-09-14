import { assinaturaHmacValida } from '../security.js';

export function criarMetaCloud(config) {
  return {
    webhookPath: '/webhooks/meta',
    verificarHandshake(query = {}) {
      return query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === config.verifyToken
        ? query['hub.challenge']
        : null;
    },
    verificarRequisicao(req) {
      return assinaturaHmacValida({ rawBody: req.rawBody, secret: config.appSecret, received: req.get('X-Hub-Signature-256') });
    },
    extrairMensagens(body = {}) {
      if (body.object !== 'whatsapp_business_account') return [];
      const saida = [];
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          for (const message of change.value?.messages || []) {
            const text = message.type === 'text' ? String(message.text?.body || '').trim() : '';
            if (!text) continue;
            const profile = change.value?.contacts?.find((c) => c.wa_id === message.from)?.profile;
            saida.push({ id: message.id, from: message.from, text, name: profile?.name || null, timestamp: Number(message.timestamp || 0) });
          }
        }
      }
      return saida;
    },
    async enviarTexto(to, text) {
      const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;
      const resposta = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: String(to).replace(/\D/g, ''),
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      });
      if (!resposta.ok) throw new Error(`Meta Cloud API HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 500)}`);
      return resposta.json();
    },
  };
}

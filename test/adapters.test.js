import test from 'node:test';
import assert from 'node:assert/strict';
import { criarOpenWA } from '../src/providers/openwa.js';
import { criarMetaCloud } from '../src/providers/meta.js';
import { criarStoreMemoria } from '../src/store.js';
import { carregarConfig } from '../src/config.js';
import { assinaturaHmacValida } from '../src/security.js';
import crypto from 'node:crypto';

test('OpenWA normaliza uma mensagem recebida e ignora eco próprio', () => {
  const adapter = criarOpenWA({});
  const payload = { event: 'message.received', data: { id: 'abc', from: '5511999999999@c.us', body: 'Oi', fromMe: false } };
  assert.deepEqual(adapter.extrairMensagens(payload)[0], {
    id: 'abc', from: '5511999999999@c.us', text: 'Oi', name: null, timestamp: 0,
  });
  payload.data.fromMe = true;
  assert.deepEqual(adapter.extrairMensagens(payload), []);
});

test('Meta normaliza o envelope oficial de webhook', () => {
  const adapter = criarMetaCloud({ verifyToken: 'segredo' });
  const payload = {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '5511999999999', profile: { name: 'Ana' } }],
      messages: [{ id: 'wamid.1', from: '5511999999999', timestamp: '10', type: 'text', text: { body: 'Olá' } }],
    } }] }],
  };
  assert.deepEqual(adapter.extrairMensagens(payload)[0], {
    id: 'wamid.1', from: '5511999999999', text: 'Olá', name: 'Ana', timestamp: 10,
  });
  assert.equal(adapter.verificarHandshake({ 'hub.mode': 'subscribe', 'hub.verify_token': 'segredo', 'hub.challenge': '123' }), '123');
});

test('store limita histórico e deduplica IDs', () => {
  const store = criarStoreMemoria({ maxHistoryMessages: 2 });
  store.adicionar('1', { role: 'user', content: 'a' });
  store.adicionar('1', { role: 'assistant', content: 'b' });
  store.adicionar('1', { role: 'user', content: 'c' });
  assert.deepEqual(store.historico('1').map((m) => m.content), ['b', 'c']);
  assert.equal(store.jaProcessada('x'), false);
  assert.equal(store.jaProcessada('x'), true);
});

test('config exige credenciais específicas da Meta', () => {
  assert.throws(() => carregarConfig({ WHATSAPP_PROVIDER: 'meta', AI_API_KEY: 'teste' }), /META_PHONE_NUMBER_ID/);
  const config = carregarConfig({
    WHATSAPP_PROVIDER: 'meta', AI_API_KEY: 'teste', META_PHONE_NUMBER_ID: '1',
    META_ACCESS_TOKEN: 'token', META_VERIFY_TOKEN: 'verify',
  });
  assert.equal(config.whatsappProvider, 'meta');
});

test('assinatura HMAC aceita corpo íntegro e rejeita alteração', () => {
  const rawBody = Buffer.from('{"ok":true}');
  const secret = 'segredo';
  const received = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  assert.equal(assinaturaHmacValida({ rawBody, secret, received }), true);
  assert.equal(assinaturaHmacValida({ rawBody: Buffer.from('{"ok":false}'), secret, received }), false);
});

test('OpenWA envia no endpoint da sessão com chatId preservado', async () => {
  const original = globalThis.fetch;
  let chamada;
  globalThis.fetch = async (url, options) => {
    chamada = { url, options };
    return new Response(JSON.stringify({ messageId: '1' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const adapter = criarOpenWA({ url: 'http://gateway', sessionId: 'vendas', apiKey: 'key' });
    await adapter.enviarTexto('5511999999999@c.us', 'Olá');
    assert.equal(chamada.url, 'http://gateway/api/sessions/vendas/messages/send-text');
    assert.deepEqual(JSON.parse(chamada.options.body), { chatId: '5511999999999@c.us', text: 'Olá' });
    assert.equal(chamada.options.headers['X-API-Key'], 'key');
  } finally {
    globalThis.fetch = original;
  }
});

test('Meta envia texto no contrato oficial da Graph API', async () => {
  const original = globalThis.fetch;
  let chamada;
  globalThis.fetch = async (url, options) => {
    chamada = { url, options };
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.2' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const adapter = criarMetaCloud({ graphVersion: 'v23.0', phoneNumberId: '123', accessToken: 'token' });
    await adapter.enviarTexto('5511 99999-9999', 'Olá');
    assert.equal(chamada.url, 'https://graph.facebook.com/v23.0/123/messages');
    assert.deepEqual(JSON.parse(chamada.options.body), {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: '5511999999999',
      type: 'text', text: { preview_url: false, body: 'Olá' },
    });
    assert.equal(chamada.options.headers.Authorization, 'Bearer token');
  } finally {
    globalThis.fetch = original;
  }
});

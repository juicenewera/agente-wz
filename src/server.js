import express from 'express';
import { carregarConfig } from './config.js';
import { criarLogger } from './logger.js';
import { criarStoreMemoria } from './store.js';
import { criarAgente } from './agent.js';
import { criarOpenWA } from './providers/openwa.js';
import { criarMetaCloud } from './providers/meta.js';

const config = carregarConfig();
const logger = criarLogger(config.logLevel);
const store = criarStoreMemoria({ maxHistoryMessages: config.ai.maxHistoryMessages });
const agent = criarAgente({ config, store, logger });
const provider = config.whatsappProvider === 'meta' ? criarMetaCloud(config.meta) : criarOpenWA(config.openwa);
const app = express();

app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buffer) => { req.rawBody = buffer; },
}));

app.get('/health', (_req, res) => res.json({ ok: true, provider: config.whatsappProvider }));

if (config.whatsappProvider === 'meta') {
  app.get(provider.webhookPath, (req, res) => {
    const challenge = provider.verificarHandshake(req.query);
    return challenge === null ? res.sendStatus(403) : res.status(200).send(challenge);
  });
}

app.post(provider.webhookPath, (req, res) => {
  if (!provider.verificarRequisicao(req)) return res.sendStatus(401);
  res.sendStatus(200);
  queueMicrotask(async () => {
    for (const mensagem of provider.extrairMensagens(req.body)) {
      if (store.jaProcessada(mensagem.id)) {
        logger.debug('mensagem_duplicada', { id: mensagem.id });
        continue;
      }
      try {
        logger.info('mensagem_recebida', { id: mensagem.id, contact: mensagem.from, chars: mensagem.text.length });
        const resposta = await agent.responder(mensagem);
        await provider.enviarTexto(mensagem.from, resposta);
        logger.info('mensagem_enviada', { id: mensagem.id, contact: mensagem.from });
      } catch (error) {
        logger.error('processamento_falhou', { id: mensagem.id, contact: mensagem.from, error: error.message });
      }
    }
  });
});

app.listen(config.port, () => logger.info('servidor_iniciado', { port: config.port, provider: config.whatsappProvider }));

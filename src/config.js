const inteiro = (valor, padrao) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : padrao;
};

export function carregarConfig(env = process.env) {
  const provider = String(env.WHATSAPP_PROVIDER || 'openwa').toLowerCase();
  if (!['openwa', 'meta'].includes(provider)) {
    throw new Error('WHATSAPP_PROVIDER deve ser "openwa" ou "meta"');
  }
  const config = {
    port: inteiro(env.PORT, 3000),
    logLevel: env.LOG_LEVEL || 'info',
    whatsappProvider: provider,
    ai: {
      baseURL: env.AI_BASE_URL || 'https://api.openai.com/v1',
      apiKey: env.AI_API_KEY || '',
      model: env.AI_MODEL || 'gpt-4.1-mini',
      maxHistoryMessages: inteiro(env.MAX_HISTORY_MESSAGES, 20),
      systemPrompt: env.SYSTEM_PROMPT || 'Você é um assistente prestativo. Responda com clareza e concisão.',
    },
    identity: {
      agentName: env.AGENT_NAME || 'Assistente',
      businessName: env.BUSINESS_NAME || 'Minha Empresa',
    },
    openwa: {
      url: String(env.OPENWA_URL || 'http://localhost:8080').replace(/\/$/, ''),
      apiKey: env.OPENWA_API_KEY || '',
      sessionId: env.OPENWA_SESSION_ID || 'default',
      webhookSecret: env.OPENWA_WEBHOOK_SECRET || '',
    },
    meta: {
      graphVersion: env.META_GRAPH_VERSION || 'v23.0',
      phoneNumberId: env.META_PHONE_NUMBER_ID || '',
      accessToken: env.META_ACCESS_TOKEN || '',
      verifyToken: env.META_VERIFY_TOKEN || '',
      appSecret: env.META_APP_SECRET || '',
    },
  };

  const faltando = [];
  if (!config.ai.apiKey) faltando.push('AI_API_KEY');
  if (provider === 'openwa' && !config.openwa.sessionId) faltando.push('OPENWA_SESSION_ID');
  if (provider === 'meta') {
    if (!config.meta.phoneNumberId) faltando.push('META_PHONE_NUMBER_ID');
    if (!config.meta.accessToken) faltando.push('META_ACCESS_TOKEN');
    if (!config.meta.verifyToken) faltando.push('META_VERIFY_TOKEN');
  }
  if (faltando.length) throw new Error(`Configuração ausente: ${faltando.join(', ')}`);
  return config;
}

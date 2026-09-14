import OpenAI from 'openai';
import { analisarEntrada, INSTRUCAO_ANTI_INJECAO, RESPOSTA_GUARDRAIL } from './guardrails.js';

export function criarAgente({ config, store, logger }) {
  const client = new OpenAI({ apiKey: config.ai.apiKey, baseURL: config.ai.baseURL });
  return {
    async responder(mensagem) {
      store.adicionar(mensagem.from, { role: 'user', content: mensagem.text });
      const guardrail = analisarEntrada(mensagem.text);
      if (guardrail.bloquear) {
        logger.warn('guardrail_prompt_injection_bloqueado', { contact: mensagem.from, nivel: guardrail.nivel, score: guardrail.score, sinais: guardrail.sinais });
        store.adicionar(mensagem.from, { role: 'assistant', content: RESPOSTA_GUARDRAIL });
        return RESPOSTA_GUARDRAIL;
      }
      const completion = await client.chat.completions.create({
        model: config.ai.model,
        messages: [
          {
            role: 'system',
            content: `${INSTRUCAO_ANTI_INJECAO}\n\n${config.ai.systemPrompt}\n\nSeu nome é ${config.identity.agentName} e a empresa é ${config.identity.businessName}.`,
          },
          ...store.historico(mensagem.from),
        ],
      });
      const texto = completion.choices?.[0]?.message?.content?.trim();
      if (!texto) throw new Error('O modelo não retornou texto');
      store.adicionar(mensagem.from, { role: 'assistant', content: texto });
      logger.info('resposta_gerada', { contact: mensagem.from, chars: texto.length });
      return texto;
    },
  };
}

# Arquitetura detalhada

## 1. Inicialização

1. `src/server.js` chama `carregarConfig()`.
2. `src/config.js` seleciona `openwa` ou `meta` e rejeita configurações obrigatórias ausentes.
3. O logger, o store em memória e o cliente de IA são criados.
4. Apenas o adapter selecionado é ligado.
5. O Express abre a porta configurada e expõe `/health` mais a rota do webhook.

## 2. Recebimento

O provedor faz `POST` no webhook. O Express preserva os bytes originais em `req.rawBody`, necessários para validar HMAC. A aplicação valida a assinatura quando o segredo correspondente está preenchido e responde HTTP 200 imediatamente. O processamento continua fora do tempo de resposta do webhook para reduzir reentregas do provedor.

O adapter converte o payload externo para um contrato interno único:

```js
{
  id: 'identificador único da mensagem',
  from: 'identificador do usuário',
  text: 'texto recebido',
  name: 'nome opcional',
  timestamp: 0
}
```

Assim, o núcleo não precisa conhecer o envelope da Meta nem os sufixos `@c.us`/`@lid` do OpenWA.

## 3. Deduplicação

Provedores podem repetir webhooks. `store.jaProcessada(id)` aceita o primeiro evento e ignora repetições. Na edição didática, isso fica em RAM. Em produção, o ID deve ter restrição `UNIQUE` em um banco durável.

## 4. Histórico e IA

`agent.responder()` adiciona a fala do usuário, limita a janela a `MAX_HISTORY_MESSAGES` e chama `chat.completions.create()` por meio do SDK `openai`. `AI_BASE_URL` permite usar OpenAI, OpenRouter ou outro endpoint compatível. A resposta é validada e adicionada ao histórico.

O modelo não fala diretamente com o WhatsApp. Essa separação permite testar, trocar modelo e criar guardrails antes do envio.

## 5. Envio

O mesmo adapter que recebeu a mensagem envia a resposta:

- OpenWA recebe `{ chatId, text }` na Easy API/gateway.
- Meta recebe um objeto `messaging_product: "whatsapp"` no endpoint Graph `/{PHONE_NUMBER_ID}/messages`.

Uma falha lança erro e gera log estruturado. A versão didática não tenta novamente para não correr o risco de duplicar respostas sem uma outbox durável.

## 6. Estado e concorrência

O exemplo é adequado para estudo e protótipo de uma instância. Para uso real, conversas do mesmo contato devem ser serializadas e mensagens de contatos diferentes podem ser processadas em paralelo. Persistência, lock por contato e outbox são itens obrigatórios de endurecimento.

## 7. Extensões recomendadas

- `store-postgres.js`: conversas, deduplicação e consentimento.
- `queue.js`: fila por contato e limite global.
- `guardrails.js`: regras determinísticas que validam a resposta da IA.
- `crm/`: adapter independente para Kommo, HubSpot etc.
- `media/`: download e envio conforme o contrato de cada provedor.
- `handoff/`: estado explícito `bot`/`humano`, sem depender apenas de mensagens enviadas pelo telefone.

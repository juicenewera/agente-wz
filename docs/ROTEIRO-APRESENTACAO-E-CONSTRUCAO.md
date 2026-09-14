# Roteiro para explicar e construir o sistema

Este roteiro serve para apresentar o Agent Zap a outra pessoa e, em seguida, construir uma instalação própria do zero. A ideia é explicar primeiro o caminho de uma mensagem e só depois entrar nos detalhes de código e infraestrutura.

## Parte 1 — Como explicar o sistema

### 1. Comece pelo problema

> “O sistema recebe uma mensagem do WhatsApp, entende quem enviou, consulta o histórico, pede uma resposta ao modelo de IA e devolve a resposta pelo mesmo canal. A aplicação também protege o prompt, evita duplicidade e registra o que aconteceu.”

Deixe claro que ele é um orquestrador. O WhatsApp é o canal, o provider é o transporte, o modelo gera texto e o servidor coordena tudo.

### 2. Mostre o caminho em uma frase

```text
Cliente → WhatsApp → OpenWA/Meta → webhook → validação → agente → IA → provider → cliente
```

Explique que cada seta é uma chamada ou transformação de dados; não existe uma “mágica” escondida entre elas.

### 3. Explique as duas opções de WhatsApp

- **OpenWA:** controla uma sessão do WhatsApp Web e normalmente usa QR code. É simples para protótipos, mas não é a API oficial e tem risco operacional/termos próprios.
- **Meta Cloud API:** é a API oficial da WhatsApp Business Platform. Usa webhook, token, número empresarial e permissões da Meta; não usa QR code.

O código escolhe o transporte por `WHATSAPP_PROVIDER`. O restante do sistema recebe o mesmo formato interno, independentemente do provider.

### 4. Explique o webhook

O provider envia um `POST` para o servidor quando chega uma mensagem. O Express:

1. recebe o JSON e preserva o corpo bruto;
2. verifica a assinatura HMAC;
3. responde `200` rapidamente;
4. processa a mensagem de forma assíncrona.

O `200` significa “recebi o evento”, não necessariamente “já respondi ao cliente”. Isso evita timeout e reenvio pelo provedor.

### 5. Explique a normalização

Cada provider tem um JSON diferente. Os adapters convertem ambos para:

```js
{ id, from, text, name, timestamp }
```

Assim, `agent.js` não precisa saber se a mensagem veio do OpenWA ou da Meta.

### 6. Explique segurança e deduplicação

Antes da IA, o sistema:

- rejeita webhook com assinatura inválida;
- ignora mensagens enviadas pelo próprio agente;
- ignora texto vazio ou evento incompatível;
- verifica se o ID já foi processado;
- bloqueia tentativas de prompt injection/jailbreak.

Isso separa “dados recebidos do cliente” das “instruções confiáveis do sistema”.

### 7. Explique o agente

O agente adiciona a mensagem ao histórico, combina prompt de sistema com contexto e chama uma API compatível com OpenAI. Quando recebe texto válido, salva a resposta no histórico e entrega a string ao provider.

O modelo não envia WhatsApp diretamente. Ele apenas produz texto; quem envia é o adapter do canal.

### 8. Explique a resposta

- No OpenWA, o adapter chama o endpoint da sessão e envia `chatId` e `text`.
- Na Meta, o adapter chama o endpoint Graph com Bearer token, `phone_number_id` e o contrato oficial de mensagem.

Se o envio falhar, o sistema registra `processamento_falhou`. Se der certo, registra `mensagem_enviada`.

### 9. Explique o que é memória e o que é produção

O starter usa memória local para histórico e IDs processados. É ótimo para entender o fluxo, mas reiniciar o processo apaga esses dados.

Em produção, troque por banco/fila durável e acrescente RAG, CRM, follow-ups, retentativas, métricas e alertas. Esses componentes aparecem no blueprint como extensões, não como dependências obrigatórias do starter.

## Parte 2 — Como construir do zero

### Fase 0 — Defina o primeiro objetivo

Construa primeiro apenas:

```text
receber texto → gerar texto → responder texto
```

Não comece por áudio, campanhas, CRM, RAG e múltiplos workers. Cada recurso adicional cria uma nova superfície de falha.

### Fase 1 — Prepare o projeto

1. Instale Node.js 22 ou superior.
2. Crie um projeto ESM:

```bash
mkdir meu-agente-zap
cd meu-agente-zap
npm init -y
npm install express openai
```

3. Configure `"type": "module"` no `package.json`.
4. Crie `.env` a partir de `.env.example`.
5. Nunca faça commit de `.env`, tokens, QR code ou sessões.

### Fase 2 — Modele o contrato interno

Antes de escrever integrações, defina a mensagem normalizada:

```js
{
  id: 'id-do-evento',
  from: 'identificador-do-contato',
  text: 'mensagem limpa',
  name: 'nome opcional',
  timestamp: 0
}
```

Esse contrato é a fronteira entre transporte e regra de negócio.

### Fase 3 — Construa o store mínimo

Implemente duas operações:

- `jaProcessada(id)` para idempotência;
- `historico(contato)`/`adicionar(contato, mensagem)` para contexto da conversa.

Limite a quantidade de mensagens mantidas. Depois, substitua a implementação por Redis/Postgres sem alterar o contrato usado pelo agente.

### Fase 4 — Construa o adapter do WhatsApp

Para cada provider, implemente quatro responsabilidades:

1. informar o caminho do webhook;
2. verificar assinatura/handshake;
3. extrair mensagens normalizadas;
4. enviar texto para o contato.

Comece por um único provider. Adicione o segundo somente quando o primeiro estiver coberto por testes.

### Fase 5 — Construa o servidor

No Express:

1. habilite JSON com limite de tamanho;
2. capture `rawBody`;
3. adicione `GET /health`;
4. adicione o handshake da Meta, se necessário;
5. valide o webhook;
6. responda `200` rapidamente;
7. encaminhe o trabalho para o agente;
8. envie a resposta pelo adapter;
9. registre sucesso e erro.

### Fase 6 — Construa o agente e os guardrails

1. Crie o cliente do modelo com `AI_BASE_URL`, `AI_API_KEY` e `AI_MODEL`.
2. Defina um prompt de sistema curto e explícito.
3. Adicione o histórico do contato.
4. Rode guardrails antes da chamada ao modelo.
5. Rejeite resposta vazia ou inválida.
6. Grave a resposta no store.

O guardrail não substitui controle de acesso: segredos, permissões e regras comerciais devem permanecer fora do texto do usuário.

### Fase 7 — Teste local

Execute:

```bash
npm test
npm start
```

Verifique `GET /health`. Depois envie um webhook de teste assinado e confirme, nesta ordem:

1. o servidor retorna `200`;
2. o log mostra `mensagem_recebida`;
3. o modelo é chamado uma vez;
4. o provider recebe o texto;
5. o log mostra `mensagem_enviada`;
6. repetir o mesmo ID gera `mensagem_duplicada`.

### Fase 8 — Publique com segurança

1. Coloque o servidor atrás de HTTPS.
2. Mantenha OpenWA em rede privada quando possível.
3. Use secrets do provedor de deploy, nunca arquivos versionados.
4. Configure timeout e retentativas no worker, não dentro do webhook.
5. Restrinja logs para não vazar telefone completo, prompt ou token.
6. Adicione health checks reais para provider, IA e banco.

### Fase 9 — Adicione produção por camadas

Evolua nesta ordem:

1. Redis/Postgres para histórico e idempotência;
2. fila durável e worker;
3. observabilidade e alertas;
4. RAG com documentos versionados;
5. CRM e atualização de etapas;
6. follow-ups com consentimento e janela de atendimento;
7. áudio, imagem e mídia;
8. reconciliação e painel operacional.

Após cada camada, adicione testes de contrato, falha e repetição. Não conecte todas as integrações de uma vez.

## Parte 3 — Demonstração de cinco minutos

Use esta sequência ao apresentar:

1. Abra o blueprint e mostre a linha superior: é o caminho de uma mensagem ao vivo.
2. Aponte para OpenWA/Meta e diga que são transportes substituíveis.
3. Mostre o webhook e explique HMAC + resposta `200` rápida.
4. Mostre `src/server.js` e `src/agent.js`.
5. Envie uma mensagem de teste.
6. Mostre os logs de recebimento, geração e envio.
7. Repita o mesmo evento para demonstrar deduplicação.
8. Envie uma entrada de injection para demonstrar o guardrail.
9. Explique que histórico em memória é didático e que produção exige persistência.
10. Termine mostrando onde adicionar CRM, RAG e workers sem alterar o contrato do agente.

## Frase final

> “O sistema é uma cadeia de adapters e regras: o canal entrega um evento, o servidor autentica e normaliza, o agente decide com contexto e segurança, e o mesmo canal entrega a resposta. Para construir uma versão própria, começo pelo caminho mínimo de texto, testo cada fronteira e só depois adiciono persistência, RAG e automações.”


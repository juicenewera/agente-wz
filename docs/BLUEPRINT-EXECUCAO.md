# Blueprint de execução: do WhatsApp à resposta

Este documento acompanha [`blueprint-execucao.html`](./blueprint-execucao.html). Ele explica o que cada caixa representa, qual serviço executa a etapa, quais dados entram e saem e como uma mensagem percorre o sistema até o fim do workflow.

> Importante: o blueprint mostra a arquitetura operacional completa. O starter open source implementa integralmente o caminho de mensagem ao vivo (webhook → agente → resposta). Timers, CRM, RAG persistente e reconciliações aparecem como pontos de extensão para uma instalação de produção; eles não são ativados automaticamente neste pacote.

## 1. Visão geral

O sistema é um adaptador entre um canal de WhatsApp e um modelo de IA:

```text
WhatsApp
  → OpenWA ou Meta Cloud API
  → POST /webhooks/*
  → validação, filtro e deduplicação
  → histórico + guardrails
  → modelo compatível com OpenAI
  → envio pelo mesmo provedor
  → logs e estado operacional
```

O servidor não mantém uma conexão de conversa aberta. Cada mensagem é um evento HTTP independente. O identificador do contato (`from`) funciona como chave do histórico em memória.

## 2. Preparação do processo

Quando `npm start` é executado, `src/server.js` monta os componentes nesta ordem:

1. `carregarConfig()` lê as variáveis de ambiente em `src/config.js`.
2. `criarLogger()` prepara logs estruturados em `src/logger.js`.
3. `criarStoreMemoria()` cria o histórico por contato e o conjunto de IDs já processados.
4. `criarAgente()` instancia o cliente de IA, o histórico e os guardrails.
5. O provider é escolhido por `WHATSAPP_PROVIDER`:
   - `openwa` → `src/providers/openwa.js`;
   - `meta` → `src/providers/meta.js`.
6. O Express registra JSON, preservando o corpo bruto (`rawBody`) para validar HMAC.
7. O processo abre a porta configurada e registra `servidor_iniciado`.

Nesse momento o servidor ainda não fala com o WhatsApp por conta própria. O OpenWA ou a Meta precisam estar configurados para entregar eventos ao endpoint público do agente.

## 3. Etapas do caminho principal

### 3.1 Lead no WhatsApp

O cliente envia uma mensagem de texto. O WhatsApp entrega o evento ao transporte configurado. O starter processa texto; áudio, imagem e outros tipos precisam de um transcritor ou tratador adicional antes de chegarem ao modelo.

### 3.2 OpenWA ou Meta Cloud API

Esses componentes são a fronteira do WhatsApp:

- **OpenWA** mantém uma sessão baseada em WhatsApp Web, normalmente autenticada por QR code. Ele chama o webhook OpenWA quando chega uma mensagem.
- **Meta Cloud API** recebe a mensagem na infraestrutura da Meta e chama o webhook oficial. Não há QR code no fluxo da API oficial.

O restante da aplicação não precisa conhecer os formatos específicos. Cada provider traduz seu payload para o formato interno:

```js
{ id, from, text, name, timestamp }
```

#### Como o OpenWA funciona dentro da VPS

Na instalação com Docker, o OpenWA é um serviço separado, normalmente executado em um container na VPS:

```text
VPS com IP público e HTTPS
  └─ Docker Compose
      ├─ container OpenWA
      │    └─ sessão WhatsApp Web + QR + chamadas ao WhatsApp
      └─ container Agent Zap
           └─ Express /webhooks/openwa + agente + envio
```

O ciclo real é:

1. O container OpenWA inicia e cria ou restaura uma sessão.
2. Se a sessão não estiver autenticada, o OpenWA disponibiliza um QR code.
3. O operador lê o QR no celular; a sessão fica armazenada no volume do container.
4. O WhatsApp Web mantém a sessão conectada dentro do OpenWA.
5. Quando o cliente envia uma mensagem, o OpenWA recebe o evento e faz um `POST` para `http://agent-zap:PORT/webhooks/openwa` na rede Docker (ou para a URL HTTPS pública, conforme a topologia).
6. O Agent Zap valida `X-OpenWA-Signature`, normaliza o evento e processa a mensagem.
7. Depois de gerar a resposta, o Agent Zap chama `/api/sessions/{session}/messages/send-text` no OpenWA.
8. O OpenWA converte essa chamada em uma ação do WhatsApp Web e o cliente recebe a mensagem.

O volume é importante: sem ele, recriar o container pode apagar a sessão e exigir um novo QR code. O OpenWA deve ficar protegido por rede privada, autenticação e firewall; normalmente apenas o endpoint do Agent Zap fica público atrás de HTTPS.

O Docker não muda o protocolo do WhatsApp. Ele apenas empacota, isola e conecta os processos. A sessão continua sendo uma sessão do WhatsApp Web controlada pelo OpenWA.

### 3.3 Express `/webhook`

O Express recebe:

- `POST /webhooks/openwa` para OpenWA;
- `GET /webhooks/meta` para o handshake da Meta;
- `POST /webhooks/meta` para eventos da Meta.

Antes de processar uma mensagem, o servidor preserva o corpo original. Isso é necessário porque a assinatura criptográfica deve ser calculada sobre os bytes recebidos, e não sobre um JSON reformatado.

No caso da Meta, o `GET` compara `hub.verify_token` com `META_VERIFY_TOKEN` e devolve `hub.challenge`. Se o token não confere, responde `403`.

### 3.4 Gates: segurança, identidade e handoff

O primeiro gate impede que uma chamada não autorizada entre no fluxo:

- OpenWA usa `X-OpenWA-Signature` e `OPENWA_WEBHOOK_SECRET`.
- Meta usa `X-Hub-Signature-256` e `META_APP_SECRET`.
- A validação usa HMAC-SHA256 em `src/security.js` e comparação em tempo constante.

Se a assinatura estiver inválida, o servidor responde `401` e não chama a IA.

Depois o provider aplica os filtros próprios:

- descarta eventos que não são mensagens suportadas;
- descarta mensagens enviadas pelo próprio agente (`fromMe` no OpenWA);
- descarta texto vazio;
- extrai o contato, nome, ID e timestamp.

Esse é o handoff: o payload externo deixa de ser responsabilidade do provider e passa a ser uma mensagem normalizada para o agente.

### 3.5 Confirmação HTTP rápida

Depois de passar pela assinatura, o servidor envia `200` imediatamente e agenda o processamento com `queueMicrotask`. Assim, o provedor não fica esperando a chamada do modelo de IA e tem menos chance de reenviar o mesmo webhook por timeout.

O `200` confirma o recebimento HTTP; ele não significa que a resposta ao cliente já foi enviada. O resultado do processamento aparece nos logs.

### 3.6 Fila e debounce lógico

O starter usa uma fila mínima no processo: o callback assíncrono percorre as mensagens extraídas e aguarda cada resposta antes de enviar a próxima.

O controle de duplicidade fica em `store.jaProcessada(id)`:

1. se o ID já está no conjunto, a mensagem é ignorada;
2. se é nova, o ID é marcado antes da geração;
3. o conjunto é limitado a 10.000 IDs para não crescer indefinidamente.

Isso evita responder duas vezes ao mesmo webhook, mas não é uma fila durável. Se o processo reiniciar, o conjunto é perdido. Para produção, substitua esse trecho por Redis, Postgres ou uma fila dedicada com idempotência.

### 3.7 `atenderLead` / `criarAgente`

No starter, o papel do bloco `atenderLead` é executado por `criarAgente().responder()` em `src/agent.js`:

1. adiciona a mensagem do usuário ao histórico do contato;
2. executa `analisarEntrada()`;
3. se houver sinais fortes de prompt injection/jailbreak, registra o bloqueio e devolve `RESPOSTA_GUARDRAIL` sem chamar o modelo;
4. caso contrário, monta as mensagens para a IA;
5. chama `chat.completions.create()` no endpoint configurado;
6. valida se o modelo devolveu texto;
7. grava a resposta do assistente no histórico;
8. devolve a string para o servidor.

O prompt de sistema combina a instrução anti-injeção, `AI_SYSTEM_PROMPT`, nome do agente e nome da empresa. O histórico é limitado por `AI_MAX_HISTORY_MESSAGES`.

### 3.8 Guardrails e regras determinísticas

Guardrails ficam antes do modelo para que uma entrada claramente maliciosa não seja capaz de alterar as instruções do agente. Eles detectam, entre outros sinais, pedidos para ignorar instruções, revelar prompt, extrair segredos ou assumir uma persona privilegiada.

O guardrail é um bloqueio determinístico, não uma garantia de segurança completa. Segredos nunca devem ser colocados no prompt, no histórico ou no log. Regras comerciais, roteamento para humano, limites de preço e validação de dados devem continuar em código ou em serviços controlados.

### 3.9 RAG, contexto e modelo

O bloco `RAG` do diagrama representa uma fonte de conhecimento consultável antes da chamada de IA. No starter, o histórico é apenas memória local (`src/store.js`); não há Supabase ou Postgres conectado por padrão.

Em uma extensão com RAG, o caminho seria:

```text
contato + mensagem
  → busca de documentos relevantes
  → contexto filtrado por permissão
  → prompt do agente
  → modelo
```

O modelo é acessado por uma API compatível com o SDK OpenAI. Isso permite usar um provedor OpenAI-compatible configurando `AI_BASE_URL`, `AI_API_KEY` e `AI_MODEL`. A compatibilidade do endpoint não transforma OpenWA em API oficial da Meta.

### 3.10 Envio pelo OpenWA ou Meta

Quando o agente retorna uma resposta:

- OpenWA faz `POST {OPENWA_URL}/api/sessions/{OPENWA_SESSION_ID}/messages/send-text`, enviando `{ chatId, text }`.
- Meta faz `POST https://graph.facebook.com/{META_GRAPH_VERSION}/{META_PHONE_NUMBER_ID}/messages`, com token Bearer e o contrato oficial de mensagem de texto.

O mesmo provider que recebeu o evento é usado para responder. Se o endpoint retornar HTTP diferente de sucesso, o provider lança um erro e o servidor registra `processamento_falhou`.

### 3.11 Logs e monitoramento

Os eventos principais são:

- `servidor_iniciado` — processo pronto;
- `mensagem_recebida` — evento aceito e normalizado;
- `mensagem_duplicada` — evento descartado por repetição;
- `guardrail_prompt_injection_bloqueado` — bloqueio preventivo;
- `resposta_gerada` — modelo devolveu texto;
- `mensagem_enviada` — transporte confirmou o envio;
- `processamento_falhou` — falha em qualquer etapa após o `200`.

O endpoint `GET /health` confirma que o processo está vivo e informa o provider selecionado. Ele não confirma que OpenWA, Meta, o modelo ou o banco estão saudáveis; esses checks devem ser adicionados em uma instalação de produção.

## 4. Caminhos assíncronos do blueprint

As caixas inferiores mostram trabalhos que normalmente rodam em timers ou workers separados:

| Bloco | Para que serve | Como se conecta |
|---|---|---|
| Timers no processo | dispara verificações periódicas | chama os workers em intervalos definidos |
| Leads do site | lê novos leads de um formulário/CRM | transforma o lead em contexto e inicia o atendimento |
| Retomadas e resgates | procura conversas sem resposta | agenda uma nova mensagem usando o mesmo provider |
| Follow-ups | executa cadências autorizadas | envia somente quando a regra e o horário permitem |
| Reconciliações | compara fila, identidade e CRM | corrige divergências e gera alertas |
| Kommo | CRM de lead, etapa e responsável | recebe ou fornece estado comercial |
| Supabase/Postgres | histórico, fila e documentos RAG | persiste dados que não podem depender da memória do processo |
| Logs e monitoramento | métricas, alertas e auditoria | observa o caminho inteiro e os erros |

Esses blocos não devem ser confundidos com uma implementação presente em `src/server.js`. Eles descrevem como evoluir o starter sem colocar todos os trabalhos dentro do webhook.

## 5. Workflow completo, passo a passo

1. O processo inicia e valida configuração.
2. OpenWA ou Meta recebe a mensagem no WhatsApp.
3. O provedor envia um webhook para o endpoint correspondente.
4. Express preserva o corpo bruto.
5. HMAC/handshake autentica a chamada.
6. O adapter ignora eventos incompatíveis e normaliza a mensagem.
7. O servidor responde `200` ao webhook.
8. A rotina assíncrona verifica duplicidade pelo ID.
9. A mensagem entra no histórico do contato.
10. O guardrail decide entre bloqueio seguro ou continuação.
11. O agente monta o prompt com sistema e histórico.
12. A API do modelo gera o texto.
13. O texto é validado e salvo no histórico.
14. O provider envia a resposta ao WhatsApp.
15. O logger registra sucesso ou falha.
16. Em produção, workers podem persistir o estado, atualizar CRM, executar follow-up e alertar um operador.

## 6. Onde investigar quando algo falha

| Sintoma | Primeiro ponto de investigação |
|---|---|
| webhook retorna `401` | segredo e cabeçalho HMAC |
| Meta não ativa o webhook | `META_VERIFY_TOKEN`, URL HTTPS e `GET /webhooks/meta` |
| mensagem chega mas não responde | logs `processamento_falhou`, chave/modelo da IA |
| resposta duplicada | persistência de IDs e fila durável |
| OpenWA recebe mas não envia | URL, sessão, chave e endpoint `/send-text` |
| Meta recebe mas não envia | token, `PHONE_NUMBER_ID`, versão Graph e permissões |
| histórico desaparece | comportamento intencional do store em memória; migrar para banco |
| RAG não aparece | RAG não está implementado no starter; adicionar adapter e persistência |

## 7. Limites e responsabilidade operacional

O blueprint separa claramente o caminho síncrono do webhook dos trabalhos assíncronos. O webhook deve ser curto, autenticado e idempotente. Busca RAG, CRM, follow-up, reconciliação e tarefas demoradas devem usar workers e armazenamento durável quando o sistema for levado para produção.

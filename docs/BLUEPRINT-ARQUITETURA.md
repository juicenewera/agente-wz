# Agent Zap — blueprint completo da arquitetura

Este documento explica a versão open source limpa do Agent Zap: o que existe, como uma mensagem atravessa o sistema, quais ferramentas são usadas, onde ficam os limites e como o projeto pode evoluir para produção.

## 1. Visão em uma frase

O Agent Zap é um servidor Node.js que recebe uma mensagem por um adapter de WhatsApp, valida e deduplica o webhook, aplica guardrails, monta um histórico, chama um modelo compatível com a API da OpenAI e envia a resposta pelo mesmo adapter.

## 2. Blueprint visual

- [Abrir o blueprint horizontal no formato do exemplo](./blueprint-execucao.html)
- [Abrir o blueprint interativo de componentes](./blueprint-arquitetura.html)
- [Especificação do diagrama](./blueprint.architecture.json)

O HTML é autocontido: oferece zoom, busca, rastreamento de relações, tema claro/escuro e exportação. O diagrama foi validado com nove verificações de composição, sem cruzamentos ou avisos.

## 3. Arquitetura em camadas

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Usuário / WhatsApp                                                  │
│  OpenWA (WhatsApp Web, não oficial) OU Meta Cloud API (oficial)     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ webhook HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Agent Zap — Node.js 22 + Express 5                                 │
│  server.js → HMAC → normalização → deduplicação                     │
│       ↓                                                             │
│  guardrails anti-injection/jailbreak                                │
│       ↓                                                             │
│  agent.js → histórico → system prompt → modelo                      │
│       ↓                    ↓                                        │
│  Store em memória       API OpenAI-compatible                       │
│       └──────── resposta → adapter de envio                         │
└─────────────────────────────────────────────────────────────────────┘
```

### Componentes externos

| Componente | Função | Observação |
|---|---|---|
| WhatsApp | Canal do cliente | Não é acessado diretamente pelo servidor |
| OpenWA | Eventos e envio pelo WhatsApp Web | Não oficial; depende de sessão e QR code |
| Meta Cloud API | Webhooks e envio pela Graph API | Oficial; exige conta, número, token e políticas |
| Provedor de IA | Geração de texto | OpenAI, OpenRouter, NVIDIA NIM ou endpoint compatível |

### Entrada HTTP e transporte

`src/server.js` recebe o webhook, valida a assinatura quando configurada, confirma o recebimento HTTP, normaliza o payload, ignora ecos/duplicatas, chama o agente e envia a resposta pelo adapter escolhido.

Os adapters isolam os contratos incompatíveis entre OpenWA e Meta. O restante do sistema trabalha com uma mensagem interna comum.

### Segurança

`src/security.js` valida HMAC dos webhooks. `src/guardrails.js` analisa o texto antes da IA e bloqueia tentativas explícitas de ignorar regras, extrair o prompt, ativar jailbreak, obter credenciais ou executar comandos. O system prompt também trata mensagens, imagens, anexos e resultados de ferramentas como dados não confiáveis.

### Agente de IA

`src/agent.js` adiciona a fala ao histórico, verifica os guardrails, monta o system prompt, limita o contexto, chama o modelo, rejeita resposta vazia, salva a resposta e devolve texto ao servidor. Ele não conhece OpenWA, Meta, QR code, CRM ou banco de produção.

### Estado

`src/store.js` mantém em memória as mensagens recentes e os IDs processados. Isso é adequado para demonstração, mas reiniciar o processo perde o histórico e a deduplicação. Em produção, use Postgres, Redis ou outra store persistente, com idempotência também na saída.

## 4. Ciclo de uma mensagem

```text
1. Cliente envia mensagem
2. Provider entrega webhook
3. Express valida assinatura e confirma HTTP
4. Adapter normaliza o payload
5. Deduplicação descarta reentrega
6. Guardrail avalia injection/jailbreak
7. Store carrega histórico
8. Agent monta system prompt + histórico
9. SDK OpenAI chama o provedor
10. Resposta vazia é rejeitada
11. Store salva a resposta
12. Adapter envia texto ao WhatsApp
13. Logger registra sucesso ou falha
```

## 5. Ferramentas e frameworks

| Tecnologia | Uso |
|---|---|
| Node.js 22+ | Runtime |
| JavaScript ESM | Módulos `import`/`export` |
| Express 5 | HTTP e webhooks |
| `openai` SDK 6 | Chat Completions |
| OpenWA | Provider opcional não oficial |
| Meta Graph API | Provider oficial opcional |
| HMAC SHA-256 | Autenticidade de webhook |
| Docker / Compose | Empacotamento e execução |
| Node test runner | Testes automatizados |
| Archify | Blueprint interativo |

O starter não inclui frontend obrigatório, ORM, fila, Redis ou banco. Essas ausências são intencionais.

## 6. Configuração

As variáveis principais estão em `.env.example`: `WHATSAPP_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `SYSTEM_PROMPT`, `AGENT_NAME`, `BUSINESS_NAME`, `MAX_HISTORY_MESSAGES` e as credenciais específicas de OpenWA ou Meta. O boot falha quando faltam credenciais obrigatórias do provider escolhido.

## 7. OpenWA versus API oficial

OpenWA automatiza uma sessão do WhatsApp Web e normalmente usa QR code, sessão persistente e IDs próprios. É útil para uma conta existente, mas não é oficial e pode desconectar ou sofrer restrições.

A Meta Cloud API usa webhooks assinados e Graph API. Não usa QR code e não reaproveita automaticamente contratos de OpenWA. Trocar apenas a URL não é uma migração completa: payloads, autenticação, mídia, grupos e envio são diferentes.

## 8. Operação e observabilidade

O logger registra recebimento, deduplicação, guardrails, chamada da IA, resposta e envio. `/health` confirma o processo, não a saúde completa do WhatsApp ou do provedor de IA.

Antes de produção, adicione store persistente, fila durável, idempotência de saída, métricas, alertas, tracing por `messageId`, retenção/mascaramento de logs, backups, política de privacidade, rate limiting e testes de contrato dos providers.

## 9. O que é exclusivo da instalação comercial

A versão open source não contém dados do Clube Carvão, Kommo, Supabase/RAG, follow-ups, distribuição Sofia/Belizia, motor de orçamento, mídia, áudio, TTS ou alertas de grupo. Essas capacidades são extensões de domínio sobre este núcleo.

## 10. Execução

```bash
cp .env.example .env
npm install
npm test
npm start
```

Com Docker:

```bash
cp .env.example .env
docker compose up -d --build
```

Depois configure o webhook e verifique `GET /health`.

## 11. Limites

Guardrails reduzem prompt injection, mas não substituem controle de acesso. O modelo pode errar ou ficar indisponível. O histórico padrão é volátil. OpenWA não é API oficial. E um status HTTP saudável não prova que o caminho inteiro até o WhatsApp está funcionando.

Para começar, abra o [diagrama HTML](./blueprint-arquitetura.html). Para operar, leia [CONFIGURACAO.md](./CONFIGURACAO.md), [OPENWA.md](./OPENWA.md), [API-OFICIAL.md](./API-OFICIAL.md) e [PRODUCAO.md](./PRODUCAO.md).

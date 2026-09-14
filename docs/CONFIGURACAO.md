# Configuração, variável por variável

## Servidor

| Variável | Obrigatória | Função |
|---|---:|---|
| `PORT` | não | Porta HTTP; padrão `3000` |
| `LOG_LEVEL` | não | `debug`, `info`, `warn` ou `error` |
| `WHATSAPP_PROVIDER` | sim | `openwa` ou `meta` |

## Inteligência artificial

| Variável | Obrigatória | Função |
|---|---:|---|
| `AI_BASE_URL` | não | Base de uma API compatível com OpenAI |
| `AI_API_KEY` | sim | Credencial do provedor de IA |
| `AI_MODEL` | não | Identificador aceito pelo provedor |
| `SYSTEM_PROMPT` | não | Papel, limites e tom do agente |
| `AGENT_NAME` | não | Nome apresentado no prompt |
| `BUSINESS_NAME` | não | Empresa apresentada no prompt |
| `MAX_HISTORY_MESSAGES` | não | Máximo de mensagens guardadas por contato em RAM |

O cliente usa Chat Completions. Se o provedor implementar somente outra API, crie um adapter em `agent.js`.

## OpenWA

| Variável | Obrigatória | Função |
|---|---:|---|
| `OPENWA_URL` | sim | URL privada do gateway |
| `OPENWA_API_KEY` | conforme gateway | Header `X-API-Key` |
| `OPENWA_SESSION_ID` | sim | Sessão/conta conectada |
| `OPENWA_WEBHOOK_SECRET` | recomendada | HMAC do webhook, se suportado pelo gateway |

## Meta Cloud API

| Variável | Obrigatória | Função |
|---|---:|---|
| `META_GRAPH_VERSION` | sim | Versão suportada da Graph API |
| `META_PHONE_NUMBER_ID` | sim | ID técnico do número, não o telefone visível |
| `META_ACCESS_TOKEN` | sim | Bearer token com permissão de mensagens |
| `META_VERIFY_TOKEN` | sim | Segredo escolhido por você para o handshake |
| `META_APP_SECRET` | recomendada | Segredo do app para validar o corpo recebido |

## Política de precedência

Somente as variáveis do provider selecionado são exigidas. Trocar de provider não reaproveita IDs: `@lid/@c.us`, `wa_id` e `phone_number_id` têm significados diferentes.

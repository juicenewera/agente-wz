# Agent Zap — edição open source

Edição limpa e genérica do Agent Zap para receber mensagens do WhatsApp, gerar uma resposta com IA e devolvê-la ao usuário. O transporte do WhatsApp é selecionável por configuração:

- **OpenWA**: automação não oficial de uma conta comum/Business por meio do WhatsApp Web.
- **Meta Cloud API**: API oficial da WhatsApp Business Platform.

Esta pasta é uma distribuição independente. Ela não contém nomes de clientes, preços, CRM, dados de produção, sessões de WhatsApp ou regras comerciais da instalação original.

## Resposta curta: funciona com a API oficial?

**Esta edição funciona**, para mensagens de texto recebidas e respostas de texto, usando `WHATSAPP_PROVIDER=meta`. Uma instalação construída diretamente sobre OpenWA não funciona automaticamente com a API oficial porque o contrato de webhook, IDs de conversa, envio de mídia, grupos, QR code e detecção de mensagens `fromMe` são específicos do OpenWA. Migrar o sistema completo exige adaptar esses recursos; não basta trocar a URL.

## Fluxo

```text
WhatsApp
   │ mensagem
   ▼
OpenWA ou Meta Cloud API
   │ webhook HTTP
   ▼
src/server.js ──► deduplicação ──► histórico ──► modelo de IA
   ▲                                                    │
   └──────── adapter envia a resposta ao WhatsApp ◄─────┘
```

## Instalação local

Pré-requisitos: Node.js 22 ou superior, uma chave de um provedor de IA compatível com a API da OpenAI e um dos provedores de WhatsApp configurado.

```bash
cp .env.example .env
npm install
npm test
npm start
```

Depois:

- OpenWA: configure o webhook para `POST https://SEU_HOST/webhooks/openwa`.
- Meta: configure a callback como `https://SEU_HOST/webhooks/meta`, usando o mesmo `META_VERIFY_TOKEN`, e assine o campo `messages`.

O endpoint `GET /health` retorna o estado básico do processo.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

Em produção, publique apenas a rota de webhook por HTTPS e mantenha qualquer OpenWA em rede privada.

## Estrutura

| Arquivo | Responsabilidade |
|---|---|
| `src/server.js` | HTTP, webhooks, confirmação rápida e orquestração |
| `src/agent.js` | Chamada do modelo e montagem do histórico |
| `src/store.js` | Histórico e deduplicação em memória |
| `src/providers/openwa.js` | Traduz payloads e chamadas HTTP do OpenWA |
| `src/providers/meta.js` | Traduz webhooks e envios da Meta Cloud API |
| `src/security.js` | Validação HMAC dos webhooks |
| `src/config.js` | Leitura e validação das variáveis de ambiente |
| `docs/ARQUITETURA.md` | Explicação detalhada do caminho de cada mensagem |
| `docs/OPENWA.md` | O que é OpenWA e como conectá-lo |
| `docs/API-OFICIAL.md` | Diferenças e configuração da Meta Cloud API |
| `docs/PRODUCAO.md` | O que acrescentar antes de operar em escala |
| `docs/CONFIGURACAO.md` | Explicação de cada variável de ambiente |
| `docs/PUBLICAR.md` | Como extrair esta pasta sem expor o projeto comercial |
| `docs/GUIA-COMPLETO.md` | Visão integral do projeto em um único documento |
| `docs/BLUEPRINT-ARQUITETURA.md` | Blueprint completo: arquitetura, ferramentas, fluxos e limites |
| `docs/blueprint-arquitetura.html` | Diagrama arquitetural interativo validado |
| `docs/blueprint-execucao.html` | Fluxograma horizontal completo no formato operacional |
| `docs/BLUEPRINT-EXECUCAO.md` | Explicação passo a passo de cada etapa do fluxograma |
| `docs/ROTEIRO-APRESENTACAO-E-CONSTRUCAO.md` | Roteiro para explicar o sistema e construí-lo do zero |

## Limites intencionais

Este starter é pequeno para ser compreensível. O histórico e a deduplicação são voláteis: reiniciar o processo apaga ambos. Antes de produção, troque `store.js` por Postgres/Redis, implemente fila durável, retentativas, idempotência de saída, observabilidade e política de privacidade. Veja [docs/PRODUCAO.md](docs/PRODUCAO.md).

## Licença e risco

O starter usa MIT. OpenWA não está incluído e possui licença/termos próprios. OpenWA é não oficial e pode levar a restrição ou banimento da conta. A API oficial exige conta empresarial, número registrado, tokens e conformidade com as políticas da Meta. Leia [THIRD_PARTY.md](THIRD_PARTY.md).

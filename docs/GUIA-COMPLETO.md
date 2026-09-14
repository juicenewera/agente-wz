# Agent Zap Open Source — guia completo

Este é o documento canônico da edição aberta. Ele explica o objetivo, todos os componentes, o caminho completo de uma mensagem, as duas formas de conexão com WhatsApp, segurança, execução, testes e limites.

## 1. O que o projeto faz

O Agent Zap recebe uma mensagem de texto pelo WhatsApp, converte o formato do provedor para um contrato interno simples, evita processar o mesmo evento duas vezes, acrescenta o histórico do contato, pede uma resposta a um modelo de IA e envia essa resposta pelo mesmo provedor.

O núcleo é independente do transporte. A variável `WHATSAPP_PROVIDER` escolhe:

- `openwa`: gateway não oficial baseado no WhatsApp Web;
- `meta`: WhatsApp Business Platform Cloud API oficial.

Esta edição não contém dados, credenciais, mídia, contatos, preços ou regras da instalação que lhe deu origem.

## 2. O que está incluído

- servidor HTTP Express;
- health check;
- webhook OpenWA;
- webhook oficial Meta, incluindo handshake;
- validação opcional de assinatura HMAC;
- normalização dos dois formatos de mensagem;
- deduplicação de webhooks em RAM;
- histórico curto por contato em RAM;
- cliente de IA configurável por `baseURL`;
- envio de resposta de texto;
- logs JSON estruturados;
- Docker, Compose, testes e documentação.

Não estão incluídos CRM, orçamento, campanhas, follow-up, mídia, transcrição, RAG ou painel. Esses recursos precisam ser módulos opcionais, porque misturá-los ao núcleo dificultaria entender, proteger e reutilizar o projeto.

## 3. Visão geral

```text
Pessoa
  │
  ▼
WhatsApp
  │
  ├── OpenWA ───────────────► POST /webhooks/openwa
  │
  └── Meta Cloud API ───────► GET/POST /webhooks/meta
                                      │
                                      ▼
                              validação de assinatura
                                      │
                                      ▼
                                  normalização
                                      │
                                      ▼
                                  deduplicação
                                      │
                                      ▼
                              histórico + modelo IA
                                      │
                                      ▼
                              adapter envia resposta
```

## 4. Responsabilidade de cada arquivo

### `src/server.js`

É o ponto de composição. Carrega configuração, cria dependências, registra as rotas e liga a porta. Responde ao webhook rapidamente e processa depois, reduzindo a chance de o provedor reenviar por timeout.

### `src/config.js`

Transforma `process.env` em um objeto previsível. Valida o nome do provider e exige somente as credenciais necessárias para o modo escolhido. Não lê arquivos de negócio.

### `src/providers/openwa.js`

Entende o envelope `message.received`, ignora mensagens `fromMe`, preserva o `chatId` e chama o endpoint HTTP de envio da sessão. Se outra distribuição do OpenWA tiver uma rota diferente, este é o único adapter que precisa mudar.

### `src/providers/meta.js`

Valida o handshake do webhook, percorre o envelope `whatsapp_business_account`, extrai mensagens de texto e envia pelo endpoint Graph `/{PHONE_NUMBER_ID}/messages`.

### `src/agent.js`

Cria o cliente compatível com OpenAI, combina system prompt e histórico, chama Chat Completions e rejeita uma resposta vazia. Ele não conhece webhooks nem números de telefone.

### `src/store.js`

Guarda, em memória, histórico e IDs processados. Limita o histórico e também limita o conjunto de IDs para a RAM não crescer indefinidamente. É propositalmente substituível.

### `src/security.js`

Calcula HMAC SHA-256 sobre os bytes originais do corpo e usa comparação de tempo constante. A Meta envia `X-Hub-Signature-256`; um gateway OpenWA compatível pode enviar `X-OpenWA-Signature`.

### `src/logger.js`

Produz uma linha JSON por evento. O exemplo registra IDs técnicos e tamanho do texto, mas não grava o conteúdo das conversas.

## 5. Inicialização passo a passo

1. O Node carrega `.env` quando iniciado pelo script `npm start`.
2. `carregarConfig()` valida IA e provider.
3. O store em memória é criado.
4. O SDK de IA é configurado.
5. O adapter OpenWA ou Meta é selecionado.
6. O Express instala o parser JSON, preservando `rawBody`.
7. `/health` e o webhook selecionado são registrados.
8. O servidor passa a ouvir em `PORT`.

Se faltar uma variável obrigatória, o processo encerra no boot com o nome da variável. Isso evita um agente aparentemente saudável, mas incapaz de responder.

## 6. Caminho de uma mensagem OpenWA

1. A conta é vinculada ao OpenWA por QR code/código.
2. O OpenWA recebe a mensagem pelo WhatsApp Web.
3. Ele chama `/webhooks/openwa` com `event=message.received`.
4. O adapter ignora eventos diferentes, ecos `fromMe` e mensagens sem texto.
5. O ID como `5511...@c.us` ou `@lid` é preservado.
6. Depois da IA, a resposta vai para `/api/sessions/{session}/messages/send-text` com `{chatId,text}`.

OpenWA é o ponto único de entrada e saída nesse modo. Se ele estiver desconectado, o servidor do agente pode responder `/health`, mas não conversa com ninguém. Uma readiness completa deve testar também a sessão.

## 7. Caminho de uma mensagem Meta

1. A Meta valida a callback com `GET /webhooks/meta`.
2. O projeto compara `hub.verify_token` e devolve `hub.challenge`.
3. Mensagens chegam em `POST /webhooks/meta`.
4. Se `META_APP_SECRET` estiver configurado, a assinatura é validada.
5. O adapter percorre `entry → changes → value → messages`.
6. O `wa_id`, texto, ID e nome do perfil viram o contrato interno.
7. A resposta é enviada para `https://graph.facebook.com/{version}/{phone_number_id}/messages`.

Não há QR code nesse modo. A autenticação usa ativos empresariais, número registrado e token.

## 8. Deduplicação e memória

Webhooks trabalham com entrega pelo menos uma vez: repetir um evento é normal. O store marca o ID antes do processamento. Isso impede respostas duplicadas dentro da mesma execução.

Como o estado está em RAM, reiniciar apaga a proteção e o histórico. Para produção, grave o ID em uma tabela com chave única e só confirme efeitos externos por uma outbox durável.

## 9. Inteligência artificial

`AI_BASE_URL`, `AI_API_KEY` e `AI_MODEL` desacoplam o projeto de um fornecedor específico. O system prompt define comportamento; nome do agente e empresa são acrescentados pelo código. Apenas a janela mais recente é enviada para limitar contexto e custo.

O exemplo aceita a saída do modelo como texto. Sistemas comerciais precisam validar políticas e qualquer ação irreversível em código determinístico.

## 10. Execução local

```bash
cp .env.example .env
npm ci
npm test
npm start
```

Teste `http://localhost:3000/health`. O webhook precisa ser HTTPS e alcançável pelo provedor quando não estiver na mesma rede.

## 11. Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
docker compose logs -f agent
```

O Compose injeta as variáveis do `.env`, publica a porta 3000 e verifica `/health`. Em produção, coloque um proxy HTTPS na frente e restrinja a exposição das demais rotas.

## 12. Testes

Os testes comprovam:

- normalização OpenWA e descarte de eco;
- normalização do webhook Meta;
- handshake da Meta;
- contrato exato dos dois envios HTTP;
- deduplicação e limite do histórico;
- validação das configurações;
- integridade da assinatura HMAC.

O build Docker e um smoke test do `/health` validam o empacotamento real.

## 13. Segurança

- Nunca publique `.env`, QR, sessão, token ou conversa.
- Habilite assinaturas de webhook.
- Use token de sistema e rotação de credenciais.
- Mantenha OpenWA em rede privada.
- Não registre conteúdo integral ou telefone aberto sem necessidade.
- Defina consentimento, opt-out, retenção e exclusão antes do uso real.

## 14. API oficial: nível de compatibilidade

A edição aberta está pronta para atendimento reativo de texto pela Cloud API. Paridade completa com uma instalação avançada requer templates para contatos proativos, mídia, status de entrega, inbox humana, persistência e substituição de recursos sem equivalente direto, como alertas em grupo.

## 15. Como evoluir sem perder a limpeza

Novos canais entram como adapters. Persistência entra por outra implementação do contrato do store. CRM e ferramentas externas ficam depois do núcleo. Regras críticas viram funções puras testadas. Essa separação mantém a parte conversacional reutilizável e impede que particularidades de uma empresa contaminem todo o sistema.

## 16. Publicação

Publique somente esta pasta em um repositório novo, sem herdar o histórico do projeto privado. Veja `PUBLICAR.md`. A licença MIT cobre esta edição; OpenWA e os serviços externos continuam sujeitos às próprias licenças e termos.

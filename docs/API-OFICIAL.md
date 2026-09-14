# API oficial do WhatsApp

## Resposta objetiva

Sim, o núcleo desta edição funciona com a **WhatsApp Business Platform Cloud API**, selecionando `WHATSAPP_PROVIDER=meta`. O adapter incluído cobre webhook de texto, verificação da callback, assinatura `X-Hub-Signature-256` e resposta de texto.

Uma instalação originalmente acoplada ao OpenWA não é compatível de forma direta. Recursos dependentes dele precisam de equivalentes próprios na Meta.

## Configuração

Você precisa de portfólio empresarial da Meta, WhatsApp Business Account, número registrado, aplicativo, `PHONE_NUMBER_ID`, token com permissão de mensagens e webhook HTTPS público.

```env
WHATSAPP_PROVIDER=meta
META_GRAPH_VERSION=v23.0
META_PHONE_NUMBER_ID=123456789
META_ACCESS_TOKEN=token-de-sistema
META_VERIFY_TOKEN=segredo-escolhido-por-voce
META_APP_SECRET=app-secret-da-meta
```

`META_GRAPH_VERSION` é configurável porque versões da Graph API expiram. Use uma versão suportada no momento da instalação.

Na área de configuração do WhatsApp no Meta for Developers:

1. informe `https://seu-dominio/webhooks/meta`;
2. use o mesmo valor de `META_VERIFY_TOKEN`;
3. assine o campo `messages`;
4. mantenha `META_APP_SECRET` no servidor para validar POSTs;
5. use um token de sistema adequado à produção, não um token temporário de teste.

## Contrato de envio

O adapter faz:

```http
POST https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {META_ACCESS_TOKEN}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "5511999999999",
  "type": "text",
  "text": { "preview_url": false, "body": "Resposta" }
}
```

## Diferenças importantes

| Tema | OpenWA | Meta Cloud API |
|---|---|---|
| Natureza | Não oficial, automatiza WhatsApp Web | Oficial, hospedada pela Meta |
| Login | QR/código de vinculação | Ativos empresariais e tokens |
| Identificador | `@c.us`, `@lid`, grupos | número/`wa_id`, `phone_number_id` |
| Webhook | formato definido pelo gateway | envelope `whatsapp_business_account` |
| Iniciar conversa | comportamento da conta automatizada | exige observar regras e templates aplicáveis |
| Grupos | recursos do WhatsApp Web podem existir | Cloud API é orientada a conversas individuais; não presuma equivalência de grupos |
| Handoff | pode observar `fromMe` no aparelho | deve ser modelado com inbox/estado de atendimento |
| Risco de ban | maior, por ser não oficial | caminho suportado, sujeito às políticas da Meta |

## O que falta para paridade completa

- templates aprovados para contatos proativos fora da janela permitida;
- upload/download de imagens, áudio e documentos pela Graph API;
- leitura de status `sent`, `delivered`, `read` e `failed`;
- inbox humana e estado explícito de handoff;
- substituição dos avisos em grupos por CRM, e-mail, Slack ou outro canal;
- migração dos IDs históricos `@lid/@c.us` para `wa_id`;
- consentimento, opt-out, retenção e exclusão de dados.

Portanto: texto reativo funciona nesta edição; paridade com uma instalação completa exige uma migração planejada.

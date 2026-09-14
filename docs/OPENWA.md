# OpenWA: o que é e como este projeto acessa

## O que é

OpenWA (`@open-wa/wa-automate`) é um projeto independente que automatiza o WhatsApp Web e pode expor uma Easy API HTTP. Ele usa uma sessão ligada a uma conta de WhatsApp, normalmente autenticada por QR code ou código de vinculação. Não é um produto da Meta nem a API oficial.

Consequências práticas:

- permite automações próximas ao comportamento do WhatsApp Web;
- pode trabalhar com IDs como `5511...@c.us` e IDs opacos `@lid`;
- a sessão precisa ser preservada e continuar válida;
- mudanças do WhatsApp Web podem quebrar a automação;
- existe risco de restrição ou banimento da conta;
- a licença e os termos do OpenWA precisam ser analisados separadamente.

## Como o starter acessa

Entrada:

```http
POST /webhooks/openwa
Content-Type: application/json

{
  "event": "message.received",
  "data": {
    "id": "...",
    "from": "5511999999999@c.us",
    "body": "Olá",
    "fromMe": false
  }
}
```

Saída:

```http
POST {OPENWA_URL}/api/sessions/{OPENWA_SESSION_ID}/messages/send-text
X-API-Key: {OPENWA_API_KEY}
Content-Type: application/json

{
  "chatId": "5511999999999@c.us",
  "text": "Olá! Como posso ajudar?"
}
```

O caminho exato acima corresponde ao gateway usado pelo projeto original. A Easy API padrão de outra versão do OpenWA pode expor rotas diferentes. Nesse caso, altere somente `src/providers/openwa.js`; o agente e os demais arquivos permanecem iguais.

## Configuração

```env
WHATSAPP_PROVIDER=openwa
OPENWA_URL=http://openwa:8080
OPENWA_API_KEY=uma-chave-forte
OPENWA_SESSION_ID=default
OPENWA_WEBHOOK_SECRET=outro-segredo-forte
```

Configure o OpenWA para chamar `https://seu-dominio/webhooks/openwa`. O OpenWA deve ficar em rede privada; não exponha o painel, QR, dados da sessão ou API sem autenticação.

## QR code e sessão

O QR autentica uma sessão equivalente a um dispositivo vinculado. O diretório/volume da sessão é uma credencial: quem o obtiver pode controlar a conta. Não versione, não envie por e-mail e inclua-o em backups criptografados com acesso restrito.

## Compatibilidade entre versões

Na documentação atual do projeto, a linha v4 é indicada para produção e a v5 permanece em alpha. Confirme a documentação da versão que você instalou antes de copiar comandos ou endpoints.

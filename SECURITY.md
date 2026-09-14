# Segurança

- Nunca versione `.env`, tokens, backups de sessão, QR codes ou conversas.
- Use HTTPS nos webhooks públicos.
- Na Meta, configure `META_APP_SECRET` para validar `X-Hub-Signature-256`.
- No OpenWA, mantenha o gateway em rede privada e use API key. A assinatura do webhook depende da distribuição do gateway; este starter aceita `X-OpenWA-Signature` no formato `sha256=<hex>`.
- Troque imediatamente qualquer segredo que tenha sido enviado a logs, commits ou tickets.

O agente inclui guardrails determinísticos contra prompt injection e jailbreak. Tentativas explícitas de substituir regras, extrair o prompt, assumir papel privilegiado ou obter credenciais são registradas e recebem uma resposta fixa; não chegam ao modelo. O system prompt também trata mensagens, imagens e resultados de ferramentas como dados não confiáveis. Isso é defesa em profundidade e não substitui autenticação, controle de acesso, gestão de segredos e revisão dos logs.

Relate vulnerabilidades por um canal privado do mantenedor do fork, nunca em uma issue pública com credenciais ou dados pessoais.

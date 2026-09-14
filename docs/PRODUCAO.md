# Checklist de produção

O código principal foi mantido pequeno para ensino. Antes de receber clientes reais:

## Confiabilidade

- Persistir mensagens e IDs processados em Postgres.
- Criar uma fila/outbox durável; confirmar o envio antes de marcar sucesso.
- Serializar mensagens por contato.
- Aplicar retry somente a falhas transitórias e com backoff.
- Guardar status de handoff humano e bloquear o bot enquanto o humano atende.

## Segurança e privacidade

- HTTPS obrigatório e validação de assinatura habilitada.
- Segredos em cofre, nunca na imagem Docker.
- Logs sem texto integral, tokens ou telefone aberto.
- Política de retenção, exclusão e atendimento a direitos do titular.
- Consentimento e opt-out aplicados antes de campanhas/follow-ups.
- Controle de acesso para painel, CRM, banco e sessão do OpenWA.

## IA

- Limite de tokens, timeout e fallback.
- Moderação e guardrails determinísticos para ações irreversíveis.
- Nunca deixar o modelo calcular preço, conceder desconto ou alterar CRM sem validação de código.
- Avaliações automatizadas e testes com conversas representativas.

## Operação

- Readiness que verifica IA, banco e WhatsApp, não apenas o processo.
- Métricas de recebimento, latência, falha de envio e conversas sem resposta.
- Alertas com motivo acionável e sem dados pessoais desnecessários.
- Backup testado e procedimento de rotação de credenciais.
- Ambiente de homologação separado de produção.

## Recursos do projeto comercial que não fazem parte do starter

CRM Kommo, Supabase, RAG, áudio, mídia, follow-up, orçamento, distribuição de leads, abordagem de formulários e reconciliação de funis foram removidos porque são específicos e aumentariam muito a superfície de risco. Eles devem voltar como módulos opcionais, com interfaces e testes próprios.

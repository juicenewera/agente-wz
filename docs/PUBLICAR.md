# Como publicar como repositório separado

Publique **somente o conteúdo desta pasta**, não a raiz da instalação comercial.

Exemplo seguro:

1. crie um repositório vazio no GitHub/GitLab;
2. copie o conteúdo de `open-source/` para uma pasta nova fora da instalação;
3. confirme que `.env` e `node_modules/` não foram copiados;
4. execute `npm ci && npm test`;
5. inicialize um Git novo e faça o primeiro commit;
6. ative proteção de segredo e revisão de dependências na hospedagem.

Antes do push, rode uma ferramenta de varredura como Gitleaks/TruffleHog e revise manualmente números, domínios, nomes e exemplos. Não preserve o histórico Git da instalação comercial: remover um segredo no commit atual não o remove de commits antigos.

# Desenvolvimento do CaptaBit

A V1 será implementada em etapas descritas em docs/05-entrega.md.

1. Atualize a branch main com `git pull --ff-only`.
2. Crie uma branch `codex/nome-da-alteracao`.
3. Implemente uma etapa pequena, atualizando documentação quando necessário.
4. Valide o comportamento afetado; isolamento de carteiras exige testes no backend.
5. Registre um commit e envie a branch ao GitHub.
6. Abra um pull request com problema, mudança e validação realizada.

Não versionar senhas, tokens, bancos locais, exportações de clientes ou arquivos de ambiente. Não usar dados reais em testes. A logo oficial está em public/assets/brand/captabit-logo-original.png.

Cloudflare Workers + D1 no Free é a plataforma aprovada. A integração de deploy será configurada quando houver aplicação executável e acesso à conta; enviar commits agora não publica um sistema.

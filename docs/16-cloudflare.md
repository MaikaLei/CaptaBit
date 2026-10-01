# Publicação na Cloudflare

Endereço: https://captabit.maikonandreyleiria.workers.dev

Worker: `captabit`. Banco: `captabit-production`. Configuração: `wrangler.production.jsonc`. O desenvolvimento continua em `wrangler.local.jsonc`, sem compartilhar o banco de produção.

## Estado da primeira publicação

As sete migrações foram aplicadas. Somente a identidade da conta Master foi copiada do ambiente local. Imobiliárias, captadores, contatos e captações de teste não foram importados. A senha Master precisa ser definida novamente no terminal privado para o formato compatível com produção; o próprio procedimento verifica login e logout no endereço público. O usuário cadastra a primeira imobiliária manualmente.

## Proteção das senhas

A Cloudflare rejeita PBKDF2 com mais de 100.000 iterações em produção, apesar de o runtime local aceitar 600.000. O perfil `cloudflare-v1` usa PBKDF2-HMAC-SHA256 com 100.000 iterações, salt aleatório de 128 bits e HMAC-SHA256 posterior com `AUTH_PEPPER` de 256 bits armazenado como segredo do Worker, separado do D1. O formato é versionado e a produção rejeita hashes locais sem pepper. Senhas de 12 a 128 caracteres e limites de tentativas continuam obrigatórios.

Esta é uma adaptação ao limite da plataforma, **não equivale ao fator de trabalho PBKDF2 de 600.000 recomendado pela OWASP**. O segredo adicional protege contra vazamento isolado do banco; o comprometimento conjunto do banco e do segredo continua permitindo ataques ao fator de 100.000. Antes de comercialização em escala, avaliar autenticação gerenciada ou plataforma com suporte a um KDF de maior custo e MFA.

O ambiente local preserva seus hashes de 600.000 iterações. Não importar hashes locais diretamente para produção. A redefinição de senha é necessária.

O segredo de bootstrap está em `.wrangler/production-auth.json` (ignorado pelo Git). Não exibir, enviar ou versionar esse arquivo. Guardar uma cópia protegida em gerenciador de segredos: o segredo não pode ser recuperado pelo painel do Worker. Não gerar um novo valor durante deploys comuns. Perder ou trocar o pepper exige redefinir as senhas dos usuários. Excluir a cópia local apenas após assegurar recuperação protegida.

## Administração pelo notebook

- Primeira criação: `node scripts/create-admin.mjs --remote`.
- Redefinição administrativa da Master existente: `node scripts/create-admin.mjs --remote --reset-master`.
- Esses procedimentos exigem autorização Cloudflare e o segredo local de bootstrap. Senhas são digitadas sem exibição e arquivos SQL temporários são removidos ao terminar.
- Não existe cadastro público de Master. Broker e Captador são criados pela interface autenticada.

## Atualizações

1. `npm test` e `npm run check`.
2. Antes de alterações no banco, exportar um backup protegido com D1 e conferir recuperação.
3. `npm run db:migrate:production`.
4. `npm run deploy:check`.
5. `npm run deploy`.
6. Verificar página, login, permissões e criação/alteração de usuários. Registrar a versão retornada.

Enviar commits ao GitHub não publica automaticamente. Rollback do Worker não desfaz migrações nem alterações de senha. Nunca reverter para uma versão que não reconheça o formato de senha de produção.

Se o atalho `npm` do Windows apontar para instalação antiga, usar o `npm-cli.js` da instalação ativa do Node. Não é necessário alterar o sistema para publicar via `node node_modules/wrangler/bin/wrangler.js`.

## Certificados do Windows

Se houver proxy com certificado corporativo, fornecer ao Node as autoridades já confiáveis no Windows por `NODE_EXTRA_CA_CERTS`. Não desativar a verificação TLS. Tokens, certificados locais e arquivos de bootstrap não devem entrar no Git.

## Validação

11 testes automatizados: autenticação local e de produção, acesso por perfil, criação de Brokers/Captadores, redefinição e revogação de sessões, isolamento entre imobiliárias, concorrência no limite de captadores, migrações, relatórios e mensagens. O teste de migração utiliza o interpretador SQL do Wrangler. As regras da migração 0007 usam `SELECT RAISE ... WHERE` para evitar incompatibilidade do parser remoto com `CASE ... END;` dentro de triggers, sem alterar sua semântica.

Verificação remota: página e assets HTTP 200; rotas privadas HTTP 401 sem sessão; credenciais fictícias retornam 401. A verificação do login Master ocorre após a definição privada da senha.

## Referências

- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://github.com/cloudflare/workerd/issues/1346
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

# Arquitetura proposta

## Plataforma aprovada

Git local → GitHub → Cloudflare Workers (interface estática e API) → D1/SQLite. Permanecer no plano Free, sem contratar serviços pagos. Frontend HTML, CSS e JavaScript modular, conforme conversa. Backend JavaScript modular com regras separadas das consultas SQL.

Uma origem para interface e API simplifica cookies e acesso. Publicar somente arquivos públicos; documentos internos, dados e segredos não entram em `public/`. Endpoints previstos sob `/api`: sessão, usuários, captações, contatos, histórico, dashboard, relatórios e exportação. Duplicidades são verificadas no fluxo de gravação; não disponibilizar pesquisa irrestrita da carteira alheia.

## Autenticação e autorização

Login e senha, sem cadastro público. Criar primeiro ADMIN por procedimento administrativo local e seguro, sem senha padrão no repositório. Escolher e medir algoritmo de hash de senha apropriado ao Worker antes de implementar; nunca reduzir segurança só para cumprir orçamento de CPU.

Sessões opacas aleatórias: guardar somente hash do token, com expiração e revogação no D1. Cookie HttpOnly, Secure em produção e SameSite; proteção CSRF/Origin nas alterações. Login com limitação de tentativas e erros genéricos. Desativar usuário revoga sessões. Senhas e tokens não entram em logs.

Cada requisição valida sessão, usuário ativo e perfil no backend. CAPTADOR recebe filtro pelo próprio `captador_id`; o servidor não confia em responsável ou perfil enviados pelo navegador. Contatos e eventos verificam a captação pai. Usar consultas parametrizadas e lista explícita de campos editáveis.

Respostas de acesso a registros alheios não revelam sua existência. ADMIN também passa por autenticação e auditoria. Transferências alteram imediatamente o acesso; o histórico mantém autoria original.

## Operação

Migrações SQL versionadas, aplicadas e verificadas primeiro no D1 local. Separar desenvolvimento e produção. Credenciais Cloudflare/GitHub fora do código; `DB` será o binding D1. Configuração de publicação só será finalizada com o banco real criado, sem IDs fictícios prontos para deploy.

Usar índices, paginação e limites para consultas e CSV. Escritas e seus eventos devem ser atômicos por operações transacionais suportadas pelo D1. Alterações concorrentes usam versão do registro e resposta de conflito. Backup/exportação e recuperação devem ser ensaiados antes de dados reais.

O plano Free tem limites: gratuidade não significa capacidade ilimitada. Monitorar leituras, escritas, armazenamento e CPU; falhas por cota devem aparecer como indisponibilidade temporária sem perder silenciosamente dados. Não habilitar upgrade automático.

## Referências oficiais consultadas

- Assets no Worker: https://developers.cloudflare.com/workers/static-assets/binding/
- Bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/
- Migrações D1: https://developers.cloudflare.com/d1/reference/migrations/
- Preços D1: https://developers.cloudflare.com/d1/platform/pricing/
- Limites D1: https://developers.cloudflare.com/d1/platform/limits/
- Preços Workers: https://developers.cloudflare.com/workers/platform/pricing/

Conferir cotas vigentes antes da publicação. Não transportar números antigos da conversa como garantia de capacidade.

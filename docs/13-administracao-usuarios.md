# Administração de usuários

A lista Equipe oferece Redefinir senha e Excluir usuário ao ADMIN. A própria conta pode redefinir a senha, mas não pode ser excluída nem desativada pela tela.

Redefinir senha abre um formulário com nova senha e confirmação (12 a 128 caracteres). POST /api/users/:id/password aceita apenas password; salva hash, registra USER_PASSWORD_RESET e revoga todas as sessões em lote transacional. Não reativa contas inativas. Se o ADMIN alterar a própria senha, sai do sistema e precisa entrar novamente. A nova senha não é retornada nem registrada no histórico. O ADMIN deve informá-la ao usuário por canal privado. Login concorrente à redefinição valida novamente o hash antes de criar a sessão.

DELETE /api/users/:id realiza exclusão lógica: active=0 e deleted_at, revoga sessões e registra USER_DELETED. O usuário sai da lista padrão e não pode entrar, reativar ou redefinir senha. Captações, telefones, atribuições e histórico são preservados. ADMIN continua consultando e pode transferir as captações pelo cadastro do imóvel. Filtros de relatório e dashboard mostram responsáveis excluídos quando necessário. Não existe restauração pela interface nesta versão. O e-mail permanece reservado para preservar a identidade histórica; exclusão de usuário não é apagamento definitivo de dados pessoais.

Migração 0006 adiciona deleted_at; fazer backup antes de aplicar. O GET de usuários aceita include_deleted=1 somente com autenticação ADMIN. Redefinição/exclusão verificam permissão administrativa novamente na escrita. A própria conta não pode ser excluída.

Validação automatizada: autorização, origem, tamanho de senha, senha antiga recusada e nova aceita, revogação de sessões, redefinição da própria conta, exclusão com dados relacionados, preservação do histórico, consultas administrativas posteriores e bloqueio de reativação do excluído. Testes usam bases isoladas; nenhuma senha ou conta real foi alterada nos testes.

# Multiempresa implementado — uso local

Esta entrega substitui o plano de migrar os dados antigos para a primeira imobiliária. Por decisão do titular, todos os registros anteriores ficam com company_id NULL, acessíveis apenas ao Master. Nenhuma imobiliária é criada pela migração.

## Como testar

1. Entrar no endereço principal com o mesmo e-mail e senha do ADMIN original, agora Master. A migração encerra as sessões antigas.
2. Na aba Imobiliárias, informar nome, código do link (3 a 50 caracteres, letras minúsculas, números e hífens), nome/e-mail do Broker e senha inicial com confirmação.
3. O cadastro cria imobiliária e Broker em transação única; se houver erro, nenhum dos dois fica parcialmente cadastrado. A empresa começa sem imóveis e com limite de três captadores ativos.
4. Abrir o link mostrado, no formato /?conta=codigo. Entrar com o Broker e cadastrar os captadores em Equipe. Broker pode redefinir senhas, desativar ou excluir captadores, consultar carteiras da empresa e transferir imóveis internamente. Captador só consulta sua própria carteira.
5. Em Esqueci minha senha, a página da empresa mostra o nome do Broker responsável. O Broker solicita recuperação ao Master. Não há envio automático de mensagem nem redefinição pela página pública.
6. Master pode bloquear/liberar uma imobiliária e redefinir a senha do Broker pelo painel. Bloqueio revoga sessões; liberação exige novo login. Master não consulta carteiras das empresas por este painel; sua base de contato/relatórios continua exclusiva dos dados reservados.

Ao alternar contas na mesma origem, o cookie de sessão é compartilhado entre abas. As chamadas da interface enviam o contexto da página e recusam sessão de outra conta, exigindo novo login para evitar ações na empresa errada. Para testar Master e Broker simultaneamente, usar perfis de navegador separados.

## Isolamento

users.company_id e leads.company_id definem a empresa. O perfil de autorização é access_role: MASTER, BROKER, CAPTADOR. O antigo campo role é mantido apenas por compatibilidade do esquema e não autoriza acesso. LEGACY identifica usuários antigos preservados para autoria/histórico, desativados e sem login. Sessões validam empresa ativa e perfil a cada chamada.

Todas as leituras/escritas de carteira e relatórios aplicam o company_id da sessão. Duplicidades de endereço e telefone também são restritas à empresa. Contatos/histórico dependem da captação autorizada. Transferências não atravessam empresas. Gatilhos tornam empresa/perfil imutáveis e validam o proprietário interno do imóvel. Índices de consulta começam por empresa.

Limite de captadores ativos aplicado em gatilhos de INSERT/UPDATE, inclusive reativação e concorrência. Broker e Master não contam nas vagas. captador_limit fica na tabela companies, padrão 3; alteração de plano pela interface é evolução posterior. Um Broker por empresa, um Master na plataforma, protegidos por índices únicos.

Mensagens usam o nome da imobiliária autenticada; nenhuma inclui nome do proprietário. Dados reservados do Master mantêm o texto original aprovado. Recuperação pública retorna somente nome da empresa e nome do gerente, sem e-mails, IDs de usuários ou consulta de contas por e-mail.

## Limitações explícitas desta primeira versão

- E-mail continua único em toda a plataforma, inclusive registros excluídos/legados; usar e-mail diferente do Master para criar Broker. Identidades compartilhadas entre empresas ou reutilização de e-mail exigem evolução do esquema.
- O painel lista até 200 imobiliárias e avisa quando há mais. Paginação administrativa, alteração de plano e substituição de Broker são evoluções posteriores.
- Não há restauração de usuários excluídos pela interface nem recuperação automática da senha Master. O titular deve guardar seu acesso e backups.
- Não foi publicado no Cloudflare; validação prática local precede produção. Plano Free não implica capacidade ilimitada.

## Migração e validação

0007_companies.sql preserva IDs, dados de imóveis, contatos e histórico. Promove o ADMIN ativo mais antigo a Master (a base local foi conferida e tinha exatamente um ADMIN ativo), desativa os demais acessos antigos e limpa sessões. Backup local anterior: .wrangler/backups/before-multiempresa.sql, ignorado pelo Git.

Testes automatizados cobrem Master/Broker/Captador, empresas X/Y/Z com telefones e endereços coincidentes, APIs de usuários, reset/exclusão, carteiras, contato/histórico, CSV, dashboard, marca das mensagens, troca de conta em abas, bloqueio/liberação, três criações simultâneas permitidas e quarta recusada, reativação sem vaga e preservação da carteira antiga. Nenhuma conta empresarial de teste é criada na base real.

# Preparação para comercialização — arquitetura multiempresa

Estado: especificação para a próxima migração. O sistema atual NÃO é multiempresa; não liberar uma segunda imobiliária antes da implementação e dos testes abaixo. Esta especificação substitui o significado global do ADMIN e do cruzamento de duplicidades dos documentos iniciais.

## Perfis

- MASTER: único titular da plataforma; o ADMIN atual será migrado para este papel. Cria/bloqueia imobiliárias, define limite de captadores, cadastra/substitui Broker e redefine sua senha. Não pode ser criado por Broker nem pelas rotas comuns de cadastro. Acesso a dados de uma empresa deve usar contexto explícito e auditado, sem juntar carteiras automaticamente.
- BROKER: administrador de uma imobiliária. Gerencia captadores, senhas, exclusões, transferências internas, dashboard e relatórios apenas da própria empresa. Não cria Master, outra empresa nem aumenta o próprio limite.
- CAPTADOR: mantém acesso à própria carteira dentro da empresa. Duplicidades podem alertar entre captadores da mesma imobiliária sem expor a carteira.

Limite inicial: três captadores ativos por imobiliária, além do Broker e do Master. Campo configurável pela plataforma, não constante espalhada no código. Cadastro e reativação devem aplicar a cota atomicamente no banco, inclusive sob concorrência. Inativos/excluídos não consomem vaga. Inicialmente um Broker responsável ativo por empresa.

## Banco compartilhado

Criar companies: id, slug, nome, nome comercial para mensagens, gerente público, broker_user_id, status, captador_limit, datas. A indicação pública do gerente deve permanecer disponível mesmo se sua conta estiver temporariamente inativa; substituição gerenciada pelo Master.

Vincular users e leads por company_id obrigatório para Broker/Captador. Master é identidade da plataforma, sem carteira implícita. Sessão determina usuário, papel e empresa; o navegador nunca autoriza company_id arbitrário. Contatos e eventos herdam empresa da captação, com consultas sempre passando por captação autorizada. Auditoria administrativa precisa registrar contexto da empresa.

Usar chaves/validações que impeçam proprietário interno (captador), contato e imóvel de pertencerem a empresas diferentes. Índices começam pelo company_id nas consultas de carteira, endereço, andamento e relatórios. Nenhuma busca de telefone/endereço pode atravessar empresas. Considerar e-mail único dentro da empresa, com login contextual; não revelar em que outras empresas esse e-mail existe.

Revisar todas as rotas: login/sessões, usuários, redefinição, exclusão, captações, contatos, histórico, transferências, duplicidades, dashboard e CSV. Escopo de empresa é obrigatório antes do escopo de captador. Imobiliárias bloqueadas perdem acesso; revogar sessões. Consultas inexistentes ou de outra empresa não devem revelar a existência do registro.

Banco D1 compartilhado é a escolha inicial, com isolamento implementado no servidor e no esquema. Isso não equivale a isolamento automático do D1. Separar a seleção do banco das regras de negócio permite mover empresas para bancos dedicados no futuro, com migração controlada. Capacidade e custos deverão ser medidos, sem prometer plano Free ilimitado.

## Login e Esqueci minha senha

Cada imobiliária terá um link de entrada próprio (ex.: /conta/criativa). O link identifica a empresa; autenticação continua exigindo senha. Não listar empresas nem consultar o gerente pelo e-mail digitado.

O botão Esqueci minha senha mostra: "Contate o gerente da sua conta: [nome público do Broker]." Não envia mensagem, não redefine senha e não retorna dados de usuários. O nome exibido pertence à empresa do link. Em entrada genérica, solicitar o link/código da imobiliária antes de mostrar gerente. Broker que perder a senha deve ser atendido pelo Master. A recuperação do Master precisa de procedimento administrativo seguro, não de autoelevação pela página pública.

## Marca e mensagens

Remover Criativa Imóveis como valor fixo compartilhado. Textos WhatsApp devem usar nome comercial da empresa autenticada. Nome do proprietário continua fora das mensagens. CaptaBit by ZapBits permanece como marca do produto.

## Migração dos dados existentes

1. Confirmar empresa inicial e nome/e-mail do Broker com o titular. Não promover automaticamente um captador de teste.
2. Exportar backup local; parar servidor antes da migração SQLite no Windows.
3. Criar empresa inicial e associar todos os dados atuais a ela; preservar IDs, telefones, classificações e histórico.
4. Converter o ADMIN titular em Master e configurar o Broker confirmado; preservar acessos atuais até a transição planejada. Novas senhas serão definidas pelo usuário, sem senha padrão no código.
5. Invalidar sessões antigas para reconstruir o contexto de acesso.
6. Validar localmente antes de publicar.

## Critérios de conclusão

Bases de teste com empresas X/Y/Z e telefones/endereços iguais. Provar ausência de vazamento em leitura, escrita, avisos, nomes de responsáveis, totais, histórico e CSV, inclusive manipulando IDs e filtros. Broker não pode atingir usuário nem imóvel de outra empresa, nem elevar perfil/limite. Testar criação concorrente e reativação na quarta vaga, bloqueio de empresa, gerente público correto, perda de senha e marca das mensagens. Conferir preservação da carteira migrada e caminho de restauração.

Referências oficiais consultadas: https://developers.cloudflare.com/use-cases/saas/data-isolation/ e https://developers.cloudflare.com/d1/platform/limits/ . Cloudflare descreve banco compartilhado com isolamento por linha e bancos por cliente; o isolamento da aplicação precisa ser implementado e testado.

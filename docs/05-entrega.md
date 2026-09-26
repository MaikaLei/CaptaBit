# Plano incremental

## Etapa 0 — Fundação (atual)

- Consolidar escopo, arquitetura, modelo de dados e identidade.
- Selecionar pasta definitiva e criar estrutura local.
- Inicializar Git no projeto, respeitando repositórios preexistentes.
- Preservar a logo original fornecida e documentar seu uso.

## Etapa 1 — Ambiente e autenticação

Preparar runtime, dependências fixadas, Worker local, migração inicial, bootstrap ADMIN, login/logout e usuários. Configurar GitHub e Cloudflare após identificar contas e repositório. Validar senha, sessão expirada/revogada, usuário inativo, CSRF e limite de tentativas. Medir custo do hash no Free.

## Etapa 2 — Núcleo de captação

Cadastro rápido, listagem/detalhe, contatos, status, histórico e autorização. Validar com ADMIN e dois CAPTADORES que manipulação de IDs não permite ler ou alterar carteira alheia, incluindo contatos e histórico. Validar escrita atômica e conflito de edição.

## Etapa 3 — Duplicidades e WhatsApp

Normalização, alertas e mensagem preenchida. Cobrir abreviações, acentos, apartamentos distintos, dados incompletos, telefone compartilhado e cadastro concorrente. Verificar resposta mínima do alerta. Abertura nunca marca envio automaticamente.

## Etapa 4 — Busca, dashboard e CSV

Filtros, paginação, métricas e exportação com autorização. Testar totais contra dados conhecidos e isolamento em relatórios. CSV deve escapar aspas/separadores/quebras de linha e neutralizar fórmulas de planilha em dados fornecidos por usuários.

## Etapa 5 — Publicação e uso piloto

Verificar plano Free, backup/restauração, migrações, segredos, logs sem dados sensíveis, limites e teste de acesso responsivo. Publicar via GitHub/Cloudflare. Ensaiar recuperação de falha de migração e rollback de código sem presumir rollback automático do banco.

## Critério de V1 entregue

Login → cadastro → telefones → alerta → WhatsApp manual → resultado → histórico → busca → relatório/CSV funcionando, com isolamento demonstrado e piloto validado. Documentação ou tela estática isolada não equivale à V1 concluída.


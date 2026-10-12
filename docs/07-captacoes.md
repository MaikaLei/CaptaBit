# Etapa 2 — Captações e contatos

Disponível localmente: cadastro rápido com até dez telefones iniciais, listagem paginada, busca por endereço/cidade/bairro/nome/telefone, filtro de status, edição do imóvel, contatos adicionais e histórico paginado.

CAPTADOR acessa somente a própria carteira. ADMIN consulta todas as captações, transfere responsáveis e encerra/reabre registros. A transferência retira o acesso do captador anterior. Status do contato e do imóvel permanecem independentes. Telefones usam formato internacional normalizado; números brasileiros precisam de DDD.

Cada gravação de imóvel/contato gera seu evento por trigger SQLite, na mesma transação. Alterações usam versão para rejeitar edição desatualizada. Telefones repetidos na mesma captação são rejeitados; em outras captações ainda são permitidos.

## Validação

npm test cobre dois captadores e um ADMIN em banco separado: consulta, busca, histórico, alteração de contatos, transferência, reabertura, conflito concorrente e entradas inválidas. Os usuários reais não são usados nos testes.

A migração 0002 apenas adiciona tabelas, índices e triggers; não altera users ou sessions. Antes da aplicação local foi salvo backup em .wrangler/backups/before-captacoes.sql, ignorado pelo Git. Não compartilhar esse backup: ele contém dados locais de autenticação.

## Limites desta entrega

Até 200 contatos por captação e 20 captações por página. A busca textual simples ainda não ignora acentos e busca telefone pelos dígitos armazenados. Atualização de contato aparece no histórico, mas não muda automaticamente o status da captação.

Ainda pendentes: alerta global de duplicidades, botão WhatsApp, dashboard, relatórios/CSV e publicação Cloudflare. A tela informa que a verificação global de duplicidades não está disponível; não usar esta etapa como garantia contra abordagens repetidas.

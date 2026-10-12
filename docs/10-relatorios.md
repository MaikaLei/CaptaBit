# Relatórios e acompanhamento

Disponível na aba Relatórios e acompanhamento, separada do contato inicial.

## Consulta

Filtros combináveis: datas inicial/final de cadastro (dias completos no horário de Brasília, UTC-03), proprietário, imóvel (tipo, rua, número, complemento, bairro ou cidade), andamento, classificação de telefone e captador responsável (ADMIN). Textos usam correspondência parcial literal; % e _ não são curingas. Sem datas, mostra todo o período. Paginação de 20 captações, ordenada por cadastro decrescente e ID.

Os totais, distribuição de andamentos e classificações consideram todo o conjunto filtrado, não apenas a página. Cada telefone ativo conta uma vez; excluídos não contam. O filtro de classificação seleciona captações que tenham pelo menos um telefone com aquele resultado; o resumo continua mostrando todos os telefones ativos dessas captações. Imóveis sem telefone também entram quando não há filtro de resultado.

## Acompanhamento

Acompanhar abre o andamento, os resultados dos telefones e o histórico paginado. Salvar andamento usa a autorização, versão e histórico atômico já existentes. Reabertura e encerramento continuam exclusivos do ADMIN. Cadastros antigos sem proprietário podem atualizar apenas o andamento; editar os dados do imóvel ainda exige proprietário.

## Exportação

GET /api/reports/captacoes.csv usa os mesmos filtros e autorização da consulta GET /api/reports/captacoes. Uma linha por imóvel, com proprietário, endereço, captador, andamento, datas e quantidades por classificação. Exporta todas as páginas. UTF-8 com BOM, separador ponto e vírgula, escape de aspas/quebras e neutralização de fórmulas. Até 10.000 captações por exportação; acima disso retorna erro explícito, sem entregar arquivo truncado. Reduzir o período ou refinar filtros para exportar conjuntos maiores.

## Segurança e validação

ADMIN consulta toda a equipe. CAPTADOR tem escopo obrigatório pela sessão; tentar consultar/exportar outro responsável retorna 403. Não há dados de outras carteiras nos totais, histórico ou CSV. Consultas parametrizadas e respostas sem cache. Resumo/listagem são obtidos em lote transacional D1. Não exige migração nem altera os registros existentes.

Testes com duas carteiras, 26 imóveis, múltiplas classificações e um telefone excluído: paginação sem repetição, totais, filtros combinados, limites de dias, entradas inválidas, busca literal, histórico, conflitos de edição, acesso não autenticado, CSV além da primeira página e neutralização de fórmulas. Conferência visual local de filtros, resultados vazios, resumo e acompanhamento sem modificar os dados reais.

Dashboard disponível conforme docs/11-dashboard.md. Modelos alternativos de WhatsApp e publicação Cloudflare seguem como próximos incrementos.

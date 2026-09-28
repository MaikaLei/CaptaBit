# Dashboard — Visão geral

A aba Visão geral resume os imóveis cadastrados no período selecionado. Contato inicial permanece como tela de entrada. O padrão é de 30 dias incluindo hoje, no horário de Brasília; aceita até 366 dias. ADMIN pode selecionar um responsável ou toda a equipe; CAPTADOR consulta somente a carteira da sessão.

## Definições dos indicadores

- Captações cadastradas: quantidade de imóveis com data de cadastro dentro do período.
- Imóveis com contato correto: imóveis com pelo menos um telefone ativo classificado como correto, independentemente de quantos telefones corretos possuam.
- Imóveis sem telefone: imóveis sem nenhum telefone ativo; números excluídos não contam.
- Imóveis captados: imóveis do período cujo andamento atual é Captado. Não significa captações concluídas durante o período.
- Resultados dos contatos: contagem de telefones ativos por classificação.
- Evolução dos cadastros: quantidade por data de cadastro; dias vazios aparecem como zero. Até 31 dias, barras diárias; períodos maiores agrupam intervalos de até sete dias a partir da data inicial. Tabela acessível com os valores do gráfico.
- Andamentos: situação atual dos imóveis do período.
- Equipe: quantidade de imóveis por responsável atual, exibida apenas ao ADMIN.

Aberturas do WhatsApp não são usadas como envio confirmado. Não há taxa de conversão baseada em abertura de WhatsApp.

## Integração

GET /api/dashboard compartilha filtros e escopo de autorização dos relatórios. Datas omitidas usam 30 dias; datas parciais, inválidas, invertidas ou intervalos maiores que 366 dias retornam erro. Consulta dos indicadores em lote transacional D1, sem cache e sem migração.

Botões de classificação, andamento e responsável abrem Relatórios e acompanhamento, preservando datas e responsável e acrescentando o filtro selecionado. Ver relatório deste período mantém os filtros atuais. O relatório exporta o mesmo recorte.

## Validação

Testes cobrem contagem distinta de imóveis versus telefones, excluídos, imóveis sem telefone, isolamento ADMIN/CAPTADOR, limites dos dias em Brasília, dias sem cadastros, agrupamento semanal, padrão de 30 dias, intervalos inválidos e atualização do indicador Captado. Conferência visual local confirmou o preenchimento dos filtros ao navegar do dashboard para os relatórios; sem alterações nos registros reais.

Próximas etapas: modelos alternativos de mensagem e preparação/publicação no Cloudflare.

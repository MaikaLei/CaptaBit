# Escopo da V1

## Fluxo principal

Pesquisar → cadastrar → cruzar a base → contatar manualmente → registrar resultado → acompanhar → medir.

ADMIN tem acesso a usuários, carteiras, contatos, históricos e relatórios gerais; pode transferir, encerrar e reabrir captações. CAPTADOR consulta e altera somente sua carteira, inclusive em busca, indicadores, históricos e CSV.

Uma captação possui vários possíveis contatos/telefones. O telefone pode aparecer em mais de uma captação: um proprietário pode ter vários imóveis. Não fazer fusão automática.

## Cadastro ágil

Dados do imóvel: tipo, finalidade (venda/locação), logradouro, número, complemento, bairro, cidade, CEP, origem, link e observações. Responsável, datas e status inicial são preenchidos pelo servidor.

Proposta inicial: exigir tipo, finalidade, logradouro e cidade; permitir número desconhecido explicitamente. Bairro e telefone podem ser preenchidos depois. CEP, origem, link, complemento e observações ficam em “Mais informações”. Endereço incompleto reduz a confiança da comparação; não indicar ausência garantida de duplicidade.

## Status preservados

Contato: Não contatado; Mensagem enviada; Aguardando resposta; Contato incorreto; Proprietário/Responsável localizado; Sem resposta; Não possui WhatsApp.

Captação: Nova; Em pesquisa; Em contato; Proprietário localizado; Em negociação; Captado; Recusado; Já alugado; Encerrado.

Status de contato e captação são independentes. Toda mudança registra autor, data e valores anterior/novo. Reabertura e transferência são administrativas. Proposta: Captado, Recusado, Já alugado e Encerrado são estados finais; reabertura explícita permite continuar.

## Duplicidades

Comparar endereço normalizado e telefone em toda a operação, inclusive outras carteiras. Alertar sem bloquear automaticamente: telefone repetido não significa imóvel repetido. Revalidar no salvamento, não só na interface. Cadastros concorrentes podem coexistir e devem ser sinalizados para revisão.

Para outra carteira, retornar apenas tipo do conflito, nome do responsável, situação e início. Nunca retornar identificador navegável, endereço completo, telefone adicional, observações ou histórico. Orientar a procurar o ADMIN. Registros encerrados geram aviso histórico distinto de “em andamento”.

## WhatsApp e histórico

Botão abre conversa com telefone e mensagem preenchida, revisável pelo captador; envio exclusivamente manual. Abertura não comprova envio e não altera automaticamente o status para Mensagem enviada. Registrar a solicitação de abertura; confirmar envio manualmente para contabilizar contato realizado.

Histórico inclui criação, edição, telefone adicionado, abertura solicitada do WhatsApp, resultados, mudanças de status, transferência e reabertura.

## Busca e indicadores

Busca por endereço, telefone, bairro, proprietário/nome do contato, status e data. Dashboard e relatórios por período, captador (ADMIN), bairro, tipo e status. Indicadores: captações cadastradas, em andamento, contatos realizados confirmados, aguardando resposta, proprietários localizados, em negociação e captados. CSV respeita os mesmos filtros e permissões.

## Fora da V1

Envio automático, API oficial do WhatsApp, integração EEmovel/CRM, anexos, ficha completa, lembretes e relatórios avançados. Preparar evolução para modelos de mensagem e comercialização sem implementar múltiplas empresas prematuramente.

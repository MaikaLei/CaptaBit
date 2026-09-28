# Contato inicial e classificação

A tela prioriza o primeiro contato. Cada telefone oferece Enviar mensagem de captação, classificação e exclusão. O texto padrão aprovado é preenchido com os dados do imóvel e do usuário; a revisão e o envio são feitos no WhatsApp, aberto em nova guia para manter o CaptaBit disponível. Se o navegador bloquear a guia, um link permite abri-la manualmente. Não há envio automático nem caixa de revisão no CaptaBit. Esta decisão substitui a revisão interna descrita na documentação anterior.

Classificações independentes do andamento da captação: Não verificado (cinza), Contato correto (verde), Contato errado (vermelho), Sem retorno (cinza), Sem WhatsApp (cinza). Cor sempre acompanhada de texto. Contato errado ou sem WhatsApp bloqueia a abertura até reclassificação. Abrir o WhatsApp não marca mensagem enviada.

Excluir remove o telefone da lista, busca e comparação de telefones duplicados, mantendo o histórico. Adicionar novamente o mesmo telefone restaura o registro como Não verificado. Permissões de carteira e controle de versão protegem atualização, exclusão e restauração.

Dados do imóvel, andamento e histórico ficam recolhidos. Relatórios de acompanhamento e seleção de outros modelos de mensagem são próximos incrementos; ainda não estão implementados. O identificador initial prepara o ponto de seleção de modelos.

Migração 0004 preserva os registros e converte resultados antigos equivalentes. Fazer backup e parar o servidor local antes de migrar o D1 local no Windows. Validação: testes de autenticação, isolamento, classificação, concorrência, exclusão, restauração, duplicidades e texto WhatsApp; conferência visual local sem enviar mensagens nem alterar contatos reais.

## Proprietário do imóvel

O campo proprietor_name (Proprietário) abre o cadastro e é obrigatório no cadastro e na edição dos dados do imóvel. É independente do captador responsável (owner_id). Não é exclusivo: vários imóveis podem ter o mesmo proprietário. Alterações entram no histórico, e a busca por proprietário respeita a carteira do usuário. O nome não é usado na mensagem WhatsApp.

Os formulários de telefone não exibem mais Nome; os dados históricos de contatos são preservados. A migração 0005 mantém os imóveis antigos com proprietário vazio até preenchimento manual, sem inferir a identidade a partir de possíveis contatos. A classificação de telefone continua disponível sem exigir a edição do imóvel antigo.

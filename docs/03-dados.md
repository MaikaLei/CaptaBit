# Modelo de dados proposto

Identificadores opacos, datas UTC e chaves estrangeiras. Este documento antecede a primeira migração executável.

| Entidade | Campos principais |
|---|---|
| usuarios | id, nome, email único normalizado, senha_hash, perfil ADMIN/CAPTADOR, ativo, criado_em |
| sessoes | token_hash, usuario_id, criado_em, expira_em, revogado_em |
| captacoes | id, captador_id, tipo_imovel, finalidade, logradouro, numero, complemento, bairro, cidade, uf, cep, origem, link_origem, observacoes, status, chave_endereco, versao, criado_em, atualizado_em |
| contatos | id, captacao_id, nome opcional, telefone_original, telefone_normalizado, status, observacoes, criado_em, atualizado_em |
| historico | id, captacao_id, contato_id opcional, autor_id, tipo_evento, dados estruturados mínimos, criado_em |

UF é uma proposta técnica para desambiguar cidades. Não exigir nome de proprietário ainda desconhecido. Não usar unicidade global de telefone ou endereço; repetição gera alerta, não perda de dados. Evitar duplicação do mesmo telefone dentro da mesma captação.

Índices previstos: captacoes(captador_id, atualizado_em, id), captacoes(captador_id, status), captacoes(chave_endereco), contatos(telefone_normalizado), contatos(captacao_id), historico(captacao_id, criado_em), sessoes(usuario_id), sessoes(expira_em). Acrescentar índices conforme consultas reais e planos de execução.

## Normalização

Telefone: validar país e DDD; formato internacional canônico; remover formatação visual, sem inventar DDD. Prefixo brasileiro por padrão apenas quando a entrada for nacional válida. Preservar original para apresentação.

Endereço: aparar espaços, padronizar caixa/acentos e abreviações conhecidas de logradouro; comparar cidade/UF, logradouro, número e unidade/complemento. Apartamentos distintos não são duplicidade exata. Complemento ausente ou número desconhecido gera apenas possível correspondência. Versionar normalização para permitir recalcular chaves no futuro.

## Métricas e rastreabilidade

Contatos realizados são eventos confirmados pelo usuário, não cliques no WhatsApp. Totais por situação são o estado atual; produção no período usa eventos/datas correspondentes. Exibir claramente essa diferença. Para resultados, contar a primeira entrada no status desejado por captação no período, evitando dupla contagem por reabertura. Métricas por autor e carteira atual devem ser explicitamente distintas após transferência.

## Evolução

Futuras tabelas: modelos_mensagem, retornos, fichas e anexos. Para comercialização entre empresas, adicionar organização e isolamento por empresa antes de aceitar a segunda empresa; cruzamento global então significa dentro da empresa, nunca entre clientes. Não afirmar que a V1 já é multiempresa.

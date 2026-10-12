# Etapa 3 — Duplicidades e WhatsApp

O cadastro rápido verifica endereços/telefones antes de salvar. Ao salvar, a API repete a consulta e o detalhe exibe o resultado atualizado. Edições e inclusão de contatos reabrem o detalhe com nova comparação. Alertas são orientativos: não impedem imóveis diferentes do mesmo proprietário e não fundem registros.

## Comparação e privacidade

Endereços usam chaves normalizadas e índice por cidade/logradouro. Normaliza caixa, acentos, espaços e abreviações conhecidas: R., Av., Trav., Rod., Ap., Apt. e Apto. Número sem informação gera possível correspondência; complementos diferentes e informados não coincidem. UF ausente reduz a confiança. Telefones são comparados em formato internacional.

O alerta mostra apenas tipo, responsável, status, data e indicação de histórico. Não retorna ID, endereço, telefone, observações ou histórico da outra carteira. Estados finais são separados de captações em andamento. A consulta prévia aceita até 60 verificações por usuário em quinze minutos. Consultas são limitadas e avisam quando há resultados omitidos ou dados incompletos; ausência de alerta não garante ausência de duplicidade.

## WhatsApp

Abra uma captação e expanda o contato. A mensagem sugerida é editável. O botão Abrir WhatsApp gera um link wa.me com texto codificado, sem chamar API de envio. Antes de abrir, revalida contato, versão, acesso e duplicidades. Havendo avisos, pede revisão. Um link manual permanece disponível caso o navegador bloqueie a nova aba.

O histórico registra Abertura do WhatsApp solicitada. Não afirma que o aplicativo abriu ou que a mensagem foi enviada. O status do telefone não muda automaticamente; o usuário registra Mensagem enviada quando tiver enviado. A mensagem e o telefone não são copiados para o evento de abertura.

## Atualização local

Pare o servidor, aplique as migrações e indexe os cadastros anteriores:

```sh
npm run db:migrate
node scripts/backfill-addresses.mjs
npm run dev
```

O indexador é retomável e altera somente chaves auxiliares, sem trocar versão nem gerar eventos falsos. Antes desta atualização foi salvo backup em .wrangler/backups/before-duplicates.sql, fora do Git. Usuários, contatos e endereços originais foram preservados.

## Validação

Testes no runtime Cloudflare cobrem equivalência de endereços, unidades diferentes, dados incompletos, telefone repetido, resposta mínima entre carteiras, registro histórico, reindexação após edição, URL codificada, autorização do WhatsApp e preservação de status. Nenhuma mensagem real foi enviada nos testes.

Ainda pendentes: dashboard, relatórios/CSV, publicação Cloudflare e validação do custo de autenticação no plano Free.

Modelo atualizado conforme texto fornecido pelo usuário: Criativa Imóveis, saudação Boa tarde, nome do captador, tipo, logradouro e finalidade. Para a conta genérica admin/administrador, o remetente padrão é Maikon, conforme exemplo fornecido. O texto pode ser revisado antes da abertura.


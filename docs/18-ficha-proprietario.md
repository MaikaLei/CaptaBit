# Ficha do proprietário e identidade por imobiliária

## Uso

1. Master: Imobiliárias → Logo, CRECI e taxas. Broker: menu Imobiliária.
2. Preencher CRECI, e-mail de contato e descrição escrita dos valores/percentuais e condições. Logo e imagem explicativa são opcionais; a descrição é obrigatória.
3. Acompanhamento → abrir imóvel → Ficha do proprietário → Gerar link da ficha. Copiar e enviar ao proprietário.
4. Após o preenchimento, Atualizar respostas → Abrir ficha / gerar PDF. A impressão do navegador permite Salvar como PDF. O PDF pode ser enviado para assinatura externa pelo gov.br.
5. Marcar como conferida registra apenas a conferência interna, não valida assinatura ou identidade.

O aceite de divulgação é opcional, nunca pré-marcado. A declaração informa taxas devidas somente quando a locação/venda for concluída. Não há valores de taxas pré-cadastrados. A imobiliária deve informar suas condições reais e conferir o texto antes de enviar a ficha.

## Preservação e acesso

- Migração 0008 adiciona tabelas e índices; não altera nem exclui cadastros existentes.
- Cada configuração gera versão imutável. Links já emitidos mantêm logo, imagem, taxas e declaração originais. Se as condições mudarem, cancelar links pendentes e emitir novos.
- Resposta não sobrescreve imóvel, proprietário ou contatos. Conferir e atualizar a captação manualmente quando necessário.
- Link aleatório de 256 bits; somente hash armazenado. O segredo fica no fragmento da URL, não no endereço enviado na navegação inicial. Válido por sete dias, cancelável e de uso único. Enviar somente ao destinatário.
- Página pública não recebe os dados preexistentes da captação. Após envio, não permite consultar a resposta pelo link público.
- Consulta de respostas e PDF exige sessão e mantém isolamento por imobiliária/carteira. Broker acessa a base da própria imobiliária; Captador somente seus imóveis. Master configura identidades, sem transferir a base legada para uma imobiliária.
- Turnstile validado no servidor, incluindo hostname e action. Limite de tentativas por IP, limites de tamanho, validação de CPF e campos. CPF válido matematicamente não comprova identidade.
- Datas, texto da declaração, versão das taxas e opção de aceite são preservados com a resposta. O PDF é gerado a partir desses dados; não é um PDF assinado ou certificação de identidade.
- O armazenamento/anexo de PDF devolvido assinado não faz parte desta entrega. Guardar o arquivo original assinado externamente, sem reimprimir ou modificar.

## Imagens e recursos

Upload PNG/JPEG/WebP de até 5 MB, convertido no navegador para JPEG de até aproximadamente 200 KB, dimensão máxima 1200 pixels. Servidor aceita PNG/JPEG até 200 KB por imagem. Não aceita SVG. Versões antigas são preservadas; seu volume conta para o armazenamento D1. Não há serviço pago adicionado, sujeito às cotas dos planos Free.

## Configuração e publicação

`TURNSTILE_SITE_KEY` público em wrangler.production.jsonc; `TURNSTILE_SECRET_KEY` nos secrets do Worker. Widget vinculado ao hostname publicado, action `owner-form`. Ao adicionar domínio, atualizar os domínios permitidos do widget. Sem ambos, a emissão/envio fica indisponível.

Antes de publicar: exportar backup privado, verificar restauração e integridade, executar testes, aplicar apenas migração 0008 e publicar os assets/Worker. Backups e segredos permanecem em .wrangler, ignorada pelo Git. Não remover tabelas novas para desfazer interface: preservar respostas recebidas.

Validação automatizada cobre isolamento, configuração por papel, versões, rejeição de imagem inválida, CPF, Turnstile, concorrência de envio, aceite opcional, cancelamento e imutabilidade. Revisão visual com dados fictícios cobre desktop, celular e PDF. Teste humano de preenchimento com Turnstile real continua recomendado antes de enviar a clientes.

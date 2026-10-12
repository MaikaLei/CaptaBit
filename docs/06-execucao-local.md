# Executar a primeira etapa localmente

Requisitos: Node.js 22.13 ou superior e npm. Nenhuma conta Cloudflare é necessária para o desenvolvimento local.

```sh
npm ci
npm run db:migrate
npm run admin:create
npm run dev
```

Abra http://127.0.0.1:8787. O comando admin:create solicita nome, e-mail e senha em um terminal interativo, sem exibir a senha. Cria somente o primeiro ADMIN e não altera contas já existentes. O SQL temporário contém apenas o hash e é removido ao concluir. Não há senha padrão. Não envie sua senha pelo chat.

Após entrar como ADMIN, é possível cadastrar usuários ADMIN/CAPTADOR e ativar/desativar outras contas. A própria conta não pode ser desativada. A lista inicial é limitada a 200 usuários; paginação será adicionada antes de ultrapassar esse volume. Redefinição de senha e recuperação por e-mail ainda não estão disponíveis.

## Validação

```sh
npm run check
npm test
```

Os testes usam banco isolado em memória no Miniflare e cobrem login válido/inválido, origem externa, cookie seguro, token armazenado como hash, permissão de usuários, criação, desativação, revogação, expiração, logout e bloqueio por tentativas. Dados de teste são fictícios e não são criados no banco da aplicação.

## Segurança implementada

PBKDF2-SHA256 com 600.000 iterações e salt aleatório por senha. Sessões de oito horas em cookie HttpOnly/SameSite Strict, Secure em HTTPS. Mudanças exigem origem idêntica e JSON. Endpoints privados consultam perfil e conta ativa a cada chamada. Limites de login por e-mail e IP são persistidos atomicamente no D1; uma janela de quinze minutos admite oito tentativas por e-mail e quarenta por IP, inclusive tentativas corretas. Criação e alteração de contas geram auditoria.

## Limitações e publicação

Esta etapa entrega autenticação e gestão básica de usuários. Carteiras, captações e relatórios ainda não foram implementados; seu isolamento será testado na etapa seguinte. A interface informa esse estado, sem indicadores fictícios.

wrangler.local.jsonc contém um identificador exclusivamente local. Não usar esse arquivo para publicar. A configuração de produção só deve ser criada com os identificadores reais do Worker/D1 e autenticação Cloudflare. Nenhum deploy automático está ativo.

O teste mediu aproximadamente 836 ms de tempo de parede para login local. Isso NÃO mede CPU no plano Free. Antes de publicar, medir CPU na Cloudflare e validar orçamento de autenticação; não reduzir o custo do hash para contornar cotas. Se o custo for incompatível, revisar a estratégia de autenticação antes de produção, preservando login/senha e a restrição de custo.

## Dependências

Versões fixadas em package-lock.json. A versão instalada do Wrangler usa Miniflare 5 alpha; os testes utilizam o adaptador oficial convertV4MiniflareOptions. Revisar atualizações em alteração separada e executar os testes antes de adotá-las.

## Banco local ocupado no Windows

Antes de executar admin:create, pare o servidor npm run dev com Ctrl+C. Neste ambiente, a tentativa de abrir o D1 por um segundo processo enquanto o servidor estava ativo retornou SQLITE_READONLY. A gravação voltou a funcionar após parar o servidor. O script agora testa a gravação sem alterar registros antes de solicitar credenciais. Depois de criar o ADMIN, execute npm run dev novamente.


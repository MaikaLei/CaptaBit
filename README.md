# CaptaBit — by ZapBits

**Menos cadastro, mais captação.**

Aplicação web responsiva para organizar captações imobiliárias com cadastro rápido, carteira individual e alertas globais de duplicidade.

![CaptaBit by ZapBits](public/assets/brand/captabit-logo-original.png)

## Estado inicial

Fundação documental preparada. A aplicação ainda não foi implementada ou publicada. Git local inicializado em repositório próprio, branch main. Repositório GitHub: [MaikaLei/CaptaBit](https://github.com/MaikaLei/CaptaBit). Recursos Cloudflare ainda não foram criados.

## Estrutura planejada

```text
docs/                   Escopo, arquitetura, dados e plano de entrega
public/                 Interface HTML, CSS, JavaScript e assets públicos
src/worker/             Rotas HTTP, autenticação e autorização
src/domain/             Regras de captação, contatos e duplicidades
src/repositories/       Consultas D1 com escopo de acesso explícito
migrations/             Migrações SQL versionadas
tests/                  Testes de regras, isolamento e integração
```

## Documentação

- [Escopo e regras](docs/01-escopo.md)
- [Arquitetura e segurança](docs/02-arquitetura.md)
- [Modelo de dados](docs/03-dados.md)
- [Interface e identidade](docs/04-interface.md)
- [Entrega incremental e validação](docs/05-entrega.md)

Decisões recuperadas da conversa “Melhore script captação imóveis” e da solicitação de início do projeto. Propostas técnicas abaixo não significam funcionalidades já entregues.



## Desenvolvimento

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) para o fluxo de evolução. Ainda não há aplicação executável, dependências instaláveis ou deploy configurado.


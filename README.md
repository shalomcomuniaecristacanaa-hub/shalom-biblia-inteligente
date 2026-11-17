# Shalom Bíblia Inteligente — projeto inicial

Este repositório contém o **código-fonte inicial** de um plugin em desenvolvimento para o SPresenter no Windows. Ainda não é um pacote instalável pronto.

## O que já está incluído
- Observador do evento `live` do SPresenter.
- Leitura das camadas ao vivo e extração defensiva de texto/referências bíblicas.
- Classificação temática inicial por palavras-chave (fallback local; ainda não usa IA generativa).
- Pesquisa de fotos e vídeos pela API do Pexels.
- Proteção contra reprocessamento do mesmo versículo.

## O que ainda falta
A aplicação automática do fundo está intencionalmente desativada até confirmar o formato de `Presentation` e o índice da camada de fundo na versão do SPresenter instalada. Também faltam interface de configuração, integração com um provedor de IA, build empacotado e testes no Windows.

**Não instale durante um culto ao vivo.** Este projeto é um starter técnico e precisa ser validado com a versão exata do SPresenter.

## Requisitos
- Windows 10/11
- Node.js LTS
- SPresenter compatível com plugins
- SDK oficial `@spresenter/plugin-sdk`
- Chave de API Pexels (opcional)

## Desenvolvimento
```bash
npm install
npm run build
```

Configure a chave Pexels por mecanismo local seguro; nunca a coloque no código nem no Git.

## Estrutura
- `src/code.ts`: integração inicial com eventos do SPresenter.
- `src/theme.ts`: classificação temática local.
- `src/media.ts`: pesquisa de fotos e vídeos no Pexels.
- `docs/INTEGRACAO-SPRESENTER.md`: pendências para integração da projeção.

## Referências
- SDK: https://github.com/sonext-software/spresenter-plugin
- API: https://github.com/sonext-software/spresenter-plugin/blob/master/docs/api-reference.md
- Projeto comunitário de referência: https://github.com/zosmalabs/fundos-por-culto-spresenter

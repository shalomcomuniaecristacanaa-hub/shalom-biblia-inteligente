# Integração final com o SPresenter

## API a validar na instalação
A documentação pública do SDK descreve eventos de live, leitura de camadas, importação de assets e armazenamento. Os nomes e assinaturas usados neste starter precisam ser conferidos contra a versão efetivamente instalada.

## Etapa obrigatória antes de ativar projeção automática
Precisamos inspecionar uma apresentação real retornada por `live.read()` na versão instalada e identificar:
1. Qual índice contém a Bíblia.
2. Qual índice é a camada de fundo.
3. Qual estrutura de `Presentation` representa um asset de imagem/vídeo.
4. Como tema e mídia são resolvidos em cada saída.

A referência pública menciona `live.apply(output, layer, presentation)`, mas isso não basta para adivinhar o objeto `presentation`. Por segurança, `applyBackgroundAsset` falha de propósito em vez de alterar uma camada incorreta durante um culto.

## Importação e segurança
- A integração com Pexels depende de chave configurada localmente.
- Nunca grave tokens no repositório.
- Mostre autor/crédito quando exigido pelos termos do provedor.
- Não use Google Images como fonte de download automatizado.

## Referências
- SDK: https://github.com/sonext-software/spresenter-plugin
- API: https://github.com/sonext-software/spresenter-plugin/blob/master/docs/api-reference.md
- Projeto comunitário de referência: https://github.com/zosmalabs/fundos-por-culto-spresenter

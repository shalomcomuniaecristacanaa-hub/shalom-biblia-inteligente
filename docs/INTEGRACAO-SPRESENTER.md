# Integração com SPresenter 0.3.50

## Camada de destino
O usuário confirmou que a apresentação possui uma camada separada chamada **Fundo**. O plugin deverá localizar essa camada pelo nome (ou permitir seleção manual na interface), e preservar todas as outras camadas, especialmente a que contém o versículo.

## API confirmada na documentação do SDK
- `spresenter.on('live', callback)` notifica que algo mudou; o callback deve reler os dados.
- `spresenter.outputs.list()` lista saídas.
- `spresenter.layers.list()` lista camadas com índice e nome.
- `spresenter.live.read(output)` lê as apresentações por camada.
- `spresenter.live.apply(output, layer, presentation)` substitui a apresentação da camada indicada.
- `spresenter.assets.createFile({ filename, sourceUrl, title, type })` pode importar mídia remota para a biblioteca; exige `assets:write` e `net:connect`.

## Proteção obrigatória
Nunca escolher a camada do versículo como destino. Antes de escrever, validar que o índice selecionado corresponde a **Fundo** e registrar o estado anterior. Se o nome/índice não puder ser confirmado, não aplicar nada.

## Pendente
A documentação pública consultada não foi suficiente para confirmar a estrutura completa do objeto `Presentation` para imagens e vídeos. Por isso a projeção automática continua desativada até testar com um asset real e confirmar o comportamento na instalação 0.3.50.

## Referências
- https://github.com/sonext-software/spresenter-plugin/blob/master/docs/api-reference.md
- https://github.com/sonext-software/spresenter-plugin/blob/master/docs/manifest.md
- https://github.com/sonext-software/spresenter-plugin/blob/master/docs/permissions.md
- https://github.com/sonext-software/spresenter-plugin/blob/master/docs/packaging.md

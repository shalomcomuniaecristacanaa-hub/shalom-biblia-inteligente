# Shalom Bíblia Inteligente

Plugin em desenvolvimento para **SPresenter 0.3.50 no Windows**.

## Objetivo
Identificar o texto bíblico que entrou ao vivo, interpretar seu tema e selecionar imagens/vídeos adequados para a camada **Fundo**, sem substituir a camada do versículo.

## Estado da versão 0.2.0
- Manifesto alinhado ao formato oficial: `main: dist/code.js` e compatibilidade mínima 0.3.50.
- Build do código com esbuild e script de empacotamento ZIP.
- Leitura de eventos live e tentativa inicial de identificar referências bíblicas.
- Classificação temática local por palavras-chave.
- A aplicação automática de mídia permanece protegida até validar a estrutura de Presentation e confirmar o índice da camada Fundo no computador de destino.

## Instalação para desenvolvimento
1. Instale Node.js 18 ou superior.
2. Execute `npm install`.
3. Execute `npm run build`.
4. No SPresenter, abra **Settings → Plugins → Load folder (dev)** e selecione a pasta do projeto.

Para gerar o ZIP: `npm run package`.

**Atenção:** ainda é uma versão de desenvolvimento. Faça os testes com uma saída de teste, nunca durante a projeção de um culto. Não coloque chaves de API no Git.

# Auxiliar Shalom para Microsoft PowerPoint

Este auxiliar permite que o painel **Culto ao Vivo** controle o Microsoft PowerPoint desktop sem converter os slides em imagens.

## Requisitos

- Windows 10 ou 11.
- Microsoft PowerPoint desktop instalado e ativado.
- PowerShell 5.1 (incluído no Windows).
- O painel do plugin SPresenter aberto no mesmo computador em que o auxiliar será iniciado.

## Instalação e uso

1. Baixe os arquivos `bridge.ps1` e `INICIAR.bat` desta pasta, mantendo os dois no mesmo diretório.
2. Dê duplo clique em `INICIAR.bat`. Se o Windows exibir uma confirmação, permita a execução do script.
3. Mantenha a janela preta aberta durante o culto. O serviço local escuta em `127.0.0.1:17843`.
4. No SPresenter, abra **Culto ao Vivo → Anúncios e apresentações** e clique em **Testar / atualizar status**.
5. Selecione o arquivo `.ppt` ou `.pptx`, clique em **Iniciar apresentação** e use os controles de slides.

O arquivo selecionado é enviado ao auxiliar e salvo em uma pasta temporária do Windows. O PowerPoint abre o arquivo original; o plugin não converte nem rasteriza os slides.

## Integração com o vMix em outro computador

O auxiliar precisa ficar no computador que executa o SPresenter e o PowerPoint. No computador do vMix, adicione uma entrada de captura da tela desse computador, por exemplo usando NDI (NDI Screen Capture) ou outro método de captura de desktop pela rede. Se usar NDI, os dois computadores precisam estar na mesma rede e o firewall deve permitir o tráfego NDI.

## Segurança e limites

- O serviço escuta somente em loopback (`127.0.0.1`), não aceita conexões da rede local e não deve ser exposto publicamente.
- O limite de upload é 200 MB por apresentação.
- O auxiliar usa automação COM do PowerPoint. Vídeos, animações, transições e efeitos são renderizados pelo próprio PowerPoint, dentro das capacidades da versão instalada.
- Vídeos vinculados externamente, fontes ausentes, codecs e caminhos de mídia que não estejam acessíveis no computador podem afetar a reprodução. Prefira incorporar mídias ou copiar junto os arquivos vinculados.
- O modo de apresentação depende da configuração de monitores do Windows e do PowerPoint. Faça um ensaio antes do culto para confirmar em qual tela a apresentação aparece e qual tela será capturada pelo vMix.
- Para encerrar o auxiliar, pressione `Ctrl+C` na janela do PowerShell. A apresentação aberta será encerrada e o PowerPoint será fechado pelo auxiliar.

## Diagnóstico

Se o teste no plugin falhar:
1. Confirme que o auxiliar foi configurado e está em execução em segundo plano.
2. Verifique se o endereço local `http://127.0.0.1:17843/health` responde no navegador.
3. Confirme que o Microsoft PowerPoint desktop está instalado (a versão web não oferece a automação COM).
4. Reinicie o auxiliar e tente novamente.

# Ponte local GrandMA2 Telnet

Ponte local entre o plugin Shalom Bíblia Inteligente e a GrandMA2 / grandMA2 onPC.

## Requisitos
- Windows com Node.js 20 LTS ou superior.
- GrandMA2/onPC na rede, com Telnet habilitado e usuário autorizado.
- A ponte deve rodar no mesmo computador do SPresenter (ela escuta somente em 127.0.0.1).

## Instalação e inicialização
1. Instale o Node.js LTS.
2. Extraia/abra esta pasta do repositório.
3. Execute `start-windows.bat` e mantenha a janela aberta.
4. No SPresenter, abra Configurações → Endereços dos equipamentos → Configurar acesso Telnet.
5. Informe o IP da máquina GrandMA2, usuário (por exemplo administrator) e senha; clique em Configurar ponte local e depois Testar conexão.
6. Use “Ler grupos, presets, cenas e macros” para consultar o show carregado.

Porta Telnet padrão: 30000. O serviço HTTP local usa 127.0.0.1:17842.

## Consultas incluídas
O plugin envia comandos documentados de consulta:
- `List Group Thru 10` — primeiros dez grupos.
- `List Preset` — presets disponíveis no destino atual.
- `List Sequence` — sequências/cenas.
- `List Macro` — macros.

O resultado depende do show aberto, destino selecionado, versão e permissões do usuário. Para detalhar uma sequência, use `List Cue` no destino correspondente ou abra `Edit Sequence [número]` no console. A listagem de presets pode exigir selecionar o tipo/destino de preset, por exemplo `List Preset 4` para Color.

## Gravar uma nova cena
1. Na GrandMA2, selecione os fixtures/grupos e prepare os valores no Programmer.
2. No plugin, informe um número de Sequence ainda livre e o nome.
3. Clique “Gravar cena na GrandMA2” e confirme a caixa de segurança.
4. O plugin envia `Store Cue 1 Sequence [número]` e `Label Sequence [número] "nome"`.
5. Confira a Sequence na mesa antes de executá-la. O comando Store grava os valores ativos do Programmer; ele não cria automaticamente efeitos, movimentos ou programação que não estejam preparados.

Para executar uma cena já existente, use o comando apropriado ao seu show, por exemplo `Go Sequence [número]` ou `Go Executor [página].[executor]`. A execução pode alterar a iluminação ao vivo.

## Segurança e limites
- A API HTTP aceita somente conexões locais (loopback).
- A senha fica apenas na memória do processo; “Desconectar” ou fechar a janela da ponte limpa a sessão/credencial.
- Não salve credenciais em arquivos ou commits.
- Telnet não é criptografado. Use uma rede de controle confiável.
- O serviço remove comandos de negociação Telnet e códigos ANSI, acompanha respostas divididas em vários pacotes e aguarda o prompt `[Channel]>`. A autenticação só é considerada concluída quando a mesa confirma explicitamente o usuário configurado. Consultas aguardam até 30 segundos pelo prompt; se houver timeout, confira o console antes de reenviar, pois o comando pode ter sido executado.
- `List` exibe dados no feedback da linha de comando. Nem todos os parâmetros internos de um preset/cue são devolvidos como texto por Telnet. Exportação XML/CSV e transferência de arquivos precisam de um fluxo separado.
- A gravação de cenas altera o show. Use número livre, confirme o Programmer e valide na mesa; não use em operação ao vivo sem teste.
- Ainda não foi possível executar teste de rede contra a GrandMA2 física/onPC nesta etapa.

# Ponte local GrandMA2 Telnet

Protótipo de serviço local para conectar o plugin Shalom à GrandMA2/onPC via Telnet.

## Requisitos
- Node.js 20 ou superior
- GrandMA2/onPC com Telnet habilitado e acessível pela rede
- No Windows, execute a ponte no mesmo computador que roda o SPresenter

## Iniciar no Windows
1. Instale o Node.js LTS.
2. Abra esta pasta no Explorador e execute `start-windows.bat`.
3. O serviço escuta somente em `127.0.0.1:17842`; não fica exposto à rede.
4. A porta Telnet padrão da GrandMA2 é 30000. O serviço ainda requer configuração por chamada HTTP local.

## Endpoints locais
- `GET http://127.0.0.1:17842/status`
- `POST /configure` JSON: `{"host":"IP_DA_MESA","port":30000,"username":"administrator","password":"SENHA"}`
- `POST /connect`
- `POST /command` JSON: `{"command":"List Group Thru 10"}`
- `POST /disconnect`

## Segurança e limitações
- A ponte aceita conexões HTTP apenas do próprio computador.
- A senha permanece somente em memória do processo; encerre o processo para apagá-la.
- Não coloque credenciais em commits, arquivos .env ou capturas de tela.
- Este é um protótipo técnico: o diálogo de autenticação e o enquadramento das respostas Telnet variam conforme versão/configuração da GrandMA2. Confirme a resposta no console da mesa antes de usar comandos que alterem luzes.
- A interface do plugin SPresenter ainda não está conectada a esta ponte; a configuração e os testes iniciais são feitos via cliente HTTP local. Não é ainda uma integração pronta para operação.

# Shalom Control — arquitetura técnica

## Decisões aprovadas

- Execução de programação em sequência, respeitando a ordem das etapas.
- Falha de etapa pausa a sequência inteira; nenhuma etapa posterior é disparada.
- Equipamentos podem estar em computadores diferentes na rede local.
- Retomada após falha é explícita e registrada.
- O estado de execução é persistido após cada transição para permitir diagnóstico após reinicialização.

## Arquitetura lógica

```text
SPresenter / Shalom Control
  ├── Scheduler — identifica eventos vencidos
  ├── Automation Engine — executa uma etapa por vez
  ├── Execution Journal — salva status, horário, erro e checkpoint
  ├── Device Manager — endereços e estado das pontes por equipamento
  └── Recovery Manager — pausa segura e retomada explícita
        │
        ├── Computador do ProPresenter / PowerPoint
        ├── Computador da GrandMA2 / ponte Telnet
        └── Computador do vMix / API HTTP
```

## Contrato de execução

Cada etapa possui identificador estável, descrição e função de execução. O motor:

1. Persiste o estado `running` antes de enviar o comando.
2. Executa somente a etapa atual.
3. Persiste `success` após retorno bem-sucedido.
4. Em erro, persiste `failed`, pausa o evento e não executa etapas posteriores.
5. Ao retomar, ignora etapas confirmadas como sucesso e tenta novamente a etapa que falhou.
6. Só marca o evento como `completed` quando todas as etapas terminarem.

Se o processo for encerrado enquanto uma etapa estiver `running`, a próxima inicialização converte o estado em `paused`. Isso evita repetir automaticamente um comando cujo resultado ficou incerto. A retomada manual pode reenviar a etapa interrompida; por isso, comandos de equipamentos deverão evoluir para confirmação/idempotência no adaptador de cada dispositivo.

## Segurança e limites da fase 1

- A fila do agendador é serializada; eventos vencidos não são executados em paralelo.
- Um evento pausado bloqueia a fila até a retomada ou intervenção.
- A execução bem-sucedida e os erros ficam registrados no próprio evento.
- Não declarar sucesso de um equipamento sem resposta do adaptador.
- A fase 1 cria o motor e o diário de execução. As fases seguintes conectam GrandMA2, vMix e os demais adaptadores com confirmações específicas.
- A ponte PowerPoint atual é local ao computador que executa o PowerPoint; o acesso distribuído será tratado pelo Device Manager sem expor serviços locais à rede indevidamente.

## Fase 1 — núcleo inicial entregue no repositório

- Motor reutilizável de execução sequencial em `src/automation/engine.ts`.
- Agendador integrado ao motor: salva checkpoint antes e depois de cada ação.
- Falha pausa o evento e impede as etapas seguintes.
- Eventos vencidos são ordenados pelo horário e processados sem concorrência.
- Reinicialização durante uma ação gera pausa de segurança, sem repetição automática.
- A tela de programações mostra estado, contagem de etapas concluídas/falhas e botão de retomada explícita.
- Retomar reenvia a etapa que falhou; o operador deve conferir o equipamento antes de autorizar, pois nem todos os protocolos atuais oferecem confirmação idempotente.

### Limitações ainda abertas na fase 1

- Situação atualizada na Fase 3: GrandMA2, vMix Start/Stop e YouTube possuem adaptadores descritos abaixo. Consulte as limitações específicas antes de operar.
- Ainda não foi possível executar build ou ensaio com equipamentos reais nesta etapa.

## Próximas entregas

1. Device Manager com perfis de computadores e testes de conexão.
2. Adaptadores confirmáveis para GrandMA2 e vMix.
3. Editor visual de sequência e dependências.
4. Painel ao vivo com estado de cada etapa e ações de retomar/cancelar.
5. Modo de ensaio sem envio de comandos reais.


## Fase 2 — Device Manager e primeira camada de rede

### Entregue no repositório

- Cadastro persistente de até 30 dispositivos, com nome, tipo, IPv4 privado, porta HTTP e rota de saúde.
- Validação de IPv4 em redes privadas RFC1918 (10/8, 172.16/12 e 192.168/16); destinos públicos e nomes DNS são recusados.
- Teste individual por HTTP GET, com timeout de 4 segundos e sem envio de comandos de operação.
- Estado do último teste (online/offline), horário e erro persistidos e apresentados no painel.
- Exclusão e atualização do cadastro pela interface de Configurações.

### Limites deliberados desta entrega

- O teste confirma somente que o endpoint HTTP respondeu com status de sucesso. Não confirma que o equipamento está pronto para operar, nem valida a reprodução de mídia ou o estado de transmissão.
- O vMix pode ser cadastrado usando a porta da API e uma rota GET suportada pela instalação; isso é um teste HTTP, separado da confirmação de streaming.
- A GrandMA2 usa Telnet e ainda requer um adaptador TCP autenticado integrado ao motor sequencial. O Device Manager HTTP não tenta simular uma conexão Telnet.
- A ponte PowerPoint existente permanece em 127.0.0.1:17843. Ela não foi exposta à LAN. O controle a partir de outro computador depende de um agente Windows dedicado com autenticação, autorização por comandos, proteção contra repetição e instalação/pareamento explícitos.
- Não há descoberta automática de computadores na rede; os endereços são cadastrados pelo operador.

### Próximas integrações

1. Agente Windows autenticado para PowerPoint e comandos locais, com instalação por computador e pareamento seguro.
2. Adaptador Telnet GrandMA2 no host de rede autorizado, com login e confirmação de prompt/resposta.
3. Adaptador vMix que consulte XML de estado após cada comando e valide a transição solicitada.
4. Confirmação de reprodução do YouTube por um player controlado, em vez de considerar a abertura de URL como reprodução.
5. Testes de integração em rede real, incluindo firewall, CORS, perda de conexão e reinicialização dos agentes.


## Fase 3 — adaptadores do agendador

### Integrações conectadas

- **GrandMA2:** o agendador envia o comando configurado à ponte Telnet local em `127.0.0.1:17842/command`, aguarda a resposta e trata respostas de login/comando recusado como falha. A ponte precisa estar configurada e autenticada previamente no painel. O serviço Telnet da mesa continua sendo acessado pela ponte existente.
- **vMix:** após StartStreaming/StopStreaming, consulta novamente o XML da API e compara `<streaming>` com o estado esperado. Divergência ou ausência do campo pausa a etapa. Comandos vMix genéricos continuam confirmando a resposta HTTP, não um estado semântico específico.
- **YouTube:** o painel usa o YouTube IFrame Player API. A etapa fica aguardando o evento PLAYING, falha ao receber erro do player e expira após 60 segundos sem confirmação. O vídeo depende de conexão, permissões de incorporação e política de autoplay do navegador; se exigir interação, a automação permanece pausada.

### Ainda pendente para comunicação distribuída completa

- A ponte PowerPoint continua local em `127.0.0.1:17843`. O agente remoto Windows autenticado, seu pareamento e o controle remoto do PowerPoint ainda não foram entregues.
- A GrandMA2 é comandada pela ponte local já existente; não há agente remoto independente no computador da mesa.
- Testes de rede, confirmação em hardware e build/compilação ainda precisam ser executados no ambiente Windows da igreja.


## Fechamento técnico e prontidão operacional

### Entregue no repositório
- Núcleo sequencial com diário/checkpoints, pausa por falha e retomada explícita.
- Cadastro e teste de saúde de dispositivos em IPv4 privado.
- Adaptador de agendamento GrandMA2 pela ponte local existente.
- Confirmação do estado de streaming do vMix após Start/Stop.
- Player YouTube incorporado que aguarda confirmação PLAYING ou erro/timeout.
- Ponte PowerPoint local com comandos de apresentação e inicialização automática opcional.

### Não declarar como concluído
- **Controle PowerPoint entre computadores:** ainda não existe agente Windows remoto autenticado/pareado. A ponte continua vinculada a 127.0.0.1:17843; não a exponha na LAN.
- **GrandMA2 distribuída:** o agendador depende da ponte local em 127.0.0.1:17842, não de um agente remoto no computador da mesa.
- **Validação de campo:** build, testes automatizados, ensaio de rede e testes com os equipamentos reais ainda não foram executados/confirmados.

### Critérios para liberar em culto
1. Executar build e testes automatizados no ambiente do projeto.
2. Testar cada adaptador com os equipamentos reais e registrar respostas/estados.
3. Simular desconexão, timeout e reinicialização; confirmar pausa sem disparo das etapas seguintes.
4. Validar firewall, endereços fixos/reservas DHCP e permissões de API.
5. Só então habilitar agendamentos automáticos em produção; manter operador disponível para confirmar retomadas.

**Conclusão:** as integrações de agendamento disponíveis no host atual estão conectadas no código, mas a comunicação distribuída completa e a validação operacional continuam pendentes. Esta documentação não certifica prontidão para uso ao vivo.

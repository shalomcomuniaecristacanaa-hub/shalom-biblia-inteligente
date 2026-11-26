# Shalom SPresenter — plano de prontidão comercial

## Objetivo
Transformar o projeto em um produto instalável, seguro, confiável e suportável por igrejas com diferentes configurações. Este documento define trabalho e critérios de aceite; não certifica que os itens estejam concluídos.

## Estado conhecido
- Existe motor de automação sequencial com checkpoint, pausa por falha e retomada explícita.
- Existe Device Manager com validação de IPv4 privado e teste HTTP de saúde.
- Há integrações no agendador para GrandMA2 via ponte local, vMix e player YouTube, com limites descritos em `docs/SHALOM-CONTROL-ARCHITECTURE.md`.
- A ponte PowerPoint permanece local; não deve ser exposta à LAN.
- A suíte automatizada inclui testes do motor e foi ampliada com testes do Device Manager. A execução da nova suíte ainda precisa ser confirmada pelo CI.
- Testes em equipamentos reais e validação de campo não estão certificados.

## Princípios de liberação
1. Diferenciar comando enviado de ação confirmada.
2. Em falha ou resultado incerto, pausar e não executar etapas posteriores.
3. Não repetir automaticamente ações interrompidas cujo resultado seja desconhecido.
4. Manter trilha de auditoria e checkpoints persistentes.
5. Não habilitar controle remoto de dispositivos sem autenticação, autorização e proteção contra repetição.
6. Não anunciar compatibilidade sem versão e configuração efetivamente testadas.

## Fases e critérios de aceite

### Fase 1 — Robustez do núcleo (prioridade imediata)
**Trabalho:** ampliar testes do motor, scheduler, persistência e retomada; testar estado `running` após reinício; verificar que falha pausa a fila; adicionar testes de regressão para eventos vencidos e concorrência; validar os artefatos e o manifest do pacote.

**Aceite:** `npm test` passa no CI; build e empacotamento passam; testes provam ordem sequencial, pausa, retomada sem repetir sucessos e recuperação segura após reinício; pacote gerado é importado em instalação limpa.

### Fase 2 — Testes de dispositivos e integrações
**Trabalho:** cobrir Device Manager (validação, timeout, HTTP inválido e erro de rede); testar contratos de GrandMA2, vMix e YouTube com respostas simuladas; separar confirmação semântica de resposta HTTP genérica.

**Aceite:** testes automatizados determinísticos sem depender de hardware; cada integração declara o que confirma e o que não confirma; falha/timeout pausa a sequência e aparece no diário.

### Fase 3 — Segurança de rede
**Trabalho:** projetar agente Windows autenticado e pareado; TLS ou canal protegido apropriado; autorização por comandos; armazenamento seguro de credenciais; proteção contra replay; logs sem segredos; limites de rede e atualização segura.

**Aceite:** revisão de ameaças documentada; pareamento revogável; testes de autenticação, autorização, replay, destinos inválidos e desconexão; nenhuma ponte local exposta diretamente à LAN.

### Fase 4 — Instalação e diagnóstico
**Trabalho:** assistente de configuração; validação de pré-requisitos; teste de conectividade por integração; exportação/importação de configuração; atualização e rollback; diagnóstico exportável com consentimento e sem credenciais.

**Aceite:** pessoa não desenvolvedora instala em ambiente limpo seguindo documentação; erros apontam causa provável e próximo passo; atualização e rollback são ensaiados.

### Fase 5 — Experiência do operador
**Trabalho:** painel ao vivo unificado; estados inequívocos (pronto, executando, confirmado, pausado, falhou); modo de ensaio sem comandos reais; pausa/cancelamento acessíveis; pré-visualização da programação.

**Aceite:** operador consegue identificar o estado de cada etapa e recuperar uma falha em ensaio observado; modo de ensaio não envia comandos a equipamentos.

### Fase 6 — Piloto e lançamento
**Trabalho:** matriz de compatibilidade; piloto acompanhado em igreja; procedimento de suporte; documentação operacional; política de versões, licença, privacidade e atualização.

**Aceite:** ciclos de culto definidos sem falhas críticas não resolvidas; cenários de desconexão, reinício e recuperação registrados; limitações e versões suportadas publicadas; plano de suporte e rollback aprovado.

## Ordem imediata dos testes automatizados
1. Motor de automação: sequência, falha, retomada e persistência.
2. Scheduler: ordenação de eventos, serialização, pausa e recuperação.
3. Device Manager: validação de cadastro e probes (sucesso, HTTP não-2xx, timeout e erro de rede).
4. Adaptadores: respostas simuladas e confirmação específica de estado.
5. Empacotamento: build, manifest, conteúdo do ZIP e instalação limpa.

## Bloqueios antes de uso comercial ao vivo
- Agente remoto autenticado/pareado ainda não entregue.
- Controle distribuído de PowerPoint e GrandMA2 ainda incompleto conforme a arquitetura técnica.
- Testes de hardware, rede real, instalação limpa e recuperação em campo precisam ser executados e registrados.
- Segurança, licenciamento, política de privacidade, suporte e matriz de compatibilidade precisam ser definidos.

## Registro de validação
Para cada execução, registrar: commit, versão do pacote, ambiente/versões, testes executados, resultado, falhas conhecidas, responsável e evidência. Não transformar um resultado de CI em certificação de funcionamento com hardware real.

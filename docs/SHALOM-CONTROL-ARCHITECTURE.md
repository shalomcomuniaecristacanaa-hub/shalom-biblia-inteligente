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

## Próximas entregas

1. Device Manager com perfis de computadores e testes de conexão.
2. Adaptadores confirmáveis para GrandMA2 e vMix.
3. Editor visual de sequência e dependências.
4. Painel ao vivo com estado de cada etapa e ações de retomar/cancelar.
5. Modo de ensaio sem envio de comandos reais.

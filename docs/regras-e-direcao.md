# Prisma — regras de referência e direção do jogo

Estado: referência de produto e registro das decisões implementadas. Revisado em 23/09/2026.

**Etapas 2 e 3 implementadas:** pedras com `id`, cor e tipo; eventos de limpeza/queda; Pulso (quatro), Raio (L/T) e Espectro (cinco); reações em cadeia, inclusive dois Espectros; migração de saves numéricos.

**Etapa 4 implementada:** Clássico sem tempo e com fim por falta de jogadas, Zen sem fim com recuperação por Espectro; níveis em ambos; partidas separadas por modo; migração do antigo Endless para Clássico.

**Etapa 5 implementada:** pontuação por pedras e especiais, multiplicador de cascata, metas de nível crescentes, dica que prioriza jogadas de maior potencial e recordes separados por modo. A calibragem foi baseada em 30 partidas simuladas de 100 jogadas.

## Objetivo

Criar um jogo de combinar três pedras agradável em sessões longas no Android, com a clareza, as cascatas e a satisfação das pedras especiais que tornam *Bejeweled 3* uma boa referência. Prisma tem nome, identidade visual, áudio, interface, textos e decisões de equilíbrio próprios. Os fatos sobre o jogo de referência abaixo são contexto de pesquisa, não uma exigência de reprodução exata.

**Prioridade do usuário:** Zen e jogo contínuo. A direção visual deve ser autoral; não copiar o desenho das gemas, fundos, animações, sons, nomes comerciais ou disposição específica da interface de outro jogo.

## Ponto de partida antes das etapas 2 e 3

Registro histórico da versão inicial, para comparação com as entregas:

| Sistema | Comportamento inicial | Direção de desenvolvimento |
| --- | --- | --- |
| Tabuleiro | Grade 8×8 com sete cores; nasce sem combinações prontas e com uma jogada possível | Manter como ponto de partida, ajustar depois de testar no Android |
| Jogada | Troca ortogonal adjacente; troca sem combinação volta à posição anterior | Dar resposta visual imediata e suportar ativações especiais quando existirem |
| Resolução | Remove linhas de três ou mais, aplica gravidade, repõe pedras e repete cascatas | Preservar a ordem das ocorrências e identidades das peças para efeitos especiais |
| Pontos | Fórmula provisória `(pedras × 20 + bônus por comprimento) × profundidade da cascata` | Calibrar com partidas reais, sem compromisso com a fórmula do jogo de referência |
| Zen | Não termina, não tem progressão visível de nível | Dar sensação de progresso sem pressão, com preferências próprias de som e efeitos |
| Endless | Não termina; sobe um nível a cada 2.000 pontos | Definir o futuro modo Clássico, com fim de partida quando acabarem as jogadas |
| Sem jogadas | Cria automaticamente um tabuleiro novo nos dois modos | Em Zen, recuperar uma jogada; em Clássico, concluir a partida |
| Ajuda | Botão de embaralhar sempre disponível | Decidir papel da ajuda em cada modo para preservar o desafio |
| Continuidade | Salva sessão e recorde no armazenamento do navegador | Migração para pedras com identidade entregue nas etapas 2 e 3 |

## Referência confirmada e decisão proposta

| Tema | Bejeweled 3: referência documentada | Prisma: alvo inicial verificável |
| --- | --- | --- |
| Combinação e ritmo | Combinar pedras e criar gemas especiais é parte central da experiência [1][2] | Trocar vizinhas para produzir linha horizontal ou vertical com ≥3 da mesma cor; inválida retorna; resolver simultaneamente as combinações de uma etapa, depois queda e novas cascatas |
| Clássico | Sem cronômetro; termina quando não restam combinações possíveis [2] | Modo Clássico sem tempo; progressão de níveis; fim de partida quando não houver jogada legal **após** resolver toda a cascata e os efeitos especiais; mostrar resultado e opção de recomeçar |
| Zen | Partida sem fim, com sons ambientes e opções de respiração na versão para Xbox [2]; a apresentação oficial destaca a personalização [3] | Modo contínuo sem cronômetro, limite de movimentos ou fim por falta de jogadas; manter pontuação e uma progressão discreta; opções separadas para música, sons e intensidade dos efeitos, em etapas posteriores |
| Quatro em linha | Cria gema Flame; ao ser combinada, atinge a própria posição e as oito ao redor [1] | Criar pedra especial de explosão local com arte e nome próprios; testar criação, ativação e reação em cadeia |
| T ou L | Cria gema Star; ao ser combinada, limpa sua linha e coluna [1] | Criar pedra especial de linhas cruzadas com identidade própria; testar cruzamentos sem contar duas vezes a célula central |
| Cinco em linha | Cria Hypercube; ao ser trocado com uma gema adjacente, elimina a cor dela [1] | Criar pedra especial que limpa uma cor do tabuleiro; definir visual, regra para trocas com outra especial e critério de pontuação antes de implementar |
| Seis em linha | Cria Supernova no jogo de referência [1] | Possibilidade de expansão; não bloquear a primeira versão de Clássico e Zen por esse caso raro |
| Níveis e pontuação | Há progressão no Clássico; o guia registra pontuação cumulativa e patentes gerais [1][2] | Exibir nível, progresso, pontuação e recorde com valores próprios; observar duração de partidas e frequência de efeitos para calibrar metas; não importar patentes nem tabela de pontos do original |

## Contratos de comportamento para implementação

1. **Estado inicial.** Toda nova partida começa com grade completa, sem combinação já formada, com pelo menos uma jogada legal. O motor e a interface usam o mesmo estado. A escolha da distribuição das cores fica ajustável.
2. **Troca comum.** Apenas vizinhos ortogonais podem ser trocados. Uma troca que não cria combinação nem ativa uma especial não altera pontuação ou tabuleiro após sua animação de retorno.
3. **Rodada de resolução.** Detectar todas as combinações criadas naquela etapa; determinar criação/ativação de especiais; aplicar remoções uma vez por célula; fazer peças sobreviventes caírem, repor espaços e repetir até o tabuleiro estabilizar. A interface deve conseguir animar cada etapa na ordem emitida pelo motor.
4. **Jogada composta.** Se uma combinação ativa outra especial, resolver a reação em cadeia antes de decidir queda, pontuação, nível ou fim de partida. Duas explosões que atinjam a mesma célula não a eliminam duas vezes.
5. **Clássico.** Só verificar fim quando não houver combinações pendentes, efeitos em andamento ou jogadas legais. Registrar resultado sem alterar a sessão Zen.
6. **Zen.** Nunca apresentar tela de derrota. Caso o tabuleiro estabilize sem jogada legal, oferecer automaticamente uma nova possibilidade sem zerar pontuação, nível ou sessão. O mecanismo exato de recuperação é uma decisão própria a validar em partidas longas.
7. **Retomada.** Pausar/fechar e voltar restaura modo, tabuleiro, pontos, nível e especiais. Versões antigas do save recebem migração ou um reinício claramente indicado, sem falha silenciosa na tela.
8. **Entrada e resposta.** Toque em duas pedras e arrasto curto representam a mesma jogada; bloqueio de entrada ocorre apenas durante a resolução. Feedback de seleção, troca inválida, combinação e cascata deve ser perceptível com som desligado.

## Casos de aceitação antes de publicar cada etapa

- Troca diagonal ou distante: não muda tabuleiro nem pontos. Troca vizinha inválida: anima e volta; troca válida de três: remove, repõe e soma pontos uma vez.
- Duas combinações na mesma etapa: ambas são resolvidas; cruzamento não duplica a célula. Nova combinação causada por queda: conta como cascata seguinte.
- Quatro em linha, T/L e cinco em linha: cada padrão cria a especial esperada quando sua etapa for entregue; criar não deve disparar a peça imediatamente por acidente.
- Explosões simultâneas e ativação em cadeia: resultado determinístico com números aleatórios controlados nos testes; nenhum vazio permanece após a resolução.
- Mesmo estado sem jogadas: Clássico mostra resultado; Zen recupera uma jogada e continua com pontuação intacta.
- Alternar modos, salvar e reabrir no Android: partidas e recordes independentes; a interface ainda responde a toque e arrasto após retomar.
- Sessão Zen longa: sem derrota, sem contagem regressiva, sem travamento de input; nível e feedback permanecem legíveis em tela pequena.

## Decisões adotadas nas etapas 2 e 3

- Uma combinação conectada da mesma cor cria no máximo uma especial: cinco em linha tem prioridade sobre L/T, que tem prioridade sobre quatro em linha. A peça nasce no destino da troca quando essa casa for uma pedra comum dentro da combinação; caso contrário, na casa comum de maior índice. Nunca substitui uma especial presente na combinação.
- Pulso atinge a área 3×3; Raio atinge linha e coluna. Uma especial atingida por outra é acionada na mesma etapa, antes da queda. Uma célula atingida várias vezes pontua apenas uma vez.
- Espectro trocado com uma pedra elimina a cor dela; dois Espectros trocados eliminam o tabuleiro inteiro. Um Espectro atingido indiretamente usa a primeira cor encontrada horizontalmente ao seu lado. São escolhas próprias do Prisma, a reavaliar após jogar no Android.
- Pontos: 25 por célula removida; bônus de 120 pelo Pulso, 180 pelo Raio e 240 pelo Espectro. Cada etapa da cascata aumenta o multiplicador em 0,4, limitado a 3×.
- Clássico e Zen começam com meta de 1.800 pontos; ela cresce 350 por nível até 5.300. Sem jogadas, Clássico encerra e Zen põe um Espectro no centro ou na primeira casa comum disponível, mantendo as demais pedras. O embaralhamento manual fica exclusivo do Zen. Ao trocar de modo, cada partida salva permanece intacta.
- A dica avalia todas as trocas legais, prioriza especiais e combinações maiores e apenas destaca duas casas. Recordes guardam maior pontuação, nível e jogada por modo, além de partidas clássicas concluídas.
- As sete cores mantêm probabilidades iguais. Em 30 simulações de 100 jogadas, a média foi 141 pontos por jogada, 1,31 etapa por jogada, 7,1 especiais criadas e nível 6 ao final; os resultados variaram do nível 5 ao 7.

## Decisões ainda abertas

Os valores atuais formam a primeira calibragem mensurável. Ajustar após partidas reais no Android se a progressão parecer rápida ou lenta. Velocidade dos efeitos e interações adicionais entre especiais continuam abertas.

O visual deve priorizar **leitura instantânea das sete cores e das especiais**, bom contraste, movimento fluido e efeitos reguláveis, com linguagem gráfica criada para Prisma. Testar em tela Android real antes de fixar desenho, brilho, tamanho de alvos e duração das animações.

## Fontes de referência

1. PopCap Games, [*Bejeweled 3 Strategy Guide*](https://images.popcap.com/www/images/product/extras/strategyguides/bejeweled3/1033/bejeweled3strategyguide.pdf), seção “Special Gems” e descrição de progressão. PDF oficial, consultado via índice de busca em 23/09/2026.
2. PopCap Games, [*Bejeweled 3 Xbox Manual*](https://static-www.ec.popcap.com/support.popcap.com/sites/support.popcap.com/files/BEJ3_Xbox_Manual.pdf), pp. 6–7 (Clássico e Zen). PDF oficial, consultado via índice de busca em 23/09/2026.
3. Electronic Arts, [página oficial do Bejeweled 3](https://www.ea.com/pt-br/games/bejeweled/bejeweled-3). Para o contexto comercial dos modos; as regras detalhadas acima vêm dos materiais da PopCap.

# Prisma

As regras de referência, decisões próprias e casos de aceitação das próximas etapas estão em [docs/regras-e-direcao.md](docs/regras-e-direcao.md).

Protótipo original de jogo de combinar pedras, feito para telas de Android. Inclui tabuleiro 8×8, trocas e quedas animadas, comandos por toque ou arrasto, cascatas, pontuação, pedras especiais, sons opcionais, partidas e recordes salvos localmente. Funciona sem internet depois de instalado.

## Modos

- **Clássico:** sem cronômetro, com níveis; termina quando não há mais trocas capazes de formar combinações nem Espectro utilizável. A tela de resultado permite recomeçar. O botão de embaralhar não está disponível neste modo.
- **Zen:** sem cronômetro nem tela de derrota, também com níveis. Se acabarem as jogadas, surge um Espectro para que a partida continue, sem zerar pontos ou apagar outras especiais. É possível embaralhar manualmente.

Ao alternar entre modos, cada partida fica guardada separadamente no navegador. Sessões e recordes antigos do modo Endless passam para Clássico, com pontos e tabuleiro preservados.

## Pontuação, níveis e recordes

- Cada pedra removida vale 25 pontos.
- Criar Pulso, Raio ou Espectro acrescenta respectivamente 120, 180 ou 240 pontos.
- Cascatas multiplicam o valor da etapa: 1×, 1,4×, 1,8×, 2,2×, 2,6× e 3× a partir da sexta etapa.
- O primeiro nível pede 1.800 pontos. A meta aumenta 350 pontos por nível até o limite de 5.300.
- O botão **Dica** destaca uma troca válida, priorizando jogadas com maior potencial, sem alterar a pontuação.
- A seção **Ver recordes** mostra maior pontuação, maior nível e melhor jogada de cada modo, além das partidas clássicas concluídas.

Partidas salvas antes desta versão mantêm o nível e o progresso aproximado que já tinham. As sete cores continuam com chances iguais de aparecer; a dificuldade cresce pelo ritmo das metas, sem retirar cores nem reduzir as jogadas disponíveis.

## Toque e apresentação

Ao arrastar, a pedra de destino é destacada antes da troca. A vibração é opcional, começa desligada e aparece apenas em aparelhos compatíveis. A transição de nível respeita a preferência do sistema por menos movimento. Cada jogada válida é salva assim que o motor confirma seu resultado; ao voltar após fechar o navegador durante uma cascata, o tabuleiro abre no resultado concluído.

## Personalização do Zen

Abra **Personalizar Zen** para ligar separadamente uma melodia sintetizada e um som ambiente suave, escolher respiração guiada (4/4 ou 4/6 segundos) e ajustar os efeitos entre Suave, Padrão e Vibrante. As preferências ficam salvas separadas da partida, enquanto o botão de som no cabeçalho controla apenas os sons das combinações. Música, ambiente e guia vêm desligados; música e ambiente só começam após um toque no jogo e param ao ocultar a página ou entrar no Clássico. A preferência do sistema por menos movimento prevalece sobre a animação do guia, mas seu texto continua funcionando.

## Arte e áudio

O seletor **Visual** abaixo dos modos permite alternar entre **Anterior**, com as pedras desenhadas em CSS, e **Novo**, com as pedras ilustradas. A escolha funciona em Zen e Clássico, fica salva no navegador e não altera o tabuleiro, os pontos nem a partida. No visual novo, todas as pedras têm uma área central quadrada dentro de sua célula. Pulso e Raio mantêm a cor e o formato da pedra original para indicar com quais peças combinam, com símbolos distintos para indicar seus efeitos; apenas o Espectro é multicolorido.

As sete pedras comuns e as três especiais usam atlas originais com recortes quadrados consistentes. O fundo do jogo foi criado para manter o centro escuro e legível; partículas complementam as reações sem esconder as peças. Os arquivos `gem-atlas.webp`, `special-atlas.webp` e `prisma-bg.jpg` foram gerados para este jogo e otimizados para uso móvel. Efeitos sonoros diferentes identificam combinação, cascata, Pulso, Raio, Espectro, nova especial, nível e jogada inválida; a música do Zen tem quatro frases próprias. Todos os sons são sintetizados no dispositivo, sem arquivos externos. O HTML único incorpora as imagens e funciona sem rede. A direção e os prompts dos assets estão em [docs/arte-e-audio.md](docs/arte-e-audio.md).

## Pedras especiais

- **Pulso:** quatro da mesma cor em linha criam uma pedra que, quando combinada, explode nas oito casas ao redor.
- **Raio:** combinação em L ou T cria uma pedra que, quando combinada, limpa a linha e a coluna.
- **Espectro:** cinco ou mais da mesma cor em linha criam uma pedra que pode ser trocada com uma vizinha para limpar a cor dela. Trocar dois Espectros limpa o tabuleiro.

As três pedras podem ativar outras especiais atingidas pelos seus efeitos. Cada pedra tem identidade persistente e o motor emite eventos separados de limpeza e queda para a animação. Saves antigos, que guardavam apenas números de cor, são convertidos ao novo formato ao abrir.

## Jogar no computador

Na pasta do projeto, execute `python3 -m http.server 8080` e abra `http://localhost:8080`. Não abra o HTML diretamente como `file://`: os módulos JavaScript e a instalação precisam de um servidor local.

## Jogar no Android

Para jogar, abra [a versão HTTPS](https://prisma-jogo-thiago.thiagodluz.chatgpt.site) no navegador do Android. Use **Adicionar à tela inicial** ou **Instalar app** no menu do navegador. O service worker guarda os arquivos para uso offline após a primeira abertura. O arquivo `Prisma-jogar-offline.html` é uma alternativa para navegadores que permitam JavaScript em arquivos locais; alguns navegadores Android abrem downloads em `content://` e bloqueiam a execução ou o armazenamento nesse contexto. O código ainda não gera um APK: para distribuição pela Play Store ou instalação por arquivo, o próximo passo é empacotar a aplicação e assinar o APK/AAB em um ambiente com Android SDK.

## Testes

Execute `npm test` (Node.js 18+). Para reconstruir o arquivo único depois de editar o código, execute `npm run build:offline`. Não há dependências externas.

## Situação do protótipo

Clássico e Zen têm regras próprias, pontuação calibrada, níveis progressivos, dicas e recordes. O Zen tem som, respiração e efeitos configuráveis. A arte e o áudio têm identidade própria; testes em aparelho Android ainda são necessários para avaliar equilíbrio, cor, desempenho e volume. Nenhum arquivo do Bejeweled foi incorporado.

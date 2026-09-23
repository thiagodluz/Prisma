# Prisma

As regras de referência, decisões próprias e casos de aceitação das próximas etapas estão em [docs/regras-e-direcao.md](docs/regras-e-direcao.md).

Protótipo original de jogo de combinar pedras, feito para telas de Android. Inclui tabuleiro 8×8, trocas e quedas animadas, comandos por toque ou arrasto, cascatas, pontuação, pedras especiais, sons opcionais, partidas e recordes salvos localmente. Funciona sem internet depois de instalado.

## Modos

- **Clássico:** sem cronômetro, com níveis; termina quando não há mais trocas capazes de formar combinações nem Espectro utilizável. A tela de resultado permite recomeçar. O botão de embaralhar não está disponível neste modo.
- **Zen:** sem cronômetro nem tela de derrota, também com níveis. Se acabarem as jogadas, surge um Espectro para que a partida continue, sem zerar pontos ou apagar outras especiais. É possível embaralhar manualmente.

Ao alternar entre modos, cada partida fica guardada separadamente no navegador. Sessões e recordes antigos do modo Endless passam para Clássico, com pontos e tabuleiro preservados. Por enquanto ambos usam a meta provisória de 2.000 pontos por nível; a calibragem do ritmo virá em outra etapa.

## Pedras especiais

- **Pulso:** quatro da mesma cor em linha criam uma pedra que, quando combinada, explode nas oito casas ao redor.
- **Raio:** combinação em L ou T cria uma pedra que, quando combinada, limpa a linha e a coluna.
- **Espectro:** cinco ou mais da mesma cor em linha criam uma pedra que pode ser trocada com uma vizinha para limpar a cor dela. Trocar dois Espectros limpa o tabuleiro.

As três pedras podem ativar outras especiais atingidas pelos seus efeitos. Cada pedra tem identidade persistente e o motor emite eventos separados de limpeza e queda para a animação. Saves antigos, que guardavam apenas números de cor, são convertidos ao novo formato ao abrir.

## Jogar no computador

Na pasta do projeto, execute `python3 -m http.server 8080` e abra `http://localhost:8080`. Não abra o HTML diretamente como `file://`: os módulos JavaScript e a instalação precisam de um servidor local.

## Jogar no Android

Para jogar, abra [a versão HTTPS](https://prisma-jogo-thiago.thiagodluz.chatgpt.site) no navegador do Android; ela é privada e pode pedir acesso à conta. Use **Adicionar à tela inicial** ou **Instalar app** no menu do navegador. O service worker guarda os arquivos para uso offline após a primeira abertura. O arquivo `Prisma-jogar-offline.html` é uma alternativa para navegadores que permitam JavaScript em arquivos locais; alguns navegadores Android abrem downloads em `content://` e bloqueiam a execução ou o armazenamento nesse contexto. O código ainda não gera um APK: para distribuição pela Play Store ou instalação por arquivo, o próximo passo é empacotar a aplicação e assinar o APK/AAB em um ambiente com Android SDK.

## Testes

Execute `npm test` (Node.js 18+). Para reconstruir o arquivo único depois de editar o código, execute `npm run build:offline`. Não há dependências externas.

## Situação do protótipo

Clássico e Zen têm regras próprias; ainda faltam a calibragem de pontuação e níveis, mais opções de áudio e efeitos, e os demais modos planejados. Todas as formas, cores, sons gerados e o nome são originais; nenhum arquivo do Bejeweled foi incorporado.

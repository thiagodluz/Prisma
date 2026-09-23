# Prisma

As regras de referência, decisões próprias e casos de aceitação das próximas etapas estão em [docs/regras-e-direcao.md](docs/regras-e-direcao.md).

Protótipo original de jogo de combinar pedras, feito para telas de Android. Inclui tabuleiro 8×8, trocas e quedas animadas, comandos por toque ou arrasto, validação de combinações, cascatas, pontuação, sons opcionais, embaralhamento, partida e recorde salvos localmente, modo Zen sem limite de tempo e modo Endless com níveis progressivos. Funciona sem internet depois de instalado.

## Jogar no computador

Na pasta do projeto, execute `python3 -m http.server 8080` e abra `http://localhost:8080`. Não abra o HTML diretamente como `file://`: os módulos JavaScript e a instalação precisam de um servidor local.

## Jogar no Android

Para jogar, abra [a versão HTTPS](https://prisma-jogo-thiago.thiagodluz.chatgpt.site) no navegador do Android; ela é privada e pode pedir acesso à conta. Use **Adicionar à tela inicial** ou **Instalar app** no menu do navegador. O service worker guarda os arquivos para uso offline após a primeira abertura. O arquivo `Prisma-jogar-offline.html` é uma alternativa para navegadores que permitam JavaScript em arquivos locais; alguns navegadores Android abrem downloads em `content://` e bloqueiam a execução ou o armazenamento nesse contexto. O código ainda não gera um APK: para distribuição pela Play Store ou instalação por arquivo, o próximo passo é empacotar a aplicação e assinar o APK/AAB em um ambiente com Android SDK.

## Testes

Execute `npm test` (Node.js 18+). Para reconstruir o arquivo único depois de editar o código, execute `npm run build:offline`. Não há dependências externas.

## Situação do protótipo

As duas opções permitem jogar sem prazo e sem fim; Endless mostra evolução de nível a cada 2.000 pontos, e Zen omite essa progressão. É uma primeira base mecânica. Ainda faltam pedras especiais, objetivos e efeitos de áudio e animação mais elaborados. Todas as formas, cores, sons gerados e o nome são originais; nenhum arquivo do Bejeweled foi incorporado.

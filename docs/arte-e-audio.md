# Prisma — arte e áudio da etapa 8

Direção: pedras com silhuetas diferentes, facetas nítidas e cores saturadas; fundo de índigo escuro com refrações somente nas bordas. Os sete tipos comuns e as três especiais preservam uma tela quadrada por célula do atlas, sem distorcer peças especiais. O jogo não utiliza imagens nem sons de outro jogo.

## Assets

| Arquivo | Uso | Tamanho no projeto |
| --- | --- | --- |
| `gem-atlas.webp` | Sete pedras comuns em grade 3×3 com transparência | 1254×1254 |
| `special-atlas.webp` | Pulso, Raio e Espectro na primeira linha de uma grade 3×3 | 1254×1254 |
| `prisma-bg.jpg` | Fundo vertical de baixo contraste | 940×1672 |

Foram gerados com o ImageGen integrado, depois convertidos para WebP/JPEG para reduzir o download móvel. Os PNGs originais da geração não são necessários para executar o jogo. O arquivo HTML autônomo incorpora as imagens como dados locais; a versão instalada pelo navegador as guarda no cache offline.

### Prompts finais de geração

**Pedras comuns:** “Use case: stylized-concept. Asset type: final game sprite atlas for a portrait mobile match-three game called Prisma. Make one square transparent PNG containing EXACTLY seven separate polished gemstone sprites arranged in the first seven cells of an invisible 3x3 grid, read left-to-right, top-to-bottom; last two cells completely transparent. Each cell is square, each gem centered and fully contained within the middle 72% of its cell with equal scale and no overlap. Top row: (1) crimson faceted rounded-kite ruby, (2) honey amber beveled hexagon, (3) luminous pale golden circular sunstone. Middle row: (4) vivid mint green angular diamond, (5) bright turquoise elongated lozenge with rounded corners, (6) deep sapphire blue pentagonal crystal. Bottom left: (7) amethyst purple asymmetric faceted crystal. Stylized premium 2.5D game art: sharp clean facets, subtle inner glow, restrained glass reflections, distinct silhouettes readable at 40px, rich saturated colors against dark navy UI. Same consistent overhead camera and light source for all gems. Genuine alpha transparency everywhere outside the individual gems; no colored or checkerboard background, no grid lines, no labels, no numbers, no typography, no halo or cast shadow crossing cell bounds. Original design, do not imitate any existing game's gemstone shapes.”

**Especiais:** “Use case: stylized-concept. Asset type: final special-stone sprite atlas for Prisma mobile match-three game, matching a premium 2.5D faceted gemstone set with overhead view, crisp facets and restrained bright inner glow on genuinely transparent alpha. One square image divided into an invisible 3x3 grid of equal square cells. ONLY the three cells in the top row contain one separate centered gemstone each, each entirely within the middle 75% of its cell; all six lower cells completely transparent. Top left: Pulso, rounded coral-orange crystal with a radiant central ember and a distinct small eight-point faceted ring inside the stone. Top middle: Raio, icy cyan-blue four-point star-crystal with strong perpendicular light facets that read as a cross. Top right: Espectro, perfectly round prismatic rainbow crystal with seven subtle color sectors converging in a bright clean center. Three silhouettes clearly distinct at 40px. No lettering, no symbols outside the stones, no cell borders or grid lines, no checkerboard or backdrop, no drop shadow extending past cell bounds. Original design, not copied from any other game.”

**Fundo:** “Use case: stylized-concept. Asset type: subtle full-screen background texture for Prisma mobile match-three game. Portrait composition, dark midnight indigo and near-black violet crystalline atmosphere, very faint diagonal refractions and soft teal/violet light entering from the upper corners, understated depth and gently illuminated edges, calm premium original game visual identity. Most of the center remains dark and low contrast to keep a foreground 8x8 gemstone board and white text legible. Fine grain and a few restrained optical prisms at far edges; no gemstones, no text, no interface, no logo, no buttons, no bright focal spot. Full-bleed seamless-looking painterly digital art, portrait orientation.”

## Áudio

`sound.js` sintetiza cues curtos e distintos para troca inválida, combinação, cascata, Pulso, Raio, Espectro, criação, nível e recuperação. `zen.js` mantém um ciclo autoral de quatro acordes com notas espaçadas e camada de ambiente filtrada. Música e ambiente permanecem controles independentes; o botão superior controla apenas os sons do jogo. O áudio é desbloqueado após interação e interrompido ao ocultar a página ou deixar o Zen.

## Verificação pendente em aparelho

Conferir legibilidade e saturação das dez pedras numa tela Android pequena, volume e balanço entre música/ambiente/efeitos por alto-falante, e fluidez de partículas em cascatas longas. Esses julgamentos dependem do hardware e da audição em uso real.

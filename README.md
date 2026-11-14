# Iniciativa & Efeitos — versão 1.0.2

Extensão independente para Owlbear Rodeo, inspirada na praticidade de uma lista de iniciativa. Todos os participantes da sala podem usar os controles. Os efeitos são inteiramente livres: não há modelos de habilidades, catálogo de magias ou efeitos pré-cadastrados.

Esta é a primeira versão para validação na mesa. A interface, as regras e a comunicação em uma sala simulada foram verificadas. A instalação numa sala real e a compatibilidade visual completa com Smoke & Spectre ainda precisam ser verificadas.

## Mudanças da versão 0.2.0

Cabeçalho, rodada, botão de turno e linhas mais compactos; superfícies semitransparentes. O cartão completo e a quantidade de efeitos no marcador pertencem somente aos alvos. Quem apenas aplicou vê uma linha discreta de aplicação; quem apenas controla a duração vê uma linha de contagem com os alvos. Clique nessas linhas para editar. A transparência do fundo do próprio painel do Owlbear depende do aplicativo e não foi verificada numa sala real.

## Usar a iniciativa

1. Selecione uma ou várias imagens de qualquer camada no mapa e use **Iniciativa** no menu da seleção. Informe o valor. Também é possível adicionar pelo painel.
2. Organize a lista. Arraste pela alça à esquerda; clique na alça para escolher a posição sem arrastar. Clique no número para mudar a iniciativa ou no lápis para editar o nome exibido.
3. Clique em **Iniciar primeiro turno**. Só nesse momento começa o combate.
4. **Próximo turno** avança pela ordem atual. Depois do último personagem, começa uma nova rodada. O atalho é `Alt + seta para a direita`, com o painel em foco.
5. A seta direita junto à rodada percorre os turnos restantes, processa os efeitos e para no primeiro personagem da rodada seguinte. Os avisos atravessados aparecem juntos numa notificação.
6. A seta esquerda recupera o estado registrado no início da rodada anterior. Isso inclui participantes, ordem e efeitos: efeitos criados depois daquele momento desaparecem e os que existiam voltam. Avisos antigos não são reenviados.
7. Clique no número da rodada para corrigir apenas sua numeração, sem mexer nos efeitos.

A inclusão inicial e a edição numérica posicionam pela iniciativa, da maior para a menor. Depois disso, a ordem arrastada prevalece até outra edição. Um personagem que entra depois da posição atual pode agir nessa rodada; quem entra antes espera a próxima. Quem já agiu não age novamente só por ter sido movido.

Clique no nome para centralizar a câmera dos participantes que podem ver aquela imagem. Nas configurações, **Focar no personagem do turno** faz isso automaticamente e permite ajustar a aproximação.

## Criar um efeito

Use o marcador ao lado de um personagem. Preencha:

- **Nome e descrição:** texto livre, sem regras prontas.
- **Quem aplicou:** origem do efeito, ou **Nenhum** para deixar sem aplicador. A referência da duração continua obrigatória e independente.
- **Conta no final do turno de:** personagem cuja passagem de turno controla a duração. O padrão é o personagem do turno atual, inclusive em uma reação durante o turno de outra pessoa.
- **Quem recebe:** um ou mais alvos. A duração é compartilhada por essa aplicação.
- **Rodadas restantes:** de 1 a 999.
- **Aviso de ativação:** sem aviso, no início do turno de cada alvo ou no final do turno de cada alvo.
- **Mensagem para a mesa:** o texto que aparece ao ativar.
- **Avisar rodadas restantes e encerramento:** controla separadamente os avisos da duração.

O turno que já estava em andamento ao criar o efeito não reduz sua duração. A primeira redução acontece no final do próximo turno da referência. Um efeito criado antes do combate começa a contar no primeiro turno completo da referência. Ao chegar a zero, desaparece automaticamente.

As aplicações são independentes, mesmo com nomes iguais. Não há acúmulo automático. Efeitos sem aviso de ativação continuam consultáveis no marcador; passe o mouse para um resumo ou clique para abrir a descrição. Editar um efeito mantém seu relógio; trocar a referência inicia a contagem na próxima passagem completa dessa nova referência.

Áreas, alcance, concentração, dados, dano, cura e vida são responsabilidade da mesa. Para uma área manual, registre a descrição apenas em quem mantém a habilidade. O restante do grupo pode consultar os efeitos dessa pessoa.

Se a referência sair da iniciativa, sua posição fica guardada internamente e continua contando sem exigir um clique extra. Remover um alvo retira apenas esse alvo; a aplicação desaparece se não restar nenhum. Nomes personalizados sobrevivem à remoção e ao reinício do combate.

## Ocultos e Smoke & Spectre

O mestre pode recolher a seção de participantes ocultos. A configuração **Passar automaticamente pelos ocultos** também percorre seus turnos e efeitos sem exigir cliques individuais. Recolher os nomes, sozinho, não muda a sequência.

A extensão filtra nomes, avisos e foco conforme o que cada jogador pode ver. Reconhece imagens ocultadas e os identificadores de Smoke & Spectre 5.x; usa luzes e paredes locais para estimar a névoa dinâmica.

**Limitação desta versão:** a visibilidade na névoa é uma aproximação conservadora pelo centro da imagem. Elevações, paredes de um lado só, bordas de iluminação, névoa persistente e formas curvas podem divergir do mapa renderizado. Essa integração ainda não foi validada em uma sala real com Smoke & Spectre. Os testes simulados não comprovam esses casos. O armazenamento é compartilhado com a sala; a filtragem da interface não é uma barreira contra inspeção técnica dos dados por um participante.

## Reiniciar

Na engrenagem, **Reiniciar tudo** pede confirmação dentro do painel e apaga a iniciativa, os efeitos, as rodadas, o registro, as configurações e o histórico desta extensão. Preserva os nomes personalizados. Não apaga imagens nem os dados de outras extensões.

## Abrir a prévia no computador

A prévia fora do Owlbear usa personagens de demonstração e salva apenas neste navegador. Não possui efeitos pré-cadastrados e não altera nenhum tabuleiro. A troca **Visão do mestre / Visão do jogador** ajuda a conferir os ocultos.

Para iniciar novamente, com Node.js 22.18 ou superior instalado, abra um terminal nesta pasta:

```powershell
npm ci
npm run dev
```

Abra o endereço que aparecer. Dentro do Owlbear, a lista usa os dados da cena em vez da demonstração.

## Publicar e instalar

Não foi feita publicação automática nem alteração na sua conta. Para usar com outras pessoas, todos precisam alcançar a mesma versão por um endereço HTTPS público. Abrir o arquivo HTML diretamente ou usar `localhost` não publica a extensão para o grupo.

O pacote de código inclui a preparação para **GitHub Pages**, em `.github/workflows/deploy.yml`. Ao colocar os arquivos na raiz de um repositório com a branch `main` e selecionar **GitHub Actions** como fonte do Pages, essa rotina compila o projeto usando o nome do repositório no caminho dos arquivos. O endereço de instalação será o endereço publicado pelo Pages, seguido de `/manifest.json`. Para um repositório especial de site pessoal, cujo nome termina em `.github.io`, altere `INITIATIVE_BASE_PATH` na rotina para `/`.

O pacote separado de publicação contém os arquivos já compilados para a **raiz de um site**. Envie seu conteúdo para uma hospedagem estática HTTPS. Caso a hospedagem use uma subpasta, gere uma nova versão com o caminho correspondente:

```powershell
$env:INITIATIVE_BASE_PATH = '/nome-do-repositorio/'
npm run build
Remove-Item Env:INITIATIVE_BASE_PATH
```

O resultado fica em `dist`. Os endereços do manifesto, da interface e do menu usam esse mesmo caminho.

Instale a extensão personalizada pelo endereço do `manifest.json` e ative-a na sala. O manifesto é o arquivo usado pelo Owlbear para carregar a extensão, conforme a [documentação oficial](https://docs.owlbear.rodeo/extensions/reference/manifest/). Antes de usar em uma sessão, confira numa sala de teste, com mestre e jogador, a névoa, os avisos e o foco da câmera.

## Verificações e manutenção

- `npm test`: testes automáticos das regras e da visibilidade.
- `npm run build`: validação de tipos e geração da versão de publicação.
- Com o servidor local aberto, visite `/tests/room.html` e clique em **Executar testes de integração** para testar a comunicação do SDK em duas instâncias simuladas.

Veja `VERIFICACAO.md` para os resultados e limites. `src/engine.ts` contém as regras, `src/background.ts` a coordenação da sala, `src/visibility.ts` o tratamento da visibilidade e `src/main.ts` a interface. As dependências estão fixadas no arquivo de versões para reproduzir esta entrega.

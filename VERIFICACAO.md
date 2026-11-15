# Verificação — 14/11/2026

## Resultados observados

- **27 testes automáticos passaram.** Cobrem preparação, primeiro turno, duração sem desconto no turno da aplicação, referências diferentes do aplicador, múltiplos alvos, expiração, avisos no início/final, salto e retorno de rodadas, edição apenas do número, ordem manual, novos participantes, remoções, nomes persistentes, reinício, repetição de comandos, dados incompatíveis e filtragem básica da visibilidade.
- **11 testes de integração passaram no navegador**, executando o SDK oficial em duas instâncias de segundo plano de uma sala simulada: conexão, menu em imagens de qualquer camada, ação de jogador, avanço simultâneo, notificações com o painel fechado, ocultos, retorno sem repetição de avisos, reenvio da mesma ação, foco, nomes persistentes e troca do coordenador após a saída do mestre.
- **Interface conferida no navegador:** criação de efeito livre, alvo diferente da referência, marcador e descrição, início do combate, salto de rodada, primeira redução correta e restauração da rodada anterior. Layout conferido também na largura de 440 pixels usada no painel. Nenhum erro de console nessa verificação da interface.
- **Compilação passou**, incluindo validação de tipos. Versões usadas: SDK 3.1.0, TypeScript 7.0.2, Vite 8.3.8; Node.js 26.13.0 neste computador.
- **Caminhos de publicação conferidos** na raiz e na subpasta `/iniciativa-efeitos/`, verificando que o manifesto aponta para arquivos existentes e que as páginas usam o caminho correto dos recursos. Isso não equivale a uma publicação no GitHub Pages.

## Limites da verificação

Não foi feita instalação numa conta real do Owlbear, publicação pública, teste numa rede com jogadores reais nem teste do mapa renderizado pelo Smoke & Spectre. O simulador confirma o protocolo usado pela extensão, mas não reproduz todo o servidor, as permissões ou a renderização do Owlbear.

A interpretação da névoa usa geometria simplificada e metadados de Smoke & Spectre 5.x. Não há garantia de equivalência visual em configurações avançadas. Recarregamento e concorrência sob perda prolongada de conexão ainda precisam ser exercitados numa sala real. O histórico mantém os estados das rodadas e pode aumentar o volume de dados em combates muito longos.

Não foram incluídos modelos prontos de efeitos ou habilidades. Os textos usados para verificar regras são dados de teste, não conteúdos carregados na extensão. A imagem de prévia mostra um efeito livre criado manualmente durante a verificação.

## Atualização 0.2.0

28 testes de regras e visibilidade passaram, incluindo aplicação sem origem, edição e expiração pela referência escolhida. Compilação validada. No navegador, foram conferidos o cabeçalho compacto, o cartão apenas no alvo, a linha de aplicação e a troca para Nenhum, preservada ao reabrir o formulário. Os 11 testes de integração acima são evidência da versão 0.1.0; não foram repetidos nesta alteração de apresentação e aplicador opcional. Transparência do painel do Owlbear ainda não conferida em sala real.

## Atualização 1.0.2
Compilação e tipos validados. Conferidos no navegador: cabeçalho sem título, ausência do botão geral Novo efeito, acesso a Adicionar efeito pelo personagem e fundo com opacidade reduzida de 78% para 64%. Regras de combate não alteradas nesta versão.

## Entrega 1.0.3

31 testes automáticos passaram, incluindo migração da preferência de retratos, preservação da opção desativada e exclusão dos endereços de imagens ocultas da apresentação do jogador. Compilação e tipos passaram. Os 11 testes de comunicação com SDK real e sala simulada passaram novamente. Conferidas no navegador três imagens carregadas e a remoção/restauração das bolhas ao salvar a configuração como jogador.

O pacote incorpora as correções documentadas na revisão intermediária. Não foi publicado nesta entrega. As imagens de demonstração e o fundo da captura são ilustrativos. A validação com imagens hospedadas numa sala real e com a névoa avançada do Smoke & Spectre permanece pendente.

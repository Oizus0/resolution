> Registro histórico: as correções abaixo foram incorporadas ao pacote 1.0.3. A publicação continua a cargo do usuário.

# Revisão intermediária — sem nova publicação

Esta revisão modifica o código local. Não foi enviada ao GitHub, não foi criado novo pacote e a versão do manifesto permanece 1.0.2 até as próximas instruções.

## Problemas confirmados e corrigidos

- Reiniciar: a confirmação desaparecia antes de poder ser utilizada. O evento assíncrono `close` do diálogo antigo apagava todo o contêiner, inclusive o novo diálogo. Cada diálogo agora só remove seu próprio elemento se ainda pertence ao contêiner. Reproduzido antes da correção e verificado depois, tanto na demonstração quanto pelo SDK na sala simulada.
- Aproveitamento de espaço: a lista tinha apenas um limite máximo de altura e o painel terminava logo após seu conteúdo. Agora o painel ocupa a altura disponível, a lista é a região flexível e o rodapé permanece abaixo dela.
- Hierarquia visual: símbolo, rodada, próximo turno e configurações ficam em uma única linha. Nomes em 16 px, status em 11 px, iniciativas em 22 px. Avatar com iniciais removido da apresentação para liberar largura. Nomes longos podem quebrar linha. Largura máxima solicitada ao Owlbear: 480 px, adaptável ao espaço disponível.
- Repetições de visibilidade: montar nomes, alvos e descrições provocava novas consultas à geometria de toda a cena. SceneClient agora reutiliza o resultado até a próxima mudança; a interface monta o conjunto de imagens visíveis uma vez por renderização.
- Trabalho de histórico: cada comando clonava todas as rodadas arquivadas. A redução agora copia apenas o estado mutável e compartilha snapshots imutáveis. Teste com congelamento do estado anterior garante que avançar, editar e retornar não alterem as rodadas arquivadas.
- Atualizações simultâneas: notificações de mudanças da cena são agrupadas por quadro de renderização; uma atualização externa não recria os elementos enquanto o usuário arrasta a ordem.
- Erros do menu contextual: falhas ao abrir a seleção agora são exibidas ao usuário, em vez de deixarem uma promessa rejeitada sem tratamento.

## Publicação examinada

Repositório: https://github.com/Oizus0/resolution
Execução: https://github.com/Oizus0/resolution/actions/runs/43655549274
Commit: e782e8fd2b9f18dc14d163ccde1cf5886d36b54d

A execução consultada terminou com sucesso. O manifesto público informa 1.0.2 e os caminhos `/resolution/index.html`, `/resolution/background.html` e `/resolution/icon.svg`. O HTML público referencia os mesmos nomes de recursos da compilação 1.0.2 entregue. Não foi identificada falha do workflow que explique o reinício ou o dimensionamento da imagem enviada.

## Validação desta revisão

- Compilação e verificação de tipos: passaram.
- 29 testes de regras e visibilidade: passaram.
- 11 testes de comunicação com SDK oficial e sala simulada: passaram.
- Reinício pela interface, como jogador, usando o coordenador da sala simulada: confirmação permaneceu aberta; após confirmar, a iniciativa ficou vazia e voltou à preparação.
- Painel incorporado em 388 × 592 px, como na imagem enviada: cabeçalho de 39 px; lista com 460 px de altura; fonte dos nomes de 16 px. Sem erros de console nessa execução.
- Arquivos revistos: interface, estilos, regras, controlador, sincronização, visibilidade, protocolo, manifesto, configuração de compilação e workflow.

## Limites e pontos ainda abertos

A sala simulada não comprova comportamento em uma sessão real, sob perda de conexão ou mudanças avançadas de Smoke & Spectre. A névoa continua usando geometria aproximada. O histórico ainda cresce com a duração do combate, embora não seja mais clonado integralmente a cada redução. A transparência interna da extensão não controla a superfície de fundo oferecida pelo Owlbear. Esses pontos não foram apresentados como resolvidos por esta revisão.

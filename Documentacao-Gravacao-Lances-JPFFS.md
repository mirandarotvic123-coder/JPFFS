# JPFFS — Sistema de Gravação de Lances

**Replay automático de gols e lances — Campeonato e Rachão**
Documentação técnica e funcional · versão em produção · atualizada em 02/10/2026

> Esta documentação substitui o PDF original e descreve o sistema **como ele
> está no ar hoje**.

---

## Sumário

1. Visão geral
2. Como a captura funciona
3. Fluxo no Campeonato
4. Fluxo no Rachão
5. Galeria de lances
6. Retenção e limpeza automática
7. Limitações e cuidados
8. Resumo das decisões de design

---

## 1. Visão geral

O Sistema de Gravação de Lances grava automaticamente clipes de vídeo de gols e
lances usando os celulares que estiverem posicionados no campo como câmeras — a
quantidade é livre, escolhida a cada partida — sincronizados em tempo real com o
sistema.

Cada clipe tem **20 segundos** — de ~8 a 17s antes do momento em que o gol ou o
lance é marcado, mais de 3 a 11s depois, sempre fechando em 20s — e fica pronto
sozinho, sem precisar editar vídeo depois. Só sai mais curto se a câmera acabou
de ser ligada (ou retomada) e ainda não juntou histórico (ver seção 2.2).

A **orientação do vídeo é escolhida em cada celular-câmera** (e fica lembrada
no aparelho):

- **Horizontal** (padrão) — celular apoiado **deitado**; pega mais do campo.
- **Vertical (stories)** — celular apoiado **em pé**; sai em 720×1280, pronto
  para postar em stories/reels. O iPhone entrega a câmera "deitada" mesmo com o
  celular em pé — para resolver isso, o app desenha cada quadro num canvas
  720×1280 e grava esse canvas, girando/enquadrando a imagem sozinho. Se o
  celular ficar deitado nesse modo, a imagem sai muito cortada e a tela avisa.

### 1.1. Por que existe

- Registrar os melhores momentos da pelada (gols, dribles, defesas, lances
  polêmicos) sem depender de alguém filmando manualmente.
- Automatizar o corte do vídeo: em vez de assistir horas de gravação procurando
  o lance, o sistema já entrega o trecho certo.
- Funcionar tanto no CAMPEONATO quanto no RACHÃO, com regras específicas para
  cada modalidade.

### 1.2. Resumo do funcionamento

1. Os celulares-câmera ficam gravando continuamente em segundo plano, mantendo
   sempre pelo menos os últimos ~8 segundos prontos (até 17).
2. Alguém marca um gol ou um lance no aparelho que está lançando as estatísticas
   (tela do Campeonato ou do Rachão).
3. Cada celular-câmera ativo trava o que já tinha gravado e continua pelo tempo
   que falta para fechar 20 segundos (de 3 a 11s).
4. O próprio celular fecha o arquivo — um clipe separado por câmera (ângulo),
   pronto de 3 a 11 segundos depois do clique.

---

## 2. Como a captura funciona

### 2.1. Preparação antes da partida

Cada celular que for gravar abre um **link específico do sistema** (não é uma aba
do menu).

- O organizador copia esse link no **cabeçalho** da tela do Rachão ou da
  Gestão da Rodada — botão de **link** ao lado de "Gravar lance", que vira um ✓
  quando copia.
- O link tem o formato `.../?camera=1&p=dia-<AAAA-MM-DD>` e é **do dia**: o
  mesmo link vale a rodada inteira do Campeonato **e** o Rachão daquele dia —
  não precisa trocar quando uma partida termina e a próxima começa, nem quando
  acaba o Campeonato e começa o Rachão. (Links antigos, de rodada ou de rachão,
  continuam funcionando.)
- É preciso ter **login aprovado** no aplicativo (qualquer jogador aprovado
  serve, não só organizador).
- Ao abrir, concede-se a permissão de câmera **para o site** (não é a câmera
  nativa do aparelho).
- Escolhe-se a **orientação** (Horizontal / Vertical) — trocar depois desliga a
  câmera, e é preciso ligá-la de novo.
- Antes de começar, deixar o **bloqueio automático de tela** do aparelho em
  "Nunca". O app tenta manter a tela acesa sozinho, mas alguns celulares ignoram
  — e a tela apagando corta a gravação.
- Depois de posicionar, toca-se em **"Modo gravação (tela cheia)"** — a tela fica
  só com o vídeo e o sistema **trava a tela acesa** (Wake Lock).

Detalhes:

- **Quantidade de câmeras livre.** Cada celular que entra no canal recebe um
  número de ângulo (1, 2, 3…), na ordem em que se conectou. Os ângulos valem o
  dia todo — os mesmos celulares seguem como ângulo 1, 2… de uma partida para a
  outra, sem reconectar.
- **Tela sempre ligada e em primeiro plano.** O Modo gravação ajuda, mas se a
  pessoa trocar de app ou de aba, a gravação daquele celular pausa (limitação do
  navegador — ver seção 7). Se o app perceber que a gravação parou, a tela da
  câmera mostra **"TELA TRAVOU — toque para retomar"**; um toque volta a gravar
  sem precisar reconectar.
- **Sem uso paralelo.** Ninguém deve mexer nesse celular para outra coisa
  enquanto ele estiver gravando.

### 2.2. Buffer contínuo (de ~8 a 17 segundos de história)

Em vez de um único gravador contínuo, cada celular roda **dois gravadores em
paralelo**, defasados meio ciclo (8,5s). Cada gravador grava no máximo 17
segundos e então reinicia. Assim, a qualquer momento existe um gravador com
~8–17 segundos de história pronta.

No sinal de gol/lance, o sistema pega o gravador que já tem mais história e
calcula quanto falta para fechar **20 segundos** (20s menos a idade do buffer,
com mínimo de 3s). Deixa ele rodar esse tempo e o encerra. Isso faz o navegador **fechar o arquivo
de verdade** — com duração correta, sem trechos "mortos", tocando do começo ao
fim em qualquer player. (Concatenar pedaços de uma gravação ainda em andamento
gera um arquivo com duração errada e um vão de tempo morto — o navegador só
finaliza os metadados quando a gravação é encerrada.)

### 2.3. Sinal em tempo real

Os celulares-câmera e o aparelho que lança as estatísticas (a tela do Rachão ou
da rodada do Campeonato) ficam conectados a um canal em tempo real (Supabase
Realtime) — **um por dia** (`dia-<AAAA-MM-DD>`). A sincronização acontece por
internet — Wi-Fi ou dados móveis — não é necessário estarem na mesma rede.

As partidas do dia (as do Campeonato e as do Rachão) acontecem uma de cada vez,
no mesmo campo, então um canal só cobre o dia inteiro. Cada clipe é etiquetado
com a modalidade e a partida em que foi gravado (quem marca o lance sabe qual
é), então na Galeria eles continuam separados — Campeonato de um lado, Rachão
do outro, e por partida.

### 2.4. O que acontece no clique

No instante em que o gol ou o lance é marcado, o sinal chega a todos os celulares
ativos no canal, imediatamente. Cada um trava o buffer que já tinha (o
"antes") e continua gravando de 3 a 11 segundos (o "depois", o que faltar para
fechar 20s) — independente de qualquer pergunta que apareça na tela em seguida.

As perguntas de confirmação só decidem se o clipe é salvo ou descartado. A
captura em si já aconteceu no momento certo, então o lance nunca é perdido por
causa do tempo gasto respondendo.

Se um novo gol/lance for marcado enquanto a captura anterior ainda está no
"depois", esse novo clique é **ignorado**, para não sobrepor duas capturas na
mesma câmera. É preciso aguardar (até ~11 segundos) para registrar o próximo.

### 2.5. Arquivo final

**Não existe servidor.** O próprio navegador do celular fecha o arquivo (ver
2.2) — ele já sai pronto e independente por câmera. Nunca um único vídeo com
múltiplos ângulos misturados.

Se 3 celulares estavam ativos naquele lance, o resultado são 3 vídeos separados
na galeria (um por ângulo); se só 1 estava ativo, é 1 vídeo só.

iPhone e Android gravam em formatos diferentes (MP4 / WebM). Cada um toca direto
no player do sistema, **sem conversão** — não há um servidor para "padronizar".

**Qualidade: 720p comprimido** (~1,8 Mbps, cerca de 5 MB por clipe de 20s),
nas duas orientações. O
plano gratuito do Supabase dá só 1 GB de armazenamento, então os clipes são
salvos comprimidos para caber (ver seção 6).

---

## 3. Fluxo no Campeonato

No topo da aba **Rodada** fica um **cabeçalho congelado** — título, câmeras e
cronômetro numa faixa só, que continua visível enquanto a tela rola (dá para
descer até a súmula sem perder o botão de gravar). Ali, toca-se em **"Ativar
câmeras"**. Isso abre o canal em tempo real do dia, que serve todas as partidas
da rodada. **O link de câmera vale o dia inteiro**: quando uma partida termina e
a próxima começa, não é preciso trocar nem reenviar o link. As câmeras ficam
disponíveis em qualquer etapa da rodada (Presença, Sorteio ou Partidas).

Com as câmeras ligadas, a barra mostra: o status **"Ao vivo ✕"** (verde quando
conectado; tocar desliga) · o seletor de partida (quando há mais de uma aberta)
· **"Gravar lance"** · o botão de copiar o link.

O aparelho **lembra** que a rodada está com câmeras ativas: ao sair e voltar da
tela não pede para ativar de novo. Só volta a pedir se alguém tocar em
**"Ao vivo ✕"** (desligar de propósito). Isso vale por aparelho — o link
mandado para os celulares-câmera continua funcionando normalmente.

Cada clipe é gravado com a etiqueta da partida em que aconteceu (o "+" do gol e
o botão "Gravar lance" sabem qual partida é), então na Galeria os vídeos
continuam agrupados por partida ("Rodada 5 · Partida 2").

### 3.1. Gol

Não existe um botão "Gol" separado. **Marcar o gol continua sendo o botão "+" do
jogador na própria súmula** — uma via só, para não confundir.

Com as câmeras ativas, ao tocar o **"+"** do gol de um jogador:

1. O gol é registrado normalmente — conta para pontuação e artilharia, exatamente
   como sempre.
2. Todas as câmeras ativas começam a capturar os ~20s.
3. Aparece no cabeçalho, logo abaixo da barra de câmeras, a pergunta: **"Gol de
   (jogador) registrado — guardar o vídeo? Sim, guardar / Não."**

| Resposta | O que acontece |
| --- | --- |
| Sim, guardar | O clipe entra na Galeria. |
| Não | O gol continua valendo normalmente para pontuação e artilharia — só o vídeo é descartado, nenhum clipe é salvo. |

Se as câmeras **não** estiverem ativas, o "+" funciona exatamente como antes, sem
nada a mais.

### 3.2. Lance

Na barra de câmeras do cabeçalho existe o botão **"Gravar lance"**. Usado para
dribles, defesas, falhas ou qualquer momento que não seja gol.

1. Se houver mais de uma partida da rodada em aberto, escolhe-se antes a
   **partida em jogo** (seletor ao lado do botão). Com só uma aberta, ela já vem
   selecionada.
2. Ao tocar, a captura começa imediatamente em todas as câmeras ativas.
3. Escolhe-se atribuir o lance a um jogador da partida, ou deixar "sem jogador".
4. Salvar ou Descartar.

**Importante:** o "Lance" é apenas um registro de vídeo — não afeta estatística,
pontuação ou disciplina de nenhum jogador.

---

## 4. Fluxo no Rachão

A tela do Rachão tem o mesmo **cabeçalho congelado** (título, câmeras e
cronômetro). Toca-se em **"Ativar câmeras"** (também lembrado por aparelho) e
depois em **"Gravar lance"** (botão único). O canal e o link de câmera são do
**dia inteiro** — o mesmo link do Campeonato daquele dia, se houver. No Rachão
nem gol nem lance têm peso na pontuação, então o mesmo clique cobre os dois
casos.

1. Toca em **"Gravar lance"** → a captura começa na hora em todas as câmeras
   ativas.
2. No cabeçalho, escolhe o tipo: **Gol** ou **Lance**.
3. Escolhe se é atribuído a um jogador presente, ou "sem jogador".
4. Salvar ou Descartar.

O resultado da partida (qual time vence e permanece em quadra, conforme o
Estatuto) continua sendo apurado exatamente como já é hoje — o botão "Gravar
lance" no Rachão serve **apenas** para disparar a gravação e classificar, sem
alterar esse processo.

---

## 5. Galeria de lances

Aba **"Lances"** do sistema, disponível para qualquer usuário com login aprovado.
Atualiza sozinha quando entra ou sai um clipe (não precisa recarregar a página).

### 5.1. Filtros

- **Modalidade** (seletor no topo): **Rachão · Campeonato**. (Não há aba
  "Testes" — clipes de teste aparecem no Rachão, agrupados como "Teste".)
- **Tipo**: Tudo · Gols · Lances.
- **Jogador**: lista só com os jogadores que têm algum clipe atribuído.

### 5.2. Ângulos do mesmo lance, lado a lado

Cada câmera ativa gera o seu próprio arquivo — os ângulos não são combinados num
vídeo só. Um lance capturado por 3 celulares vira 3 arquivos distintos; um lance
capturado por 1 celular vira 1 arquivo.

Na Galeria, porém, os arquivos do **mesmo lance aparecem juntos num cartão só**,
com os ângulos lado a lado (Ângulo 1, Ângulo 2…). O cartão tem o botão **"Ver
juntos"**, que abre os vídeos lado a lado no player (com o celular em pé, um
embaixo do outro; só o primeiro sai com som, para não embolar o áudio). Cada
ângulo continua tendo seus próprios botões de ver, baixar e apagar.

O app entende que são o mesmo lance quando os clipes são da mesma partida, do
mesmo tipo e do mesmo jogador, e chegaram até 90 segundos um do outro. Dois
clipes com o **mesmo número de ângulo** nunca vão para o mesmo cartão — se isso
acontecer, aparecem em cartões separados, para nada ficar escondido.

### 5.3. Título automático dos vídeos

Cada arquivo recebe um título gerado automaticamente, no formato:

```
Tipo (Gol ou Lance) — Jogador (ou "sem jogador") — HH:mm — Ângulo (nº)
```

| Exemplo de título | Situação |
| --- | --- |
| `Gol — João — 16:42 — Ângulo 1` | Vídeo da câmera 1, gol do João, gravado às 16h42. |
| `Gol — João — 16:42 — Ângulo 2` | Mesmo lance, arquivo da câmera 2. |
| `Lance — sem jogador — 17:03 — Ângulo 1` | Lance sem atribuição, gravado às 17h03. |

### 5.4. Organização

- Os vídeos ficam **agrupados por partida** dentro da galeria (ex.: "Rachão ·
  sábado, 30 de agosto" ou "Rodada 5 · Partida 2").
- Dentro de cada partida, cada lance é um cartão (ver 5.2), do mais recente
  para o mais antigo. O título do cartão é o do lance, sem o ângulo; os ângulos
  aparecem dentro dele.

### 5.5. Acesso e ações

A galeria fica aberta a **qualquer usuário com login aprovado**, sem filtro por
papel.

| Ação | Quem pode |
| --- | --- |
| **Ver** — player em tela cheia (link temporário assinado; o bucket é privado) | todos |
| **Baixar** — no celular abre o menu "compartilhar" do sistema (opção "Salvar vídeo"); no computador baixa o arquivo direto, com nome tipo `gol-joao-16-42-angulo-1.mp4` | todos |
| **Apagar** (vídeo + registro, sem volta) | **só o organizador** |

O botão "Apagar" nem aparece para quem não é organizador, e a regra do banco
(RLS) barra a exclusão no servidor mesmo que alguém tente por fora.

A câmera fica só no link `?camera=1` (não aparece no menu) para não virar
bagunça.

---

## 6. Retenção e limpeza automática

Todo lance salvo fica disponível na galeria por **5 dias corridos**, contando a
partir da data da gravação.

Depois desse prazo, uma rotina automática apaga o vídeo. Essa rotina é uma
**Edge Function** (`limpar-lances`) chamada por um **Cron Job** a cada 30
minutos, e ela faz duas coisas:

1. Apaga clipes com mais de 5 dias.
2. **Trava de segurança de espaço:** se o armazenamento do bucket passar de ~850
   MB (o plano gratuito do Supabase dá 1 GB), apaga os clipes mais antigos até
   baixar — sem isso, o upload falharia no meio de uma rodada ao bater o teto.

**Recomendação:** quem quiser guardar um lance específico além dos 5 dias deve
baixar o vídeo da galeria antes do prazo vencer.

---

## 7. Limitações e cuidados

- **Tela ligada e em primeiro plano.** O Modo gravação trava a tela acesa (Wake
  Lock), mas se a tela apagar mesmo assim ou o navegador for trocado de aba/app,
  a gravação daquele celular pausa — é uma limitação do navegador, mais
  restritiva no iPhone.
- **Sem uso paralelo do celular.** O aparelho que está gravando não pode ser
  usado para mais nada durante a partida.
- **Conexão instável.** Se um celular perder conexão exatamente no momento do
  clique, aquele ângulo específico não grava aquele lance — os demais seguem
  normalmente.
- **Aparelhos diferentes.** iPhone e Android gravam em formatos diferentes; cada
  um toca direto no sistema, sem conversão.
- **Tempo de espera.** O clipe fica pronto de 3 a 11 segundos depois do clique
  (o tempo real da parte "depois").
- **Início da câmera.** Nos primeiros ~8 segundos depois de ligar (ou de tocar em
  "retomar"), ainda não há histórico suficiente — o clipe sai mais curto que 20s.
- **Orientação.** Escolhida em cada celular-câmera. Na **horizontal**, apoiar o
  celular deitado. Na **vertical**, apoiar em pé com a trava de rotação ligada —
  o app gira/enquadra a imagem sozinho (o iPhone entrega a câmera "deitada"); se
  ficar deitado nesse modo, a imagem sai muito cortada e a tela avisa.
- **Tela travou.** Se a tela apagar ou o app for para o fundo, a gravação para;
  ao voltar, a tela da câmera mostra "TELA TRAVOU — toque para retomar". O lance
  marcado enquanto ela estava parada não é gravado por aquele celular.
- **Ângulo repetido.** Já aconteceu de um mesmo lance sair duas vezes com o mesmo
  número de ângulo (ex.: depois de uma reconexão). Ainda não há correção; a
  Galeria mostra os dois em cartões separados.
- **Processamento.** Cada celular roda dois gravadores em paralelo (mais o
  desenho no canvas, no modo vertical) — celular dos últimos anos aguenta; num
  aparelho muito antigo pode engasgar.

---

## 8. Resumo das decisões de design

| Decisão | Campeonato | Rachão |
| --- | --- | --- |
| Como o gol é registrado | botão "+" do jogador na súmula (registra o gol de verdade) | classificado na confirmação — não mexe no placar |
| Pergunta "guardar vídeo? sim/não" | Sim, ao marcar o gol | Não — a confirmação só classifica |
| Botão de "Lance" (não-gol) | Sim, no painel de câmeras | é o mesmo botão único, tipo escolhido depois |
| Atribuição de jogador | o "+" já é do jogador · opcional no Lance | opcional |
| Afeta estatística do jogador | Gol sim / Lance não | Não |
| Onde ficam os controles | cabeçalho congelado da aba Rodada | cabeçalho congelado do Rachão |
| Canal Realtime / link de câmera | um por dia (`dia-<data>`), o mesmo do Rachão | um por dia (`dia-<data>`), o mesmo do Campeonato |
| Câmeras ativas lembradas | sim, por aparelho (por rodada) | sim, por aparelho (por dia) |
| Quantidade de câmeras | livre | livre |
| Arquivo por lance | 1 vídeo por câmera (ângulo), juntos num cartão na Galeria | 1 vídeo por câmera (ângulo), juntos num cartão na Galeria |
| Orientação | escolhida em cada câmera (horizontal padrão / vertical) | idem |
| Retenção do vídeo | 5 dias corridos | 5 dias corridos |

### 8.1. Decisões técnicas gerais

- **Sem backend próprio.** O clipe é fechado pelo próprio navegador do celular
  (um dos dois gravadores em paralelo). Não há servidor juntando ou padronizando
  vídeo.
- **Orientação escolhível.** Horizontal (padrão) grava a câmera direto. Vertical
  desenha cada quadro num canvas 720×1280 e grava esse canvas — garante clipe
  vertical mesmo com o iPhone entregando a câmera deitada.
- **Um link por dia.** Canal `dia-<AAAA-MM-DD>` cobre Campeonato e Rachão; a
  modalidade e a partida de cada clipe vão no sinal, e a Galeria separa sozinha.
- **Canal em tempo real.** Supabase Realtime — `broadcast` para os sinais
  (`disparo` / `decisao`) e `presence` para numerar os ângulos.
- **Lances sobrepostos.** Um novo clique durante o "depois" (até ~11s) de um lance
  em andamento é ignorado, para não sobrepor buffers na mesma câmera.
- **Qualidade de vídeo.** 720p comprimido (~1,8 Mbps) — imposto pelo limite de 1
  GB de armazenamento do plano gratuito do Supabase.
- **Acesso à câmera.** Por link `?camera=1` (não é aba do menu); exige login
  aprovado.
- **Acesso à galeria.** Aberta a qualquer login aprovado; todos veem e baixam,
  só o organizador apaga (barrado também pela RLS). Vídeo servido por link
  assinado (bucket privado).
- **Limpeza.** Edge Function `limpar-lances` + Cron Job a cada 30 minutos (5 dias
  de retenção + trava de espaço em ~850 MB).
- **Isolamento.** Todo o código de gravação está isolado do resto do app (barreira
  de erro + `try/catch`): se o Realtime cair, a súmula, a fila e o resultado do
  jogo seguem funcionando normalmente.

---

*— Sistema de Gravação de Lances · JPFFS —*

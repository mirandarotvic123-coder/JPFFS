# JPFFS — Sistema de Gravação de Lances

**Replay automático de gols e lances — Campeonato e Rachão**
Documentação técnica e funcional · versão em produção · atualizada em 29/08/2026

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

Cada clipe tem cerca de **15 a 25 segundos** (a meta é ~20s: por volta de 15s
antes e 5s depois do momento em que o gol ou o lance é marcado) e fica pronto
sozinho, sem precisar editar vídeo depois. A duração não é exata por causa de
como o buffer funciona (ver seção 2.2).

Os clipes saem sempre na **vertical (720×1280)**, prontos para postar em
stories/reels. O iPhone entrega a câmera "deitada" mesmo com o celular em pé —
para resolver isso, o app desenha cada quadro num canvas 720×1280 e grava esse
canvas, girando/enquadrando a imagem sozinho. Basta apoiar o celular **em pé**,
com a trava de rotação ligada; se o celular ficar deitado, a imagem sai muito
cortada e a tela de câmera avisa.

### 1.1. Por que existe

- Registrar os melhores momentos da pelada (gols, dribles, defesas, lances
  polêmicos) sem depender de alguém filmando manualmente.
- Automatizar o corte do vídeo: em vez de assistir horas de gravação procurando
  o lance, o sistema já entrega o trecho certo.
- Funcionar tanto no CAMPEONATO quanto no RACHÃO, com regras específicas para
  cada modalidade.

### 1.2. Resumo do funcionamento

1. Os celulares-câmera ficam gravando continuamente em segundo plano, mantendo
   sempre os últimos ~15 segundos prontos.
2. Alguém marca um gol ou um lance no aparelho que está lançando as estatísticas
   (tela do Campeonato ou do Rachão).
3. Cada celular-câmera ativo trava o que já tinha gravado e continua por mais 5
   segundos.
4. O próprio celular fecha o arquivo — um clipe separado por câmera (ângulo),
   pronto cerca de 5 segundos depois do clique.

---

## 2. Como a captura funciona

### 2.1. Preparação antes da partida

Cada celular que for gravar abre um **link específico do sistema** (não é uma aba
do menu).

- O organizador copia esse link na própria tela do Rachão ou da partida do
  Campeonato — botão **"Copiar link de câmera desta partida"**.
- O link tem o formato `.../?camera=1&p=<partida>` e já leva o celular para o
  canal certo daquela partida.
- É preciso ter **login aprovado** no aplicativo (qualquer jogador aprovado
  serve, não só organizador).
- Ao abrir, concede-se a permissão de câmera **para o site** (não é a câmera
  nativa do aparelho).
- Depois de posicionar, toca-se em **"Modo gravação (tela cheia)"** — a tela fica
  só com o vídeo e o sistema **trava a tela acesa** (Wake Lock).

Detalhes:

- **Quantidade de câmeras livre.** Cada celular que entra no canal da partida
  recebe um número de ângulo (1, 2, 3…), na ordem em que se conectou.
- **Tela sempre ligada e em primeiro plano.** O Modo gravação ajuda, mas se a
  pessoa trocar de app ou de aba, a gravação daquele celular pausa (limitação do
  navegador — ver seção 7).
- **Sem uso paralelo.** Ninguém deve mexer nesse celular para outra coisa
  enquanto ele estiver gravando.

### 2.2. Buffer contínuo (os últimos ~15 segundos)

Em vez de um único gravador contínuo, cada celular roda **dois gravadores em
paralelo**, defasados meio ciclo. Cada gravador grava no máximo ~20 segundos e
então reinicia. Assim, a qualquer momento existe um gravador com pelo menos
~10–20 segundos de história pronta.

No sinal de gol/lance, o sistema pega o gravador que já tem mais história, deixa
ele rodar mais 5 segundos e o encerra. Isso faz o navegador **fechar o arquivo
de verdade** — com duração correta, sem trechos "mortos", tocando do começo ao
fim em qualquer player. (Concatenar pedaços de uma gravação ainda em andamento
gera um arquivo com duração errada e um vão de tempo morto — o navegador só
finaliza os metadados quando a gravação é encerrada.)

### 2.3. Sinal em tempo real

Os celulares-câmera e o aparelho que lança as estatísticas (a tela do Rachão ou
da partida do Campeonato) ficam conectados a um canal em tempo real (Supabase
Realtime), identificado pela partida. A sincronização acontece por internet —
Wi-Fi ou dados móveis — não é necessário estarem na mesma rede.

- No **Campeonato**, cada partida tem o seu próprio canal, então várias partidas
  podem gravar ao mesmo tempo sem misturar.
- No **Rachão**, o canal é o do dia (uma quadra só).

### 2.4. O que acontece no clique

No instante em que o gol ou o lance é marcado, o sinal chega a todos os celulares
ativos naquela partida, imediatamente. Cada um trava o buffer que já tinha (o
"antes") e continua gravando por mais 5 segundos (o "depois") — independente de
qualquer pergunta que apareça na tela em seguida.

As perguntas de confirmação só decidem se o clipe é salvo ou descartado. A
captura em si já aconteceu no momento certo, então o lance nunca é perdido por
causa do tempo gasto respondendo.

Se um novo gol/lance for marcado enquanto a captura anterior ainda está nos 5
segundos de "depois", esse novo clique é **ignorado**, para não sobrepor duas
capturas na mesma câmera. É preciso aguardar (cerca de 5 segundos) para registrar
o próximo.

### 2.5. Arquivo final

**Não existe servidor.** O próprio navegador do celular fecha o arquivo (ver
2.2) — ele já sai pronto e independente por câmera. Nunca um único vídeo com
múltiplos ângulos misturados.

Se 3 celulares estavam ativos naquele lance, o resultado são 3 vídeos separados
na galeria (um por ângulo); se só 1 estava ativo, é 1 vídeo só.

iPhone e Android gravam em formatos diferentes (MP4 / WebM). Cada um toca direto
no player do sistema, **sem conversão** — não há um servidor para "padronizar".

**Qualidade: 720p comprimido** (~1,8 Mbps, cerca de 5 MB por clipe de 20s). O
plano gratuito do Supabase dá só 1 GB de armazenamento, então os clipes são
salvos comprimidos para caber (ver seção 6).

---

## 3. Fluxo no Campeonato

Antes de tudo, na súmula da partida (aba **Rodada → Partidas**), toca-se em
**"Ativar câmeras desta partida"**. Isso abre o canal Realtime só daquela
partida.

O aparelho **lembra** que aquela partida está com câmeras ativas: ao sair e
voltar da tela não pede para ativar de novo. Só volta a pedir se alguém tocar em
**"conectado ✕"** (desligar de propósito). Isso vale por aparelho — o link
mandado para os celulares-câmera continua funcionando normalmente.

### 3.1. Gol

Não existe um botão "Gol" separado. **Marcar o gol continua sendo o botão "+" do
jogador na própria súmula** — uma via só, para não confundir.

Com as câmeras ativas, ao tocar o **"+"** do gol de um jogador:

1. O gol é registrado normalmente — conta para pontuação e artilharia, exatamente
   como sempre.
2. Todas as câmeras ativas começam a capturar os ~20s.
3. Aparece a pergunta: **"Quer guardar o vídeo desse gol? Sim / Não."**

| Resposta | O que acontece |
| --- | --- |
| Sim, guardar | O clipe entra na Galeria. |
| Não | O gol continua valendo normalmente para pontuação e artilharia — só o vídeo é descartado, nenhum clipe é salvo. |

Se as câmeras **não** estiverem ativas, o "+" funciona exatamente como antes, sem
nada a mais.

### 3.2. Lance

No painel "Câmeras" da súmula existe o botão **"Gravar lance"**. Usado para
dribles, defesas, falhas ou qualquer momento que não seja gol.

1. Ao tocar, a captura começa imediatamente em todas as câmeras ativas.
2. Escolhe-se atribuir o lance a um jogador da partida, ou deixar "sem jogador".
3. Salvar ou Descartar.

**Importante:** o "Lance" é apenas um registro de vídeo — não afeta estatística,
pontuação ou disciplina de nenhum jogador.

---

## 4. Fluxo no Rachão

Na tela do Rachão, toca-se em **"Ativar câmeras desta partida"** (também lembrado
por aparelho) e depois em **"Gravar lance"** (botão único). No Rachão nem gol nem
lance têm peso na pontuação, então o mesmo clique cobre os dois casos.

1. Toca em **"Gravar lance"** → a captura começa na hora em todas as câmeras
   ativas.
2. Escolhe o tipo: **Gol** ou **Lance**.
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

### 5.2. Vídeos separados por ângulo

Cada câmera ativa gera o seu próprio arquivo — os ângulos não são combinados. Um
lance capturado por 3 celulares vira 3 arquivos distintos; um lance capturado por
1 celular vira 1 arquivo.

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
- Dentro de cada partida, os arquivos do mesmo lance ficam próximos, com o mesmo
  horário no título e o número do ângulo diferente.

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
- **Tempo de espera.** O clipe fica pronto cerca de 5 segundos depois do clique
  (o tempo real da parte "depois").
- **Orientação.** O clipe sempre sai vertical (720×1280) — o app gira/enquadra a
  imagem sozinho, mesmo com o iPhone entregando a câmera "deitada". Basta apoiar
  o celular **em pé** com a trava de rotação ligada; se ficar deitado, a imagem
  sai muito cortada e a tela avisa.
- **Processamento.** Cada celular roda dois gravadores em paralelo mais o
  desenho no canvas — celular dos últimos anos aguenta; num aparelho muito
  antigo pode engasgar.

---

## 8. Resumo das decisões de design

| Decisão | Campeonato | Rachão |
| --- | --- | --- |
| Como o gol é registrado | botão "+" do jogador na súmula (registra o gol de verdade) | classificado na confirmação — não mexe no placar |
| Pergunta "guardar vídeo? sim/não" | Sim, ao marcar o gol | Não — a confirmação só classifica |
| Botão de "Lance" (não-gol) | Sim, no painel de câmeras | é o mesmo botão único, tipo escolhido depois |
| Atribuição de jogador | o "+" já é do jogador · opcional no Lance | opcional |
| Afeta estatística do jogador | Gol sim / Lance não | Não |
| Canal Realtime | um por partida (`camp-<rodada>-<jogo>`) | um por dia (`rachao-<sessão>`) |
| Câmeras ativas lembradas | sim, por aparelho | sim, por aparelho |
| Quantidade de câmeras | livre | livre |
| Arquivo por lance | 1 vídeo por câmera (ângulo) | 1 vídeo por câmera (ângulo) |
| Retenção do vídeo | 5 dias corridos | 5 dias corridos |

### 8.1. Decisões técnicas gerais

- **Sem backend próprio.** O clipe é fechado pelo próprio navegador do celular
  (um dos dois gravadores em paralelo). Não há servidor juntando ou padronizando
  vídeo.
- **Vídeo vertical via canvas.** Cada quadro da câmera é desenhado num canvas
  720×1280 e é esse canvas que é gravado — garante clipe vertical mesmo com o
  iPhone entregando a câmera deitada.
- **Canal em tempo real.** Supabase Realtime — `broadcast` para os sinais
  (`disparo` / `decisao`) e `presence` para numerar os ângulos.
- **Lances sobrepostos.** Um novo clique durante os 5s de "depois" de um lance em
  andamento é ignorado, para não sobrepor buffers na mesma câmera.
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

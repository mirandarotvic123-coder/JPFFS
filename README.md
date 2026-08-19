# Campeonato JPFFS

Sorteio equilibrado, súmula e classificação do JPFFS. Funciona no celular, à
beira da quadra, sem internet.

---

## Publicar no Netlify

Existem dois caminhos. O primeiro é mais rápido, o segundo é melhor a longo prazo.

### Caminho A — arrastar a pasta pronta (2 minutos, sem instalar nada)

A pasta `dist/` deste pacote **já está compilada**. Então:

1. Entre em <https://app.netlify.com/drop>
2. Arraste a pasta **`dist`** para dentro da página
3. Pronto — o Netlify devolve um endereço tipo `random-name-123.netlify.app`
4. Em *Site configuration → Change site name*, troque para algo como
   `jpffs.netlify.app`

O ponto fraco: para atualizar o sistema depois, você tem que arrastar a pasta de
novo.

### Caminho B — conectar a um repositório (atualiza sozinho)

1. Crie um repositório no GitHub e envie estes arquivos:
   ```bash
   git init
   git add .
   git commit -m "Sistema JPFFS"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/jpffs.git
   git push -u origin main
   ```
2. No Netlify: **Add new site → Import an existing project → GitHub** e escolha o
   repositório.
3. As configurações de build já vêm prontas no `netlify.toml`, então só confirme:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. **Deploy**.

A partir daí, cada `git push` republica o site automaticamente.

---

## Rodar na sua máquina

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # gera a pasta dist/
npm run preview  # testa a pasta dist/ localmente
```

Precisa do Node.js 18 ou mais novo.

---

## Instalar no celular como aplicativo

Depois de publicado, abra o endereço no celular:

- **Android (Chrome):** menu ⋮ → *Instalar aplicativo*
- **iPhone (Safari):** botão compartilhar → *Adicionar à Tela de Início*

Vira um ícone com o escudo, abre em tela cheia sem a barra do navegador e
**funciona offline** a partir da segunda abertura.

---

## Onde ficam os dados — leia isto

Os dados ficam no **`localStorage` do próprio navegador**, no aparelho. Não há
servidor nem banco de dados. Consequências práticas:

- **Não sincroniza entre aparelhos.** O sorteio feito no seu celular não aparece
  no de outra pessoa.
- **Limpar os dados do navegador apaga tudo.** Aba anônima também não guarda.
- **Trocar de celular exige transferência manual:** em *Ajustes → Exportar base
  completa (JSON)*, e no aparelho novo *Importar base (JSON)*.

Por isso: **exporte o JSON depois de cada rodada.** É o seu backup. O arquivo é
pequeno e serve tanto para restaurar quanto para levar para outro aparelho.

Se em algum momento vocês quiserem acesso compartilhado de verdade — várias
pessoas lançando a súmula ao mesmo tempo, histórico único —, o caminho é trocar
as duas funções `carregarBase` e `salvarBase` no arquivo `src/App.jsx` por
chamadas a um serviço externo (Supabase, Firebase). Foram escritas isoladas
justamente para isso: é o único ponto do sistema que toca em armazenamento.

---

## Trazendo os dados que já estão no app do Claude

O sistema que você usou aqui e este site são **armazenamentos diferentes**. Para
não recomeçar do zero:

1. No app do Claude: *Ajustes → Exportar base completa (JSON)*
2. No site publicado: *Ajustes → Importar base (JSON)*

---

## Estrutura dos arquivos

```
index.html                 página raiz, meta tags de celular e ícones
netlify.toml               configuração de build e redirecionamento
package.json               dependências (React + Vite)
vite.config.js             configuração do empacotador
public/
  fonts/                   Archivo Narrow e Inter, auto-hospedadas (ver estilo.css)
  manifest.webmanifest     dados de instalação como aplicativo
  sw.js                    service worker (funcionamento offline)
  icone-192.png            ícones gerados a partir do escudo
  icone-512.png
src/
  main.jsx                 ponto de entrada, registra o service worker
  App.jsx                  só a casca: cabeçalho, navegação, roteamento entre telas
  theme.js                 cores, gradiente de fundo, escudo, cores de time
  estilo.css               utilidades de layout escritas à mão + fontes
  assets/
    escudo.png             o escudo (era um base64 gigante embutido no código)
  core/
    rng.js                 aleatoriedade determinística (mesma seed → mesmo sorteio)
    regras.js              pontuação, disciplina, classificação e o motor de sorteio —
                            tudo puro, sem React, dá pra testar isolado
    exportacao.js           CSV e as imagens (canvas) de súmula/escalação pra baixar
    repositorio.js           único ponto que toca em armazenamento (Supabase)
  data/
    baseOficial.js           jogadores e histórico oficiais até a 21ª rodada
  components/
    icones.jsx                ícones SVG embutidos (baseados no Lucide)
    ui.jsx                     cartão, botão, badges, campos — peças usadas nas 4 telas
    ModalLogin.jsx             tela de "Entrar como organizador"
  telas/
    TelaRodada.jsx             presença, sorteio, súmula ao vivo
    TelaClassificacao.jsx      tabela, resultados, documentação (tela pública)
    TelaElenco.jsx              cadastro e edição de jogadores
    TelaConfig.jsx               regras oficiais, backup, histórico de rodadas
dist/                      resultado do build — é esta pasta que vai pro ar
```

### Por que não tem Tailwind aqui

O app usa as classes utilitárias de layout escritas à mão em `src/estilo.css`
— sem configuração e sem risco de quebrar em atualização de versão. Cores e
tipografia moram em `src/theme.js` e são usadas via `style` inline nos
componentes.

### Por que virou vários arquivos

Até pouco tempo atrás isso tudo era um `App.jsx` só, de ~3.700 linhas — viável
enquanto o app era pequeno, mas difícil de navegar depois que cresceu (súmula,
avatar, redesenho visual…). A divisão acima segue exatamente as seções que já
existiam como comentários (`core/pontuacao`, `core/sorteio`…): nada de regra
mudou, só onde cada pedaço mora. `core/` e `data/` são puros (sem React, testáveis
isolados); `components/` são peças reutilizadas por mais de uma tela;
`telas/` é uma tela cada. Se for adicionar uma 5ª tela, o padrão é: arquivo novo em
`telas/`, importa o que precisar de `core`/`components`/`theme`, e o `App.jsx`
ganha só uma linha de rota a mais.

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
  manifest.webmanifest     dados de instalação como aplicativo
  sw.js                    service worker (funcionamento offline)
  icone-192.png            ícones gerados a partir do escudo
  icone-512.png
src/
  main.jsx                 ponto de entrada, registra o service worker
  App.jsx                  o sistema inteiro (regras, telas, sorteio)
  estilo.css               utilidades de layout escritas à mão
dist/                      resultado do build — é esta pasta que vai pro ar
```

### Por que não tem Tailwind aqui

O app usa 77 classes utilitárias de layout. Em vez de instalar o Tailwind
inteiro, elas estão escritas em `src/estilo.css` — menos de 3 KB, sem
configuração e sem risco de quebrar em atualização de versão. Cores e tipografia
ficam em `style` inline dentro do `App.jsx`.

### Sobre o `App.jsx` ser um arquivo único

São ~2.200 linhas num só arquivo. A separação existe, mas por seções comentadas
(`core/pontuacao`, `core/sorteio`, `core/disciplina`…) em vez de arquivos. Se em
algum momento você for mexer nele com frequência, vale quebrar em módulos
seguindo esses mesmos comentários — as funções já são puras e independentes.

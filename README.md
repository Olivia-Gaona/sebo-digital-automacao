# Projeto Base — Livraria Sebo Digital

Projeto de referência construído em aula para a disciplina **Programação para Internet**. A cada
aula, um item da ementa é acrescentado na mesma pasta. Esta versão cobre os **itens 1 a 9**.

## O que existe em cada item

- **Item 1 — Arquitetura da Internet e WWW**: `docs/01-arquitetura-internet-www.md`, usando este
  projeto como exemplo de cliente (navegador) e servidor.
- **Item 2 — Principais protocolos**: `docs/02-protocolos.md`, com requisições HTTP feitas contra
  os servidores deste projeto.
- **Item 3 — Linguagens de marcação**: o HTML semântico e o CSS em `frontend/`.
- **Item 4 — Tecnologias de desenvolvimento web**: dois servidores diferentes
  (`servidores/server-node` e `servidores/server-python`) servindo o mesmo front-end.
- **Item 5 — Páginas dinâmicas**: o servidor Node monta `catalogo.html` a cada requisição (SSR),
  com filtro por categoria (`?categoria=romance`).
- **Item 6 — Front-end e back-end**: a API (`/api/produtos`, `/api/categorias`) e a página
  `catalogo-api.html`, montada pelo navegador (CSR). Escaping de HTML contra XSS.
- **Item 7 — Conteúdo semântico**: página de cada livro (`/livros/dom-casmurro`), meta tags,
  Open Graph, JSON-LD (schema.org), `sitemap.xml`, `robots.txt` e a **Visão do robô** (`/robo`).
- **Item 8 — Banco de dados**: os livros vêm do SQLite (`dados/sebo.db`), criado a partir de
  `dados/seed.sql`. Busca com consulta parametrizada (`/buscar`) e console SQL de aula (`/sql`).
- **Item 9 — Automação da construção** *(aula de hoje)*: roteiro em
  `docs/09-automacao-construcao.md`. Comandos do projeto no `package.json` da raiz, testes
  automatizados (`testes/`), construção de uma versão estática do site (`dist/`), integração
  contínua no GitHub (`.github/workflows/testes.yml`) e publicação na Vercel (`vercel.json`).

## O que NÃO existe ainda (de propósito)

- Framework de front-end ou back-end (item 10). Até aqui, tudo é HTML/CSS/JS puro e um servidor
  mínimo, para não misturar conceitos antes da hora.

## Como rodar

Precisa do **Node.js 22.13 ou mais novo** (`node -v`). Todos os comandos abaixo rodam na **raiz**
do projeto (a pasta que tem este README). Nenhum precisa de `npm install`: o projeto não tem
dependências.

| Comando | O que faz |
|---|---|
| `npm start` | Sobe o servidor em http://localhost:3000 |
| `npm run dev` | Igual ao `start`, mas reinicia sozinho quando você salva o `server.js` |
| `npm test` | Roda os testes automatizados |
| `npm run build` | Gera a versão estática do site na pasta `dist/` |
| `npm run preview` | Serve a pasta `dist/` em http://localhost:4000, como a hospedagem fará |
| `npm run db:reset` | Apaga o banco e o recria a partir de `dados/seed.sql` (com o servidor parado) |
| `npm run` | Lista todos os comandos acima |

Para rodar ao lado de outra versão do projeto, troque a porta (PowerShell):
`$env:PORT=3001; npm start`

O servidor Python continua disponível, servindo o front-end sem gerar nada:

```bash
cd servidores/server-python
python server.py
```
Acesse http://localhost:8000

## Como publicar (Vercel)

1. Coloque o projeto num repositório do GitHub.
2. Em https://vercel.com, entre com a conta do GitHub, clique em **Add New > Project** e importe
   o repositório. O `vercel.json` já diz o que fazer: rodar os testes, construir e publicar a
   pasta `dist/`.
3. A cada `push`, o GitHub roda os testes (aba **Actions**) e a Vercel publica a nova versão. Se
   um teste falhar, a Vercel não publica e o site continua na versão anterior.

O que vai para o ar é a **versão estática**: catálogo, páginas de livro, catálogo via API, sitemap
e robots. O console SQL, a busca e a Visão do robô dependem de um servidor e ficam só no seu
computador. O console SQL, em especial, nunca deveria ir para um site público.

## Estrutura de pastas

```
ProjetoBase/
├── README.md
├── package.json                    ← comandos do projeto (novo)
├── vercel.json                     ← configuração da publicação (novo)
├── .gitignore                      ← o que não vai para o GitHub (novo)
├── .github/workflows/testes.yml    ← integração contínua no GitHub (novo)
├── testes/site.test.js             ← testes automatizados (novo)
├── docs/                           ← roteiros de cada item
├── dados/
│   ├── seed.sql                    ← cria e preenche o banco
│   ├── produtos.json               (fonte de dados até o item 7)
│   └── sebo.db                     (gerado; não vai para o GitHub)
├── dist/                           (gerada pelo npm run build; não vai para o GitHub)
├── frontend/                       ← HTML, CSS, JS e favicon
└── servidores/
    ├── server-node/
    │   ├── server.js               ← SSR, API, páginas de livro, sitemap, banco
    │   ├── build.js                ← gera o site estático em dist/ (novo)
    │   ├── preview.js              ← serve dist/ localmente (novo)
    │   ├── recriar-banco.js        ← npm run db:reset (novo)
    │   └── templates/
    └── server-python/
        └── server.py               (continua estático, de propósito, para contraste)
```

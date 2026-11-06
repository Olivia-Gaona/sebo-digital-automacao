// server.js — servidor em Node.js, usando SÓ módulos nativos (http, fs, path).
//
// Papel deste arquivo na arquitetura:
//   - Item 1: é o SERVIDOR do modelo cliente-servidor.
//   - Item 2: ouve uma porta TCP e responde requisições HTTP.
//   - Item 4: é uma das tecnologias possíveis do lado do servidor (Node.js puro).
//   - Item 5: "/catalogo.html" é MONTADO na hora a partir de dados/produtos.json (SSR).
//   - Item 6: as rotas "/api/..." devolvem só DADOS em JSON, e o navegador monta a
//     página (frontend/catalogo-api.html + assets/js/catalogo-api.js).
//   - Item 7 (NOVO nesta aula): o servidor também gera conteúdo SEMÂNTICO, ou seja,
//     informação pensada para máquinas (buscadores, redes sociais, leitores de tela):
//       * /livros/<slug>   página de cada livro, com endereço legível
//       * <meta> e Open Graph (como o link aparece no Google e no WhatsApp)
//       * JSON-LD com vocabulário schema.org (dados estruturados)
//       * /sitemap.xml e /robots.txt, gerados a partir dos dados
//       * /robo?url=...    ferramenta didática: mostra o que um robô "enxerga"
//   - Item 8: os livros vêm de um banco SQLite (dados/sebo.db), criado a partir
//     de dados/seed.sql.
//   - Item 9 (NOVO nesta aula): este arquivo agora também é usado por OUTROS
//     programas, e não só para subir o servidor:
//       * build.js   gera uma versão ESTÁTICA do site (pasta dist/) para publicar
//       * testes/    os testes automatizados chamam as funções daqui diretamente
//     Por isso, no final do arquivo, o servidor só começa a ouvir a porta quando
//     este arquivo é executado diretamente (node server.js / npm start).
//
// O servidor Python (servidores/server-python) continua servindo os arquivos de
// frontend/ como estão, sem gerar nada.

const http = require("http");
const fs = require("fs");
const path = require("path");
// Item 8: o SQLite já vem embutido no Node (versão 22+), não precisa instalar nada.
const { DatabaseSync } = require("node:sqlite");

// Porta configurável: permite rodar esta versão ao lado da versão anterior do
// projeto para comparar (no PowerShell: $env:PORT=3001; npm start).
const PORTA = Number(process.env.PORT) || 3000;

// Endereço público do site. Meta tags, JSON-LD e sitemap exigem URLs ABSOLUTAS
// (com protocolo e domínio), porque quem lê essas informações é um robô que está
// fora do site. Em produção, isto seria algo como https://www.sebodigital.com.br
// Item 9: na Vercel, a variável VERCEL_PROJECT_PRODUCTION_URL traz o domínio do
// site publicado (sem o "https://"), e a usamos quando SITE_URL não foi informada.
const ENDERECO_SITE = (process.env.SITE_URL
  || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  || `http://localhost:${PORTA}`).replace(/\/$/, "");

const NOME_LOJA = "Sebo Digital";

const PASTA_FRONTEND = path.join(__dirname, "..", "..", "frontend");
const PASTA_TEMPLATES = path.join(__dirname, "templates");
const ARQUIVO_PRODUTOS = path.join(__dirname, "..", "..", "dados", "produtos.json");
// Item 9: os testes automatizados usam SEBO_BD=":memory:", um banco que existe só
// na memória enquanto o teste roda. Assim o teste sempre começa do seed, não
// importa o que você tenha alterado no seu sebo.db pelo console SQL.
const ARQUIVO_BD = process.env.SEBO_BD || path.join(__dirname, "..", "..", "dados", "sebo.db");
const ARQUIVO_SEED = path.join(__dirname, "..", "..", "dados", "seed.sql");

const TIPOS_MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
};

// Rótulo de exibição de cada categoria, centralizado aqui (decisão da aula do item 5).
const NOMES_CATEGORIA = { romance: "Romance", poesia: "Poesia", tecnico: "Técnico" };

// ---------------------------------------------------------------------------
// Dados
// ---------------------------------------------------------------------------

function gerarSlug(texto) {
  // "Grande Sertão: Veredas" -> "grande-sertao-veredas"
  // O slug é a versão do título que cabe numa URL: sem acento, sem espaço, sem
  // pontuação. É o mesmo padrão "código estável vs. rótulo de exibição" que
  // discutimos com as categorias, agora aplicado ao endereço de cada livro.
  return String(texto)
    .normalize("NFD")                 // separa "ã" em "a" + "~"
    .replace(/[̀-ͯ]/g, "")  // remove os acentos que sobraram soltos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")      // qualquer outra coisa vira hífen
    .replace(/^-+|-+$/g, "");         // tira hífens das pontas
}

// --- Item 8: abertura do banco de dados ------------------------------------
// Abre (ou cria) o arquivo dados/sebo.db. Se ainda não existe a tabela de
// livros, roda o dados/seed.sql para criá-la e preenchê-la. Assim, basta rodar
// "node server.js" uma vez e o banco aparece pronto.
const bd = new DatabaseSync(ARQUIVO_BD);

function bancoPrecisaSeed() {
  const tabela = bd.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'livros'"
  ).get();
  return !tabela;
}

if (bancoPrecisaSeed()) {
  console.log("Banco vazio — criando a partir de dados/seed.sql");
  bd.exec(fs.readFileSync(ARQUIVO_SEED, "utf-8"));
}

function carregarProdutos() {
  // Item 8: os livros agora vêm de um SELECT no banco, não mais do arquivo JSON.
  // O resto do site não mudou NADA, porque todas as páginas passam por aqui:
  // trocar a fonte de dados foi mexer em uma função só.
  // O slug e a URL continuam DERIVADOS do título a cada leitura.
  const linhas = bd.prepare("SELECT * FROM livros ORDER BY id").all();
  return linhas.map(p => {
    const slug = gerarSlug(p.titulo);
    return { ...p, slug, url: `/livros/${slug}` };
  });
}

function dataUltimaAlteracaoDados() {
  // Usada no sitemap: diz aos buscadores quando o conteúdo mudou pela última vez.
  // (Um banco só em memória não tem arquivo: usamos a data de hoje.)
  const data = ARQUIVO_BD === ":memory:" ? new Date() : fs.statSync(ARQUIVO_BD).mtime;
  return data.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Utilitários de saída
// ---------------------------------------------------------------------------

function formatarPreco(valor) {
  return "R$ " + valor.toFixed(2).replace(".", ",");
}

function escaparHTML(texto) {
  // Item 6: impede que texto dos dados vire código no HTML (proteção contra XSS).
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function blocoJsonLd(objeto) {
  // Item 7: JSON-LD vai dentro de <script type="application/ld+json">. Ali dentro
  // o escaping é DIFERENTE do HTML: entidades como &lt; não são interpretadas.
  // O perigo é um texto conter "</script>", o que encerraria o bloco antes da
  // hora. Trocar "<" pela forma < mantém o JSON válido e elimina o risco.
  const json = JSON.stringify(objeto, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function urlAbsoluta(caminho) {
  return ENDERECO_SITE + caminho;
}

function preencherTemplate(template, valores) {
  // Troca cada {{CHAVE}} pelo valor correspondente. A função na segunda posição
  // do replace evita uma pegadinha do JavaScript: em replace("x", texto), padrões
  // como "$&" ou "$'" dentro do texto são interpretados de forma especial.
  return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (marcador, chave) =>
    chave in valores ? valores[chave] : marcador);
}

function lerTemplate(nome) {
  return fs.readFileSync(path.join(PASTA_TEMPLATES, nome), "utf-8");
}

// ---------------------------------------------------------------------------
// Item 7 — dados estruturados (schema.org em JSON-LD)
// ---------------------------------------------------------------------------

function disponibilidade(produto) {
  return produto.estoque > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

function schemaLivro(produto) {
  // Um mesmo item pode ter mais de um tipo: é um Livro (Book, que tem autor) e
  // também um Produto à venda (Product, que tem oferta). As propriedades usam o
  // vocabulário público do schema.org, entendido por Google, Bing e outros.
  return {
    "@context": "https://schema.org",
    "@type": ["Book", "Product"],
    "@id": urlAbsoluta(produto.url) + "#livro",
    name: produto.titulo,
    author: { "@type": "Person", name: produto.autor },
    description: produto.descricao,
    genre: NOMES_CATEGORIA[produto.categoria] || produto.categoria,
    inLanguage: "pt-BR",
    url: urlAbsoluta(produto.url),
    offers: {
      "@type": "Offer",
      price: produto.preco.toFixed(2),
      priceCurrency: "BRL",
      availability: disponibilidade(produto),
      itemCondition: "https://schema.org/UsedCondition",
      url: urlAbsoluta(produto.url),
      seller: { "@type": "BookStore", name: NOME_LOJA },
    },
  };
}

function schemaTrilha(itens) {
  // BreadcrumbList: a "trilha de navegação" (Início > Catálogo > Livro), que o
  // Google pode mostrar no resultado da busca no lugar da URL crua.
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: itens.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.nome,
      item: urlAbsoluta(item.caminho),
    })),
  };
}

function schemaListaCatalogo(produtos) {
  // ItemList: diz ao robô que esta página é uma LISTA de livros, e onde fica a
  // página de cada um.
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catálogo do " + NOME_LOJA,
    numberOfItems: produtos.length,
    itemListElement: produtos.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: urlAbsoluta(p.url),
      name: p.titulo,
    })),
  };
}

function metaTags({ titulo, descricao, caminho, tipoOg }) {
  // <meta name="description">: o texto que costuma aparecer abaixo do título no Google.
  // <link rel="canonical">: o endereço "oficial" da página (evita duplicatas como
  //   /catalogo.html e /catalogo.html?categoria=todos contarem como páginas diferentes).
  // og:* (Open Graph): como o link aparece quando é colado no WhatsApp, LinkedIn etc.
  return [
    `<meta name="description" content="${escaparHTML(descricao)}">`,
    `<link rel="canonical" href="${escaparHTML(urlAbsoluta(caminho))}">`,
    `<meta property="og:site_name" content="${NOME_LOJA}">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:type" content="${tipoOg}">`,
    `<meta property="og:title" content="${escaparHTML(titulo)}">`,
    `<meta property="og:description" content="${escaparHTML(descricao)}">`,
    `<meta property="og:url" content="${escaparHTML(urlAbsoluta(caminho))}">`,
    `<meta name="twitter:card" content="summary">`,
  ].join("\n  ");
}

// ---------------------------------------------------------------------------
// Item 5 + 7 — catálogo gerado no servidor, agora com semântica
// ---------------------------------------------------------------------------

function montarCardProduto(produto) {
  const esgotado = produto.estoque <= 0;
  const titulo = escaparHTML(produto.titulo);
  // Repare nas escolhas de marcação:
  //   <h2>   cada livro é um item de nível logo abaixo do <h1> "Catálogo"
  //   <a>    o título leva à página do livro (link = ir para outro endereço)
  //   <data> o preço legível por humanos ("R$ 32,00") com o valor de máquina (32.00)
  //   sr-only: texto que só leitores de tela ouvem, para o botão não ser apenas
  //            "Adicionar" seis vezes seguidas
  const botao = esgotado
    ? `<button class="add-carrinho" disabled>Esgotado</button>`
    : `<button class="add-carrinho">Adicionar<span class="sr-only"> ${titulo} ao carrinho</span></button>`;
  return `
        <article class="produto" data-categoria="${escaparHTML(produto.categoria)}">
          <p class="categoria">${escaparHTML(NOMES_CATEGORIA[produto.categoria] || produto.categoria)}</p>
          <h2 class="produto-titulo"><a href="${produto.url}">${titulo}</a></h2>
          <p class="autor">${escaparHTML(produto.autor)}</p>
          <p class="preco"><data value="${produto.preco.toFixed(2)}">${formatarPreco(produto.preco)}</data></p>
          ${botao}
        </article>`;
}

function montarFiltros(produtos, categoriaAtiva, linkCategoria = linkCategoriaPadrao) {
  // Na versão gerada pelo servidor, os filtros são LINKS, não botões: cada um leva
  // a um endereço próprio (?categoria=...). Funciona sem JavaScript e pode ser
  // seguido por buscadores. aria-current marca, para leitores de tela, qual está ativo.
  const categorias = [...new Set(produtos.map(p => p.categoria))];
  const opcoes = [{ codigo: null, nome: "Todos" },
    ...categorias.map(c => ({ codigo: c, nome: NOMES_CATEGORIA[c] || c }))];

  return opcoes.map(({ codigo, nome }) => {
    const href = linkCategoria(codigo);
    const ativo = codigo === categoriaAtiva;
    return `<a class="filtro-btn${ativo ? " ativo" : ""}" href="${href}"${ativo ? ' aria-current="page"' : ""}>${escaparHTML(nome)}</a>`;
  }).join("\n        ");
}

function linkCategoriaPadrao(codigo) {
  return codigo ? `/catalogo.html?categoria=${encodeURIComponent(codigo)}` : "/catalogo.html";
}

function escolherDestaque(produtos) {
  const disponiveis = produtos.filter(p => p.estoque > 0);
  const sorteado = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  return `Destaque agora: <a href="${sorteado.url}"><strong>${escaparHTML(sorteado.titulo)}</strong></a> (${escaparHTML(sorteado.autor)}) — ${formatarPreco(sorteado.preco)}`;
}

function gerarPaginaCatalogo(query, opcoes = {}) {
  // Item 9: "opcoes.linkCategoria" permite ao build.js trocar o endereço dos filtros.
  // Num site estático não há servidor para ler o "?categoria=", então cada categoria
  // vira um arquivo próprio (catalogo-romance.html, catalogo-poesia.html...).
  const produtos = carregarProdutos();
  const categoriaFiltro = query.categoria && query.categoria !== "todos" ? query.categoria : null;
  const produtosExibidos = categoriaFiltro
  ? produtos.filter(p => p.categoria === categoriaFiltro)
  : produtos;



  const nomeCategoria = categoriaFiltro ? (NOMES_CATEGORIA[categoriaFiltro] || categoriaFiltro) : null;
  const tituloPagina = nomeCategoria
    ? `${nomeCategoria} — Catálogo — ${NOME_LOJA}`
    : `Catálogo — ${NOME_LOJA}`;
  const descricao = nomeCategoria
    ? `Livros usados de ${nomeCategoria.toLowerCase()} à venda no ${NOME_LOJA}: ${produtosExibidos.map(p => p.titulo).join(", ")}.`
    : `Catálogo de livros usados do ${NOME_LOJA}: romance, poesia e livros técnicos com preços a partir de ${formatarPreco(Math.min(...produtos.map(p => p.preco)))}.`;
  const caminho = categoriaFiltro ? `/catalogo.html?categoria=${encodeURIComponent(categoriaFiltro)}` : "/catalogo.html";

  return preencherTemplate(lerTemplate("catalogo-template.html"), {
    TITULO_PAGINA: escaparHTML(tituloPagina),
    META: metaTags({ titulo: tituloPagina, descricao, caminho, tipoOg: "website" }),
    JSON_LD: [
      blocoJsonLd(schemaListaCatalogo(produtosExibidos)),
      blocoJsonLd(schemaTrilha([
        { nome: "Início", caminho: "/" },
        { nome: "Catálogo", caminho: "/catalogo.html" },
      ])),
    ].join("\n  "),
    TITULO_H1: nomeCategoria ? `Catálogo: ${escaparHTML(nomeCategoria)}` : "Catálogo",
    DESTAQUE: categoriaFiltro
  ? `Exibindo apenas livros de ${escaparHTML(nomeCategoria)}.`
  : escolherDestaque(produtos),
    FILTROS: montarFiltros(produtos, categoriaFiltro, opcoes.linkCategoria),
    PRODUTOS: produtosExibidos.map(montarCardProduto).join("\n"),
    TOTAL: String(produtos.length),
    GERADO_EM: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ORIGEM: opcoes.origem || "pelo servidor",
  });
}

// ---------------------------------------------------------------------------
// Item 7 — página de cada livro
// ---------------------------------------------------------------------------

function gerarPaginaLivro(produto) {
  const categoria = NOMES_CATEGORIA[produto.categoria] || produto.categoria;
  const tituloPagina = `${produto.titulo}, de ${produto.autor} — ${NOME_LOJA}`;
  const descricao = `${produto.titulo} (${produto.autor}), exemplar usado por ${formatarPreco(produto.preco)}. ${produto.descricao}`;
  const esgotado = produto.estoque <= 0;
  const titulo = escaparHTML(produto.titulo);

  const situacao = esgotado
    ? `<p class="situacao esgotado">Esgotado no momento</p>`
    : `<p class="situacao">${produto.estoque === 1 ? "Último exemplar" : `${produto.estoque} exemplares disponíveis`}</p>`;
  const botao = esgotado
    ? `<button class="add-carrinho" disabled>Esgotado</button>`
    : `<button class="add-carrinho">Adicionar<span class="sr-only"> ${titulo}</span> ao carrinho</button>`;

  return preencherTemplate(lerTemplate("livro-template.html"), {
    TITULO_PAGINA: escaparHTML(tituloPagina),
    META: metaTags({ titulo: tituloPagina, descricao, caminho: produto.url, tipoOg: "book" }),
    JSON_LD: [
      blocoJsonLd(schemaLivro(produto)),
      blocoJsonLd(schemaTrilha([
        { nome: "Início", caminho: "/" },
        { nome: "Catálogo", caminho: "/catalogo.html" },
        { nome: produto.titulo, caminho: produto.url },
      ])),
    ].join("\n  "),
    CATEGORIA_CODIGO: escaparHTML(produto.categoria),
    CATEGORIA: escaparHTML(categoria),
    TITULO: titulo,
    AUTOR: escaparHTML(produto.autor),
    DESCRICAO: escaparHTML(produto.descricao),
    CONSERVACAO: escaparHTML(produto.conservacao),
    PRECO_VALOR: produto.preco.toFixed(2),
    PRECO: formatarPreco(produto.preco),
    SITUACAO: situacao,
    BOTAO: botao,
  });
}

function gerarPagina404(caminho) {
  return preencherTemplate(lerTemplate("404-template.html"), {
    CAMINHO: escaparHTML(caminho),
  });
}

// ---------------------------------------------------------------------------
// Item 7 — arquivos para robôs: sitemap.xml e robots.txt
// ---------------------------------------------------------------------------

function gerarSitemap() {
  // Lista de TODAS as páginas que interessam a um buscador. Como é gerada a partir
  // dos dados, um livro novo no JSON entra no sitemap sozinho.
  const ultimaAlteracao = dataUltimaAlteracaoDados();
  const caminhos = ["/", "/catalogo.html", ...carregarProdutos().map(p => p.url)];
  const urls = caminhos.map(c =>
    `  <url>\n    <loc>${escaparHTML(urlAbsoluta(c))}</loc>\n    <lastmod>${ultimaAlteracao}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

function gerarRobotsTxt() {
  // Instruções para robôs: o que pode ser indexado e onde está o sitemap.
  // A API devolve dados crus e não interessa como resultado de busca.
  // Atenção: robots.txt é um pedido, não uma proteção. Robôs mal-intencionados
  // simplesmente ignoram.
  return [
    "User-agent: *",
    "Disallow: /api/",
    "Disallow: /robo",
    "",
    `Sitemap: ${urlAbsoluta("/sitemap.xml")}`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Ferramenta didática — "Visão do robô"
// ---------------------------------------------------------------------------
// Busca uma página DESTE servidor do jeito que um robô simples faz: baixa o HTML
// e NÃO executa JavaScript. Depois lista o que dá para extrair dali. É o que
// acontece, por exemplo, quando alguém cola um link no WhatsApp: o robô do
// WhatsApp lê só o HTML que chegou, procurando as tags og:*.

function buscarHtmlLocal(caminho) {
  return new Promise((resolver, rejeitar) => {
    http.get({ host: "127.0.0.1", port: PORTA, path: caminho }, resposta => {
      let corpo = "";
      resposta.setEncoding("utf-8");
      resposta.on("data", parte => { corpo += parte; });
      resposta.on("end", () => resolver({ status: resposta.statusCode, html: corpo }));
    }).on("error", rejeitar);
  });
}

function textoSemTags(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function analisarHtml(html) {
  const pegar = (regex) => { const m = html.match(regex); return m ? m[1] : null; };
  const todos = (regex) => [...html.matchAll(regex)];

  const metaOg = todos(/<meta\s+property="(og:[^"]+)"\s+content="([^"]*)"/g).map(m => [m[1], m[2]]);
  const titulos = todos(/<(h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/g)
    .map(m => ({ nivel: Number(m[1][1]), texto: textoSemTags(m[2]) }));

  const blocosJsonLd = todos(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map(m => {
    try {
      const dados = JSON.parse(m[1]);
      const tipo = dados["@type"];
      return { ok: true, tipo: Array.isArray(tipo) ? tipo.join(" + ") : tipo };
    } catch (erro) {
      return { ok: false, tipo: "JSON inválido: " + erro.message };
    }
  });

  return {
    idioma: pegar(/<html[^>]*\blang="([^"]+)"/),
    titulo: pegar(/<title>([\s\S]*?)<\/title>/),
    descricao: pegar(/<meta\s+name="description"\s+content="([^"]*)"/),
    canonica: pegar(/<link\s+rel="canonical"\s+href="([^"]*)"/),
    metaOg,
    titulos,
    blocosJsonLd,
    marcosEstruturais: ["header", "nav", "main", "article", "aside", "footer"]
      .map(tag => ({ tag, quantidade: todos(new RegExp(`<${tag}\\b`, "g")).length })),
    links: todos(/<a\s[^>]*href=/g).length,
    imagensSemAlt: todos(/<img\b(?![^>]*\balt=)[^>]*>/g).length,
    tamanhoTextoVisivel: textoSemTags(html.replace(/<(script|style)\b[\s\S]*?<\/\1>/g, "")).length,
  };
}

async function gerarPaginaRobo(caminhoAlvo) {
  const sugestoes = ["/", "/catalogo.html", "/catalogo-api.html", "/livros/dom-casmurro", "/livros/claro-enigma"];
  const atalhos = sugestoes.map(s =>
    `<li><a href="/robo?url=${encodeURIComponent(s)}"${s === caminhoAlvo ? ' aria-current="page"' : ""}>${escaparHTML(s)}</a></li>`).join("\n          ");

  let relatorio = `<p>Escolha uma página acima para ver o que um robô sem JavaScript consegue extrair dela.</p>`;

  if (caminhoAlvo) {
    // Segurança: só aceitamos caminhos DESTE site (começando com "/", sem "//").
    // Se aceitássemos qualquer URL, qualquer pessoa poderia usar nosso servidor
    // para fazer requisições a outros endereços (um ataque chamado SSRF).
    if (!caminhoAlvo.startsWith("/") || caminhoAlvo.startsWith("//")) {
      relatorio = `<p class="situacao esgotado">Informe um caminho deste site, começando com "/".</p>`;
    } else {
      const { status, html } = await buscarHtmlLocal(caminhoAlvo);
      const a = analisarHtml(html);
      const linha = (rotulo, valor) =>
        `<tr><th scope="row">${rotulo}</th><td>${valor ? escaparHTML(valor) : '<span class="ausente">não encontrado</span>'}</td></tr>`;

      relatorio = `
      <h2>Resultado para <code>${escaparHTML(caminhoAlvo)}</code> (HTTP ${status})</h2>

      <h3>Identificação da página</h3>
      <table class="tabela-robo">
        ${linha("Idioma (lang)", a.idioma)}
        ${linha("Título (&lt;title&gt;)", a.titulo)}
        ${linha("Descrição (meta description)", a.descricao)}
        ${linha("Endereço canônico", a.canonica)}
      </table>

      <h3>Prévia em redes sociais (Open Graph)</h3>
      ${a.metaOg.length
        ? `<table class="tabela-robo">${a.metaOg.map(([k, v]) => `<tr><th scope="row">${escaparHTML(k)}</th><td>${escaparHTML(v)}</td></tr>`).join("")}</table>`
        : `<p class="ausente">Nenhuma tag og:* encontrada. Colado no WhatsApp, este link apareceria sem título nem descrição próprios.</p>`}

      <h3>Dados estruturados (JSON-LD)</h3>
      ${a.blocosJsonLd.length
        ? `<ul>${a.blocosJsonLd.map(b => `<li>${b.ok ? "Tipo" : "Erro"}: ${escaparHTML(b.tipo)}</li>`).join("")}</ul>`
        : `<p class="ausente">Nenhum bloco JSON-LD no HTML recebido.</p>`}

      <h3>Estrutura de títulos</h3>
      ${a.titulos.length
        ? `<ul class="arvore-titulos">${a.titulos.map(t => `<li class="nivel-${t.nivel}">h${t.nivel}: ${escaparHTML(t.texto) || '<span class="ausente">(vazio)</span>'}</li>`).join("")}</ul>`
        : `<p class="ausente">Nenhum título (h1 a h6) no HTML recebido.</p>`}

      <h3>Outros sinais</h3>
      <table class="tabela-robo">
        <tr><th scope="row">Marcos estruturais</th><td>${a.marcosEstruturais.map(m => `${m.tag}: ${m.quantidade}`).join(", ")}</td></tr>
        <tr><th scope="row">Links</th><td>${a.links}</td></tr>
        <tr><th scope="row">Imagens sem texto alternativo</th><td>${a.imagensSemAlt}</td></tr>
        <tr><th scope="row">Texto visível (caracteres)</th><td>${a.tamanhoTextoVisivel}</td></tr>
      </table>`;
    }
  }

  return preencherTemplate(lerTemplate("robo-template.html"), {
    ATALHOS: atalhos,
    VALOR_CAMPO: escaparHTML(caminhoAlvo || ""),
    RELATORIO: relatorio,
  });
}

// ---------------------------------------------------------------------------
// Item 8 — busca por título (SQL Injection) e console de SQL
// ---------------------------------------------------------------------------
// Estas duas páginas são ferramentas da aula de banco de dados. As duas só fazem
// sentido rodando no SEU computador (localhost). Por que nenhuma delas poderia
// existir num site de verdade é, por si só, assunto da aula.

function envelopeHTML({ titulo, h1, miolo }) {
  // Embrulha um conteúdo no cabeçalho/rodapé do site, reaproveitando o CSS.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escaparHTML(titulo)}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
  <a class="pular-conteudo" href="#conteudo">Pular para o conteúdo</a>
  <header class="topo">
    <div class="topo-conteudo">
      <a class="marca" href="/">Sebo Digital</a>
      <nav class="topo-nav" aria-label="Principal">
        <a href="/">Início</a>
        <a href="/catalogo.html">Catálogo</a>
        <a href="/buscar">Busca</a>
        <a href="/sql">Console SQL</a>
      </nav>
    </div>
  </header>
  <main id="conteudo">
    <section class="secao robo">
      <h1>${escaparHTML(h1)}</h1>
      ${miolo}
    </section>
  </main>
  <footer class="rodape">Livraria Sebo Digital — projeto acadêmico, sem fins comerciais.</footer>
</body>
</html>`;
}

function listaResultados(linhas) {
  if (!linhas.length) return `<p class="ausente">Nenhum livro encontrado.</p>`;
  const itens = linhas.map(l =>
    `<li><strong>${escaparHTML(l.titulo)}</strong> — ${escaparHTML(l.autor)} (${escaparHTML(l.categoria)}), ${formatarPreco(l.preco)}</li>`
  ).join("\n        ");
  return `<p>${linhas.length} livro(s) encontrado(s):</p>\n      <ul class="lista-resultados">\n        ${itens}\n      </ul>`;
}

function gerarPaginaBusca(query) {
  const termo = query.q || "";
  let saida = "";

  if (termo !== "" || "q" in query) {
    // JEITO CERTO (consulta parametrizada): o comando tem um espaço reservado (?),
    // e o texto digitado vai SEPARADO, no lugar do ?. O banco trata esse texto
    // SEMPRE como dado (um título a procurar), nunca como comando. Por isso um
    // título "esquisito" não vira SQL: é a correção do tipo de brecha que a turma
    // viu no login do Juice Shop. Ver docs/08-banco-de-dados.md, seção 4.
    const sql = "SELECT * FROM livros WHERE titulo LIKE ? ORDER BY id";
    const linhas = bd.prepare(sql).all(`%${termo}%`);
    saida = `
      <h2>SQL que o servidor enviou ao banco</h2>
      <pre class="sql-montado">${escaparHTML(sql)}</pre>
      <p class="dica">O texto digitado não entra no comando: ele vai em separado, no lugar do
         <code>?</code>, e o banco o trata sempre como um título a procurar.</p>
      ${listaResultados(linhas)}`;
  }

  const miolo = `
      <p>Busca de livros pelo título, usando uma <strong>consulta parametrizada</strong>. Repare
         que o comando enviado ao banco é sempre o mesmo, com um <code>?</code> no lugar do texto.</p>
      <form class="robo-form" action="/buscar" method="get">
        <label for="q">Título</label>
        <input id="q" name="q" type="text" value="${escaparHTML(termo)}" placeholder="ex.: Dom">
        <button type="submit" class="filtro-btn">Buscar</button>
      </form>
      ${saida}`;
  return envelopeHTML({ titulo: "Busca — Sebo Digital", h1: "Busca de livros", miolo });
}

function gerarPaginaSql(query) {
  // Console de SQL da aula. Roda o comando digitado no banco e mostra o resultado.
  const sqlDigitado = (query.sql || "").trim();
  let resultado = `<p>Digite um comando SQL e clique em Executar. Comece por
      <code>SELECT * FROM livros;</code></p>`;

  if (sqlDigitado) {
    const ehConsulta = /^\s*(select|pragma|with)\b/i.test(sqlDigitado);
    const temVarios = sqlDigitado.replace(/;\s*$/, "").includes(";");
    try {
      if (!ehConsulta && temVarios) {
        // Vários comandos colados de uma vez (ex.: CREATE TABLE + INSERTs no Nível 2).
        bd.exec(sqlDigitado);
        resultado = `<p class="dica">Comandos executados.</p>`;
      } else if (ehConsulta) {
        // SELECT/PRAGMA/WITH devolvem linhas: mostramos como tabela.
        const linhas = bd.prepare(sqlDigitado).all();
        if (!linhas.length) {
          resultado = `<p class="ausente">0 linha(s).</p>`;
        } else {
          const cols = Object.keys(linhas[0]);
          const cab = cols.map(c => `<th scope="col">${escaparHTML(c)}</th>`).join("");
          const corpo = linhas.map(l =>
            `<tr>${cols.map(c => `<td>${escaparHTML(l[c])}</td>`).join("")}</tr>`).join("\n          ");
          resultado = `<p>${linhas.length} linha(s):</p>
      <table class="tabela-robo"><thead><tr>${cab}</tr></thead><tbody>
          ${corpo}
      </tbody></table>`;
        }
      } else {
        // INSERT/UPDATE/DELETE (um comando): mostramos quantas linhas foram afetadas.
        const r = bd.prepare(sqlDigitado).run();
        resultado = `<p class="dica">Comando executado. Linhas afetadas: ${r.changes}.</p>`;
      }
    } catch (erro) {
      resultado = `<p class="ausente">Erro: ${escaparHTML(erro.message)}</p>`;
    }
  }

  const miolo = `
      <p>Console de SQL para a aula. Roda qualquer comando no banco
         <code>dados/sebo.db</code>. Pode rodar vários comandos de uma vez (separados por <code>;</code>).</p>
      <form class="robo-form robo-form--sql" action="/sql" method="get">
        <textarea id="sql" name="sql" rows="4" placeholder="SELECT * FROM livros;">${escaparHTML(sqlDigitado)}</textarea>
        <button type="submit" class="filtro-btn">Executar</button>
      </form>
      ${resultado}`;
  return envelopeHTML({ titulo: "Console SQL — Sebo Digital", h1: "Console SQL", miolo });
}

// ---------------------------------------------------------------------------
// Item 6 — API JSON
// ---------------------------------------------------------------------------

function enviar(resposta, status, tipo, corpo) {
  resposta.writeHead(status, { "Content-Type": tipo, "Cache-Control": "no-store" });
  resposta.end(corpo);
}

function enviarJSON(resposta, status, dados) {
  enviar(resposta, status, "application/json; charset=utf-8", JSON.stringify(dados));
}

function responderApi(caminhoPedido, urlRequisicao, requisicao, resposta) {
  if (requisicao.method !== "GET") {
    enviarJSON(resposta, 405, { erro: "Método não permitido. Esta API só aceita GET por enquanto." });
    return;
  }

  if (caminhoPedido === "/api/produtos") {
    const categoria = urlRequisicao.searchParams.get("categoria");
    const produtos = carregarProdutos();
    const resultado = categoria && categoria !== "todos"
      ? produtos.filter(p => p.categoria === categoria)
      : produtos;
    enviarJSON(resposta, 200, resultado);
    return;
  }

  if (caminhoPedido === "/api/categorias") {
    const codigos = [...new Set(carregarProdutos().map(p => p.categoria))];
    enviarJSON(resposta, 200, codigos.map(codigo => ({ codigo, nome: NOMES_CATEGORIA[codigo] || codigo })));
    return;
  }

  enviarJSON(resposta, 404, { erro: `Endpoint não encontrado: ${caminhoPedido}` });
}

// ---------------------------------------------------------------------------
// Servidor HTTP — roteamento
// ---------------------------------------------------------------------------

const servidor = http.createServer(async (requisicao, resposta) => {
  const urlRequisicao = new URL(requisicao.url, `http://localhost:${PORTA}`);
  const caminhoPedido = urlRequisicao.pathname === "/" ? "/index.html" : urlRequisicao.pathname;
  const html = "text/html; charset=utf-8";

  try {
    if (caminhoPedido.startsWith("/api/")) {
      responderApi(caminhoPedido, urlRequisicao, requisicao, resposta);
      return;
    }

    if (caminhoPedido === "/catalogo.html") {
      enviar(resposta, 200, html, gerarPaginaCatalogo(Object.fromEntries(urlRequisicao.searchParams)));
      return;
    }

    // /livros/<slug>: a URL descreve o conteúdo ("/livros/dom-casmurro") em vez de
    // um número sem significado ("/produto?id=2").
    const rotaLivro = caminhoPedido.match(/^\/livros\/([a-z0-9-]+)\/?$/);
    if (rotaLivro) {
      const produto = carregarProdutos().find(p => p.slug === rotaLivro[1]);
      if (produto) {
        enviar(resposta, 200, html, gerarPaginaLivro(produto));
      } else {
        enviar(resposta, 404, html, gerarPagina404(caminhoPedido));
      }
      return;
    }

    if (caminhoPedido === "/sitemap.xml") {
      enviar(resposta, 200, TIPOS_MIME[".xml"], gerarSitemap());
      return;
    }

    if (caminhoPedido === "/robots.txt") {
      enviar(resposta, 200, TIPOS_MIME[".txt"], gerarRobotsTxt());
      return;
    }

    if (caminhoPedido === "/robo") {
      enviar(resposta, 200, html, await gerarPaginaRobo(urlRequisicao.searchParams.get("url")));
      return;
    }

    // Item 8 — ferramentas da aula de banco de dados (só fazem sentido em localhost)
    if (caminhoPedido === "/buscar") {
      enviar(resposta, 200, html, gerarPaginaBusca(Object.fromEntries(urlRequisicao.searchParams)));
      return;
    }

    if (caminhoPedido === "/sql") {
      enviar(resposta, 200, html, gerarPaginaSql(Object.fromEntries(urlRequisicao.searchParams)));
      return;
    }

    // Todo o resto: arquivos estáticos de frontend/ (como no item 4).
    const caminhoArquivo = path.join(PASTA_FRONTEND, caminhoPedido);
    if (!caminhoArquivo.startsWith(PASTA_FRONTEND)) {
      enviar(resposta, 404, html, gerarPagina404(caminhoPedido)); // bloqueia "../" para fora da pasta
      return;
    }
    fs.readFile(caminhoArquivo, (erro, conteudo) => {
      if (erro) {
        enviar(resposta, 404, html, gerarPagina404(caminhoPedido));
        return;
      }
      resposta.writeHead(200, { "Content-Type": TIPOS_MIME[path.extname(caminhoArquivo)] || "application/octet-stream" });
      resposta.end(conteudo);
    });
  } catch (erro) {
    console.error(erro);
    enviar(resposta, 500, "text/plain; charset=utf-8", "500 - Erro interno no servidor");
  }
});

// Item 9: o servidor só ouve a porta quando este arquivo é o programa principal
// (node server.js). Quando outro arquivo faz require("./server.js"), como o
// build.js e os testes, ele recebe as funções abaixo sem subir servidor nenhum.
module.exports = {
  bd, servidor, carregarProdutos, gerarSlug, escaparHTML, gerarPaginaCatalogo, gerarPaginaLivro,
  gerarPagina404, gerarSitemap, gerarRobotsTxt, gerarPaginaBusca, NOMES_CATEGORIA, ENDERECO_SITE,
};

if (require.main === module) servidor.listen(PORTA, () => {
  console.log(`Servidor Node rodando em http://localhost:${PORTA}`);
  console.log("Estáticos servidos de:", PASTA_FRONTEND);
  console.log("Banco de dados:", ARQUIVO_BD);
  console.log(`API:            ${ENDERECO_SITE}/api/produtos e /api/categorias`);
  console.log(`Página de livro: ${ENDERECO_SITE}/livros/dom-casmurro`);
  console.log(`Busca (item 8):  ${ENDERECO_SITE}/buscar`);
  console.log(`Console SQL:    ${ENDERECO_SITE}/sql`);
  console.log(`Para robôs:     ${ENDERECO_SITE}/sitemap.xml e /robots.txt`);
  console.log(`Visão do robô:  ${ENDERECO_SITE}/robo`);
});

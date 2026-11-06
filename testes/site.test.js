// site.test.js — Item 9: testes automatizados do Sebo Digital.
//
// Rodar:  npm test   (na raiz do projeto)
//
// Cada test(...) abaixo é uma verificação que antes fazíamos "no olho", abrindo o
// navegador. Agora o computador faz todas em menos de um segundo, quantas vezes
// for preciso: antes de publicar, a cada alteração, e automaticamente no GitHub.
//
// Usamos só o que já vem no Node: node:test (o executor de testes) e node:assert
// (as comparações). Não precisa instalar nada.

// Banco só em memória, criado do seed.sql: o teste não depende do seu sebo.db.
process.env.SEBO_BD = ":memory:";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const site = require("../servidores/server-node/server.js");

test("o slug de um título tira acentos, pontuação e espaços", () => {
  assert.equal(site.gerarSlug("Grande Sertão: Veredas"), "grande-sertao-veredas");
});

test("o escaping de HTML neutraliza tags (proteção contra XSS, item 6)", () => {
  assert.equal(site.escaparHTML("<script>"), "&lt;script&gt;");
});

test("o banco de teste começa com os 7 livros do seed.sql", () => {
  assert.equal(site.carregarProdutos().length, 7);
});

test("livro esgotado aparece como OutOfStock nos dados estruturados (item 7)", () => {
  const claroEnigma = site.carregarProdutos().find(p => p.slug === "claro-enigma");
  const html = site.gerarPaginaLivro(claroEnigma);
  assert.match(html, /OutOfStock/);
  assert.match(html, /Esgotado no momento/);
});

test("o sitemap lista a página inicial, o catálogo e uma página por livro", () => {
  const urls = site.gerarSitemap().match(/<loc>/g);
  assert.equal(urls.length, 2 + 7);
});


test("a busca trata o texto digitado como dado, nunca como comando (item 8)", () => {
  assert.match(site.gerarPaginaBusca({ q: "Dom" }), /1 livro\(s\) encontrado\(s\)/);
  // Um título com apóstrofo e símbolos simplesmente não é encontrado.
  assert.match(site.gerarPaginaBusca({ q: "Dom' Casmurro" }), /Nenhum livro encontrado/);
});

test("a API responde JSON com todos os livros (item 6)", async () => {
  // Sobe o servidor de verdade numa porta livre (0 = "o sistema escolhe"),
  // faz uma requisição HTTP e desliga.
  await new Promise(pronto => site.servidor.listen(0, pronto));
  try {
    const { port } = site.servidor.address();
    const resposta = await fetch(`http://localhost:${port}/api/produtos`);
    assert.equal(resposta.status, 200);
    assert.equal((await resposta.json()).length, 7);
  } finally {
    site.servidor.close();
  }
});

test("o catálogo filtrado por poesia mostra apenas livros da categoria", () => {
  const html = site.gerarPaginaCatalogo({ categoria: "poesia" });
  assert.match(html, /Antologia Poética/);
  assert.doesNotMatch(html, /Dom Casmurro/);
});

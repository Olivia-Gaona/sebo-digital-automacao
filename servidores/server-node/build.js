// build.js — Item 9: gera uma versão ESTÁTICA do site na pasta dist/.
//
// Rodar:  npm run build   (na raiz do projeto)
//
// "Construir" (build) é transformar o projeto em algo pronto para publicar. Aqui,
// isso significa gerar AGORA, de uma vez, todas as páginas que o server.js gera a
// cada requisição. O resultado é uma pasta só com arquivos (HTML, CSS, JS, JSON),
// que qualquer hospedagem de site estático serve, sem precisar de Node rodando.
// Esse jeito de montar páginas se chama SSG (Static Site Generation), o terceiro
// jeito, ao lado do SSR (item 5, montado no servidor) e do CSR (item 6, montado
// no navegador).
//
// O que NÃO vai para dist/, de propósito:
//   /sql e /buscar  dependem de um servidor recebendo o que o usuário digita. E o
//                   console SQL jamais poderia ir para um site público: qualquer
//                   visitante poderia apagar o banco (lembre do Juice Shop).
//   /robo           ferramenta de aula, que consulta o próprio servidor.

const fs = require("fs");
const path = require("path");

// Reaproveita as funções do servidor. Graças ao "require.main === module" no fim do
// server.js, isto NÃO sobe servidor nenhum: só carrega as funções e abre o banco.
const site = require("./server.js");

const RAIZ = path.join(__dirname, "..", "..");
const PASTA_FRONTEND = path.join(RAIZ, "frontend");
const DIST = path.join(RAIZ, "dist");

let arquivosGerados = 0;
function gravar(caminhoRelativo, conteudo) {
  const destino = path.join(DIST, caminhoRelativo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo);
  arquivosGerados++;
}

// 1) Começa do zero: apaga o dist/ anterior, para não sobrar arquivo velho.
fs.rmSync(DIST, { recursive: true, force: true });

// 2) Copia os arquivos estáticos (CSS, JS, favicon, páginas que já são fixas).
fs.cpSync(PASTA_FRONTEND, DIST, { recursive: true });

// 3) Gera as páginas que o servidor montava na hora.
const produtos = site.carregarProdutos();
const categorias = [...new Set(produtos.map(p => p.categoria))];

// Num site estático não existe "?categoria=": cada filtro aponta para um arquivo.
const opcoesEstaticas = {
  linkCategoria: codigo => (codigo ? `/catalogo-${codigo}.html` : "/catalogo.html"),
  origem: "na construção do site (npm run build)",
};

gravar("catalogo.html", site.gerarPaginaCatalogo({}, opcoesEstaticas));
for (const categoria of categorias) {
  gravar(`catalogo-${categoria}.html`, site.gerarPaginaCatalogo({ categoria }, opcoesEstaticas));
}

// Cada livro vira livros/<slug>/index.html. A hospedagem entrega esse arquivo
// quando alguém pede /livros/<slug>, o mesmo endereço da versão com servidor.
for (const produto of produtos) {
  gravar(path.join("livros", produto.slug, "index.html"), site.gerarPaginaLivro(produto));
}

// Página de "não encontrado": as hospedagens estáticas procuram um 404.html.
// Como o endereço pedido só é conhecido na hora, um pequeno script o preenche
// (com textContent, que trata tudo como texto: nada de XSS pela barra de endereço).
const MARCA = "__CAMINHO__";
gravar("404.html", site.gerarPagina404(MARCA).replace(`<code>${MARCA}</code>`,
  `<code id="caminho"></code><script>document.getElementById("caminho").textContent = location.pathname;</script>`));

// Arquivos para robôs (item 7), já com o endereço público do site.
gravar("sitemap.xml", site.gerarSitemap());
gravar("robots.txt", site.gerarRobotsTxt());

// 4) A "API" vira arquivo: o catálogo via API (item 6) continua funcionando,
// buscando um arquivo JSON pronto em vez de pedir ao servidor.
gravar(path.join("api", "produtos"), JSON.stringify(produtos));
gravar(path.join("api", "categorias"), JSON.stringify(
  categorias.map(codigo => ({ codigo, nome: site.NOMES_CATEGORIA[codigo] || codigo }))));

console.log(`Build concluído: ${arquivosGerados} arquivos gerados em dist/ (mais os copiados de frontend/).`);
console.log(`Endereço usado em links absolutos, sitemap e Open Graph: ${site.ENDERECO_SITE}`);
console.log("Para conferir antes de publicar: npm run preview");

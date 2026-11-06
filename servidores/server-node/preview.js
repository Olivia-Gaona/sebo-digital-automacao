// preview.js — Item 9: serve a pasta dist/ como uma hospedagem estática faria.
//
// Rodar:  npm run build  e depois  npm run preview   (na raiz do projeto)
//
// Repare na diferença para o server.js: este servidor NÃO gera nada. Ele só
// entrega arquivos prontos, exatamente como a Vercel (ou qualquer hospedagem
// estática) vai fazer. Se funcionar aqui, deve funcionar publicado.

const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = path.join(__dirname, "..", "..", "dist");
const PORTA = Number(process.env.PORT) || 4000;

const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8", ".svg": "image/svg+xml", "": "application/json; charset=utf-8",
};

if (!fs.existsSync(DIST)) {
  console.error("A pasta dist/ não existe. Rode primeiro: npm run build");
  process.exit(1);
}

http.createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  let arquivo = path.join(DIST, caminho);
  if (!arquivo.startsWith(DIST)) arquivo = path.join(DIST, "404.html");
  // Como nas hospedagens estáticas: /livros/dom-casmurro -> livros/dom-casmurro/index.html
  if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, "index.html");
  const existe = fs.existsSync(arquivo);
  const final = existe ? arquivo : path.join(DIST, "404.html");
  res.writeHead(existe ? 200 : 404, { "Content-Type": TIPOS[path.extname(final)] || "application/octet-stream" });
  fs.createReadStream(final).pipe(res);
}).listen(PORTA, () => {
  console.log(`Pré-visualização do site estático (dist/) em http://localhost:${PORTA}`);
  console.log("Experimente /sql: ele não existe aqui, e nem vai existir no site publicado.");
});

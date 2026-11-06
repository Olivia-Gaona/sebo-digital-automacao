// recriar-banco.js — Item 9: apaga o banco e o recria a partir de dados/seed.sql.
//
// Rodar:  npm run db:reset   (na raiz do projeto, com o servidor PARADO)
//
// Útil depois de experimentar no console SQL: em um comando, o banco volta ao
// estado inicial. E responde à pergunta "como o banco foi criado?": sempre pelo
// mesmo arquivo seed.sql, que fica guardado junto com o código.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ARQUIVO_BD = path.join(__dirname, "..", "..", "dados", "sebo.db");
const ARQUIVO_SEED = path.join(__dirname, "..", "..", "dados", "seed.sql");

try {
  fs.rmSync(ARQUIVO_BD, { force: true });
} catch (erro) {
  // No Windows, o arquivo fica travado enquanto o servidor está usando.
  console.error("Não consegui apagar o banco. O servidor está rodando? Pare-o (Ctrl + C) e tente de novo.");
  process.exit(1);
}

const bd = new DatabaseSync(ARQUIVO_BD);
bd.exec(fs.readFileSync(ARQUIVO_SEED, "utf-8"));
const { total } = bd.prepare("SELECT COUNT(*) AS total FROM livros").get();
bd.close();
console.log(`Banco recriado a partir de dados/seed.sql: ${total} livros.`);

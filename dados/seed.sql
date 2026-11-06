-- seed.sql — cria e preenche o banco do Sebo Digital (item 8).
-- Executado automaticamente pelo server.js quando o arquivo sebo.db ainda não existe.
-- Você pode ler, editar e rodar este arquivo à mão para aprender SQL.

-- 1) Apaga a tabela se já existir (para poder recriar do zero)
DROP TABLE IF EXISTS livros;

-- 2) Cria a tabela: cada COLUNA tem um nome e um TIPO
CREATE TABLE livros (
  id          INTEGER PRIMARY KEY,   -- identificador único de cada livro
  titulo      TEXT    NOT NULL,      -- NOT NULL = não pode ficar vazio
  autor       TEXT    NOT NULL,
  categoria   TEXT    NOT NULL,
  preco       REAL    NOT NULL,      -- REAL = número com casas decimais
  estoque     INTEGER NOT NULL DEFAULT 0,
  conservacao TEXT,
  descricao   TEXT
);

-- 3) Insere uma LINHA por livro
INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (1, 'Grande Sertão: Veredas', 'Guimarães Rosa', 'romance', 32.00, 2, 'Bom estado, capa levemente amarelada', 'Romance narrado por Riobaldo, ex-jagunço que relembra travessias pelo sertão mineiro.');
INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (2, 'Dom Casmurro', 'Machado de Assis', 'romance', 24.90, 1, 'Ótimo estado, sem anotações', 'Bento Santiago conta sua história com Capitu e deixa o leitor com uma dúvida que atravessa gerações.');
INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (3, 'Antologia Poética', 'Manuel Bandeira', 'poesia', 19.50, 3, 'Bom estado, algumas páginas sublinhadas a lápis', 'Seleção de poemas feita pelo próprio autor, do lirismo ao humor do cotidiano.');
INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (4, 'Introdução a Algoritmos', 'Cormen et al.', 'tecnico', 89.00, 1, 'Regular, lombada gasta', 'Referência clássica sobre projeto e análise de algoritmos, usada em cursos de computação.');
INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (5, 'Redes de Computadores', 'Tanenbaum', 'tecnico', 74.00, 2, 'Bom estado', 'Livro-texto que percorre as camadas de rede, dos meios físicos às aplicações.');
INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (6, 'Claro Enigma', 'Carlos Drummond de Andrade', 'poesia', 22.00, 0, 'Bom estado', 'Livro de poemas de tom reflexivo, com formas mais clássicas do que as obras anteriores do autor.');

INSERT INTO livros (id, titulo, autor, categoria, preco, estoque, conservacao, descricao) VALUES
  (7, 'Memórias Póstumas de Brás Cubas', 'Machado de Assis', 'romance', 28.90, 2, 'Ótimo estado', 'Romance narrado por Brás Cubas, que revisita sua vida com ironia e crítica à sociedade.');

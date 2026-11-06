// catalogo-api.js — Item 6: o FRONT-END montando a página.
//
// Divisão de responsabilidades nesta versão do catálogo:
//   - Back-end (server.js, rotas /api/...): só responde DADOS em JSON.
//   - Front-end (este arquivo, rodando no navegador): pede esses dados e
//     transforma cada produto em HTML na tela.
//
// Compare com o item 5 (catalogo.html servido pelo Node), onde era o servidor
// quem montava o HTML inteiro e o navegador só exibia o resultado pronto.

const grade = document.getElementById("grade-produtos");
const areaFiltros = document.getElementById("filtros");
const destaque = document.getElementById("destaque");
const statusCarregamento = document.getElementById("status");
const infoCarregamento = document.getElementById("info-carregamento");
const carrinhoFlutuante = document.getElementById("carrinho-flutuante");
const anuncio = document.getElementById("anuncio");

// Demonstração de XSS: abrir a página com ?modo=inseguro troca a montagem segura
// (textContent) pela insegura (innerHTML). Ver docs/06-front-end-back-end.md.
const MODO_INSEGURO = new URLSearchParams(window.location.search).get("modo") === "inseguro";

let nomesCategoria = {}; // preenchido com a resposta de /api/categorias

function formatarPreco(valor) {
  return "R$ " + valor.toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Conversa com o back-end
// ---------------------------------------------------------------------------

async function buscarJSON(url) {
  // fetch() faz uma requisição HTTP a partir do JavaScript, SEM recarregar a
  // página. É exatamente a mesma requisição GET que o navegador faria se você
  // digitasse a URL — dá pra ver cada uma na aba Network do DevTools (filtro Fetch/XHR).
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`O servidor respondeu ${resposta.status} para ${url}`);
  }
  return resposta.json();
}

// ---------------------------------------------------------------------------
// Montagem dos cards
// ---------------------------------------------------------------------------

function criarCardSeguro(produto) {
  // Jeito SEGURO: cada pedaço de texto entra via textContent. O navegador trata
  // o conteúdo sempre como texto — se um título tiver "<img ...>", aparece
  // literalmente escrito na tela, nunca vira uma tag de verdade.
  // Item 7: a mesma marcação semântica do catálogo gerado no servidor
  // (h2 com link para a página do livro, <data> no preço, texto para leitor de tela).
  const card = document.createElement("article");
  card.className = "produto";
  card.dataset.categoria = produto.categoria;

  const categoria = document.createElement("p");
  categoria.className = "categoria";
  categoria.textContent = nomesCategoria[produto.categoria] || produto.categoria;

  const titulo = document.createElement("h2");
  titulo.className = "produto-titulo";
  const link = document.createElement("a");
  link.href = produto.url;
  link.textContent = produto.titulo;
  titulo.append(link);

  const autor = document.createElement("p");
  autor.className = "autor";
  autor.textContent = produto.autor;

  const preco = document.createElement("p");
  preco.className = "preco";
  const valor = document.createElement("data");
  valor.value = produto.preco.toFixed(2);
  valor.textContent = formatarPreco(produto.preco);
  preco.append(valor);

  const botao = document.createElement("button");
  botao.className = "add-carrinho";
  if (produto.estoque > 0) {
    const textoLeitor = document.createElement("span");
    textoLeitor.className = "sr-only";
    textoLeitor.textContent = ` ${produto.titulo} ao carrinho`;
    botao.append("Adicionar", textoLeitor);
    botao.addEventListener("click", () => adicionarAoCarrinho(produto.titulo));
  } else {
    botao.textContent = "Esgotado";
    botao.disabled = true;
  }

  card.append(categoria, titulo, autor, preco, botao);
  return card;
}

function criarCardInseguro(produto) {
  // Jeito INSEGURO (só para demonstração): monta uma string de HTML com os
  // dados colados direto e entrega pro navegador interpretar via innerHTML.
  // É o mesmo erro que o server.js do item 5 cometia, só que agora no navegador.
  const molde = document.createElement("div");
  molde.innerHTML = `
    <article class="produto" data-categoria="${produto.categoria}">
      <p class="categoria">${nomesCategoria[produto.categoria] || produto.categoria}</p>
      <h2 class="produto-titulo"><a href="${produto.url}">${produto.titulo}</a></h2>
      <p class="autor">${produto.autor}</p>
      <p class="preco">${formatarPreco(produto.preco)}</p>
      <button class="add-carrinho">Adicionar</button>
    </article>`;
  const card = molde.firstElementChild;
  card.querySelector(".add-carrinho").addEventListener("click", () => adicionarAoCarrinho(produto.titulo));
  return card;
}

function exibirProdutos(produtos, descricaoFiltro) {
  const criarCard = MODO_INSEGURO ? criarCardInseguro : criarCardSeguro;
  grade.replaceChildren(...produtos.map(criarCard));

  // Item 7: quando o JavaScript troca o conteúdo sem recarregar a página, quem
  // enxerga percebe a mudança, mas quem usa leitor de tela não fica sabendo de
  // nada. Esta região (role="status", invisível na tela) é lida em voz alta a
  // cada mudança. Numa página gerada no servidor isso não é necessário, porque
  // cada filtro é uma página nova e o leitor de tela anuncia o novo título.
  anuncio.textContent = `${produtos.length} livro(s) exibido(s)${descricaoFiltro ? ` em ${descricaoFiltro}` : ""}.`;

  inserirDadosEstruturados(produtos);
}

function inserirDadosEstruturados(produtos) {
  // Item 7: o JSON-LD também pode ser criado pelo JavaScript. O Google executa
  // JavaScript ao indexar (com atraso e sem garantia), então às vezes encontra
  // estes dados. Robôs mais simples, como o que monta a prévia de links no
  // WhatsApp, NÃO executam: para eles esta lista não existe. Confira em /robo.
  let bloco = document.getElementById("json-ld-catalogo");
  if (!bloco) {
    bloco = document.createElement("script");
    bloco.type = "application/ld+json";
    bloco.id = "json-ld-catalogo";
    document.head.append(bloco);
  }
  bloco.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Catálogo do Sebo Digital",
    numberOfItems: produtos.length,
    itemListElement: produtos.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: new URL(p.url, window.location.origin).href,
      name: p.titulo,
    })),
  });
}

function exibirDestaque(produtos) {
  // O sorteio do destaque agora acontece NO NAVEGADOR, com os dados recebidos.
  // No item 5, quem sorteava era o servidor.
  const disponiveis = produtos.filter(p => p.estoque > 0);
  const sorteado = disponiveis[Math.floor(Math.random() * disponiveis.length)];
  const link = document.createElement("a");
  link.href = sorteado.url;
  const nome = document.createElement("strong");
  nome.textContent = sorteado.titulo;
  link.append(nome);
  destaque.replaceChildren(
    "Destaque agora: ", link, ` (${sorteado.autor}) — ${formatarPreco(sorteado.preco)}`
  );
  destaque.hidden = false;
}

// ---------------------------------------------------------------------------
// Filtros: cada clique pede ao back-end só os produtos daquela categoria
// ---------------------------------------------------------------------------

function exibirFiltros(categorias) {
  const opcoes = [{ codigo: "todos", nome: "Todos" }, ...categorias];

  const botoes = opcoes.map(({ codigo, nome }) => {
    const botao = document.createElement("button");
    botao.className = "filtro-btn" + (codigo === "todos" ? " ativo" : "");
    botao.dataset.categoria = codigo;
    botao.setAttribute("aria-pressed", String(codigo === "todos"));
    botao.textContent = nome;

    botao.addEventListener("click", async () => {
      areaFiltros.querySelectorAll(".filtro-btn").forEach(b => {
        b.classList.remove("ativo");
        b.setAttribute("aria-pressed", "false");
      });
      botao.classList.add("ativo");
      botao.setAttribute("aria-pressed", "true");

      // Diferente do app.js (item 3/4), que só escondia cards já carregados:
      // aqui cada clique gera uma NOVA requisição à API, e a página não recarrega.
      const url = codigo === "todos" ? "/api/produtos" : `/api/produtos?categoria=${encodeURIComponent(codigo)}`;
      try {
        const produtos = await buscarJSON(url);
        // Item 9: na versão publicada como site estático (pasta dist/), não há servidor
        // para ler o "?categoria=", e a resposta é sempre a lista completa. Filtrar
        // também aqui garante o resultado certo nos dois casos.
        const filtrados = codigo === "todos" ? produtos : produtos.filter(p => p.categoria === codigo);
        exibirProdutos(filtrados, codigo === "todos" ? null : nome);
        registrarHorario();
      } catch (erro) {
        exibirErro(erro);
      }
    });

    return botao;
  });

  areaFiltros.replaceChildren(...botoes);
}

// ---------------------------------------------------------------------------
// Carrinho (mesma chave do app.js, então o carrinho é compartilhado entre as páginas)
// ---------------------------------------------------------------------------

function lerCarrinho() {
  const dados = localStorage.getItem("sebo-digital-carrinho");
  return dados ? JSON.parse(dados) : [];
}

function adicionarAoCarrinho(titulo) {
  const itens = lerCarrinho();
  itens.push(titulo);
  localStorage.setItem("sebo-digital-carrinho", JSON.stringify(itens));
  atualizarContadorCarrinho();
}

function atualizarContadorCarrinho() {
  carrinhoFlutuante.textContent = `Carrinho: ${lerCarrinho().length} item(ns)`;
}

// ---------------------------------------------------------------------------
// Estados da tela
// ---------------------------------------------------------------------------

function registrarHorario() {
  infoCarregamento.textContent =
    `Dados recebidos da API às ${new Date().toLocaleTimeString("pt-BR")} e montados pelo navegador`;
}

function exibirErro(erro) {
  statusCarregamento.hidden = false;
  statusCarregamento.classList.add("erro");
  statusCarregamento.textContent =
    "Não foi possível carregar o catálogo. Esta página precisa do back-end Node rodando " +
    "(npm start em servidores/server-node) e deve ser aberta em http://localhost:3000/catalogo-api.html. " +
    `Detalhe técnico: ${erro.message}`;
  console.error(erro);
}

// ---------------------------------------------------------------------------
// Início: busca categorias e produtos, e só então desenha a página
// ---------------------------------------------------------------------------

async function iniciar() {
  document.getElementById("aviso-inseguro").hidden = !MODO_INSEGURO;
  atualizarContadorCarrinho();

  try {
    const categorias = await buscarJSON("/api/categorias");
    nomesCategoria = Object.fromEntries(categorias.map(c => [c.codigo, c.nome]));

    const produtos = await buscarJSON("/api/produtos");

    exibirFiltros(categorias);
    exibirDestaque(produtos);
    exibirProdutos(produtos);
    registrarHorario();
    statusCarregamento.hidden = true;
  } catch (erro) {
    exibirErro(erro);
  }
}

iniciar();

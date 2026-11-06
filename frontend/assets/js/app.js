// app.js — comportamento 100% no lado do cliente (item 4: camada client-side).
// Usado pelo catálogo estático, pelo catálogo gerado no servidor e pela página
// de cada livro.

document.addEventListener("DOMContentLoaded", () => {
  // Só BOTÕES de filtro (catálogo estático). No catálogo gerado pelo servidor os
  // filtros são links (<a>) e cada um leva a um endereço próprio, sem JavaScript.
  const botoesFiltro = document.querySelectorAll("button.filtro-btn");
  const produtos = document.querySelectorAll(".produto");
  const carrinhoFlutuante = document.getElementById("carrinho-flutuante");

  // --- Filtro de categoria (só esconde/mostra elementos já presentes no HTML) ---
  botoesFiltro.forEach((botao) => {
    botao.addEventListener("click", () => {
      botoesFiltro.forEach((b) => {
        b.classList.remove("ativo");
        b.setAttribute("aria-pressed", "false"); // item 7: estado para leitores de tela
      });
      botao.classList.add("ativo");
      botao.setAttribute("aria-pressed", "true");

      const categoria = botao.dataset.categoria;
      produtos.forEach((produto) => {
        // hidden em vez de style.display: além de esconder, tira o card da
        // árvore de acessibilidade, então o leitor de tela também deixa de anunciá-lo.
        produto.hidden = !(categoria === "todos" || produto.dataset.categoria === categoria);
      });
    });
  });

  // --- Carrinho simples, guardado no localStorage do navegador ---
  function lerCarrinho() {
    const dados = localStorage.getItem("sebo-digital-carrinho");
    return dados ? JSON.parse(dados) : [];
  }

  function salvarCarrinho(itens) {
    localStorage.setItem("sebo-digital-carrinho", JSON.stringify(itens));
  }

  function atualizarContador() {
    // O contador tem role="status" no HTML: quando este texto muda, o leitor de
    // tela anuncia a novidade sem tirar o foco de onde o usuário está.
    carrinhoFlutuante.textContent = `Carrinho: ${lerCarrinho().length} item(ns)`;
  }

  document.querySelectorAll(".add-carrinho:not([disabled])").forEach((botao) => {
    botao.addEventListener("click", (evento) => {
      const titulo = evento.target.closest("article").querySelector(".produto-titulo").textContent.trim();
      const itens = lerCarrinho();
      itens.push(titulo);
      salvarCarrinho(itens);
      atualizarContador();
    });
  });

  atualizarContador();
});

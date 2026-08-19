"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import ProdutoModal, {
  Categoria,
  Produto,
} from "../../components/ProdutoModal";

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [pesquisa, setPesquisa] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [produtoEditando, setProdutoEditando] =
    useState<Produto | null>(null);

  const [carregando, setCarregando] = useState(true);
  const [excluindoId, setExcluindoId] =
    useState<string | null>(null);

  async function carregarDados() {
    setCarregando(true);

    const [resultadoProdutos, resultadoCategorias] =
      await Promise.all([
        supabase
          .from("produtos")
          .select(
            "id, nome, preco, ativo, categoria_id, imagem_url"
          )
          .order("nome"),

        supabase
          .from("categorias")
          .select("id, nome")
          .order("nome"),
      ]);

    if (resultadoProdutos.error) {
      console.error(resultadoProdutos.error);
      alert(resultadoProdutos.error.message);
    } else {
      setProdutos(resultadoProdutos.data ?? []);
    }

    if (resultadoCategorias.error) {
      console.error(resultadoCategorias.error);
      alert(resultadoCategorias.error.message);
    } else {
      setCategorias(resultadoCategorias.data ?? []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregarDados();
  }, []);

  const produtosFiltrados = useMemo(() => {
    const termo = pesquisa.trim().toLowerCase();

    return produtos.filter((produto) => {
      const correspondePesquisa =
        !termo || produto.nome.toLowerCase().includes(termo);

      const correspondeCategoria =
        !filtroCategoria ||
        produto.categoria_id === filtroCategoria;

      return correspondePesquisa && correspondeCategoria;
    });
  }, [produtos, pesquisa, filtroCategoria]);

  function abrirNovoProduto() {
    setProdutoEditando(null);
    setModalAberto(true);
  }

  function abrirEdicao(produto: Produto) {
    setProdutoEditando(produto);
    setModalAberto(true);
  }

  function obterNomeCategoria(categoriaId: string) {
    return (
      categorias.find(
        (categoria) => categoria.id === categoriaId
      )?.nome ?? "Sem categoria"
    );
  }

  function obterCaminhoStorage(url: string | null) {
    if (!url) return null;

    const marcador = "/storage/v1/object/public/produtos/";
    const indice = url.indexOf(marcador);

    if (indice === -1) return null;

    return decodeURIComponent(
      url.substring(indice + marcador.length)
    );
  }

  async function excluirProduto(produto: Produto) {
    const confirmou = window.confirm(
      `Deseja realmente excluir "${produto.nome}"?`
    );

    if (!confirmou) return;

    setExcluindoId(produto.id);

    try {
      const { error } = await supabase
        .from("produtos")
        .delete()
        .eq("id", produto.id);

      if (error) {
        throw error;
      }

      if (produto.imagem_url) {
        const caminho = obterCaminhoStorage(
          produto.imagem_url
        );

        if (caminho) {
          const { error: erroImagem } =
            await supabase.storage
              .from("produtos")
              .remove([caminho]);

          if (erroImagem) {
            console.error(
              "Produto excluído, mas houve erro ao excluir imagem:",
              erroImagem
            );
          }
        }
      }

      await carregarDados();
    } catch (error) {
      console.error(error);

      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o produto."
      );
    } finally {
      setExcluindoId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Produtos
            </h1>

            <p className="mt-1 text-gray-500">
              Gerencie os produtos utilizados no PDV.
            </p>
          </div>

          <button
            onClick={abrirNovoProduto}
            className="rounded-lg bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
          >
            + Novo produto
          </button>
        </div>

        <div className="mb-6 grid gap-4 rounded-xl bg-white p-4 shadow-sm md:grid-cols-[1fr_260px]">
          <input
            type="search"
            value={pesquisa}
            onChange={(event) =>
              setPesquisa(event.target.value)
            }
            placeholder="Pesquisar produto..."
            className="rounded-lg border p-3 outline-none focus:border-red-500"
          />

          <select
            value={filtroCategoria}
            onChange={(event) =>
              setFiltroCategoria(event.target.value)
            }
            className="rounded-lg border bg-white p-3"
          >
            <option value="">Todas as categorias</option>

            {categorias.map((categoria) => (
              <option
                key={categoria.id}
                value={categoria.id}
              >
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          {carregando ? (
            <div className="p-10 text-center text-gray-500">
              Carregando produtos...
            </div>
          ) : produtosFiltrados.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl">📦</div>

              <p className="mt-3 font-semibold">
                Nenhum produto encontrado
              </p>

              <p className="text-sm text-gray-500">
                Cadastre um produto ou altere os filtros.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr className="border-b">
                    <th className="p-4 text-left">Imagem</th>
                    <th className="p-4 text-left">Produto</th>
                    <th className="p-4 text-left">Categoria</th>
                    <th className="p-4 text-left">Preço</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-right">Ações</th>
                  </tr>
                </thead>

                <tbody>
                  {produtosFiltrados.map((produto) => (
                    <tr
                      key={produto.id}
                      className="border-b last:border-b-0 hover:bg-gray-50"
                    >
                      <td className="p-4">
                        {produto.imagem_url ? (
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            className="h-16 w-16 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-100 text-2xl">
                            🍕
                          </div>
                        )}
                      </td>

                      <td className="p-4 font-semibold">
                        {produto.nome}
                      </td>

                      <td className="p-4 text-gray-600">
                        {obterNomeCategoria(
                          produto.categoria_id
                        )}
                      </td>

                      <td className="p-4 font-medium">
                        R${" "}
                        {Number(produto.preco).toLocaleString(
                          "pt-BR",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            produto.ativo
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {produto.ativo
                            ? "Ativo"
                            : "Inativo"}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() =>
                              abrirEdicao(produto)
                            }
                            className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                          >
                            Editar
                          </button>

                          <button
                            onClick={() =>
                              excluirProduto(produto)
                            }
                            disabled={
                              excluindoId === produto.id
                            }
                            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {excluindoId === produto.id
                              ? "Excluindo..."
                              : "Excluir"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="mt-4 text-sm text-gray-500">
          {produtosFiltrados.length} produto(s) encontrado(s).
        </p>
      </div>

      <ProdutoModal
        aberto={modalAberto}
        produto={produtoEditando}
        categorias={categorias}
        aoFechar={() => {
          setModalAberto(false);
          setProdutoEditando(null);
        }}
        aoSalvar={carregarDados}
      />
    </main>
  );
}
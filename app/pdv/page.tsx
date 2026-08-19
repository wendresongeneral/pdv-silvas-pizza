"use client";

import { MouseEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ClipboardList, QrCode, Star } from "lucide-react";

type Categoria = {
  id: string;
  nome: string;
  permite_adicionais: boolean;
};

type Produto = {
  id: string;
  nome: string;
  preco: number | string;
  custo: number | string;
  favorito: boolean;
  categoria_id: string | null;
  imagem_url: string | null;
  ativo?: boolean | null;
};

type Adicional = {
  id: string;
  nome: string;
  preco: number | string;
};

type AdicionalEscolhido = {
  id: string;
  nome: string;
  preco: number;
};

type ItemCarrinho = {
  chave: string;
  produtoId: string;
  nome: string;
  precoBase: number;
  custoUnitario: number;
  precoUnitario: number;
  quantidade: number;
  adicionais: AdicionalEscolhido[];
};

type FormaPagamento = "Dinheiro" | "Cartão" | "Pix";

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function criarChaveItem(
  produtoId: string,
  adicionais: AdicionalEscolhido[],
) {
  const ids = adicionais
    .map((adicional) => adicional.id)
    .sort()
    .join("-");

  return `${produtoId}::${ids}`;
}

export default function PdvPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);

  const [categoriaSelecionada, setCategoriaSelecionada] =
    useState<string | "todas">("todas");

  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamento>("Dinheiro");

  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);

  const [adicionaisProduto, setAdicionaisProduto] = useState<Adicional[]>([]);
  const [adicionaisEscolhidos, setAdicionaisEscolhidos] =
    useState<string[]>([]);

  const [modalAdicionalAberto, setModalAdicionalAberto] = useState(false);
  const [carregandoAdicionais, setCarregandoAdicionais] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  async function carregarDados() {
    setCarregando(true);
    setMensagem("");

    const [categoriasResponse, produtosResponse] = await Promise.all([
      supabase
        .from("categorias")
        .select("id, nome, permite_adicionais")
        .order("nome"),

      supabase
        .from("produtos")
        .select("id, nome, preco, custo, favorito, ativo, categoria_id, imagem_url",)
        .eq("ativo", true)
        .order("nome"),
    ]);

    if (categoriasResponse.error || produtosResponse.error) {
      console.error(
        "Erro ao carregar categorias:",
        categoriasResponse.error,
      );
      console.error(
        "Erro ao carregar produtos:",
        produtosResponse.error,
      );

      setMensagem("Não foi possível carregar os produtos.");
      setCarregando(false);
      return;
    }

    setCategorias(categoriasResponse.data ?? []);
    setProdutos(produtosResponse.data ?? []);
    setCarregando(false);
  }

  function quantidadeNoCarrinho(produtoId: string) {
    return carrinho
      .filter((item) => item.produtoId === produtoId)
      .reduce((soma, item) => soma + item.quantidade, 0);
  }

  function adicionarItemAoCarrinho(
    produto: Produto,
    adicionais: AdicionalEscolhido[] = [],
  ) {
    const precoBase = Number(produto.preco);
    const custoUnitario = Number(produto.custo ?? 0);

    const totalAdicionais = adicionais.reduce(
      (soma, adicional) => soma + adicional.preco,
      0,
    );

    const precoUnitario = precoBase + totalAdicionais;
    const chave = criarChaveItem(produto.id, adicionais);

    setCarrinho((atual) => {
      const itemExistente = atual.find(
        (item) => item.chave === chave,
      );

      if (itemExistente) {
        return atual.map((item) =>
          item.chave === chave
            ? {
              ...item,
              quantidade: item.quantidade + 1,
            }
            : item,
        );
      }

      return [
        ...atual,
        {
          chave,
          produtoId: produto.id,
          nome: produto.nome,
          precoBase,
          custoUnitario,
          precoUnitario,
          quantidade: 1,
          adicionais,
        },
      ];
    });

    setMensagem("");
  }

  async function abrirProduto(produto: Produto) {
    setMensagem("");
    setCarregandoAdicionais(true);

    const categoriaProduto = categorias.find(
      (categoria) => categoria.id === produto.categoria_id,
    );

    if (!categoriaProduto?.permite_adicionais) {
      adicionarItemAoCarrinho(produto);
      setCarregandoAdicionais(false);
      return;
    }

    const { data: vinculos, error: erroVinculos } = await supabase
      .from("produto_adicionais")
      .select("adicional_id")
      .eq("produto_id", produto.id);

    if (erroVinculos) {
      console.error(
        "Erro ao carregar adicionais do produto:",
        erroVinculos,
      );

      setMensagem(
        "Não foi possível verificar os adicionais deste produto.",
      );
      setCarregandoAdicionais(false);
      return;
    }

    const idsAdicionais = (vinculos ?? []).map(
      (item) => item.adicional_id as string,
    );

    if (idsAdicionais.length === 0) {
      adicionarItemAoCarrinho(produto);
      setCarregandoAdicionais(false);
      return;
    }

    const { data: adicionaisData, error: erroAdicionais } =
      await supabase
        .from("adicionais")
        .select("id, nome, preco")
        .in("id", idsAdicionais)
        .eq("ativo", true)
        .order("nome");

    if (erroAdicionais) {
      console.error(
        "Erro ao carregar dados dos adicionais:",
        erroAdicionais,
      );

      setMensagem(
        "Não foi possível carregar os adicionais deste produto.",
      );
      setCarregandoAdicionais(false);
      return;
    }

    const adicionaisAtivos = adicionaisData ?? [];

    if (adicionaisAtivos.length === 0) {
      adicionarItemAoCarrinho(produto);
      setCarregandoAdicionais(false);
      return;
    }

    setProdutoSelecionado(produto);
    setAdicionaisProduto(adicionaisAtivos);
    setAdicionaisEscolhidos([]);
    setModalAdicionalAberto(true);
    setCarregandoAdicionais(false);
  }

  function fecharModalAdicionais() {
    setProdutoSelecionado(null);
    setAdicionaisProduto([]);
    setAdicionaisEscolhidos([]);
    setModalAdicionalAberto(false);
  }

  function alternarAdicional(adicionalId: string) {
    setAdicionaisEscolhidos((atuais) =>
      atuais.includes(adicionalId)
        ? atuais.filter((id) => id !== adicionalId)
        : [...atuais, adicionalId],
    );
  }

  function confirmarProdutoComAdicionais() {
    if (!produtoSelecionado) return;

    const adicionaisSelecionados = adicionaisProduto
      .filter((adicional) =>
        adicionaisEscolhidos.includes(adicional.id),
      )
      .map((adicional) => ({
        id: adicional.id,
        nome: adicional.nome,
        preco: Number(adicional.preco),
      }));

    adicionarItemAoCarrinho(
      produtoSelecionado,
      adicionaisSelecionados,
    );

    fecharModalAdicionais();
  }

  function aumentarQuantidade(chave: string) {
    setCarrinho((atual) =>
      atual.map((item) =>
        item.chave === chave
          ? {
            ...item,
            quantidade: item.quantidade + 1,
          }
          : item,
      ),
    );
  }

  function diminuirQuantidade(chave: string) {
    setCarrinho((atual) =>
      atual
        .map((item) =>
          item.chave === chave
            ? {
              ...item,
              quantidade: item.quantidade - 1,
            }
            : item,
        )
        .filter((item) => item.quantidade > 0),
    );
  }

  function removerProduto(chave: string) {
    setCarrinho((atual) =>
      atual.filter((item) => item.chave !== chave),
    );
  }

  function limparPedido() {
    setCarrinho([]);
    setMensagem("");
  }
  async function alternarFavorito(
    produto: Produto,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();

    const novoFavorito = !produto.favorito;

    setProdutos((atuais) =>
      atuais.map((item) =>
        item.id === produto.id
          ? {
            ...item,
            favorito: novoFavorito,
          }
          : item,
      ),
    );

    const { error } = await supabase
      .from("produtos")
      .update({
        favorito: novoFavorito,
      })
      .eq("id", produto.id);

    if (error) {
      console.error("Erro ao favoritar produto:", error);

      setProdutos((atuais) =>
        atuais.map((item) =>
          item.id === produto.id
            ? {
              ...item,
              favorito: produto.favorito,
            }
            : item,
        ),
      );

      setMensagem("Não foi possível alterar o favorito.");
    }
  }

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return produtos
      .filter((produto) => {
        const categoriaOk =
          categoriaSelecionada === "todas" ||
          produto.categoria_id === categoriaSelecionada;

        const buscaOk =
          !termo ||
          produto.nome.toLowerCase().includes(termo);

        return categoriaOk && buscaOk;
      })
      .sort((a, b) => {
        // Favoritos primeiro
        if (a.favorito !== b.favorito) {
          return a.favorito ? -1 : 1;
        }

        // Depois ordem alfabética
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [produtos, categoriaSelecionada, busca]);

  const quantidadeTotal = useMemo(
    () =>
      carrinho.reduce(
        (soma, item) => soma + item.quantidade,
        0,
      ),
    [carrinho],
  );

  const total = useMemo(
    () =>
      carrinho.reduce(
        (soma, item) =>
          soma + item.precoUnitario * item.quantidade,
        0,
      ),
    [carrinho],
  );

  const totalAdicionaisModal = useMemo(
    () =>
      adicionaisProduto
        .filter((adicional) =>
          adicionaisEscolhidos.includes(adicional.id),
        )
        .reduce(
          (soma, adicional) =>
            soma + Number(adicional.preco),
          0,
        ),
    [adicionaisProduto, adicionaisEscolhidos],
  );

  const totalProdutoModal =
    Number(produtoSelecionado?.preco ?? 0) +
    totalAdicionaisModal;

  async function finalizarVenda() {
    if (carrinho.length === 0) {
      setMensagem("Adicione pelo menos um produto.");
      return;
    }

    setFinalizando(true);
    setMensagem("");

    try {
      const { data: ultimaVenda, error: erroUltimaVenda } =
        await supabase
          .from("vendas")
          .select("numero")
          .order("numero", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (erroUltimaVenda) {
        throw erroUltimaVenda;
      }

      const proximoNumero = (ultimaVenda?.numero ?? 0) + 1;

      const { data: vendaCriada, error: erroVenda } =
        await supabase
          .from("vendas")
          .insert({
            numero: proximoNumero,
            data_venda: new Date().toISOString(),
            subtotal: total,
            desconto: 0,
            total,
            forma_pagamento: formaPagamento,
          })
          .select("id")
          .single();

      if (erroVenda || !vendaCriada) {
        throw erroVenda ?? new Error("A venda não foi criada.");
      }

      for (const item of carrinho) {
        const { data: itemCriado, error: erroItem } =
          await supabase
            .from("itens_venda")
            .insert({
              venda_id: vendaCriada.id,
              produto_id: item.produtoId,
              quantidade: item.quantidade,
              valor_unitario: item.precoUnitario,
              custo_unitario: item.custoUnitario,
              subtotal:
                item.precoUnitario * item.quantidade,
            })
            .select("id")
            .single();

        if (erroItem || !itemCriado) {
          throw (
            erroItem ??
            new Error(
              `Não foi possível salvar o item ${item.nome}.`,
            )
          );
        }

        if (item.adicionais.length > 0) {
          const adicionaisVenda = item.adicionais.map(
            (adicional) => ({
              item_venda_id: itemCriado.id,
              adicional_id: adicional.id,
              nome: adicional.nome,
              valor: adicional.preco,
              quantidade: item.quantidade,
            }),
          );

          const { error: erroAdicionaisVenda } = await supabase
            .from("itens_venda_adicionais")
            .insert(adicionaisVenda);

          if (erroAdicionaisVenda) {
            throw erroAdicionaisVenda;
          }
        }
      }

      setCarrinho([]);
      setMensagem(
        `Venda de ${moeda(total)} finalizada com sucesso.`,
      );
    } catch (error) {
      console.error("Erro ao finalizar venda:", error);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a venda.",
      );
    } finally {
      setFinalizando(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>

            <h1 className="text-3xl font-bold">
              Ponto de venda
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/comandas"
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              <ClipboardList className="h-5 w-5" />
              Comandas
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-semibold transition hover:bg-zinc-50"
            >
              ← Voltar ao menu
            </Link>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-5 text-sm text-zinc-500">
              Clique nos produtos para adicionar ao pedido.
            </p>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() =>
                  setCategoriaSelecionada("todas")
                }
                className={`whitespace-nowrap rounded-xl px-4 py-3 font-semibold transition ${categoriaSelecionada === "todas"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-100 hover:bg-zinc-200"
                  }`}
              >
                Todos
              </button>

              {categorias.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() =>
                    setCategoriaSelecionada(categoria.id)
                  }
                  className={`whitespace-nowrap rounded-xl px-4 py-3 font-semibold transition ${categoriaSelecionada === categoria.id
                    ? "bg-red-600 text-white"
                    : "bg-zinc-100 hover:bg-zinc-200"
                    }`}
                >
                  {categoria.nome}
                </button>
              ))}
            </div>

            <input
              type="search"
              placeholder="🔍 Procurar produto..."
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
              }
              className="mb-5 w-full rounded-xl border border-zinc-300 p-4 text-lg outline-none focus:border-red-500"
            />

            {carregando ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
                Carregando produtos...
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {produtosFiltrados.map((produto) => {
                  const quantidadeProduto =
                    quantidadeNoCarrinho(produto.id);

                  return (
                    <div
                      key={produto.id}
                      className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-red-500 hover:shadow-xl"
                    >
                      {/* ESTRELA DE FAVORITO */}
                      <button
                        type="button"
                        onClick={(event) =>
                          alternarFavorito(produto, event)
                        }
                        className={`absolute left-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition hover:scale-105 ${
                          produto.favorito
                            ? "bg-amber-50"
                            : "bg-white/95"
                        }`}
                        title={
                          produto.favorito
                            ? "Remover dos favoritos"
                            : "Adicionar aos favoritos"
                        }
                      >
                        <Star
                          className={`h-4 w-4 ${
                            produto.favorito
                              ? "fill-amber-400 text-amber-500"
                              : "fill-none text-zinc-400"
                          }`}
                          strokeWidth={2.2}
                        />
                      </button>

                      {/* QUANTIDADE NO CARRINHO */}
                      {quantidadeProduto > 0 && (
                        <div className="absolute right-3 top-3 z-30 flex h-9 min-w-9 items-center justify-center rounded-full bg-red-600 px-2 text-sm font-bold text-white shadow-lg">
                          {quantidadeProduto}
                        </div>
                      )}

                      {/* ÁREA CLICÁVEL DO PRODUTO */}
                      <button
                        type="button"
                        onClick={() => abrirProduto(produto)}
                        disabled={carregandoAdicionais}
                        className="block w-full text-left disabled:cursor-wait disabled:opacity-70"
                      >
                        {produto.imagem_url ? (
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            className="h-32 w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-32 w-full items-center justify-center bg-zinc-100 text-5xl">
                            🍕
                          </div>
                        )}

                        <div className="flex min-h-40 flex-col justify-between p-4">
                          <span className="font-semibold text-zinc-900">
                            {produto.nome}
                          </span>

                          <span className="mt-3 text-lg font-bold text-red-600">
                            {moeda(Number(produto.preco))}
                          </span>

                          <div
                            className={`mt-4 rounded-xl py-3 text-center font-semibold text-white ${
                              quantidadeProduto > 0
                                ? "bg-green-600"
                                : "bg-red-600"
                            }`}
                          >
                            {quantidadeProduto > 0
                              ? `${quantidadeProduto} no pedido`
                              : "+ Adicionar"}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Pedido</h2>

            <p className="text-sm text-zinc-500">
              {quantidadeTotal} item(ns)
            </p>
          </div>

          {carrinho.length > 0 && (
            <button
              type="button"
              onClick={limparPedido}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
          {carrinho.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              O pedido está vazio.
            </div>
          ) : (
            carrinho.map((item) => (
              <div
                key={item.chave}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {item.nome}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {moeda(item.precoBase)} base
                    </p>

                    {item.adicionais.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.adicionais.map(
                          (adicional) => (
                            <p
                              key={adicional.id}
                              className="text-sm text-green-700"
                            >
                              + {adicional.nome} (
                              {moeda(adicional.preco)})
                            </p>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <p className="font-bold">
                    {moeda(
                      item.precoUnitario *
                      item.quantidade,
                    )}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        diminuirQuantidade(item.chave)
                      }
                      className="flex h-11 w-11 items-center justify-center bg-red-50 text-xl font-bold text-red-700 transition hover:bg-red-100"
                      aria-label={`Diminuir quantidade de ${item.nome}`}
                    >
                      −
                    </button>

                    <span className="flex h-11 w-12 items-center justify-center border-x border-zinc-200 text-lg font-bold text-zinc-900">
                      {item.quantidade}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        aumentarQuantidade(item.chave)
                      }
                      className="flex h-11 w-11 items-center justify-center bg-green-50 text-xl font-bold text-green-700 transition hover:bg-green-100"
                      aria-label={`Aumentar quantidade de ${item.nome}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removerProduto(item.chave)
                    }
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="my-5 border-t border-zinc-200 pt-5">
          <div className="flex items-end justify-between gap-3">
            <span className="font-medium text-zinc-500">
              Total
            </span>

            <strong className="text-right text-4xl font-extrabold text-red-600">
              {moeda(total)}
            </strong>
          </div>
        </div>

        <div className="mb-4">
          <p className="mb-2 font-semibold">
            Forma de pagamento
          </p>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() =>
                setFormaPagamento("Dinheiro")
              }
              className={`rounded-xl border p-3 font-semibold ${formaPagamento === "Dinheiro"
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-zinc-200"
                }`}
            >
              💵 Dinheiro
            </button>

            <button
              type="button"
              onClick={() =>
                setFormaPagamento("Cartão")
              }
              className={`rounded-xl border p-3 font-semibold ${formaPagamento === "Cartão"
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-zinc-200"
                }`}
            >
              💳 Cartão
            </button>
            <button
              type="button"
              onClick={() =>
                setFormaPagamento("Pix")
              }
              className={`rounded-xl border p-3 font-semibold ${
                formaPagamento === "Pix"
                  ? "border-teal-600 bg-teal-50 text-teal-700"
                  : "border-zinc-200"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <QrCode className="h-4 w-4" />
                Pix
              </span>
            </button>

          </div>
        </div>

        <button
          type="button"
          onClick={finalizarVenda}
          disabled={
            finalizando || carrinho.length === 0
          }
          className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-5 text-xl font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:from-zinc-300 disabled:to-zinc-300"
        >
          {finalizando
            ? "Finalizando..."
            : "Finalizar venda"}
        </button>

        {mensagem && (
          <p
            className="mt-4 rounded-xl bg-zinc-100 p-3 text-center text-sm font-medium"
            aria-live="polite"
          >
            {mensagem}
          </p>
        )}
      </aside>
    </div>
      </div>

    { modalAdicionalAberto && produtoSelecionado && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
        <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-zinc-200 p-5">
            <div>
              <p className="text-sm font-semibold text-red-600">
                Personalizar produto
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                {produtoSelecionado.nome}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Selecione os adicionais desejados.
              </p>
            </div>

            <button
              type="button"
              onClick={fecharModalAdicionais}
              className="rounded-xl px-3 py-2 text-2xl hover:bg-zinc-100"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          <div className="space-y-3 p-5">
            {adicionaisProduto.map((adicional) => {
              const selecionado =
                adicionaisEscolhidos.includes(
                  adicional.id,
                );

              return (
                <label
                  key={adicional.id}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition ${selecionado
                    ? "border-red-500 bg-red-50"
                    : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() =>
                        alternarAdicional(adicional.id)
                      }
                      className="h-5 w-5"
                    />

                    <span className="font-semibold">
                      {adicional.nome}
                    </span>
                  </div>

                  <span className="font-bold text-green-700">
                    + {moeda(Number(adicional.preco))}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Produto</span>

                <span>
                  {moeda(
                    Number(produtoSelecionado.preco),
                  )}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600">
                <span>Adicionais</span>

                <span>
                  {moeda(totalAdicionaisModal)}
                </span>
              </div>

              <div className="flex items-end justify-between border-t border-zinc-200 pt-3">
                <span className="font-semibold">
                  Total
                </span>

                <strong className="text-3xl text-red-600">
                  {moeda(totalProdutoModal)}
                </strong>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={fecharModalAdicionais}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-4 font-semibold hover:bg-zinc-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarProdutoComAdicionais}
                className="rounded-xl bg-red-600 px-4 py-4 font-bold text-white hover:bg-red-700"
              >
                Adicionar ao pedido
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </main>
  );
}
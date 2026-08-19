"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";

type Categoria = {
  id: string;
  nome: string;
  permite_adicionais: boolean;
};

type Adicional = {
  id: string;
  nome: string;
  preco: number | string;
};

type Produto = {
  id: string;
  nome: string;
  preco: number | string;
  categoria_id: string;
  imagem_url: string | null;
  favorito?: boolean;
  adicionais: Adicional[];
};

type ItemCarrinho = {
  chave: string;
  produto_id: string;
  nome: string;
  precoBase: number;
  quantidade: number;
  adicionais: Adicional[];
};

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function chaveItem(
  produtoId: string,
  adicionais: Adicional[],
) {
  const ids = adicionais
    .map((a) => a.id)
    .sort()
    .join("-");

  return `${produtoId}::${ids}`;
}

export default function ComandaMesaPage() {
  const params = useParams<{ mesa: string }>();
  const mesa = params.mesa;

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [mesaNome, setMesaNome] = useState("");
  const [totalComanda, setTotalComanda] = useState(0);

  const [categoria, setCategoria] =
    useState<string | "todas">("todas");

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [produtoModal, setProdutoModal] =
    useState<Produto | null>(null);

  const [adicionaisMarcados, setAdicionaisMarcados] =
    useState<string[]>([]);

  const [observacao, setObservacao] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");

  async function carregarMenu() {
    setCarregando(true);
    setErro("");

    try {
      const response = await fetch(`/api/comanda/${mesa}`, {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.erro || "Não foi possível carregar o menu.",
        );
      }

      setMesaNome(data.mesa?.nome || `Mesa ${mesa}`);
      setCategorias(data.categorias ?? []);
      setProdutos(data.produtos ?? []);
      setTotalComanda(Number(data.totalComanda ?? 0));
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar a comanda.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarMenu();
  }, [mesa]);

  const produtosFiltrados = useMemo(() => {
    const lista =
      categoria === "todas"
        ? produtos
        : produtos.filter(
            (produto) => produto.categoria_id === categoria,
          );

    return [...lista].sort((a, b) => {
      if (Boolean(a.favorito) !== Boolean(b.favorito)) {
        return a.favorito ? -1 : 1;
      }

      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [produtos, categoria]);

  const totalCarrinho = useMemo(
    () =>
      carrinho.reduce((soma, item) => {
        const extras = item.adicionais.reduce(
          (subtotal, adicional) =>
            subtotal + Number(adicional.preco),
          0,
        );

        return (
          soma +
          (item.precoBase + extras) * item.quantidade
        );
      }, 0),
    [carrinho],
  );

  const quantidadeTotal = useMemo(
    () =>
      carrinho.reduce(
        (soma, item) => soma + item.quantidade,
        0,
      ),
    [carrinho],
  );

  function abrirProduto(produto: Produto) {
    if (produto.adicionais.length === 0) {
      adicionarAoCarrinho(produto, []);
      return;
    }

    setProdutoModal(produto);
    setAdicionaisMarcados([]);
  }

  function adicionarAoCarrinho(
    produto: Produto,
    adicionais: Adicional[],
  ) {
    const chave = chaveItem(produto.id, adicionais);

    setCarrinho((atual) => {
      const existente = atual.find(
        (item) => item.chave === chave,
      );

      if (existente) {
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
          produto_id: produto.id,
          nome: produto.nome,
          precoBase: Number(produto.preco),
          quantidade: 1,
          adicionais,
        },
      ];
    });

    setSucesso("");
  }

  function confirmarModal() {
    if (!produtoModal) return;

    const adicionais = produtoModal.adicionais.filter(
      (adicional) =>
        adicionaisMarcados.includes(adicional.id),
    );

    adicionarAoCarrinho(produtoModal, adicionais);
    setProdutoModal(null);
    setAdicionaisMarcados([]);
  }

  function alterarQuantidade(
    chave: string,
    quantidade: number,
  ) {
    setCarrinho((atual) =>
      atual
        .map((item) =>
          item.chave === chave
            ? { ...item, quantidade }
            : item,
        )
        .filter((item) => item.quantidade > 0),
    );
  }

  async function enviarPedido() {
    if (carrinho.length === 0) return;

    setEnviando(true);
    setErro("");
    setSucesso("");

    try {
      const response = await fetch(`/api/comanda/${mesa}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          observacao,
          itens: carrinho.map((item) => ({
            produto_id: item.produto_id,
            quantidade: item.quantidade,
            adicionais: item.adicionais.map(
              (adicional) => adicional.id,
            ),
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.erro || "Não foi possível enviar o pedido.",
        );
      }

      setCarrinho([]);
      setObservacao("");
      setTotalComanda(
        Number(data.pedido?.total_comanda ?? totalComanda),
      );

      setSucesso(
        `Pedido enviado! Total atual da comanda: ${moeda(
          Number(data.pedido?.total_comanda ?? 0),
        )}`,
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o pedido.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-zinc-100 p-5">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center shadow-sm">
          Carregando cardápio...
        </div>
      </main>
    );
  }

  if (erro && produtos.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-100 p-5">
        <div className="mx-auto max-w-lg rounded-3xl bg-white p-10 text-center shadow-sm">
          <p className="font-bold text-red-600">{erro}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 pb-40 text-zinc-900">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>

            <h1 className="text-xl font-bold">{mesaNome}</h1>
          </div>

          <div className="text-right">
            <p className="text-xs text-zinc-500">
              Comanda atual
            </p>

            <p className="font-bold text-red-600">
              {moeda(totalComanda)}
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-4">
        {sucesso && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-800">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{sucesso}</p>
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {erro}
          </div>
        )}

        <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setCategoria("todas")}
            className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold ${
              categoria === "todas"
                ? "bg-red-600 text-white"
                : "bg-white text-zinc-600"
            }`}
          >
            Todos
          </button>

          {categorias.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoria(cat.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold ${
                categoria === cat.id
                  ? "bg-red-600 text-white"
                  : "bg-white text-zinc-600"
              }`}
            >
              {cat.nome}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {produtosFiltrados.map((produto) => (
            <button
              key={produto.id}
              type="button"
              onClick={() => abrirProduto(produto)}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm transition active:scale-[0.98]"
            >
              {produto.imagem_url ? (
                <img
                  src={produto.imagem_url}
                  alt={produto.nome}
                  className="h-40 w-full bg-white object-contain p-2"
                />
              ) : (
                <div className="flex h-40 items-center justify-center bg-zinc-50 text-5xl">
                  🍕
                </div>
              )}

              <div className="p-3">
                <p className="min-h-12 text-sm font-semibold">
                  {produto.nome}
                </p>

                <p className="mt-2 font-bold text-red-600">
                  {moeda(Number(produto.preco))}
                </p>

                <div className="mt-3 rounded-xl bg-red-600 py-2 text-center text-sm font-semibold text-white">
                  Adicionar
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {quantidadeTotal > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white p-4 shadow-2xl">
          <div className="mx-auto max-w-5xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-500">
                  {quantidadeTotal} item(ns)
                </p>
                <p className="text-xl font-extrabold">
                  {moeda(totalCarrinho)}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById("pedido-atual")
                    ?.scrollIntoView({
                      behavior: "smooth",
                    })
                }
                className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 font-semibold"
              >
                <ShoppingBag className="h-5 w-5" />
                Ver pedido
              </button>
            </div>

            <button
              type="button"
              onClick={enviarPedido}
              disabled={enviando}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-4 text-lg font-bold text-white disabled:bg-zinc-400"
            >
              <Send className="h-5 w-5" />
              {enviando ? "Enviando..." : "Enviar pedido"}
            </button>
          </div>
        </div>
      )}

      {carrinho.length > 0 && (
        <section
          id="pedido-atual"
          className="mx-auto mt-4 max-w-5xl px-4 pb-6"
        >
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="text-lg font-bold">Seu pedido</h2>

            <div className="mt-4 space-y-3">
              {carrinho.map((item) => {
                const extras = item.adicionais.reduce(
                  (soma, adicional) =>
                    soma + Number(adicional.preco),
                  0,
                );

                return (
                  <div
                    key={item.chave}
                    className="rounded-xl border border-zinc-200 p-3"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {item.nome}
                        </p>

                        {item.adicionais.map((adicional) => (
                          <p
                            key={adicional.id}
                            className="mt-1 text-xs text-green-700"
                          >
                            + {adicional.nome}
                          </p>
                        ))}
                      </div>

                      <p className="font-bold">
                        {moeda(
                          (item.precoBase + extras) *
                            item.quantidade,
                        )}
                      </p>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          alterarQuantidade(
                            item.chave,
                            item.quantidade - 1,
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100"
                      >
                        <Minus className="h-4 w-4" />
                      </button>

                      <span className="min-w-8 text-center font-bold">
                        {item.quantidade}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          alterarQuantidade(
                            item.chave,
                            item.quantidade + 1,
                          )
                        }
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <textarea
              value={observacao}
              onChange={(event) =>
                setObservacao(event.target.value)
              }
              maxLength={500}
              placeholder="Observação para a cozinha (opcional)"
              className="mt-4 min-h-24 w-full resize-none rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
            />
          </div>
        </section>
      )}

      {produtoModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-600">
                  Personalizar
                </p>
                <h2 className="text-2xl font-bold">
                  {produtoModal.nome}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setProdutoModal(null)}
                className="rounded-full bg-zinc-100 p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {produtoModal.adicionais.map((adicional) => {
                const marcado =
                  adicionaisMarcados.includes(adicional.id);

                return (
                  <label
                    key={adicional.id}
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 ${
                      marcado
                        ? "border-red-400 bg-red-50"
                        : "border-zinc-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() =>
                          setAdicionaisMarcados((atuais) =>
                            atuais.includes(adicional.id)
                              ? atuais.filter(
                                  (id) => id !== adicional.id,
                                )
                              : [...atuais, adicional.id],
                          )
                        }
                        className="h-5 w-5"
                      />

                      <span className="font-medium">
                        {adicional.nome}
                      </span>
                    </div>

                    <span className="font-semibold text-green-700">
                      + {moeda(Number(adicional.preco))}
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              type="button"
              onClick={confirmarModal}
              className="mt-5 w-full rounded-2xl bg-red-600 py-4 font-bold text-white"
            >
              Adicionar ao pedido
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
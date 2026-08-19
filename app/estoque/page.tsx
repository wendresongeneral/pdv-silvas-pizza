"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  House,
  Minus,
  PackageCheck,
  PackageX,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Produto = {
  id: string;
  nome: string;
  imagem_url: string | null;
  ativo: boolean;
  controla_estoque: boolean;
  estoque_atual: number;
  estoque_minimo: number;
};

type EdicaoProduto = {
  controla: boolean;
  atual: string;
  minimo: string;
};

type Insumo = {
  id: string;
  nome: string;
  unidade: string;
  estoque_atual: number;
  estoque_minimo: number;
  custo_unitario: number;
  ativo: boolean;
};

type Aba = "produtos" | "insumos";

function numero(valor: string | number) {
  const n = Number(valor);
  return Number.isFinite(n) ? n : 0;
}

function formatarQtd(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(valor);
}

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export default function EstoquePage() {
  const [aba, setAba] = useState<Aba>("produtos");

  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [edicoes, setEdicoes] = useState<Record<string, EdicaoProduto>>({});
  const [buscaProdutos, setBuscaProdutos] = useState("");
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [salvandoProdutoId, setSalvandoProdutoId] = useState<string | null>(null);

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [buscaInsumos, setBuscaInsumos] = useState("");
  const [carregandoInsumos, setCarregandoInsumos] = useState(true);

  const [modalInsumoAberto, setModalInsumoAberto] = useState(false);
  const [insumoEditando, setInsumoEditando] = useState<Insumo | null>(null);
  const [nomeInsumo, setNomeInsumo] = useState("");
  const [unidadeInsumo, setUnidadeInsumo] = useState("kg");
  const [estoqueInsumo, setEstoqueInsumo] = useState("0");
  const [minimoInsumo, setMinimoInsumo] = useState("0");
  const [custoInsumo, setCustoInsumo] = useState("0");
  const [ativoInsumo, setAtivoInsumo] = useState(true);
  const [salvandoInsumo, setSalvandoInsumo] = useState(false);

  async function carregarProdutos() {
    setCarregandoProdutos(true);

    const { data, error } = await supabase
      .from("produtos")
      .select(
        "id, nome, imagem_url, ativo, controla_estoque, estoque_atual, estoque_minimo",
      )
      .order("nome");

    if (error) {
      alert(error.message);
      setCarregandoProdutos(false);
      return;
    }

    const lista = (data ?? []) as Produto[];

    setProdutos(lista);

    setEdicoes(
      Object.fromEntries(
        lista.map((produto) => [
          produto.id,
          {
            controla: Boolean(produto.controla_estoque),
            atual: String(produto.estoque_atual ?? 0),
            minimo: String(produto.estoque_minimo ?? 3),
          },
        ]),
      ),
    );

    setCarregandoProdutos(false);
  }

  async function carregarInsumos() {
    setCarregandoInsumos(true);

    const { data, error } = await supabase
      .from("insumos")
      .select(
        "id, nome, unidade, estoque_atual, estoque_minimo, custo_unitario, ativo",
      )
      .order("nome");

    if (error) {
      alert(error.message);
      setCarregandoInsumos(false);
      return;
    }

    setInsumos((data ?? []) as Insumo[]);
    setCarregandoInsumos(false);
  }

  useEffect(() => {
    carregarProdutos();
    carregarInsumos();
  }, []);

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProdutos.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((produto) =>
      produto.nome.toLowerCase().includes(termo),
    );
  }, [produtos, buscaProdutos]);

  const insumosFiltrados = useMemo(() => {
    const termo = buscaInsumos.trim().toLowerCase();
    if (!termo) return insumos;

    return insumos.filter(
      (insumo) =>
        insumo.nome.toLowerCase().includes(termo) ||
        insumo.unidade.toLowerCase().includes(termo),
    );
  }, [insumos, buscaInsumos]);

  const resumoProdutos = useMemo(() => {
    const controlados = produtos.filter((p) => p.controla_estoque);
    const zerados = controlados.filter((p) => p.estoque_atual === 0);
    const baixos = controlados.filter(
      (p) =>
        p.estoque_atual > 0 &&
        p.estoque_atual <= p.estoque_minimo,
    );

    return {
      controlados: controlados.length,
      zerados: zerados.length,
      baixos: baixos.length,
    };
  }, [produtos]);

  const resumoInsumos = useMemo(() => {
    const ativos = insumos.filter((i) => i.ativo);
    const zerados = ativos.filter((i) => Number(i.estoque_atual) <= 0);
    const baixos = ativos.filter(
      (i) =>
        Number(i.estoque_atual) > 0 &&
        Number(i.estoque_atual) <= Number(i.estoque_minimo),
    );

    return {
      ativos: ativos.length,
      zerados: zerados.length,
      baixos: baixos.length,
    };
  }, [insumos]);

  function atualizarEdicaoProduto(
    produtoId: string,
    alteracao: Partial<EdicaoProduto>,
  ) {
    setEdicoes((atuais) => ({
      ...atuais,
      [produtoId]: {
        ...(atuais[produtoId] ?? {
          controla: false,
          atual: "0",
          minimo: "3",
        }),
        ...alteracao,
      },
    }));
  }

  function somarProduto(produtoId: string, quantidade: number) {
    const atual = Number(edicoes[produtoId]?.atual ?? 0);
    atualizarEdicaoProduto(produtoId, {
      atual: String(Math.max(0, atual + quantidade)),
    });
  }

  async function salvarProduto(produto: Produto) {
    const edicao = edicoes[produto.id];
    if (!edicao) return;

    const estoqueAtual = Number(edicao.atual);
    const estoqueMinimo = Number(edicao.minimo);

    if (
      !Number.isInteger(estoqueAtual) ||
      estoqueAtual < 0 ||
      !Number.isInteger(estoqueMinimo) ||
      estoqueMinimo < 0
    ) {
      alert("Estoque e mínimo do produto precisam ser números inteiros positivos.");
      return;
    }

    setSalvandoProdutoId(produto.id);

    const { error } = await supabase.rpc(
      "ajustar_estoque_produto",
      {
        p_produto_id: produto.id,
        p_novo_estoque: estoqueAtual,
        p_estoque_minimo: estoqueMinimo,
        p_controla_estoque: edicao.controla,
      },
    );

    setSalvandoProdutoId(null);

    if (error) {
      alert(error.message);
      return;
    }

    await carregarProdutos();
  }

  function abrirNovoInsumo() {
    setInsumoEditando(null);
    setNomeInsumo("");
    setUnidadeInsumo("kg");
    setEstoqueInsumo("0");
    setMinimoInsumo("0");
    setCustoInsumo("0");
    setAtivoInsumo(true);
    setModalInsumoAberto(true);
  }

  function abrirEditarInsumo(insumo: Insumo) {
    setInsumoEditando(insumo);
    setNomeInsumo(insumo.nome);
    setUnidadeInsumo(insumo.unidade);
    setEstoqueInsumo(String(insumo.estoque_atual));
    setMinimoInsumo(String(insumo.estoque_minimo));
    setCustoInsumo(String(insumo.custo_unitario));
    setAtivoInsumo(insumo.ativo);
    setModalInsumoAberto(true);
  }

  async function salvarInsumo() {
    const nome = nomeInsumo.trim();
    const unidade = unidadeInsumo.trim();

    const estoqueAtual = numero(estoqueInsumo.replace(",", "."));
    const estoqueMinimo = numero(minimoInsumo.replace(",", "."));
    const custoUnitario = numero(custoInsumo.replace(",", "."));

    if (!nome || !unidade) {
      alert("Informe nome e unidade do insumo.");
      return;
    }

    if (
      estoqueAtual < 0 ||
      estoqueMinimo < 0 ||
      custoUnitario < 0
    ) {
      alert("Estoque, mínimo e custo não podem ser negativos.");
      return;
    }

    setSalvandoInsumo(true);

    const payload = {
      nome,
      unidade,
      estoque_atual: estoqueAtual,
      estoque_minimo: estoqueMinimo,
      custo_unitario: custoUnitario,
      ativo: ativoInsumo,
    };

    let error;

    if (insumoEditando) {
      const resposta = await supabase
        .from("insumos")
        .update(payload)
        .eq("id", insumoEditando.id);

      error = resposta.error;
    } else {
      const resposta = await supabase
        .from("insumos")
        .insert(payload);

      error = resposta.error;
    }

    setSalvandoInsumo(false);

    if (error) {
      alert(error.message);
      return;
    }

    setModalInsumoAberto(false);
    await carregarInsumos();
  }

  async function ajustarInsumo(insumo: Insumo, delta: number) {
    const novo = Math.max(0, Number(insumo.estoque_atual) + delta);

    const { error } = await supabase.rpc(
      "ajustar_estoque_insumo",
      {
        p_insumo_id: insumo.id,
        p_novo_estoque: novo,
        p_observacao:
          delta > 0
            ? `Entrada rápida de ${delta} ${insumo.unidade}`
            : `Saída rápida de ${Math.abs(delta)} ${insumo.unidade}`,
      },
    );

    if (error) {
      alert(error.message);
      return;
    }

    await carregarInsumos();
  }

  async function excluirInsumo(insumo: Insumo) {
    const confirmar = window.confirm(
      `Excluir o insumo "${insumo.nome}"?\n\nEssa ação não pode ser desfeita.`,
    );

    if (!confirmar) return;

    const { error } = await supabase
      .from("insumos")
      .delete()
      .eq("id", insumo.id);

    if (error) {
      alert(error.message);
      return;
    }

    await carregarInsumos();
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>

            <h1 className="text-3xl font-bold">Estoque</h1>

            <p className="mt-1 text-sm text-zinc-500">
              Produtos vendidos e insumos internos no mesmo painel.
            </p>
          </div>

          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white"
            title="Menu principal"
          >
            <House className="h-5 w-5" />
          </Link>
        </header>

        <div className="mb-6 flex gap-2 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setAba("produtos")}
            className={`px-4 py-3 font-semibold ${
              aba === "produtos"
                ? "border-b-2 border-red-600 text-red-600"
                : "text-zinc-500"
            }`}
          >
            Produtos
          </button>

          <button
            type="button"
            onClick={() => setAba("insumos")}
            className={`px-4 py-3 font-semibold ${
              aba === "insumos"
                ? "border-b-2 border-red-600 text-red-600"
                : "text-zinc-500"
            }`}
          >
            Insumos
          </button>
        </div>

        {aba === "produtos" ? (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <PackageCheck className="h-5 w-5 text-green-600" />
                <p className="mt-3 text-sm text-zinc-500">
                  Produtos controlados
                </p>
                <p className="text-3xl font-extrabold">
                  {resumoProdutos.controlados}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <p className="mt-3 text-sm text-amber-700">
                  Estoque baixo
                </p>
                <p className="text-3xl font-extrabold text-amber-700">
                  {resumoProdutos.baixos}
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <PackageX className="h-5 w-5 text-red-600" />
                <p className="mt-3 text-sm text-red-700">
                  Sem estoque
                </p>
                <p className="text-3xl font-extrabold text-red-700">
                  {resumoProdutos.zerados}
                </p>
              </div>
            </section>

            <div className="mb-5 relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={buscaProdutos}
                onChange={(event) => setBuscaProdutos(event.target.value)}
                placeholder="Pesquisar produto..."
                className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-11 pr-4 outline-none focus:border-red-500"
              />
            </div>

            {carregandoProdutos ? (
              <div className="rounded-2xl bg-white p-10 text-center text-zinc-500">
                Carregando estoque...
              </div>
            ) : (
              <div className="space-y-3">
                {produtosFiltrados.map((produto) => {
                  const edicao = edicoes[produto.id] ?? {
                    controla: false,
                    atual: "0",
                    minimo: "3",
                  };

                  const atual = Number(edicao.atual || 0);
                  const minimo = Number(edicao.minimo || 0);

                  const zerado = edicao.controla && atual === 0;
                  const baixo =
                    edicao.controla &&
                    atual > 0 &&
                    atual <= minimo;

                  return (
                    <section
                      key={produto.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        zerado
                          ? "border-red-300"
                          : baixo
                            ? "border-amber-300"
                            : "border-zinc-200"
                      }`}
                    >
                      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                        <div className="flex min-w-0 items-center gap-4">
                          {produto.imagem_url ? (
                            <img
                              src={produto.imagem_url}
                              alt={produto.nome}
                              className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1"
                            />
                          ) : (
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl">
                              🍕
                            </div>
                          )}

                          <div className="min-w-0">
                            <p className="truncate text-lg font-bold">
                              {produto.nome}
                            </p>

                            {edicao.controla ? (
                              zerado ? (
                                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-red-600">
                                  <PackageX className="h-4 w-4" />
                                  Sem estoque
                                </p>
                              ) : baixo ? (
                                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-amber-600">
                                  <AlertTriangle className="h-4 w-4" />
                                  Estoque baixo
                                </p>
                              ) : (
                                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-green-600">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Estoque disponível
                                </p>
                              )
                            ) : (
                              <p className="mt-1 text-sm text-zinc-400">
                                Sem controle de estoque
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-end">
                          <label className="flex items-center gap-2 rounded-xl border border-zinc-200 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={edicao.controla}
                              onChange={(event) =>
                                atualizarEdicaoProduto(produto.id, {
                                  controla: event.target.checked,
                                })
                              }
                              className="h-5 w-5"
                            />
                            <span className="text-sm font-semibold">
                              Controlar
                            </span>
                          </label>

                          <div>
                            <p className="mb-1 text-xs font-semibold text-zinc-500">
                              Estoque atual
                            </p>

                            <div className="flex overflow-hidden rounded-xl border border-zinc-300 bg-white">
                              <button
                                type="button"
                                onClick={() => somarProduto(produto.id, -1)}
                                className="flex h-11 w-11 items-center justify-center bg-zinc-50 hover:bg-zinc-100"
                              >
                                <Minus className="h-4 w-4" />
                              </button>

                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={edicao.atual}
                                onChange={(event) =>
                                  atualizarEdicaoProduto(produto.id, {
                                    atual: event.target.value,
                                  })
                                }
                                className="h-11 w-20 border-x border-zinc-300 text-center font-bold outline-none"
                              />

                              <button
                                type="button"
                                onClick={() => somarProduto(produto.id, 1)}
                                className="flex h-11 w-11 items-center justify-center bg-zinc-50 hover:bg-zinc-100"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-end gap-2">
                            <label>
                              <p className="mb-1 text-xs font-semibold text-zinc-500">
                                Mínimo
                              </p>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={edicao.minimo}
                                onChange={(event) =>
                                  atualizarEdicaoProduto(produto.id, {
                                    minimo: event.target.value,
                                  })
                                }
                                className="h-11 w-20 rounded-xl border border-zinc-300 text-center font-bold outline-none focus:border-red-500"
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => salvarProduto(produto)}
                              disabled={salvandoProdutoId === produto.id}
                              className="flex h-11 items-center gap-2 rounded-xl bg-red-600 px-4 font-semibold text-white hover:bg-red-700 disabled:bg-zinc-400"
                            >
                              <Save className="h-4 w-4" />
                              {salvandoProdutoId === produto.id
                                ? "Salvando..."
                                : "Salvar"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            <section className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                <PackageCheck className="h-5 w-5 text-green-600" />
                <p className="mt-3 text-sm text-zinc-500">
                  Insumos ativos
                </p>
                <p className="text-3xl font-extrabold">
                  {resumoInsumos.ativos}
                </p>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <p className="mt-3 text-sm text-amber-700">
                  Estoque baixo
                </p>
                <p className="text-3xl font-extrabold text-amber-700">
                  {resumoInsumos.baixos}
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <PackageX className="h-5 w-5 text-red-600" />
                <p className="mt-3 text-sm text-red-700">
                  Sem estoque
                </p>
                <p className="text-3xl font-extrabold text-red-700">
                  {resumoInsumos.zerados}
                </p>
              </div>
            </section>

            <div className="mb-5 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={buscaInsumos}
                  onChange={(event) => setBuscaInsumos(event.target.value)}
                  placeholder="Pesquisar insumo..."
                  className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-11 pr-4 outline-none focus:border-red-500"
                />
              </div>

              <button
                type="button"
                onClick={abrirNovoInsumo}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700"
              >
                <Plus className="h-5 w-5" />
                Novo insumo
              </button>
            </div>

            {carregandoInsumos ? (
              <div className="rounded-2xl bg-white p-10 text-center text-zinc-500">
                Carregando insumos...
              </div>
            ) : insumosFiltrados.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center text-zinc-500">
                Nenhum insumo cadastrado.
              </div>
            ) : (
              <div className="space-y-3">
                {insumosFiltrados.map((insumo) => {
                  const atual = Number(insumo.estoque_atual);
                  const minimo = Number(insumo.estoque_minimo);

                  const zerado = insumo.ativo && atual <= 0;
                  const baixo =
                    insumo.ativo &&
                    atual > 0 &&
                    atual <= minimo;

                  return (
                    <section
                      key={insumo.id}
                      className={`rounded-2xl border bg-white p-4 shadow-sm ${
                        zerado
                          ? "border-red-300"
                          : baixo
                            ? "border-amber-300"
                            : "border-zinc-200"
                      }`}
                    >
                      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-bold">
                              {insumo.nome}
                            </h3>

                            {!insumo.ativo && (
                              <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-600">
                                Inativo
                              </span>
                            )}
                          </div>

                          <p className="mt-1 text-sm text-zinc-500">
                            {formatarQtd(atual)} {insumo.unidade}
                            {" • "}
                            mínimo {formatarQtd(minimo)} {insumo.unidade}
                            {" • "}
                            custo {moeda(Number(insumo.custo_unitario))}/{insumo.unidade}
                          </p>

                          {zerado ? (
                            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-red-600">
                              <PackageX className="h-4 w-4" />
                              Sem estoque
                            </p>
                          ) : baixo ? (
                            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-amber-600">
                              <AlertTriangle className="h-4 w-4" />
                              Estoque baixo
                            </p>
                          ) : (
                            <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-green-600">
                              <CheckCircle2 className="h-4 w-4" />
                              Estoque disponível
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => ajustarInsumo(insumo, -1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50"
                            title={`Retirar 1 ${insumo.unidade}`}
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <div className="min-w-24 rounded-xl bg-zinc-100 px-4 py-2.5 text-center font-bold">
                            {formatarQtd(atual)}
                          </div>

                          <button
                            type="button"
                            onClick={() => ajustarInsumo(insumo, 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50"
                            title={`Adicionar 1 ${insumo.unidade}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => abrirEditarInsumo(insumo)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Editar insumo"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => excluirInsumo(insumo)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 hover:bg-red-50"
                            title="Excluir insumo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {modalInsumoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-red-600">
                  Estoque interno
                </p>
                <h2 className="text-2xl font-bold">
                  {insumoEditando ? "Editar insumo" : "Novo insumo"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setModalInsumoAberto(false)}
                className="rounded-lg p-2 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-semibold">
                  Nome
                </span>
                <input
                  value={nomeInsumo}
                  onChange={(event) => setNomeInsumo(event.target.value)}
                  placeholder="Ex.: Muçarela"
                  className="w-full rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold">
                  Unidade
                </span>
                <select
                  value={unidadeInsumo}
                  onChange={(event) => setUnidadeInsumo(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 bg-white p-3"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="L">L</option>
                  <option value="ml">ml</option>
                  <option value="un">un</option>
                  <option value="pct">pct</option>
                  <option value="cx">cx</option>
                </select>
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold">
                  Custo por unidade
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={custoInsumo}
                  onChange={(event) => setCustoInsumo(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold">
                  Estoque atual
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={estoqueInsumo}
                  onChange={(event) => setEstoqueInsumo(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold">
                  Estoque mínimo
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={minimoInsumo}
                  onChange={(event) => setMinimoInsumo(event.target.value)}
                  className="w-full rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3">
              <input
                type="checkbox"
                checked={ativoInsumo}
                onChange={(event) => setAtivoInsumo(event.target.checked)}
                className="h-5 w-5"
              />
              <span className="font-medium">Insumo ativo</span>
            </label>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModalInsumoAberto(false)}
                className="rounded-xl border border-zinc-300 px-4 py-3 font-semibold hover:bg-zinc-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={salvarInsumo}
                disabled={salvandoInsumo}
                className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white hover:bg-red-700 disabled:bg-zinc-400"
              >
                {salvandoInsumo ? "Salvando..." : "Salvar insumo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
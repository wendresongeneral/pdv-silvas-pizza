"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  ChartColumn,
  CreditCard,
  House,
  QrCode,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type Venda = {
  id: string;
  numero: number;
  data_venda: string;
  total: number | string;
  forma_pagamento: "Dinheiro" | "Cartão" | "Pix";
};

type ItemVenda = {
  venda_id: string;
  produto_id: string;
  quantidade: number;
  valor_unitario: number | string;
  custo_unitario: number | string | null;
};

type Produto = {
  id: string;
  nome: string;
};

type PeriodoRapido = "hoje" | "7dias" | "30dias" | "mes" | "personalizado";

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function dataParaInput(data: Date) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function inicioDoDia(data: Date) {
  const nova = new Date(data);
  nova.setHours(0, 0, 0, 0);
  return nova;
}

function fimExclusivoDoDia(data: Date) {
  const nova = inicioDoDia(data);
  nova.setDate(nova.getDate() + 1);
  return nova;
}

export default function RelatorioPage() {
  const hoje = new Date();

  const [periodoRapido, setPeriodoRapido] =
    useState<PeriodoRapido>("mes");

  const [dataInicial, setDataInicial] = useState(() => {
    const inicio = new Date();
    inicio.setDate(1);
    return dataParaInput(inicio);
  });

  const [dataFinal, setDataFinal] = useState(() =>
    dataParaInput(new Date()),
  );

  const [vendas, setVendas] = useState<Venda[]>([]);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");

  function aplicarPeriodo(periodo: PeriodoRapido) {
    setPeriodoRapido(periodo);

    const agora = new Date();
    const final = dataParaInput(agora);

    if (periodo === "hoje") {
      setDataInicial(final);
      setDataFinal(final);
      return;
    }

    if (periodo === "7dias") {
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 6);
      setDataInicial(dataParaInput(inicio));
      setDataFinal(final);
      return;
    }

    if (periodo === "30dias") {
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() - 29);
      setDataInicial(dataParaInput(inicio));
      setDataFinal(final);
      return;
    }

    if (periodo === "mes") {
      const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
      setDataInicial(dataParaInput(inicio));
      setDataFinal(final);
    }
  }

  async function carregarRelatorio() {
    setCarregando(true);
    setErro("");

    try {
      const inicio = inicioDoDia(new Date(`${dataInicial}T00:00:00`));
      const fim = fimExclusivoDoDia(new Date(`${dataFinal}T00:00:00`));

      const { data: vendasData, error: vendasError } = await supabase
        .from("vendas")
        .select("id, numero, data_venda, total, forma_pagamento")
        .gte("data_venda", inicio.toISOString())
        .lt("data_venda", fim.toISOString())
        .order("data_venda", { ascending: false });

      if (vendasError) throw vendasError;

      const vendasPeriodo = (vendasData ?? []) as Venda[];
      setVendas(vendasPeriodo);

      const { data: produtosData, error: produtosError } = await supabase
        .from("produtos")
        .select("id, nome")
        .order("nome");

      if (produtosError) throw produtosError;
      setProdutos((produtosData ?? []) as Produto[]);

      if (vendasPeriodo.length === 0) {
        setItens([]);
        return;
      }

      const vendaIds = vendasPeriodo.map((venda) => venda.id);

      const { data: itensData, error: itensError } = await supabase
        .from("itens_venda")
        .select(
          "venda_id, produto_id, quantidade, valor_unitario, custo_unitario",
        )
        .in("venda_id", vendaIds);

      if (itensError) throw itensError;

      setItens((itensData ?? []) as ItemVenda[]);
    } catch (error) {
      console.error("Erro ao carregar relatório:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar o relatório.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarRelatorio();
  }, [dataInicial, dataFinal]);

  const resumo = useMemo(() => {
    const faturamento = vendas.reduce(
      (soma, venda) => soma + Number(venda.total ?? 0),
      0,
    );

    const custo = itens.reduce(
      (soma, item) =>
        soma +
        Number(item.custo_unitario ?? 0) *
          Number(item.quantidade ?? 0),
      0,
    );

    const lucro = faturamento - custo;
    const margem = faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    const dinheiro = vendas
      .filter((venda) => venda.forma_pagamento === "Dinheiro")
      .reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);

    const cartao = vendas
      .filter((venda) => venda.forma_pagamento === "Cartão")
      .reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);

    const pix = vendas
      .filter((venda) => venda.forma_pagamento === "Pix")
      .reduce((soma, venda) => soma + Number(venda.total ?? 0), 0);

    const ticketMedio =
      vendas.length > 0 ? faturamento / vendas.length : 0;

    return {
      faturamento,
      custo,
      lucro,
      margem,
      dinheiro,
      cartao,
      pix,
      ticketMedio,
      quantidadeVendas: vendas.length,
    };
  }, [vendas, itens]);

  const rankingProdutos = useMemo(() => {
    const mapa = new Map<
      string,
      {
        produtoId: string;
        quantidade: number;
        faturamento: number;
      }
    >();

    for (const item of itens) {
      const atual = mapa.get(item.produto_id) ?? {
        produtoId: item.produto_id,
        quantidade: 0,
        faturamento: 0,
      };

      atual.quantidade += Number(item.quantidade ?? 0);
      atual.faturamento +=
        Number(item.valor_unitario ?? 0) *
        Number(item.quantidade ?? 0);

      mapa.set(item.produto_id, atual);
    }

    return Array.from(mapa.values())
      .map((item) => ({
        ...item,
        nome:
          produtos.find((produto) => produto.id === item.produtoId)?.nome ??
          "Produto",
      }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [itens, produtos]);

  const vendasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) return vendas;

    return vendas.filter((venda) => {
      return (
        String(venda.numero).includes(termo) ||
        venda.forma_pagamento.toLowerCase().includes(termo)
      );
    });
  }, [vendas, busca]);

  const cards = [
    {
      titulo: "Faturamento",
      valor: moeda(resumo.faturamento),
      detalhe: `${resumo.quantidadeVendas} venda(s)`,
      icone: WalletCards,
    },
    {
      titulo: "Lucro bruto",
      valor: moeda(resumo.lucro),
      detalhe: `${resumo.margem.toFixed(1)}% de margem`,
      icone: TrendingUp,
    },
    {
      titulo: "Custo vendido",
      valor: moeda(resumo.custo),
      detalhe: "Custo histórico dos itens",
      icone: Package,
    },
    {
      titulo: "Ticket médio",
      valor: moeda(resumo.ticketMedio),
      detalhe: "Média por venda",
      icone: ReceiptText,
    },
  ];

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>

            <h1 className="text-3xl font-bold">Relatórios</h1>

            <p className="mt-1 text-sm text-zinc-500">
              Acompanhe vendas, custos e resultados por período.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={carregarRelatorio}
              disabled={carregando}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw
                className={`h-5 w-5 ${carregando ? "animate-spin" : ""}`}
              />
            </button>

            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50"
              title="Menu principal"
            >
              <House className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <section className="mb-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              ["hoje", "Hoje"],
              ["7dias", "7 dias"],
              ["30dias", "30 dias"],
              ["mes", "Este mês"],
            ].map(([valor, texto]) => (
              <button
                key={valor}
                type="button"
                onClick={() => aplicarPeriodo(valor as PeriodoRapido)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  periodoRapido === valor
                    ? "bg-red-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                Data inicial
              </span>

              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

                <input
                  type="date"
                  value={dataInicial}
                  onChange={(event) => {
                    setPeriodoRapido("personalizado");
                    setDataInicial(event.target.value);
                  }}
                  className="w-full rounded-xl border border-zinc-300 py-3 pl-10 pr-3 outline-none focus:border-red-500"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-zinc-600">
                Data final
              </span>

              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

                <input
                  type="date"
                  value={dataFinal}
                  onChange={(event) => {
                    setPeriodoRapido("personalizado");
                    setDataFinal(event.target.value);
                  }}
                  className="w-full rounded-xl border border-zinc-300 py-3 pl-10 pr-3 outline-none focus:border-red-500"
                />
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={carregarRelatorio}
                className="w-full rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 md:w-auto"
              >
                Aplicar
              </button>
            </div>
          </div>
        </section>

        {erro && (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            {erro}
          </div>
        )}

        <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => {
            const Icone = card.icone;

            return (
              <div
                key={card.titulo}
                className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <Icone className="h-5 w-5" />
                </div>

                <p className="text-sm font-medium text-zinc-500">
                  {card.titulo}
                </p>

                <p className="mt-1 text-2xl font-extrabold">
                  {carregando ? "—" : card.valor}
                </p>

                <p className="mt-2 text-xs text-zinc-400">
                  {card.detalhe}
                </p>
              </div>
            );
          })}
        </section>

        <section className="mb-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <Banknote className="h-5 w-5 text-green-700" />

              <div>
                <p className="font-bold">Dinheiro</p>
                <p className="text-sm text-zinc-500">
                  Total recebido no período
                </p>
              </div>
            </div>

            <p className="text-3xl font-extrabold text-green-700">
              {carregando ? "—" : moeda(resumo.dinheiro)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-blue-700" />

              <div>
                <p className="font-bold">Cartão</p>
                <p className="text-sm text-zinc-500">
                  Total recebido no período
                </p>
              </div>
            </div>

            <p className="text-3xl font-extrabold text-blue-700">
              {carregando ? "—" : moeda(resumo.cartao)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <QrCode className="h-5 w-5 text-teal-700" />

              <div>
                <p className="font-bold">Pix</p>
                <p className="text-sm text-zinc-500">
                  Total recebido no período
                </p>
              </div>
            </div>

            <p className="text-3xl font-extrabold text-teal-700">
              {carregando ? "—" : moeda(resumo.pix)}
            </p>
          </div>

        </section>

        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />

                <input
                  type="search"
                  value={busca}
                  onChange={(event) => setBusca(event.target.value)}
                  placeholder="Pesquisar venda ou pagamento..."
                  className="w-full rounded-xl border border-zinc-300 py-3 pl-10 pr-4 outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="border-b border-zinc-200 p-5">
              <div className="flex items-center gap-2">
                <ChartColumn className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-bold">Vendas do período</h2>
              </div>
            </div>

            {carregando ? (
              <div className="p-10 text-center text-zinc-500">
                Carregando relatório...
              </div>
            ) : vendasFiltradas.length === 0 ? (
              <div className="p-10 text-center text-zinc-500">
                Nenhuma venda encontrada.
              </div>
            ) : (
              <div className="max-h-[530px] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-zinc-50">
                    <tr className="border-b">
                      <th className="p-4 text-left">Venda</th>
                      <th className="p-4 text-left">Data</th>
                      <th className="p-4 text-left">Pagamento</th>
                      <th className="p-4 text-right">Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {vendasFiltradas.map((venda) => (
                      <tr
                        key={venda.id}
                        className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                      >
                        <td className="p-4 font-semibold">
                          #{venda.numero}
                        </td>

                        <td className="p-4 text-zinc-600">
                          {new Date(venda.data_venda).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        <td className="p-4">
                          {venda.forma_pagamento}
                        </td>

                        <td className="p-4 text-right font-bold">
                          {moeda(Number(venda.total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 p-5">
              <div className="flex items-center gap-2">
                <Package className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-bold">
                  Produtos mais vendidos
                </h2>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Ranking por quantidade
              </p>
            </div>

            {carregando ? (
              <div className="p-10 text-center text-zinc-500">
                Carregando ranking...
              </div>
            ) : rankingProdutos.length === 0 ? (
              <div className="p-10 text-center text-zinc-500">
                Sem produtos vendidos neste período.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {rankingProdutos.map((produto, index) => (
                  <div
                    key={produto.produtoId}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0
                            ? "bg-amber-100 text-amber-700"
                            : index === 1
                              ? "bg-zinc-200 text-zinc-700"
                              : index === 2
                                ? "bg-orange-100 text-orange-700"
                                : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          {produto.nome}
                        </p>

                        <p className="text-sm text-zinc-500">
                          {produto.quantidade} unidade(s)
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 font-bold">
                      {moeda(produto.faturamento)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
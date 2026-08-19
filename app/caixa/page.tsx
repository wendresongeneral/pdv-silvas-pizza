"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  House,
  QrCode,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
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
  quantidade: number;
  custo_unitario: number | string | null;
};

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function inicioEFimDoDia() {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 1);

  return {
    inicio: inicio.toISOString(),
    fim: fim.toISOString(),
  };
}

export default function CaixaPage() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [itens, setItens] = useState<ItemVenda[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  async function carregarCaixa() {
    setCarregando(true);
    setErro("");

    try {
      const { inicio, fim } = inicioEFimDoDia();

      const { data: vendasData, error: vendasError } = await supabase
        .from("vendas")
        .select("id, numero, data_venda, total, forma_pagamento")
        .gte("data_venda", inicio)
        .lt("data_venda", fim)
        .order("data_venda", { ascending: false });

      if (vendasError) {
        throw vendasError;
      }

      const vendasDoDia = (vendasData ?? []) as Venda[];
      setVendas(vendasDoDia);

      if (vendasDoDia.length === 0) {
        setItens([]);
        return;
      }

      const ids = vendasDoDia.map((venda) => venda.id);

      const { data: itensData, error: itensError } = await supabase
        .from("itens_venda")
        .select("venda_id, quantidade, custo_unitario")
        .in("venda_id", ids);

      if (itensError) {
        throw itensError;
      }

      setItens((itensData ?? []) as ItemVenda[]);
    } catch (error) {
      console.error("Erro ao carregar caixa:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os dados do caixa.",
      );
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarCaixa();
  }, []);

  const resumo = useMemo(() => {
    const faturamento = vendas.reduce(
      (soma, venda) => soma + Number(venda.total ?? 0),
      0,
    );

    const dinheiro = vendas
      .filter((venda) => venda.forma_pagamento === "Dinheiro")
      .reduce(
        (soma, venda) => soma + Number(venda.total ?? 0),
        0,
      );

    const cartao = vendas
      .filter((venda) => venda.forma_pagamento === "Cartão")
      .reduce(
        (soma, venda) => soma + Number(venda.total ?? 0),
        0,
      );

    const pix = vendas
      .filter((venda) => venda.forma_pagamento === "Pix")
      .reduce(
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

    const margem =
      faturamento > 0 ? (lucro / faturamento) * 100 : 0;

    const ticketMedio =
      vendas.length > 0 ? faturamento / vendas.length : 0;

    return {
      faturamento,
      dinheiro,
      cartao,
      pix,
      custo,
      lucro,
      margem,
      ticketMedio,
      quantidadeVendas: vendas.length,
    };
  }, [vendas, itens]);

  const cards = [
    {
      titulo: "Faturamento",
      valor: moeda(resumo.faturamento),
      detalhe: "Vendas de hoje",
      icone: CircleDollarSign,
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
      detalhe: "Custo dos produtos vendidos",
      icone: ShoppingBag,
    },
    {
      titulo: "Ticket médio",
      valor: moeda(resumo.ticketMedio),
      detalhe: `${resumo.quantidadeVendas} venda(s)`,
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

            <h1 className="text-3xl font-bold">Caixa</h1>

            <p className="mt-1 text-sm text-zinc-500">
              Resumo financeiro do dia
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={carregarCaixa}
              disabled={carregando}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-50"
              title="Atualizar"
            >
              <RefreshCw
                className={`h-5 w-5 ${
                  carregando ? "animate-spin" : ""
                }`}
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

        {erro && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <Banknote className="h-5 w-5" />
              </div>

              <div>
                <p className="font-bold">Dinheiro</p>
                <p className="text-sm text-zinc-500">
                  Recebimentos de hoje
                </p>
              </div>
            </div>

            <p className="text-3xl font-extrabold text-green-700">
              {carregando ? "—" : moeda(resumo.dinheiro)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <CreditCard className="h-5 w-5" />
              </div>

              <div>
                <p className="font-bold">Cartão</p>
                <p className="text-sm text-zinc-500">
                  Recebimentos de hoje
                </p>
              </div>
            </div>

            <p className="text-3xl font-extrabold text-blue-700">
              {carregando ? "—" : moeda(resumo.cartao)}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <QrCode className="h-5 w-5" />
              </div>

              <div>
                <p className="font-bold">Pix</p>
                <p className="text-sm text-zinc-500">
                  Recebimentos de hoje
                </p>
              </div>
            </div>

            <p className="text-3xl font-extrabold text-teal-700">
              {carregando ? "—" : moeda(resumo.pix)}
            </p>
          </div>

        </section>

        <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-200 p-5">
            <div>
              <div className="flex items-center gap-2">
                <ChartNoAxesCombined className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-bold">
                  Vendas de hoje
                </h2>
              </div>

              <p className="mt-1 text-sm text-zinc-500">
                Últimas vendas realizadas
              </p>
            </div>

            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-zinc-600">
              {resumo.quantidadeVendas}
            </span>
          </div>

          {carregando ? (
            <div className="p-10 text-center text-zinc-500">
              Carregando caixa...
            </div>
          ) : vendas.length === 0 ? (
            <div className="p-10 text-center">
              <ReceiptText className="mx-auto h-10 w-10 text-zinc-300" />

              <p className="mt-3 font-semibold">
                Nenhuma venda hoje
              </p>

              <p className="mt-1 text-sm text-zinc-500">
                As vendas realizadas no PDV aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50">
                  <tr className="border-b border-zinc-200">
                    <th className="p-4 text-left">Venda</th>
                    <th className="p-4 text-left">Horário</th>
                    <th className="p-4 text-left">Pagamento</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>

                <tbody>
                  {vendas.map((venda) => (
                    <tr
                      key={venda.id}
                      className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50"
                    >
                      <td className="p-4 font-semibold">
                        #{venda.numero}
                      </td>

                      <td className="p-4 text-zinc-600">
                        {new Date(
                          venda.data_venda,
                        ).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            venda.forma_pagamento === "Dinheiro"
                              ? "bg-green-100 text-green-700"
                              : venda.forma_pagamento === "Pix"
                                ? "bg-teal-100 text-teal-700"
                                : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {venda.forma_pagamento}
                        </span>
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
      </div>
    </main>
  );
}
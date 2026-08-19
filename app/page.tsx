"use client";

import Link from "next/link";
import {
  ShoppingCart,
  Package,
  Boxes,
  Wallet,
  ChartColumn,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

const cards = [
  {
    titulo: "PDV",
    descricao: "Realizar vendas",
    href: "/pdv",
    icon: ShoppingCart,
    destaque: true,
  },
  {
    titulo: "Comandas",
    descricao: "Pedidos das mesas",
    href: "/comandas",
    icon: ClipboardList,
  },
  {
    titulo: "Produtos",
    descricao: "Produtos e adicionais",
    href: "/produtos",
    icon: Package,
  },
  {
    titulo: "Estoque",
    descricao: "Controle de insumos",
    href: "/estoque",
    icon: Boxes,
  },
  {
    titulo: "Caixa",
    descricao: "Abertura e fechamento",
    href: "/caixa",
    icon: Wallet,
  },
  {
    titulo: "Relatórios",
    descricao: "Consultar vendas",
    href: "/relatorio",
    icon: ChartColumn,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-900 md:px-8">
      <div className="mx-auto max-w-6xl">

        {/* CABEÇALHO */}
        <header className="mb-10 text-center">
          <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-xl p-2">
            <Image
              src="/logo.jpg"
              alt="Silvas Pizza Frita"
              width={110}
              height={110}
              className="rounded-full object-cover"
              priority
            />
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            Silvas&apos; Pizza Frita
          </h1>

          <p className="mt-2 text-zinc-500">
            Sistema de Gestão
          </p>
        </header>

        {/* PDV EM DESTAQUE */}
        <Link
          href="/pdv"
          className="group mb-5 flex items-center justify-between rounded-3xl bg-red-600 p-6 text-white shadow-lg transition hover:-translate-y-1 hover:bg-red-700 hover:shadow-xl"
        >
          <div className="flex items-center gap-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15">
              <ShoppingCart className="h-7 w-7" />
            </div>

            <div>
              <p className="text-sm font-medium text-red-100">
                Atendimento
              </p>

              <h2 className="text-2xl font-bold">
                Abrir PDV
              </h2>

              <p className="mt-1 text-sm text-red-100">
                Iniciar uma nova venda
              </p>
            </div>
          </div>

          <ArrowRight className="h-6 w-6 transition group-hover:translate-x-1" />
        </Link>

        {/* OUTRAS ÁREAS */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards
            .filter((card) => !card.destaque)
            .map((card) => {
              const Icon = card.icon;

              return (
                <Link
                  key={card.href}
                  href={card.href}
                  className="group rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-md"
                >
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 transition group-hover:bg-red-50 group-hover:text-red-600">
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        {card.titulo}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {card.descricao}
                      </p>
                    </div>

                    <ArrowRight className="h-4 w-4 text-zinc-300 transition group-hover:translate-x-1 group-hover:text-red-600" />
                  </div>
                </Link>
              );
            })}
        </div>

        {/* RODAPÉ */}
        <p className="mt-10 text-center text-xs text-zinc-400">
          Silvas&apos; Pizza Frita • Sistema interno
        </p>
      </div>
    </main>
  );
}
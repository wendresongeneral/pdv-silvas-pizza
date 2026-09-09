"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChefHat,
  Clock3,
  CreditCard,
  House,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  ReceiptText,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Mesa = {
  id: string;
  numero: number;
  nome: string | null;
};

type Comanda = {
  id: string;
  numero: number;
  mesa_id: string | null;
  cliente_nome: string | null;
  total: number | string;
  status: string;
};

type Pedido = {
  id: string;
  comanda_id: string;
  criado_em: string;
  status: "Novo" | "Em preparo" | "Entregue" | "Cancelado";
  observacao: string | null;
  subtotal: number | string;
};

type Item = {
  id: string;
  pedido_id: string;
  nome: string;
  quantidade: number;
  valor_unitario: number | string;
};

type Extra = {
  id: string;
  item_id: string;
  nome: string;
  valor: number | string;
};

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export default function ComandasPage() {
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [itens, setItens] = useState<Item[]>([]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [alterando, setAlterando] = useState<string | null>(null);
  const [fechando, setFechando] = useState<string | null>(null);
  const [abrindoComanda, setAbrindoComanda] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [excluindoPedido, setExcluindoPedido] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);

    const [
      mesasResp,
      comandasResp,
      pedidosResp,
    ] = await Promise.all([
      supabase
        .from("mesas")
        .select("id, numero, nome")
        .eq("ativo", true)
        .order("numero"),

      supabase
        .from("comandas")
        .select("id, numero, mesa_id, cliente_nome, total, status")
        .eq("status", "Aberta")
        .order("aberta_em"),

      supabase
        .from("comanda_pedidos")
        .select(
          "id, comanda_id, criado_em, status, observacao, subtotal",
        )
        .order("criado_em", { ascending: false }),
    ]);

    if (
      mesasResp.error ||
      comandasResp.error ||
      pedidosResp.error
    ) {
      console.error(
        mesasResp.error ||
          comandasResp.error ||
          pedidosResp.error,
      );
      setCarregando(false);
      return;
    }

    const comandasAbertas = comandasResp.data ?? [];
    const idsComandas = new Set(
      comandasAbertas.map((c) => c.id),
    );

    const pedidosAbertos = (pedidosResp.data ?? []).filter(
      (p) => idsComandas.has(p.comanda_id),
    );

    const idsPedidos = pedidosAbertos.map((p) => p.id);

    let itensData: Item[] = [];
    let extrasData: Extra[] = [];

    if (idsPedidos.length > 0) {
      const itensResp = await supabase
        .from("comanda_itens")
        .select(
          "id, pedido_id, nome, quantidade, valor_unitario",
        )
        .in("pedido_id", idsPedidos);

      if (!itensResp.error) {
        itensData = itensResp.data ?? [];

        const idsItens = itensData.map((i) => i.id);

        if (idsItens.length > 0) {
          const extrasResp = await supabase
            .from("comanda_item_adicionais")
            .select("id, item_id, nome, valor")
            .in("item_id", idsItens);

          if (!extrasResp.error) {
            extrasData = extrasResp.data ?? [];
          }
        }
      }
    }

    setMesas(mesasResp.data ?? []);
    setComandas(comandasAbertas);
    setPedidos(pedidosAbertos as Pedido[]);
    setItens(itensData);
    setExtras(extrasData);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();

    const canal = supabase
      .channel("comandas-tempo-real")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_pedidos",
        },
        carregar,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comanda_itens",
        },
        carregar,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comandas",
        },
        carregar,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const dadosPorComanda = useMemo(() => {
    return comandas
      .map((comanda) => {
        const mesa = mesas.find(
          (m) => m.id === comanda.mesa_id,
        );

        const pedidosComanda = pedidos
          .filter((p) => p.comanda_id === comanda.id)
          .sort(
            (a, b) =>
              new Date(b.criado_em).getTime() -
              new Date(a.criado_em).getTime(),
          );

        return {
          comanda,
          mesa,
          pedidos: pedidosComanda,
        };
      })
      .sort(
        (a, b) => a.comanda.numero - b.comanda.numero,
      );
  }, [comandas, mesas, pedidos]);

  const novos = pedidos.filter(
    (p) => p.status === "Novo",
  ).length;

  async function abrirNovaComanda() {
    const nome = clienteNome.trim();

    if (!nome) {
      alert("Informe o nome do cliente.");
      return;
    }

    setAbrindoComanda(true);

    const { data, error } = await supabase.rpc(
      "abrir_comanda",
      {
        p_cliente_nome: nome,
      },
    );

    setAbrindoComanda(false);

    if (error) {
      alert(error.message);
      return;
    }

    setClienteNome("");

    alert(
      `Comanda #${data?.numero} aberta para ${data?.cliente_nome}.`,
    );

    await carregar();
  }

  async function mudarStatus(
    pedidoId: string,
    status: Pedido["status"],
  ) {
    setAlterando(pedidoId);

    const { error } = await supabase.rpc(
      "alterar_status_pedido_comanda",
      {
        p_pedido_id: pedidoId,
        p_status: status,
      },
    );

    if (error) {
      alert(error.message);
    }

    setAlterando(null);
    await carregar();
  }

  async function excluirPedido(pedido: Pedido) {
    const confirmar = window.confirm(
      `Excluir este pedido da comanda?\n\nValor: ${moeda(
        Number(pedido.subtotal),
      )}\n\nEssa ação remove o pedido e seus itens definitivamente.`,
    );

    if (!confirmar) return;

    setExcluindoPedido(pedido.id);

    const { data, error } = await supabase.rpc(
      "excluir_pedido_comanda",
      {
        p_pedido_id: pedido.id,
      },
    );

    setExcluindoPedido(null);

    if (error) {
      alert(error.message);
      return;
    }

    alert(
      `Pedido excluído. Novo total da comanda: ${moeda(
        Number(data?.total_comanda ?? 0),
      )}.`,
    );

    await carregar();
  }

  function imprimirComanda(
    comanda: Comanda,
    forma: "Dinheiro" | "Cartão" | "Pix",
    numeroVenda: number | string,
    totalFinal: number,
  ) {
    const pedidosComanda = pedidos
      .filter(
        (pedido) =>
          pedido.comanda_id === comanda.id &&
          pedido.status !== "Cancelado",
      )
      .sort(
        (a, b) =>
          new Date(a.criado_em).getTime() -
          new Date(b.criado_em).getTime(),
      );

    const linhasItens = pedidosComanda
      .flatMap((pedido) =>
        itens
          .filter((item) => item.pedido_id === pedido.id)
          .map((item) => {
            const extrasItem = extras.filter(
              (extra) => extra.item_id === item.id,
            );

            const extrasHtml = extrasItem
              .map(
                (extra) =>
                  `<div class="extra">+ ${extra.nome}</div>`,
              )
              .join("");

            const subtotalItem =
              Number(item.valor_unitario) *
              Number(item.quantidade);

            return `
              <div class="item">
                <div class="linha">
                  <span>${item.quantidade}x ${item.nome}</span>
                  <strong>${moeda(subtotalItem)}</strong>
                </div>
                ${extrasHtml}
              </div>
            `;
          }),
      )
      .join("");

    const janela = window.open(
      "",
      "_blank",
      "width=420,height=720",
    );

    if (!janela) {
      alert(
        "O navegador bloqueou a janela de impressão. Permita pop-ups para este site.",
      );
      return;
    }

    const dataHora = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Comanda #${comanda.numero}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 4mm;
            }

            * {
              box-sizing: border-box;
            }

            body {
              width: 72mm;
              margin: 0 auto;
              color: #000;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.35;
            }

            .centro {
              text-align: center;
            }

            h1 {
              margin: 0;
              font-size: 18px;
            }

            .subtitulo {
              margin-top: 3px;
              font-size: 11px;
            }

            .separador {
              margin: 10px 0;
              border-top: 1px dashed #000;
            }

            .linha {
              display: flex;
              justify-content: space-between;
              gap: 10px;
            }

            .item {
              margin: 7px 0;
            }

            .extra {
              margin-left: 12px;
              font-size: 11px;
            }

            .total {
              margin-top: 8px;
              font-size: 17px;
              font-weight: 700;
            }

            .rodape {
              margin-top: 14px;
              text-align: center;
              font-size: 10px;
            }

            @media print {
              body {
                width: auto;
              }
            }
          </style>
        </head>

        <body>
          <div class="centro">
            <h1>Silvas' Pizza Frita</h1>
            <div class="subtitulo">COMPROVANTE DA COMANDA</div>
          </div>

          <div class="separador"></div>

          <div><strong>Comanda:</strong> #${comanda.numero}</div>
          <div><strong>Cliente:</strong> ${
            comanda.cliente_nome || "Cliente sem nome"
          }</div>
          <div><strong>Venda:</strong> #${numeroVenda}</div>
          <div><strong>Data:</strong> ${dataHora}</div>

          <div class="separador"></div>

          ${linhasItens || "<div>Nenhum item.</div>"}

          <div class="separador"></div>

          <div class="linha">
            <span>Pagamento</span>
            <strong>${forma}</strong>
          </div>

          <div class="linha total">
            <span>TOTAL</span>
            <span>${moeda(totalFinal)}</span>
          </div>

          <div class="separador"></div>

          <div class="rodape">
            Obrigado pela preferência!
          </div>

          <script>
            window.onload = function () {
              window.print();
            };

            window.onafterprint = function () {
              window.close();
            };
          </script>
        </body>
      </html>
    `);

    janela.document.close();
  }

  async function fecharComanda(
    comandaId: string,
    forma: "Dinheiro" | "Cartão" | "Pix",
  ) {
    const comanda = comandas.find(
      (item) => item.id === comandaId,
    );

    if (!comanda) {
      alert("Comanda não encontrada.");
      return;
    }

    const confirmar = window.confirm(
      `Fechar a Comanda #${comanda.numero} em ${forma}?`,
    );

    if (!confirmar) return;

    setFechando(comandaId);

    const { data, error } = await supabase.rpc(
      "fechar_comanda",
      {
        p_comanda_id: comandaId,
        p_forma_pagamento: forma,
      },
    );

    setFechando(null);

    if (error) {
      alert(error.message);
      return;
    }

    const imprimir = window.confirm(
      `Comanda fechada com sucesso.\n\nVenda #${data?.numero_venda} - ${moeda(
        Number(data?.total ?? 0),
      )}\n\nDeseja imprimir a comanda?`,
    );

    if (imprimir) {
      imprimirComanda(
        comanda,
        forma,
        data?.numero_venda ?? "",
        Number(data?.total ?? comanda.total ?? 0),
      );
    }

    await carregar();
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>

            <h1 className="text-3xl font-bold">Comandas</h1>

            <p className="mt-1 text-sm text-zinc-500">
              Acompanhe comandas e pedidos em tempo real.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={carregar}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white"
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
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white"
              title="Menu"
            >
              <House className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <section className="mb-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Nova comanda</h2>
              <p className="text-sm text-zinc-500">
                Abra uma nova comanda para o cliente.
              </p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-zinc-700">
                Nome do cliente
              </span>
              <input
                type="text"
                value={clienteNome}
                onChange={(event) => setClienteNome(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !abrindoComanda) {
                    abrirNovaComanda();
                  }
                }}
                maxLength={80}
                placeholder="Ex.: João"
                className="h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
              />
            </label>

            <button
              type="button"
              onClick={abrirNovaComanda}
              disabled={abrindoComanda}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {abrindoComanda ? "Abrindo..." : "Abrir comanda"}
            </button>
          </div>
        </section>

        {novos > 0 && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
            <Clock3 className="h-6 w-6" />
            <div>
              <p className="font-bold">
                {novos} novo(s) pedido(s)
              </p>
              <p className="text-sm">
                Confira as comandas abaixo.
              </p>
            </div>
          </div>
        )}

        {carregando && comandas.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-zinc-500 shadow-sm">
            Carregando comandas...
          </div>
        ) : dadosPorComanda.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <UtensilsCrossed className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-3 font-semibold">
              Nenhuma comanda aberta
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Quando uma comanda for aberta, ela aparecerá aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {dadosPorComanda.map(
              ({ comanda, mesa, pedidos: pedidosMesa }) => {
                const possuiPendentes = pedidosMesa.some(
                  (p) =>
                    p.status === "Novo" ||
                    p.status === "Em preparo",
                );

                return (
                  <section
                    key={comanda.id}
                    className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-zinc-200 p-5">
                      <div>
                        <p className="text-sm font-semibold text-red-600">
                          Comanda #{comanda.numero}
                        </p>
                        <h2 className="text-2xl font-extrabold">
                          {comanda.cliente_nome || "Cliente sem nome"}
                        </h2>
                        {mesa && (
                          <p className="mt-0.5 text-sm font-medium text-zinc-500">
                            {mesa.nome || `Mesa ${mesa.numero}`}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-zinc-500">
                          Total
                        </p>
                        <p className="text-2xl font-extrabold text-red-600">
                          {moeda(Number(comanda.total))}
                        </p>
                      </div>
                    </div>

                    <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
                      {pedidosMesa.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
                          <p className="font-semibold text-zinc-700">
                            Nenhum pedido nesta comanda ainda.
                          </p>
                          <p className="mt-1 text-sm text-zinc-500">
                            A comanda está aberta e pronta para receber pedidos.
                          </p>
                        </div>
                      )}

                      {pedidosMesa.map((pedido) => {
                        const itensPedido = itens.filter(
                          (item) =>
                            item.pedido_id === pedido.id,
                        );

                        return (
                          <div
                            key={pedido.id}
                            className={`rounded-2xl border p-4 ${
                              pedido.status === "Novo"
                                ? "border-red-300 bg-red-50"
                                : pedido.status === "Em preparo"
                                  ? "border-amber-300 bg-amber-50"
                                  : pedido.status === "Cancelado"
                                    ? "border-zinc-300 bg-zinc-100 opacity-75"
                                    : "border-green-200 bg-green-50"
                            }`}
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                  {new Date(
                                    pedido.criado_em,
                                  ).toLocaleTimeString(
                                    "pt-BR",
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </p>

                                <p className="font-bold">
                                  {pedido.status}
                                </p>
                              </div>

                              <p className="font-bold">
                                {moeda(
                                  Number(pedido.subtotal),
                                )}
                              </p>
                            </div>

                            <div className="space-y-2">
                              {itensPedido.map((item) => {
                                const extrasItem =
                                  extras.filter(
                                    (extra) =>
                                      extra.item_id === item.id,
                                  );

                                return (
                                  <div key={item.id}>
                                    <p className="font-semibold">
                                      {item.quantidade}x{" "}
                                      {item.nome}
                                    </p>

                                    {extrasItem.map((extra) => (
                                      <p
                                        key={extra.id}
                                        className="ml-4 text-sm text-green-700"
                                      >
                                        + {extra.nome}
                                      </p>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>

                            {pedido.observacao && (
                              <div className="mt-3 rounded-xl bg-white/70 p-3 text-sm">
                                <strong>Obs.:</strong>{" "}
                                {pedido.observacao}
                              </div>
                            )}

                            <div className="mt-4 flex flex-wrap gap-2">
                              {pedido.status === "Novo" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    mudarStatus(
                                      pedido.id,
                                      "Em preparo",
                                    )
                                  }
                                  disabled={
                                    alterando === pedido.id
                                  }
                                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white"
                                >
                                  <ChefHat className="h-4 w-4" />
                                  Em preparo
                                </button>
                              )}

                              {pedido.status ===
                                "Em preparo" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    mudarStatus(
                                      pedido.id,
                                      "Entregue",
                                    )
                                  }
                                  disabled={
                                    alterando === pedido.id
                                  }
                                  className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                  Entregue
                                </button>
                              )}

                              {pedido.status !== "Entregue" &&
                                pedido.status !== "Cancelado" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      mudarStatus(
                                        pedido.id,
                                        "Cancelado",
                                      )
                                    }
                                    disabled={
                                      alterando === pedido.id
                                    }
                                    className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600"
                                  >
                                    Cancelar pedido
                                  </button>
                                )}

                              {pedido.status === "Cancelado" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    mudarStatus(
                                      pedido.id,
                                      "Novo",
                                    )
                                  }
                                  disabled={
                                    alterando === pedido.id
                                  }
                                  className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700"
                                >
                                  Restaurar pedido
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => excluirPedido(pedido)}
                                disabled={
                                  excluindoPedido === pedido.id ||
                                  alterando === pedido.id
                                }
                                className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                {excluindoPedido === pedido.id
                                  ? "Excluindo..."
                                  : "Excluir"}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border-t border-zinc-200 bg-zinc-50 p-4">
                      {possuiPendentes ? (
                        <p className="text-center text-sm text-zinc-500">
                          Entregue todos os pedidos antes de fechar a comanda.
                        </p>
                      ) : (
                        <div>
                          <div className="mb-3 flex items-center justify-center gap-2 text-sm font-semibold">
                            <Printer className="h-4 w-4 text-zinc-500" />
                            <span>Fechar comanda</span>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                fecharComanda(
                                  comanda.id,
                                  "Dinheiro",
                                )
                              }
                              disabled={
                                fechando === comanda.id
                              }
                              className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-3 font-semibold text-green-700"
                            >
                              <ReceiptText className="h-4 w-4" />
                              Dinheiro
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                fecharComanda(
                                  comanda.id,
                                  "Cartão",
                                )
                              }
                              disabled={
                                fechando === comanda.id
                              }
                              className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-3 font-semibold text-blue-700"
                            >
                              <CreditCard className="h-4 w-4" />
                              Cartão
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                fecharComanda(
                                  comanda.id,
                                  "Pix",
                                )
                              }
                              disabled={
                                fechando === comanda.id
                              }
                              className="flex items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-3 font-semibold text-teal-700"
                            >
                              <QrCode className="h-4 w-4" />
                              Pix
                            </button>

                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                );
              },
            )}
          </div>
        )}
      </div>
    </main>
  );
}
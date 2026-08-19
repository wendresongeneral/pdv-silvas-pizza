import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function clienteSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase não está configurado.");
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type Contexto = {
  params: Promise<{
    mesa: string;
  }>;
};

export async function GET(
  _request: NextRequest,
  { params }: Contexto,
) {
  const { mesa } = await params;
  const numeroMesa = Number(mesa);

  if (!Number.isInteger(numeroMesa) || numeroMesa <= 0) {
    return NextResponse.json(
      { erro: "Mesa inválida." },
      { status: 400 },
    );
  }

  try {
    const supabase = clienteSupabase();

    const { data: mesaData, error: mesaError } = await supabase
      .from("mesas")
      .select("id, numero, nome, ativo")
      .eq("numero", numeroMesa)
      .eq("ativo", true)
      .maybeSingle();

    if (mesaError) throw mesaError;

    if (!mesaData) {
      return NextResponse.json(
        { erro: "Mesa não encontrada ou inativa." },
        { status: 404 },
      );
    }

    const [
      categoriasResp,
      produtosResp,
      adicionaisResp,
      vinculosResp,
      comandaResp,
    ] = await Promise.all([
      supabase
        .from("categorias")
        .select("id, nome, permite_adicionais")
        .order("nome"),

      supabase
        .from("produtos")
        .select(
          "id, nome, preco, categoria_id, imagem_url, favorito",
        )
        .eq("ativo", true)
        .order("nome"),

      supabase
        .from("adicionais")
        .select("id, nome, preco")
        .eq("ativo", true)
        .order("nome"),

      supabase
        .from("produto_adicionais")
        .select("produto_id, adicional_id"),

      supabase
        .from("comandas")
        .select("id, total")
        .eq("mesa_id", mesaData.id)
        .eq("status", "Aberta")
        .maybeSingle(),
    ]);

    const erro =
      categoriasResp.error ||
      produtosResp.error ||
      adicionaisResp.error ||
      vinculosResp.error ||
      comandaResp.error;

    if (erro) throw erro;

    const adicionaisPorProduto = new Map<string, string[]>();

    for (const vinculo of vinculosResp.data ?? []) {
      const lista =
        adicionaisPorProduto.get(vinculo.produto_id) ?? [];

      lista.push(vinculo.adicional_id);
      adicionaisPorProduto.set(vinculo.produto_id, lista);
    }

    const adicionaisMap = new Map(
      (adicionaisResp.data ?? []).map((adicional) => [
        adicional.id,
        adicional,
      ]),
    );

    const produtos = (produtosResp.data ?? []).map((produto) => {
      const ids =
        adicionaisPorProduto.get(produto.id) ?? [];

      return {
        ...produto,
        adicionais: ids
          .map((id) => adicionaisMap.get(id))
          .filter(Boolean),
      };
    });

    return NextResponse.json({
      mesa: mesaData,
      categorias: categoriasResp.data ?? [],
      produtos,
      totalComanda: Number(comandaResp.data?.total ?? 0),
    });
  } catch (error: any) {
    console.error("Erro ao carregar menu da comanda:", error);

    return NextResponse.json(
      {
        erro:
          error?.message ||
          "Não foi possível carregar a comanda.",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: Contexto,
) {
  const { mesa } = await params;
  const numeroMesa = Number(mesa);

  if (!Number.isInteger(numeroMesa) || numeroMesa <= 0) {
    return NextResponse.json(
      { erro: "Mesa inválida." },
      { status: 400 },
    );
  }

  try {
    const body = await request.json();

    const itens = Array.isArray(body?.itens)
      ? body.itens
      : [];

    if (itens.length === 0) {
      return NextResponse.json(
        { erro: "O pedido está vazio." },
        { status: 400 },
      );
    }

    const supabase = clienteSupabase();

    const { data, error } = await supabase.rpc(
      "enviar_pedido_mesa",
      {
        p_mesa_numero: numeroMesa,
        p_itens: itens,
        p_observacao:
          typeof body?.observacao === "string"
            ? body.observacao.slice(0, 500)
            : null,
      },
    );

    if (error) throw error;

    return NextResponse.json({
      sucesso: true,
      pedido: data,
    });
  } catch (error: any) {
    console.error("Erro ao enviar pedido da mesa:", error);

    return NextResponse.json(
      {
        erro:
          error?.message ||
          "Não foi possível enviar o pedido.",
      },
      { status: 500 },
    );
  }
}
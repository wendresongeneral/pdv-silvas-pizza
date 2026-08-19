import { NextRequest, NextResponse } from "next/server";

type OpenFoodFactsResponse = {
  status?: number;
  status_verbose?: string;
  product?: {
    code?: string;
    product_name?: string;
    product_name_pt?: string;
    generic_name?: string;
    generic_name_pt?: string;
    brands?: string;
    quantity?: string;
    image_front_url?: string;
    image_url?: string;
  };
};

function limparEan(valor: string) {
  return valor.replace(/\D/g, "");
}

function candidatosDeEan(ean: string) {
  const candidatos = [ean];

  // Alguns leitores/entradas podem trazer um zero à esquerda
  // antes de um EAN-13. Tentamos também a versão sem esse zero.
  if (ean.length === 14 && ean.startsWith("0")) {
    candidatos.push(ean.slice(1));
  }

  return [...new Set(candidatos)];
}

async function consultarOpenFoodFacts(ean: string) {
  const campos = [
    "code",
    "product_name",
    "product_name_pt",
    "generic_name",
    "generic_name_pt",
    "brands",
    "quantity",
    "image_front_url",
    "image_url",
  ].join(",");

  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${ean}?fields=${encodeURIComponent(
      campos,
    )}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent":
          "SilvasPizzaPDV/1.0 (EAN product lookup)",
      },
      cache: "no-store",
    },
  );

  // Produto não existe na base: isso NÃO é erro do sistema.
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `A consulta externa retornou HTTP ${response.status}.`,
    );
  }

  const texto = await response.text();

  if (!texto) {
    return null;
  }

  let resultado: OpenFoodFactsResponse;

  try {
    resultado = JSON.parse(texto) as OpenFoodFactsResponse;
  } catch {
    throw new Error(
      "A base externa retornou uma resposta inválida.",
    );
  }

  if (resultado.status !== 1 || !resultado.product) {
    return null;
  }

  return resultado.product;
}

export async function GET(request: NextRequest) {
  const eanOriginal = limparEan(
    request.nextUrl.searchParams.get("ean") ?? "",
  );

  if (
    !eanOriginal ||
    eanOriginal.length < 8 ||
    eanOriginal.length > 14
  ) {
    return NextResponse.json(
      {
        erro: "Informe um EAN válido entre 8 e 14 dígitos.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    const candidatos = candidatosDeEan(eanOriginal);

    for (const ean of candidatos) {
      const produto = await consultarOpenFoodFacts(ean);

      if (!produto) {
        continue;
      }

      const nome =
        produto.product_name_pt?.trim() ||
        produto.product_name?.trim() ||
        produto.generic_name_pt?.trim() ||
        produto.generic_name?.trim() ||
        "";

      const imagemUrl =
        produto.image_front_url?.trim() ||
        produto.image_url?.trim() ||
        "";

      return NextResponse.json({
        encontrado: true,
        ean,
        eanOriginal,
        nome,
        marca: produto.brands?.trim() || "",
        quantidade: produto.quantity?.trim() || "",
        imagemUrl,
        fonte: "Open Food Facts",
      });
    }

    return NextResponse.json({
      encontrado: false,
      ean: eanOriginal,
      mensagem:
        "Produto não encontrado na base online. Cadastre manualmente.",
    });
  } catch (error) {
    console.error("Erro na consulta Open Food Facts:", error);

    return NextResponse.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível consultar a base online agora.",
      },
      {
        status: 502,
      },
    );
  }
}
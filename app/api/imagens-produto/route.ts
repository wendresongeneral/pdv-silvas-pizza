import { NextRequest, NextResponse } from "next/server";

type ResultadoImagemSerp = {
  position?: number;
  title?: string;
  source?: string;
  original?: string;
  thumbnail?: string;
  original_width?: number;
  original_height?: number;
  width?: number;
  height?: number;
  is_product?: boolean;
};

type RespostaSerpApi = {
  error?: string;
  images_results?: ResultadoImagemSerp[];
};

function textoSeguro(valor: string | null) {
  return (valor ?? "").trim().slice(0, 180);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.SERPAPI_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        erro:
          "SERPAPI_KEY não está configurada no .env.local.",
      },
      {
        status: 500,
      },
    );
  }

  const nome = textoSeguro(
    request.nextUrl.searchParams.get("nome"),
  );
  const marca = textoSeguro(
    request.nextUrl.searchParams.get("marca"),
  );
  const quantidade = textoSeguro(
    request.nextUrl.searchParams.get("quantidade"),
  );
  const ean = textoSeguro(
    request.nextUrl.searchParams.get("ean"),
  ).replace(/\D/g, "");

  if (!nome) {
    return NextResponse.json(
      {
        erro: "Informe o nome do produto.",
      },
      {
        status: 400,
      },
    );
  }

  // Busca mais ampla para trazer várias opções.
  // EAN continua ajudando a identificar o produto, mas não vai entre aspas
  // junto com todos os outros termos para evitar restringir demais.
  const termosPrincipais = [
    nome,
    marca,
    quantidade,
  ]
    .filter(Boolean)
    .join(" ");

  const termos = `${termosPrincipais} produto embalagem`.trim();

  const params = new URLSearchParams({
    engine: "google_images",
    q: termos,
    api_key: apiKey,
    gl: "br",
    hl: "pt",
    google_domain: "google.com.br",
    safe: "active",
  });

  try {
    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const texto = await response.text();

    let resultado: RespostaSerpApi = {};

    if (texto) {
      try {
        resultado = JSON.parse(texto) as RespostaSerpApi;
      } catch {
        return NextResponse.json(
          {
            erro:
              "O SerpApi retornou uma resposta inválida.",
          },
          {
            status: 502,
          },
        );
      }
    }

    if (!response.ok || resultado.error) {
      return NextResponse.json(
        {
          erro:
            resultado.error ||
            `SerpApi retornou HTTP ${response.status}.`,
        },
        {
          status: 502,
        },
      );
    }

    let resultadosCombinados = resultado.images_results ?? [];

    // Se a busca principal vier muito pobre e houver EAN,
    // fazemos uma segunda busca usando o código para tentar achar mais fontes.
    if (resultadosCombinados.length < 6 && ean) {
      const paramsFallback = new URLSearchParams({
        engine: "google_images",
        q: `${ean} ${nome}`,
        api_key: apiKey,
        gl: "br",
        hl: "pt",
        google_domain: "google.com.br",
        safe: "active",
      });

      const fallbackResponse = await fetch(
        `https://serpapi.com/search.json?${paramsFallback.toString()}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          cache: "no-store",
        },
      );

      if (fallbackResponse.ok) {
        const fallbackTexto = await fallbackResponse.text();

        if (fallbackTexto) {
          try {
            const fallbackResultado =
              JSON.parse(fallbackTexto) as RespostaSerpApi;

            resultadosCombinados = [
              ...resultadosCombinados,
              ...(fallbackResultado.images_results ?? []),
            ];
          } catch {
            // Ignora fallback inválido e mantém os resultados principais.
          }
        }
      }
    }

    const vistos = new Set<string>();

    const imagens = resultadosCombinados
      .filter((item) => {
        const original = item.original?.trim();

        if (!original || !/^https?:\/\//i.test(original)) {
          return false;
        }

        if (vistos.has(original)) return false;
        vistos.add(original);

        const largura =
          item.original_width ?? item.width ?? 0;
        const altura =
          item.original_height ?? item.height ?? 0;

        // Descarta miniaturas muito pequenas quando as dimensões
        // estão disponíveis.
        if (
          largura > 0 &&
          altura > 0 &&
          (largura < 180 || altura < 180)
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        // Resultados reconhecidos pelo Google como produto primeiro.
        const produtoA = a.is_product ? 1 : 0;
        const produtoB = b.is_product ? 1 : 0;

        if (produtoA !== produtoB) {
          return produtoB - produtoA;
        }

        const areaA =
          (a.original_width ?? a.width ?? 0) *
          (a.original_height ?? a.height ?? 0);

        const areaB =
          (b.original_width ?? b.width ?? 0) *
          (b.original_height ?? b.height ?? 0);

        return areaB - areaA;
      })
      .slice(0, 12)
      .map((item, index) => ({
        id: `${item.position ?? index + 1}-${index}`,
        original: item.original ?? "",
        thumbnail: item.thumbnail ?? item.original ?? "",
        titulo: item.title?.trim() || "",
        fonte: item.source?.trim() || "",
        largura:
          item.original_width ?? item.width ?? null,
        altura:
          item.original_height ?? item.height ?? null,
      }));

    return NextResponse.json({
      consulta: termos,
      imagens,
    });
  } catch (error) {
    console.error("Erro ao consultar SerpApi:", error);

    return NextResponse.json(
      {
        erro:
          error instanceof Error
            ? error.message
            : "Não foi possível pesquisar imagens agora.",
      },
      {
        status: 500,
      },
    );
  }
}
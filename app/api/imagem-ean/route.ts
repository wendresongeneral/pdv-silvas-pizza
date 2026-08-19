import { promises as dns } from "node:dns";
import net from "node:net";
import { NextRequest, NextResponse } from "next/server";

function ipPrivado(ip: string) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);

    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }

  if (net.isIPv6(ip)) {
    const normalizado = ip.toLowerCase();

    return (
      normalizado === "::1" ||
      normalizado.startsWith("fc") ||
      normalizado.startsWith("fd") ||
      normalizado.startsWith("fe80:")
    );
  }

  return true;
}

async function urlPublicaSegura(valor: string) {
  try {
    const url = new URL(valor);

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    if (
      url.username ||
      url.password ||
      url.hostname === "localhost"
    ) {
      return false;
    }

    const enderecos = await dns.lookup(url.hostname, {
      all: true,
    });

    if (enderecos.length === 0) return false;

    return enderecos.every(
      (endereco) => !ipPrivado(endereco.address),
    );
  } catch {
    return false;
  }
}

async function baixarImagem(url: string) {
  if (!(await urlPublicaSegura(url))) {
    return null;
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "image/*",
      "User-Agent":
        "SilvasPizzaPDV/1.0 (product image import)",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (!contentType.startsWith("image/")) {
    return null;
  }

  const bytes = await response.arrayBuffer();

  // 8 MB de proteção para não copiar arquivos gigantes.
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return null;
  }

  return {
    bytes,
    contentType,
  };
}

export async function GET(request: NextRequest) {
  const url =
    request.nextUrl.searchParams.get("url") ?? "";
  const fallback =
    request.nextUrl.searchParams.get("fallback") ?? "";

  if (!url) {
    return NextResponse.json(
      {
        erro: "URL de imagem não informada.",
      },
      {
        status: 400,
      },
    );
  }

  try {
    let imagem = await baixarImagem(url);

    if (!imagem && fallback) {
      imagem = await baixarImagem(fallback);
    }

    if (!imagem) {
      return NextResponse.json(
        {
          erro:
            "Não foi possível baixar a imagem selecionada.",
        },
        {
          status: 502,
        },
      );
    }

    return new NextResponse(imagem.bytes, {
      status: 200,
      headers: {
        "Content-Type": imagem.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao importar imagem:", error);

    return NextResponse.json(
      {
        erro:
          "Não foi possível importar a imagem selecionada.",
      },
      {
        status: 500,
      },
    );
  }
}
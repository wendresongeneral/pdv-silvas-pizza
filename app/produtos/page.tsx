"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { House, Package, PlusCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import ProdutosTab, { Produto, Categoria, Adicional } from "./ProdutosTab";
import AdicionaisTab from "./AdicionaisTab";

export default function ProdutosPage() {
  const [abaAtiva, setAbaAtiva] = useState<"produtos" | "adicionais">("produtos");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [adicionais, setAdicionais] = useState<Adicional[]>([]);
  const [carregando, setCarregando] = useState(true);

  async function carregarTudo() {
    setCarregando(true);

    const [produtosResp, categoriasResp, adicionaisResp] = await Promise.all([
      supabase
        .from("produtos")
        .select("id, nome, preco, custo, ean, favorito, ativo, categoria_id, imagem_url")
        .order("nome"),
      supabase
        .from("categorias")
        .select("id, nome, permite_adicionais")
        .order("nome"),
      supabase
        .from("adicionais")
        .select("id, nome, preco, ativo")
        .order("nome"),
    ]);

    if (produtosResp.error) {
      console.error("Erro ao carregar produtos:", produtosResp.error);
    } else {
      setProdutos(produtosResp.data ?? []);
    }

    if (categoriasResp.error) {
      console.error("Erro ao carregar categorias:", categoriasResp.error);
    } else {
      setCategorias(categoriasResp.data ?? []);
    }

    if (adicionaisResp.error) {
      console.error("Erro ao carregar adicionais:", adicionaisResp.error);
    } else {
      setAdicionais(adicionaisResp.data ?? []);
    }

    setCarregando(false);
  }

  useEffect(() => {
    carregarTudo();
  }, []);

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>
            <h1 className="text-3xl font-bold">Cadastro</h1>
            <p className="mt-1 text-sm text-zinc-500">
              Gerencie produtos e adicionais no mesmo lugar.
            </p>
          </div>

          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-600 transition hover:bg-zinc-50"
            title="Menu principal"
          >
            <House className="h-5 w-5" />
          </Link>
        </div>

        <div className="mb-6 flex gap-2 border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setAbaAtiva("produtos")}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition ${
              abaAtiva === "produtos"
                ? "border-b-2 border-red-600 text-red-600"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <Package className="h-4 w-4" />
            Produtos
          </button>

          <button
            type="button"
            onClick={() => setAbaAtiva("adicionais")}
            className={`flex items-center gap-2 px-4 py-3 font-semibold transition ${
              abaAtiva === "adicionais"
                ? "border-b-2 border-red-600 text-red-600"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            <PlusCircle className="h-4 w-4" />
            Adicionais
          </button>
        </div>

        {abaAtiva === "produtos" ? (
          <ProdutosTab
            produtos={produtos}
            categorias={categorias}
            adicionais={adicionais.filter((item) => item.ativo)}
            carregando={carregando}
            recarregar={carregarTudo}
          />
        ) : (
          <AdicionaisTab
            adicionais={adicionais}
            carregando={carregando}
            recarregar={carregarTudo}
          />
        )}
      </div>
    </main>
  );
}
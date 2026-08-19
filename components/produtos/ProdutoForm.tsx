"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Categoria = {
  id: string;
  nome: string;
};

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

export default function ProdutoForm() {
  const router = useRouter();

  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState("");

  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    async function carregarCategorias() {
      const { data, error } = await supabase
        .from("categorias")
        .select("id, nome")
        .order("nome");

      if (error) {
        console.error("Erro ao carregar categorias:", error);
        setErro("Não foi possível carregar as categorias.");
        return;
      }

      setCategorias(data ?? []);
    }

    carregarCategorias();
  }, []);

  useEffect(() => {
    return () => {
      if (imagemPreview) {
        URL.revokeObjectURL(imagemPreview);
      }
    };
  }, [imagemPreview]);

  function selecionarImagem(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];

    setErro("");
    setMensagem("");

    if (!arquivo) {
      setImagem(null);
      setImagemPreview("");
      return;
    }

    if (!arquivo.type.startsWith("image/")) {
      setErro("Selecione um arquivo de imagem.");
      event.target.value = "";
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      setErro("A imagem deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }

    if (imagemPreview) {
      URL.revokeObjectURL(imagemPreview);
    }

    setImagem(arquivo);
    setImagemPreview(URL.createObjectURL(arquivo));
  }

  async function salvarProduto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErro("");
    setMensagem("");

    const precoNumerico = Number(preco.replace(",", "."));

    if (!nome.trim()) {
      setErro("Informe o nome do produto.");
      return;
    }

    if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) {
      setErro("Informe um preço válido.");
      return;
    }

    if (!categoriaId) {
      setErro("Selecione uma categoria.");
      return;
    }

    setSalvando(true);

    let caminhoImagem: string | null = null;
    let imagemUrl: string | null = null;

    try {
      if (imagem) {
        const extensao =
          imagem.name.split(".").pop()?.toLowerCase() || "jpg";

        caminhoImagem = `${crypto.randomUUID()}.${extensao}`;

        const { error: erroUpload } = await supabase.storage
          .from("produtos")
          .upload(caminhoImagem, imagem, {
            cacheControl: "3600",
            upsert: false,
          });

        if (erroUpload) {
          throw new Error(`Erro ao enviar imagem: ${erroUpload.message}`);
        }

        const { data: urlPublica } = supabase.storage
          .from("produtos")
          .getPublicUrl(caminhoImagem);

        imagemUrl = urlPublica.publicUrl;
      }

      const { error: erroProduto } = await supabase
        .from("produtos")
        .insert({
          nome: nome.trim(),
          preco: precoNumerico,
          categoria_id: categoriaId,
          imagem_url: imagemUrl,
        });

      if (erroProduto) {
        if (caminhoImagem) {
          await supabase.storage.from("produtos").remove([caminhoImagem]);
        }

        throw new Error(`Erro ao salvar produto: ${erroProduto.message}`);
      }

      setNome("");
      setPreco("");
      setCategoriaId("");
      setImagem(null);

      if (imagemPreview) {
        URL.revokeObjectURL(imagemPreview);
      }

      setImagemPreview("");
      setMensagem("Produto salvo com sucesso!");

      router.refresh();
    } catch (error) {
      console.error(error);

      setErro(
        error instanceof Error
          ? error.message
          : "Ocorreu um erro ao salvar o produto."
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">Novo produto</h2>
        <p className="mt-1 text-sm text-gray-500">
          Cadastre os dados e adicione uma imagem ao produto.
        </p>
      </div>

      <form onSubmit={salvarProduto} className="space-y-5">
        <div>
          <label
            htmlFor="nome"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Nome
          </label>

          <input
            id="nome"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            placeholder="Ex.: Pizza Frita de Calabresa"
            disabled={salvando}
          />
        </div>

        <div>
          <label
            htmlFor="preco"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Preço
          </label>

          <div className="flex overflow-hidden rounded-lg border border-gray-300 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100">
            <span className="flex items-center bg-gray-50 px-3 text-gray-600">
              R$
            </span>

            <input
              id="preco"
              type="number"
              min="0"
              step="0.01"
              value={preco}
              onChange={(event) => setPreco(event.target.value)}
              className="w-full px-3 py-2.5 outline-none"
              placeholder="15,00"
              disabled={salvando}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="categoria"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            Categoria
          </label>

          <select
            id="categoria"
            value={categoriaId}
            onChange={(event) => setCategoriaId(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-100"
            disabled={salvando}
          >
            <option value="">Selecione uma categoria</option>

            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Imagem do produto
          </label>

          <label
            htmlFor="imagem"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center transition hover:border-red-400 hover:bg-red-50"
          >
            {imagemPreview ? (
              <img
                src={imagemPreview}
                alt="Pré-visualização do produto"
                className="h-44 w-full rounded-lg object-cover"
              />
            ) : (
              <>
                <div className="mb-2 text-3xl">📷</div>

                <span className="font-medium text-gray-700">
                  Clique para selecionar uma imagem
                </span>

                <span className="mt-1 text-xs text-gray-500">
                  JPG, PNG ou WEBP — máximo de 5 MB
                </span>
              </>
            )}

            <input
              id="imagem"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={selecionarImagem}
              className="hidden"
              disabled={salvando}
            />
          </label>

          {imagemPreview && (
            <button
              type="button"
              onClick={() => {
                URL.revokeObjectURL(imagemPreview);
                setImagem(null);
                setImagemPreview("");
              }}
              className="mt-2 text-sm font-medium text-red-600 hover:text-red-700"
              disabled={salvando}
            >
              Remover imagem
            </button>
          )}
        </div>

        {erro && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {mensagem}
          </div>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-lg bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {salvando ? "Salvando produto..." : "Salvar produto"}
        </button>
      </form>
    </div>
  );
}
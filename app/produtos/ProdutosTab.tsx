"use client";

import { ChangeEvent, useMemo, useState } from "react";
import { Barcode, CheckCircle2, Globe2, ImageIcon, LoaderCircle, Pencil, Plus, Search, Trash2, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

export type Categoria = {
  id: string;
  nome: string;
  permite_adicionais: boolean;
};

export type Adicional = {
  id: string;
  nome: string;
  preco: number;
  ativo: boolean;
};

export type Produto = {
  id: string;
  nome: string;
  preco: number;
  custo: number;
  ean: string | null;
  favorito: boolean;
  ativo: boolean;
  categoria_id: string;
  imagem_url: string | null;
};

type ImagemEncontrada = {
  id: string;
  original: string;
  thumbnail: string;
  titulo: string;
  fonte: string;
  largura: number | null;
  altura: number | null;
};

type Props = {
  produtos: Produto[];
  categorias: Categoria[];
  adicionais: Adicional[];
  carregando: boolean;
  recarregar: () => Promise<void>;
};

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

function mensagemErroSupabase(error: unknown) {
  if (!error) {
    return "Ocorreu um erro desconhecido.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object") {
    const erro = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
      error_description?: string;
    };

    if (erro.code === "23505") {
      return "Esse EAN já está cadastrado em outro produto.";
    }

  return (
      erro.message ||
      erro.error_description ||
      erro.details ||
      erro.hint ||
      "Não foi possível concluir a operação no banco de dados."
    );
  }

  return String(error);
}

export default function ProdutosTab({
  produtos,
  categorias,
  adicionais,
  carregando,
  recarregar,
}: Props) {
  const [nome, setNome] = useState("");
  const [ean, setEan] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState("");
  const [imagemUrlExterna, setImagemUrlExterna] = useState("");
  const [imagemUrlFallback, setImagemUrlFallback] = useState("");
  const [imagensEncontradas, setImagensEncontradas] = useState<ImagemEncontrada[]>([]);
  const [buscandoEan, setBuscandoEan] = useState(false);
  const [buscandoImagens, setBuscandoImagens] = useState(false);
  const [mensagemEan, setMensagemEan] = useState("");
  const [mensagemImagens, setMensagemImagens] = useState("");
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<string[]>([]);
  const [produtoEditando, setProdutoEditando] = useState<Produto | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [modalCategoriaAberto, setModalCategoriaAberto] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [novaCategoriaPermiteAdicionais, setNovaCategoriaPermiteAdicionais] = useState(false);
  const [salvandoCategoria, setSalvandoCategoria] = useState(false);
  const [categoriaEditando, setCategoriaEditando] = useState<Categoria | null>(null);
  const [nomeCategoriaEditando, setNomeCategoriaEditando] = useState("");
  const [categoriaEditandoPermiteAdicionais, setCategoriaEditandoPermiteAdicionais] = useState(false);
  const [salvandoEdicaoCategoria, setSalvandoEdicaoCategoria] = useState(false);
  const [categoriaExcluindoId, setCategoriaExcluindoId] = useState<string | null>(null);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((produto) =>
      produto.nome.toLowerCase().includes(termo) ||
      (produto.ean ?? "").includes(termo),
    );
  }, [produtos, busca]);

  async function salvarCategoria() {
    const nomeCategoria = novaCategoria.trim();

    if (!nomeCategoria) {
      alert("Informe o nome da categoria.");
      return;
    }

    setSalvandoCategoria(true);

    try {
      const { data, error } = await supabase
        .from("categorias")
        .insert({
          nome: nomeCategoria,
          permite_adicionais: novaCategoriaPermiteAdicionais,
        })
        .select("id, nome, permite_adicionais")
        .single();

      if (error) {
        throw new Error(mensagemErroSupabase(error));
      }

      setNovaCategoria("");
      setNovaCategoriaPermiteAdicionais(false);
      setModalCategoriaAberto(false);

      await recarregar();

      if (data?.id) {
        setCategoria(data.id);
      }
    } catch (error) {
      alert(
        `Erro ao cadastrar categoria:\n${mensagemErroSupabase(error)}`,
      );
    } finally {
      setSalvandoCategoria(false);
    }
  }

  function iniciarEdicaoCategoria(cat: Categoria) {
    setCategoriaEditando(cat);
    setNomeCategoriaEditando(cat.nome);
    setCategoriaEditandoPermiteAdicionais(Boolean(cat.permite_adicionais));
  }

  function cancelarEdicaoCategoria() {
    setCategoriaEditando(null);
    setNomeCategoriaEditando("");
    setCategoriaEditandoPermiteAdicionais(false);
  }

  async function salvarEdicaoCategoria() {
    if (!categoriaEditando) return;

    const nomeLimpo = nomeCategoriaEditando.trim();

    if (!nomeLimpo) {
      alert("Informe o nome da categoria.");
      return;
    }

    setSalvandoEdicaoCategoria(true);

    try {
      const { error } = await supabase
        .from("categorias")
        .update({
          nome: nomeLimpo,
          permite_adicionais: categoriaEditandoPermiteAdicionais,
        })
        .eq("id", categoriaEditando.id);

      if (error) {
        throw new Error(mensagemErroSupabase(error));
      }

      await recarregar();
      cancelarEdicaoCategoria();
    } catch (error) {
      alert(
        `Erro ao editar categoria:\n${mensagemErroSupabase(error)}`,
      );
    } finally {
      setSalvandoEdicaoCategoria(false);
    }
  }

  async function excluirCategoria(cat: Categoria) {
    const produtosDaCategoria = produtos.filter(
      (produto) => produto.categoria_id === cat.id,
    );

    if (produtosDaCategoria.length > 0) {
      alert(
        `Não é possível excluir "${cat.nome}".\n\n` +
          `Existem ${produtosDaCategoria.length} produto(s) usando essa categoria. ` +
          "Altere a categoria desses produtos antes de excluir.",
      );
      return;
    }

    const confirmar = window.confirm(
      `Excluir a categoria "${cat.nome}"?\n\nEssa ação não pode ser desfeita.`,
    );

    if (!confirmar) return;

    setCategoriaExcluindoId(cat.id);

    try {
      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", cat.id);

      if (error) {
        throw new Error(mensagemErroSupabase(error));
      }

      if (categoria === cat.id) {
        setCategoria("");
      }

      if (categoriaEditando?.id === cat.id) {
        cancelarEdicaoCategoria();
      }

      await recarregar();
    } catch (error) {
      alert(
        `Erro ao excluir categoria:\n${mensagemErroSupabase(error)}`,
      );
    } finally {
      setCategoriaExcluindoId(null);
    }
  }

  async function buscarImagensProduto(params?: {
    nome?: string;
    marca?: string;
    quantidade?: string;
    ean?: string;
  }) {
    const nomeBusca = (params?.nome ?? nome).trim();

    if (!nomeBusca) {
      setMensagemImagens(
        "Informe ou busque o nome do produto antes de pesquisar imagens.",
      );
      return;
    }

    setBuscandoImagens(true);
    setMensagemImagens("");
    setImagensEncontradas([]);

    try {
      const query = new URLSearchParams({
        nome: nomeBusca,
      });

      const marca = params?.marca?.trim();
      const quantidade = params?.quantidade?.trim();
      const codigoEan = params?.ean?.trim() || ean.trim();

      if (marca) query.set("marca", marca);
      if (quantidade) query.set("quantidade", quantidade);
      if (codigoEan) query.set("ean", codigoEan);

      const response = await fetch(
        `/api/imagens-produto?${query.toString()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const textoResposta = await response.text();

      let resultado: any = {};

      if (textoResposta) {
        try {
          resultado = JSON.parse(textoResposta);
        } catch {
          throw new Error(
            "A busca de imagens retornou uma resposta inválida.",
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          resultado?.erro ??
            "Não foi possível pesquisar imagens agora.",
        );
      }

      const imagens = (resultado.imagens ?? []) as ImagemEncontrada[];

      setImagensEncontradas(imagens);

      if (imagens.length === 0) {
        setMensagemImagens(
          "Nenhuma imagem comercial adequada foi encontrada. Você ainda pode enviar uma imagem manualmente.",
        );
        return;
      }

      setMensagemImagens(
        `${imagens.length} opções encontradas. Escolha a imagem que melhor representa o produto.`,
      );
    } catch (error) {
      console.error("Erro ao buscar imagens:", error);

      setMensagemImagens(
        error instanceof Error
          ? error.message
          : "Não foi possível pesquisar imagens.",
      );
    } finally {
      setBuscandoImagens(false);
    }
  }

  async function buscarPorEan() {
    const codigo = ean.replace(/\D/g, "");

    if (!codigo) {
      setMensagemEan("Digite o EAN antes de buscar.");
      return;
    }

    if (codigo.length < 8 || codigo.length > 14) {
      setMensagemEan("O código deve ter entre 8 e 14 dígitos.");
      return;
    }

    setEan(codigo);
    setBuscandoEan(true);
    setMensagemEan("");
    setMensagemImagens("");
    setImagensEncontradas([]);

    try {
      const response = await fetch(
        `/api/produto-ean?ean=${encodeURIComponent(codigo)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const textoResposta = await response.text();

      let resultado: any = {};

      if (textoResposta) {
        try {
          resultado = JSON.parse(textoResposta);
        } catch {
          throw new Error(
            "A consulta do EAN retornou uma resposta inválida.",
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          resultado?.erro ?? "Não foi possível consultar o produto.",
        );
      }

      if (!resultado.encontrado) {
        setMensagemEan(
          "Produto não encontrado pela base de EAN. Digite o nome manualmente e use “Buscar imagens”.",
        );
        return;
      }

      const nomeEncontrado = resultado.nome?.trim() || "";
      const marcaEncontrada = resultado.marca?.trim() || "";
      const quantidadeEncontrada =
        resultado.quantidade?.trim() || "";
      const eanEncontrado = resultado.ean?.trim() || codigo;

      if (nomeEncontrado) {
        setNome(nomeEncontrado);
      }

      if (eanEncontrado) {
        setEan(eanEncontrado);
      }

      // Não usamos mais automaticamente a foto do Open Food Facts.
      // A imagem será escolhida entre resultados comerciais do SerpApi.
      setImagem(null);
      setImagemUrlExterna("");
      setImagemUrlFallback("");

      if (
        imagemPreview.startsWith("blob:")
      ) {
        URL.revokeObjectURL(imagemPreview);
      }

      setImagemPreview("");

      const detalhes = [
        marcaEncontrada ? `Marca: ${marcaEncontrada}` : "",
        quantidadeEncontrada
          ? `Embalagem: ${quantidadeEncontrada}`
          : "",
      ]
        .filter(Boolean)
        .join(" • ");

      setMensagemEan(
        detalhes
          ? `Produto identificado. ${detalhes}`
          : "Produto identificado.",
      );

      if (nomeEncontrado) {
        await buscarImagensProduto({
          nome: nomeEncontrado,
          marca: marcaEncontrada,
          quantidade: quantidadeEncontrada,
          ean: eanEncontrado,
        });
      } else {
        setMensagemImagens(
          "O EAN foi localizado, mas a base não informou um nome. Digite o nome e clique em “Buscar imagens”.",
        );
      }
    } catch (error) {
      console.error("Erro ao buscar EAN:", error);

      setMensagemEan(
        error instanceof Error
          ? error.message
          : "Não foi possível consultar o EAN.",
      );
    } finally {
      setBuscandoEan(false);
    }
  }

  function escolherImagemPesquisa(imagemEscolhida: ImagemEncontrada) {
    if (imagemPreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagemPreview);
    }

    setImagem(null);
    setImagemUrlExterna(imagemEscolhida.original);
    setImagemUrlFallback(imagemEscolhida.thumbnail);
    setImagemPreview(
      imagemEscolhida.original || imagemEscolhida.thumbnail,
    );
    setMensagemImagens(
      `Imagem selecionada${imagemEscolhida.fonte ? ` • Fonte: ${imagemEscolhida.fonte}` : ""}.`,
    );
  }

  function selecionarImagem(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (!arquivo.type.startsWith("image/")) {
      alert("Selecione um arquivo de imagem.");
      event.target.value = "";
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO) {
      alert("A imagem deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }

    if (imagemPreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagemPreview);
    }

    setImagem(arquivo);
    setImagemUrlExterna("");
    setImagemUrlFallback("");
    setImagemPreview(URL.createObjectURL(arquivo));
  }

  function limparFormulario() {
    setNome("");
    setEan("");
    setPreco("");
    setCusto("");
    setCategoria("");
    setAtivo(true);
    setImagem(null);
    setImagemUrlExterna("");
    setImagemUrlFallback("");
    setImagensEncontradas([]);
    setMensagemEan("");
    setMensagemImagens("");
    setAdicionaisSelecionados([]);

    if (imagemPreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagemPreview);
    }

    setImagemPreview("");
    setProdutoEditando(null);
  }

  async function editarProduto(produto: Produto) {
    setProdutoEditando(produto);
    setNome(produto.nome);
    setEan(produto.ean ?? "");
    setPreco(String(produto.preco));
    setCusto(String(produto.custo ?? 0));
    setCategoria(produto.categoria_id);
    setAtivo(produto.ativo);
    setImagem(null);
    setImagemUrlExterna("");
    setImagemUrlFallback("");
    setImagensEncontradas([]);
    setMensagemEan("");
    setMensagemImagens("");
    setImagemPreview(produto.imagem_url ?? "");

    const { data, error } = await supabase
      .from("produto_adicionais")
      .select("adicional_id")
      .eq("produto_id", produto.id);

    if (error) {
      console.error("Erro ao carregar adicionais do produto:", error);
      setAdicionaisSelecionados([]);
    } else {
      setAdicionaisSelecionados(
        (data ?? []).map((item) => item.adicional_id as string),
      );
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function alternarAdicional(adicionalId: string, marcado: boolean) {
    setAdicionaisSelecionados((atuais) => {
      if (marcado) {
        return atuais.includes(adicionalId)
          ? atuais
          : [...atuais, adicionalId];
      }

      return atuais.filter((id) => id !== adicionalId);
    });
  }

  function obterCaminhoStorage(imagemUrl: string | null) {
    if (!imagemUrl) return null;

    const marcador = "/storage/v1/object/public/produtos/";
    const indice = imagemUrl.indexOf(marcador);
    if (indice === -1) return null;

    return decodeURIComponent(
      imagemUrl.substring(indice + marcador.length),
    );
  }

  async function prepararArquivoImagemExterna() {
    if (!imagemUrlExterna) return null;

    const query = new URLSearchParams({
      url: imagemUrlExterna,
    });

    if (imagemUrlFallback) {
      query.set("fallback", imagemUrlFallback);
    }

    const response = await fetch(
      `/api/imagem-ean?${query.toString()}`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      throw new Error(
        "A imagem foi encontrada, mas não foi possível copiá-la para o sistema.",
      );
    }

    const blob = await response.blob();

    const contentType =
      blob.type && blob.type.startsWith("image/")
        ? blob.type
        : "image/jpeg";

    const extensao =
      contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";

    return new File(
      [blob],
      `ean-${ean || crypto.randomUUID()}.${extensao}`,
      {
        type: contentType,
      },
    );
  }

  async function enviarImagem() {
    let arquivoParaEnviar = imagem;

    if (!arquivoParaEnviar && imagemUrlExterna) {
      arquivoParaEnviar = await prepararArquivoImagemExterna();
    }

    if (!arquivoParaEnviar) return null;

    const extensao =
      arquivoParaEnviar.name.split(".").pop()?.toLowerCase() ||
      "jpg";

    const caminho = `${crypto.randomUUID()}.${extensao}`;

    const { error } = await supabase.storage
      .from("produtos")
      .upload(caminho, arquivoParaEnviar, {
        cacheControl: "3600",
        upsert: false,
        contentType: arquivoParaEnviar.type,
      });

    if (error) {
      throw new Error(`Erro ao enviar imagem: ${error.message}`);
    }

    const { data } = supabase.storage
      .from("produtos")
      .getPublicUrl(caminho);

    return {
      caminho,
      url: data.publicUrl,
    };
  }

  async function sincronizarAdicionais(produtoId: string) {
    const { error: erroExcluir } = await supabase
      .from("produto_adicionais")
      .delete()
      .eq("produto_id", produtoId);

    if (erroExcluir) {
      throw new Error(
        `Erro ao atualizar adicionais: ${erroExcluir.message}`,
      );
    }

    if (adicionaisSelecionados.length === 0) return;

    const { error: erroInserir } = await supabase
      .from("produto_adicionais")
      .insert(
        adicionaisSelecionados.map((adicionalId) => ({
          produto_id: produtoId,
          adicional_id: adicionalId,
        })),
      );

    if (erroInserir) {
      throw new Error(
        `Erro ao vincular adicionais: ${erroInserir.message}`,
      );
    }
  }

  async function salvarProduto() {
    if (!nome.trim() || !preco || !categoria) {
      alert("Preencha nome, preço e categoria.");
      return;
    }

    const eanLimpo = ean.replace(/\D/g, "");
    const precoNumerico = Number(preco.replace(",", "."));
    const custoNumerico = Number(custo.replace(",", "."));

    if (
      eanLimpo &&
      (eanLimpo.length < 8 || eanLimpo.length > 14)
    ) {
      alert("O EAN deve ter entre 8 e 14 dígitos.");
      return;
    }

    if (!Number.isFinite(precoNumerico) || precoNumerico <= 0) {
      alert("Informe um preço de venda válido.");
      return;
    }

    if (!Number.isFinite(custoNumerico) || custoNumerico < 0) {
      alert("Informe um custo válido.");
      return;
    }

    setSalvando(true);

    let novaImagem: { caminho: string; url: string } | null = null;

    try {
      novaImagem = await enviarImagem();

      if (produtoEditando) {
        const imagemAnterior = produtoEditando.imagem_url;

        const { error } = await supabase
          .from("produtos")
          .update({
            nome: nome.trim(),
            ean: eanLimpo || null,
            preco: precoNumerico,
            custo: custoNumerico,
            categoria_id: categoria,
            ativo,
            imagem_url:
              novaImagem?.url ?? imagemAnterior,
          })
          .eq("id", produtoEditando.id);

        if (error) {
          throw new Error(mensagemErroSupabase(error));
        }

        await sincronizarAdicionais(produtoEditando.id);

        if (novaImagem && imagemAnterior) {
          const caminhoAnterior = obterCaminhoStorage(imagemAnterior);

          if (caminhoAnterior) {
            await supabase.storage
              .from("produtos")
              .remove([caminhoAnterior]);
          }
        }

        alert("Produto atualizado com sucesso!");
      } else {
        const { data: produtoCriado, error } = await supabase
          .from("produtos")
          .insert({
            nome: nome.trim(),
            ean: eanLimpo || null,
            preco: precoNumerico,
            custo: custoNumerico,
            categoria_id: categoria,
            ativo: true,
            imagem_url:
              novaImagem?.url ?? null,
          })
          .select("id")
          .single();

        if (error) {
          throw new Error(mensagemErroSupabase(error));
        }

        if (!produtoCriado) {
          throw new Error("Produto não foi criado.");
        }

        await sincronizarAdicionais(produtoCriado.id);
        alert("Produto salvo com sucesso!");
      }

      limparFormulario();
      await recarregar();
    } catch (error) {
      const mensagem = mensagemErroSupabase(error);

      console.warn("Falha ao salvar produto:", mensagem);

      alert(`Erro ao salvar produto:\n${mensagem}`);
    } finally {
      setSalvando(false);
    }
  }

  async function removerImagemAtual() {
    if (!produtoEditando?.imagem_url) {
      setImagem(null);
      setImagemUrlExterna("");
      setImagemUrlFallback("");
      setImagemPreview("");
      return;
    }

    if (!confirm("Deseja remover a imagem atual deste produto?")) return;

    const caminho = obterCaminhoStorage(produtoEditando.imagem_url);

    if (caminho) {
      const { error } = await supabase.storage
        .from("produtos")
        .remove([caminho]);

      if (error) {
        alert(error.message);
        return;
      }
    }

    const { error } = await supabase
      .from("produtos")
      .update({ imagem_url: null })
      .eq("id", produtoEditando.id);

    if (error) {
      alert(error.message);
      return;
    }

    setProdutoEditando({ ...produtoEditando, imagem_url: null });
    setImagem(null);
    setImagemPreview("");
    await recarregar();
  }

  async function alternarStatus(produto: Produto) {
    setAlterandoId(produto.id);

    const { error } = await supabase
      .from("produtos")
      .update({ ativo: !produto.ativo })
      .eq("id", produto.id);

    if (error) {
      alert(error.message);
    } else {
      await recarregar();
    }

    setAlterandoId(null);
  }

  const categoriaAtual = categorias.find(
    (cat) => cat.id === categoria,
  );

  const categoriaPermiteAdicionais =
    Boolean(categoriaAtual?.permite_adicionais);

  return (
    <>
      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-5 text-xl font-bold">
          {produtoEditando
            ? `Editando: ${produtoEditando.nome}`
            : "Novo produto"}
        </h2>

        <div className="mb-4">
          <label className="mb-2 block text-sm font-medium text-zinc-700">
            EAN / Código de barras
          </label>

          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Barcode className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />

              <input
                value={ean}
                onChange={(event) => {
                  setEan(event.target.value.replace(/\D/g, ""));
                  setMensagemEan("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    buscarPorEan();
                  }
                }}
                inputMode="numeric"
                maxLength={14}
                placeholder="Ex.: 7891234567890"
                className="w-full rounded-xl border border-zinc-300 py-3 pl-11 pr-3 outline-none focus:border-red-500"
                disabled={salvando || buscandoEan}
              />
            </div>

            <button
              type="button"
              onClick={buscarPorEan}
              disabled={salvando || buscandoEan || !ean}
              className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buscandoEan ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Globe2 className="h-5 w-5" />
              )}

              {buscandoEan ? "Buscando..." : "Buscar na internet"}
            </button>
          </div>

          {mensagemEan && (
            <p className="mt-2 text-sm text-zinc-600">
              {mensagemEan}
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nome"
            className="rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
            disabled={salvando}
          />

          <input
            type="number"
            min="0"
            step="0.01"
            value={preco}
            onChange={(event) => setPreco(event.target.value)}
            placeholder="Preço de venda"
            className="rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
            disabled={salvando}
          />

          <input
            type="number"
            min="0"
            step="0.01"
            value={custo}
            onChange={(event) => setCusto(event.target.value)}
            placeholder="Custo"
            className="rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
            disabled={salvando}
          />

          <div className="flex gap-2">
            <select
              value={categoria}
              onChange={(event) => setCategoria(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white p-3"
              disabled={salvando}
            >
              <option value="">Categoria</option>

              {categorias.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.nome}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setModalCategoriaAberto(true)}
              className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-xl border border-zinc-300 bg-white text-red-600 transition hover:bg-red-50"
              title="Nova categoria"
              disabled={salvando}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {produtoEditando && (
          <label className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-medium">Produto ativo</span>
          </label>
        )}

        <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <ImageIcon className="h-5 w-5 text-red-600" />
                Imagem comercial
              </h3>

              <p className="mt-1 text-sm text-zinc-500">
                O sistema pesquisa opções pela identificação do produto. Você escolhe qual será usada.
              </p>
            </div>

            <button
              type="button"
              onClick={() => buscarImagensProduto()}
              disabled={
                salvando ||
                buscandoImagens ||
                !nome.trim()
              }
              className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {buscandoImagens ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}

              {buscandoImagens
                ? "Buscando imagens..."
                : "Buscar imagens"}
            </button>
          </div>

          {mensagemImagens && (
            <p className="mt-3 text-sm text-zinc-600">
              {mensagemImagens}
            </p>
          )}

          {imagensEncontradas.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {imagensEncontradas.map((imagemEncontrada) => {
                const selecionada =
                  imagemUrlExterna === imagemEncontrada.original;

                return (
                  <button
                    key={imagemEncontrada.id}
                    type="button"
                    onClick={() =>
                      escolherImagemPesquisa(imagemEncontrada)
                    }
                    className={`relative overflow-hidden rounded-xl border-2 bg-white p-2 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                      selecionada
                        ? "border-red-500 ring-2 ring-red-100"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    {selecionada && (
                      <div className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}

                    <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-white">
                      <img
                        src={
                          imagemEncontrada.thumbnail ||
                          imagemEncontrada.original
                        }
                        alt={
                          imagemEncontrada.titulo ||
                          `Imagem de ${nome}`
                        }
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>

                    <p className="mt-2 truncate text-xs font-medium text-zinc-700">
                      {imagemEncontrada.fonte || "Resultado da web"}
                    </p>

                    {imagemEncontrada.largura &&
                      imagemEncontrada.altura && (
                        <p className="mt-0.5 text-[11px] text-zinc-400">
                          {imagemEncontrada.largura}×
                          {imagemEncontrada.altura}
                        </p>
                      )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {categoriaPermiteAdicionais && (
          <div className="mt-6">
            <h3 className="mb-3 text-lg font-semibold">
              Adicionais permitidos
            </h3>

            {adicionais.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
                Nenhum adicional ativo cadastrado.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {adicionais.map((adicional) => (
                  <label
                    key={adicional.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
                      adicionaisSelecionados.includes(adicional.id)
                        ? "border-red-400 bg-red-50"
                        : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={adicionaisSelecionados.includes(adicional.id)}
                      onChange={(event) =>
                        alternarAdicional(adicional.id, event.target.checked)
                      }
                      className="h-5 w-5"
                    />

                    <div>
                      <p className="font-medium">{adicional.nome}</p>
                      <p className="text-sm text-zinc-500">
                        + R$ {Number(adicional.preco).toFixed(2)}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}


        <div className="mt-6">
          <p className="mb-2 font-medium">Imagem do produto</p>

          <label
            htmlFor="imagem-produto"
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 text-center transition hover:border-red-400 hover:bg-red-50"
          >
            {imagemPreview ? (
              <img
                src={imagemPreview}
                alt="Pré-visualização"
                className="h-48 w-full rounded-lg object-contain"
              />
            ) : (
              <>
                <span className="text-3xl">📷</span>
                <span className="mt-2 font-medium">
                  Clique para selecionar uma imagem
                </span>
                <span className="mt-1 text-sm text-zinc-500">
                  JPG, PNG ou WEBP, até 5 MB
                </span>
              </>
            )}

            <input
              id="imagem-produto"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={selecionarImagem}
              disabled={salvando}
            />
          </label>

          {imagemPreview && (
            <button
              type="button"
              onClick={removerImagemAtual}
              className="mt-2 text-sm font-semibold text-red-600"
            >
              Remover imagem
            </button>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={salvarProduto}
            disabled={salvando}
            className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:bg-zinc-400"
          >
            {salvando
              ? "Salvando..."
              : produtoEditando
                ? "Salvar alterações"
                : "Salvar produto"}
          </button>

          {produtoEditando && (
            <button
              type="button"
              onClick={limparFormulario}
              className="rounded-xl border border-zinc-300 px-6 py-3 font-semibold hover:bg-zinc-50"
            >
              Cancelar edição
            </button>
          )}
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm">
        <div className="border-b border-zinc-200 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Pesquisar produto..."
              className="w-full rounded-xl border border-zinc-300 py-3 pl-10 pr-4 outline-none focus:border-red-500"
            />
          </div>
        </div>

        {carregando ? (
          <div className="p-10 text-center text-zinc-500">
            Carregando produtos...
          </div>
        ) : produtosFiltrados.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            Nenhum produto encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr className="border-b">
                  <th className="p-4 text-left">Imagem</th>
                  <th className="p-4 text-left">Produto</th>
                  <th className="p-4 text-left">EAN</th>
                  <th className="p-4 text-left">Venda</th>
                  <th className="p-4 text-left">Custo</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {produtosFiltrados.map((produto) => (
                  <tr key={produto.id} className="border-b last:border-0">
                    <td className="p-4">
                      {produto.imagem_url ? (
                        <img
                          src={produto.imagem_url}
                          alt={produto.nome}
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-zinc-100">
                          🍕
                        </div>
                      )}
                    </td>

                    <td className="p-4 font-medium">{produto.nome}</td>

                    <td className="p-4 text-sm text-zinc-500">
                      {produto.ean || "—"}
                    </td>

                    <td className="p-4">
                      R$ {Number(produto.preco).toFixed(2)}
                    </td>

                    <td className="p-4 text-zinc-600">
                      R$ {Number(produto.custo ?? 0).toFixed(2)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          produto.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {produto.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editarProduto(produto)}
                          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => alternarStatus(produto)}
                          disabled={alterandoId === produto.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                            produto.ativo
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          <XCircle className="h-4 w-4" />
                          {alterandoId === produto.id
                            ? "Salvando..."
                            : produto.ativo
                              ? "Desativar"
                              : "Reativar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {modalCategoriaAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Gerenciar categorias</h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Crie, edite ou exclua categorias de produtos.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setNovaCategoria("");
                  cancelarEdicaoCategoria();
                  setModalCategoriaAberto(false);
                }}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
              <p className="mb-3 font-semibold">Nova categoria</p>

              <div className="flex gap-2">
                <input
                  value={novaCategoria}
                  onChange={(event) => setNovaCategoria(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      salvarCategoria();
                    }
                  }}
                  placeholder="Ex.: Sobremesas"
                  className="min-w-0 flex-1 rounded-xl border border-zinc-300 bg-white p-3 outline-none focus:border-red-500"
                />

                <button
                  type="button"
                  onClick={salvarCategoria}
                  disabled={salvandoCategoria}
                  className="rounded-xl bg-red-600 px-5 py-3 font-semibold text-white hover:bg-red-700 disabled:bg-zinc-400"
                >
                  {salvandoCategoria ? "Salvando..." : "Adicionar"}
                </button>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3">
                <input
                  type="checkbox"
                  checked={novaCategoriaPermiteAdicionais}
                  onChange={(event) =>
                    setNovaCategoriaPermiteAdicionais(event.target.checked)
                  }
                  className="h-5 w-5"
                />

                <div>
                  <p className="font-medium">Permitir adicionais</p>
                  <p className="text-xs text-zinc-500">
                    Ex.: pizzas podem receber queijo, bacon ou outros extras.
                  </p>
                </div>
              </label>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Categorias cadastradas</h3>

                <span className="text-sm text-zinc-500">
                  {categorias.length} categoria(s)
                </span>
              </div>

              {categorias.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
                  Nenhuma categoria cadastrada.
                </div>
              ) : (
                <div className="space-y-2">
                  {categorias.map((cat) => {
                    const quantidadeProdutos = produtos.filter(
                      (produto) => produto.categoria_id === cat.id,
                    ).length;

                    const editando = categoriaEditando?.id === cat.id;

                    return (
                      <div
                        key={cat.id}
                        className="rounded-xl border border-zinc-200 bg-white p-3"
                      >
                        {editando ? (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                              value={nomeCategoriaEditando}
                              onChange={(event) =>
                                setNomeCategoriaEditando(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  salvarEdicaoCategoria();
                                }

                                if (event.key === "Escape") {
                                  cancelarEdicaoCategoria();
                                }
                              }}
                              className="min-w-0 flex-1 rounded-lg border border-zinc-300 p-2.5 outline-none focus:border-red-500"
                              autoFocus
                            />

                            <label className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm">
                              <input
                                type="checkbox"
                                checked={categoriaEditandoPermiteAdicionais}
                                onChange={(event) =>
                                  setCategoriaEditandoPermiteAdicionais(
                                    event.target.checked,
                                  )
                                }
                              />
                              Permitir adicionais
                            </label>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={salvarEdicaoCategoria}
                                disabled={salvandoEdicaoCategoria}
                                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:bg-zinc-400 sm:flex-none"
                              >
                                {salvandoEdicaoCategoria
                                  ? "Salvando..."
                                  : "Salvar"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelarEdicaoCategoria}
                                disabled={salvandoEdicaoCategoria}
                                className="flex-1 rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold hover:bg-zinc-50 sm:flex-none"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{cat.nome}</p>

                              <p className="mt-0.5 text-xs text-zinc-500">
                                {quantidadeProdutos} produto(s)
                                {" • "}
                                {cat.permite_adicionais
                                  ? "Permite adicionais"
                                  : "Sem adicionais"}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                onClick={() => iniciarEdicaoCategoria(cat)}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50"
                                title="Editar categoria"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => excluirCategoria(cat)}
                                disabled={categoriaExcluindoId === cat.id}
                                className="flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                                title={
                                  quantidadeProdutos > 0
                                    ? "Categoria possui produtos vinculados"
                                    : "Excluir categoria"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setNovaCategoria("");
                  cancelarEdicaoCategoria();
                  setModalCategoriaAberto(false);
                }}
                className="rounded-xl border border-zinc-300 px-5 py-3 font-semibold hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
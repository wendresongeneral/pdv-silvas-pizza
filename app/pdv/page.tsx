"use client";

import { MouseEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ClipboardList, Plus, Printer, QrCode, Star, X } from "lucide-react";

type Categoria = {
  id: string;
  nome: string;
  permite_adicionais: boolean;
};

type Produto = {
  id: string;
  nome: string;
  preco: number | string;
  custo: number | string;
  favorito: boolean;
  categoria_id: string | null;
  imagem_url: string | null;
  controla_estoque: boolean;
  estoque_atual: number;
  estoque_minimo: number;
  ativo?: boolean | null;
};

type Adicional = {
  id: string;
  nome: string;
  preco: number | string;
};

type AdicionalEscolhido = {
  id: string;
  nome: string;
  preco: number;
};

type ItemCarrinho = {
  chave: string;
  produtoId: string;
  nome: string;
  precoBase: number;
  custoUnitario: number;
  precoUnitario: number;
  quantidade: number;
  adicionais: AdicionalEscolhido[];
};

type FormaPagamento = "Dinheiro" | "Cartão" | "Pix";

type ComandaAberta = {
  id: string;
  numero: number;
  mesa_id: string | null;
  cliente_nome: string | null;
  total: number | string;
  status: string;
};

type Atendimento = {
  chave: string;
  tipo: "avulsa" | "comanda";
  comandaId?: string;
  numero?: number;
  clienteNome?: string | null;
  carrinho: ItemCarrinho[];
};

function moeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

function criarChaveItem(
  produtoId: string,
  adicionais: AdicionalEscolhido[],
) {
  const ids = adicionais
    .map((adicional) => adicional.id)
    .sort()
    .join("-");

  return `${produtoId}::${ids}`;
}

export default function PdvPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([
    { chave: "avulsa", tipo: "avulsa", carrinho: [] },
  ]);
  const [atendimentoAtivo, setAtendimentoAtivo] = useState("avulsa");
  const [comandasAbertas, setComandasAbertas] = useState<ComandaAberta[]>([]);
  const [modalNovaComanda, setModalNovaComanda] = useState(false);
  const [clienteNovaComanda, setClienteNovaComanda] = useState("");
  const [abrindoComanda, setAbrindoComanda] = useState(false);
  const [fechandoComandaId, setFechandoComandaId] = useState<string | null>(null);
  const [modalFecharComanda, setModalFecharComanda] = useState(false);

  const atendimentoAtual =
    atendimentos.find((item) => item.chave === atendimentoAtivo) ??
    atendimentos[0];

  const carrinho = atendimentoAtual?.carrinho ?? [];

  const comandaAtual =
    atendimentoAtual?.tipo === "comanda" && atendimentoAtual.comandaId
      ? comandasAbertas.find(
          (comanda) => comanda.id === atendimentoAtual.comandaId,
        )
      : undefined;

  const totalComandaAtual = Number(comandaAtual?.total ?? 0);

  function setCarrinho(
    atualizador:
      | ItemCarrinho[]
      | ((atual: ItemCarrinho[]) => ItemCarrinho[]),
  ) {
    setAtendimentos((atuais) =>
      atuais.map((atendimento) => {
        if (atendimento.chave !== atendimentoAtivo) return atendimento;
        const proximo =
          typeof atualizador === "function"
            ? atualizador(atendimento.carrinho)
            : atualizador;
        return { ...atendimento, carrinho: proximo };
      }),
    );
  }

  const [categoriaSelecionada, setCategoriaSelecionada] =
    useState<string | "todas">("todas");

  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamento>("Dinheiro");

  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  const [produtoSelecionado, setProdutoSelecionado] =
    useState<Produto | null>(null);

  const [adicionaisProduto, setAdicionaisProduto] = useState<Adicional[]>([]);
  const [adicionaisEscolhidos, setAdicionaisEscolhidos] =
    useState<string[]>([]);

  const [modalAdicionalAberto, setModalAdicionalAberto] = useState(false);
  const [carregandoAdicionais, setCarregandoAdicionais] = useState(false);

  useEffect(() => {
    carregarDados();
    carregarComandas();

    const canal = supabase
      .channel("pdv-comandas-abertas")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comandas" },
        carregarComandas,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function carregarComandas() {
    const { data, error } = await supabase
      .from("comandas")
      .select("id, numero, mesa_id, cliente_nome, total, status")
      .eq("status", "Aberta")
      .order("numero");

    if (error) {
      console.error("Erro ao carregar comandas:", error);
      return;
    }

    const comandasData = (data ?? []) as ComandaAberta[];

    setComandasAbertas(comandasData);

    setAtendimentos((atuais) => {
      const avulsa =
        atuais.find((item) => item.chave === "avulsa") ??
        ({ chave: "avulsa", tipo: "avulsa", carrinho: [] } as Atendimento);

      const abas = comandasData.map((comanda): Atendimento => {
        const existente = atuais.find((item) => item.comandaId === comanda.id);

        return {
          chave: `comanda:${comanda.id}`,
          tipo: "comanda",
          comandaId: comanda.id,
          numero: comanda.numero,
          clienteNome: comanda.cliente_nome,
          carrinho: existente?.carrinho ?? [],
        };
      });

      return [avulsa, ...abas];
    });
  }

  async function abrirNovaComanda() {
    const nome = clienteNovaComanda.trim();

    if (!nome) {
      setMensagem("Informe o nome do cliente.");
      return;
    }

    setAbrindoComanda(true);
    setMensagem("");

    const { data, error } = await supabase.rpc("abrir_comanda", {
      p_cliente_nome: nome,
    });

    setAbrindoComanda(false);

    if (error) {
      setMensagem(error.message);
      return;
    }

    setClienteNovaComanda("");
    setModalNovaComanda(false);

    await carregarComandas();

    if (data?.comanda_id) {
      setAtendimentoAtivo(`comanda:${data.comanda_id}`);
    }

    setMensagem(
      `Comanda #${data?.numero ?? ""} aberta para ${
        data?.cliente_nome ?? nome
      }.`,
    );
  }

  async function carregarItensParaImpressao(comandaId: string) {
    const { data: pedidosData, error: pedidosError } = await supabase
      .from("comanda_pedidos")
      .select("id, status")
      .eq("comanda_id", comandaId)
      .neq("status", "Cancelado");

    if (pedidosError) throw new Error(pedidosError.message);

    const pedidoIds = (pedidosData ?? []).map((pedido) => pedido.id);

    if (pedidoIds.length === 0) {
      return [];
    }

    const { data: itensData, error: itensError } = await supabase
      .from("comanda_itens")
      .select("id, nome, quantidade, valor_unitario")
      .in("pedido_id", pedidoIds);

    if (itensError) throw new Error(itensError.message);

    const idsItens = (itensData ?? []).map((item) => item.id);

    let extrasData: {
      item_id: string;
      nome: string;
      valor: number | string;
    }[] = [];

    if (idsItens.length > 0) {
      const { data, error } = await supabase
        .from("comanda_item_adicionais")
        .select("item_id, nome, valor")
        .in("item_id", idsItens);

      if (error) throw new Error(error.message);

      extrasData = data ?? [];
    }

    return (itensData ?? []).map((item) => ({
      ...item,
      extras: extrasData.filter((extra) => extra.item_id === item.id),
    }));
  }

  function escreverComprovante(
    janela: Window,
    dados: {
      numeroComanda: number;
      clienteNome: string;
      numeroVenda: string | number;
      total: number;
      formaPagamento: FormaPagamento;
      itens: {
        id: string;
        nome: string;
        quantidade: number;
        valor_unitario: number | string;
        extras: {
          item_id: string;
          nome: string;
          valor: number | string;
        }[];
      }[];
    },
  ) {
    const linhas = dados.itens
      .map((item) => {
        const subtotal =
          Number(item.valor_unitario) * Number(item.quantidade);

        const extras = item.extras
          .map(
            (extra) =>
              `<div class="extra">+ ${extra.nome}</div>`,
          )
          .join("");

        return `
          <div class="item">
            <div class="linha">
              <span>${item.quantidade}x ${item.nome}</span>
              <strong>${moeda(subtotal)}</strong>
            </div>
            ${extras}
          </div>
        `;
      })
      .join("");

    const dataHora = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    janela.document.open();
    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Venda #${dados.numeroVenda}</title>
          <style>
            @page { size: 80mm auto; margin: 4mm; }
            * { box-sizing: border-box; }
            body {
              width: 72mm;
              margin: 0 auto;
              color: #000;
              background: #fff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 12px;
              line-height: 1.35;
            }
            .centro { text-align: center; }
            h1 { margin: 0; font-size: 18px; }
            .subtitulo { margin-top: 3px; font-size: 11px; }
            .separador { margin: 10px 0; border-top: 1px dashed #000; }
            .linha { display: flex; justify-content: space-between; gap: 10px; }
            .item { margin: 7px 0; }
            .extra { margin-left: 12px; font-size: 11px; }
            .total { margin-top: 8px; font-size: 17px; font-weight: 700; }
            .rodape { margin-top: 14px; text-align: center; font-size: 10px; }
            @media print { body { width: auto; } }
          </style>
        </head>
        <body>
          <div class="centro">
            <h1>Silvas' Pizza Frita</h1>
            <div class="subtitulo">COMPROVANTE DE VENDA</div>
          </div>

          <div class="separador"></div>

          
          <div><strong>Cliente:</strong> ${dados.clienteNome}</div>
          <div><strong>Venda:</strong> #${dados.numeroVenda}</div>
          <div><strong>Data:</strong> ${dataHora}</div>

          <div class="separador"></div>

          ${linhas || "<div>Nenhum item.</div>"}

          <div class="separador"></div>

          <div class="linha">
            <span>Pagamento</span>
            <strong>${dados.formaPagamento}</strong>
          </div>

          <div class="linha total">
            <span>TOTAL</span>
            <span>${moeda(dados.total)}</span>
          </div>

          <div class="separador"></div>

          <div class="rodape">Obrigado pela preferência!</div>

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

  async function fecharComandaNoPdv(imprimir = false) {
    if (
      atendimentoAtual?.tipo !== "comanda" ||
      !atendimentoAtual.comandaId
    ) {
      return;
    }

    if (carrinho.length === 0 && totalComandaAtual <= 0) {
      setMensagem("Adicione pelo menos um produto.");
      setModalFecharComanda(false);
      return;
    }

    let janelaImpressao: Window | null = null;

    if (imprimir) {
      janelaImpressao = window.open(
        "",
        "_blank",
        "width=420,height=720",
      );

      if (!janelaImpressao) {
        alert(
          "O navegador bloqueou a impressão. Permita pop-ups para este site.",
        );
        return;
      }

      janelaImpressao.document.write(
        "<p style='font-family:Arial;padding:20px'>Preparando impressão...</p>",
      );
    }

    setFinalizando(true);
    setMensagem("");

    try {
      /*
       * Se houver produtos no carrinho, eles são enviados para a comanda
       * automaticamente. Para o atendente isso é uma única ação:
       * FINALIZAR VENDA.
       */
      if (carrinho.length > 0) {
        const { error: pedidoError } = await supabase.rpc(
          "enviar_pedido_comanda",
          {
            p_comanda_id: atendimentoAtual.comandaId,
            p_itens: carrinho.map((item) => ({
              produto_id: item.produtoId,
              quantidade: item.quantidade,
              adicionais: item.adicionais.map(
                (adicional) => adicional.id,
              ),
            })),
            p_observacao: null,
          },
        );

        if (pedidoError) {
          throw new Error(pedidoError.message);
        }
      }

      /*
       * Depois de gravar os itens, buscamos os dados definitivos para o
       * comprovante. Assim impressão e venda usam exatamente o mesmo pedido.
       */
      const itensImpressao = imprimir
        ? await carregarItensParaImpressao(
            atendimentoAtual.comandaId,
          )
        : [];

      const { data, error } = await supabase.rpc(
        "fechar_comanda",
        {
          p_comanda_id: atendimentoAtual.comandaId,
          p_forma_pagamento: formaPagamento,
        },
      );

      if (error) throw new Error(error.message);

      const numero = atendimentoAtual.numero ?? 0;
      const clienteNome =
        atendimentoAtual.clienteNome || "Cliente sem nome";
      const totalFinal = Number(
        data?.total ?? totalComandaAtual + total,
      );

      if (imprimir && janelaImpressao) {
        escreverComprovante(janelaImpressao, {
          numeroComanda: numero,
          clienteNome,
          numeroVenda: data?.numero_venda ?? "",
          total: totalFinal,
          formaPagamento,
          itens: itensImpressao,
        });
      }

      setCarrinho([]);
      setModalFecharComanda(false);
      setAtendimentoAtivo("avulsa");

      await Promise.all([
        carregarDados(),
        carregarComandas(),
      ]);

      setMensagem(
        `Venda #${data?.numero_venda ?? ""} finalizada em ${moeda(
          totalFinal,
        )}.`,
      );
    } catch (error) {
      if (janelaImpressao && !janelaImpressao.closed) {
        janelaImpressao.close();
      }

      console.error("Erro ao finalizar venda da comanda:", error);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a venda.",
      );
    } finally {
      setFinalizando(false);
    }
  }

  function abrirModalFechamento() {
    if (
      atendimentoAtual?.tipo !== "comanda" ||
      !atendimentoAtual.comandaId
    ) {
      return;
    }

    if (carrinho.length === 0 && totalComandaAtual <= 0) {
      setMensagem("Adicione pelo menos um produto.");
      return;
    }

    setMensagem("");
    setModalFecharComanda(true);
  }

  async function fecharComandaPeloX(
    atendimento: Atendimento,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();

    if (atendimento.tipo !== "comanda" || !atendimento.comandaId) return;

    const comanda = comandasAbertas.find(
      (item) => item.id === atendimento.comandaId,
    );
    const totalComanda = Number(comanda?.total ?? 0);
    const nome = atendimento.clienteNome || "Cliente";

    if (atendimento.carrinho.length > 0) {
      setMensagem(
        `A Comanda #${atendimento.numero} possui itens ainda não enviados. Envie ou remova esses itens antes de fechar.`,
      );
      return;
    }

    if (totalComanda > 0) {
      setMensagem(
        `A Comanda #${atendimento.numero} possui ${moeda(totalComanda)} em consumo. Faça o fechamento pela tela de Comandas para registrar o pagamento.`,
      );
      return;
    }

    const confirmar = window.confirm(
      `Fechar a Comanda #${atendimento.numero} de ${nome}?`,
    );
    if (!confirmar) return;

    setFechandoComandaId(atendimento.comandaId);
    setMensagem("");

    try {
      const { error } = await supabase.rpc(
        "fechar_comanda_vazia",
        {
          p_comanda_id: atendimento.comandaId,
        },
      );

      if (error) throw new Error(error.message);

      if (atendimentoAtivo === atendimento.chave) {
        setAtendimentoAtivo("avulsa");
      }

      setMensagem(`Comanda #${atendimento.numero} encerrada.`);
      await carregarComandas();
    } catch (error) {
      console.error("Erro ao fechar comanda vazia:", error);
      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível fechar a comanda.",
      );
    } finally {
      setFechandoComandaId(null);
    }
  }

  async function carregarDados() {
    setCarregando(true);
    setMensagem("");

    const [categoriasResponse, produtosResponse] = await Promise.all([
      supabase
        .from("categorias")
        .select("id, nome, permite_adicionais")
        .order("nome"),

      supabase
        .from("produtos")
        .select("id, nome, preco, custo, favorito, ativo, categoria_id, imagem_url, controla_estoque, estoque_atual, estoque_minimo")
        .eq("ativo", true)
        .order("nome"),
    ]);

    if (categoriasResponse.error || produtosResponse.error) {
      console.error(
        "Erro ao carregar categorias:",
        categoriasResponse.error,
      );
      console.error(
        "Erro ao carregar produtos:",
        produtosResponse.error,
      );

      setMensagem("Não foi possível carregar os produtos.");
      setCarregando(false);
      return;
    }

    setCategorias(categoriasResponse.data ?? []);
    setProdutos(produtosResponse.data ?? []);
    setCarregando(false);
  }

  function quantidadeNoCarrinho(produtoId: string) {
    return carrinho
      .filter((item) => item.produtoId === produtoId)
      .reduce((soma, item) => soma + item.quantidade, 0);
  }

  function adicionarItemAoCarrinho(
    produto: Produto,
    adicionais: AdicionalEscolhido[] = [],
  ) {
    const quantidadeAtualNoCarrinho = quantidadeNoCarrinho(produto.id);

    if (
      produto.controla_estoque &&
      quantidadeAtualNoCarrinho >= Number(produto.estoque_atual ?? 0)
    ) {
      setMensagem(
        produto.estoque_atual <= 0
          ? `${produto.nome} está sem estoque.`
          : `Só existem ${produto.estoque_atual} unidade(s) de ${produto.nome}.`,
      );
      return;
    }

    const precoBase = Number(produto.preco);
    const custoUnitario = Number(produto.custo ?? 0);

    const totalAdicionais = adicionais.reduce(
      (soma, adicional) => soma + adicional.preco,
      0,
    );

    const precoUnitario = precoBase + totalAdicionais;
    const chave = criarChaveItem(produto.id, adicionais);

    setCarrinho((atual) => {
      const itemExistente = atual.find(
        (item) => item.chave === chave,
      );

      if (itemExistente) {
        return atual.map((item) =>
          item.chave === chave
            ? {
              ...item,
              quantidade: item.quantidade + 1,
            }
            : item,
        );
      }

      return [
        ...atual,
        {
          chave,
          produtoId: produto.id,
          nome: produto.nome,
          precoBase,
          custoUnitario,
          precoUnitario,
          quantidade: 1,
          adicionais,
        },
      ];
    });

    setMensagem("");
  }

  async function abrirProduto(produto: Produto) {
    setMensagem("");
    setCarregandoAdicionais(true);

    const categoriaProduto = categorias.find(
      (categoria) => categoria.id === produto.categoria_id,
    );

    if (!categoriaProduto?.permite_adicionais) {
      adicionarItemAoCarrinho(produto);
      setCarregandoAdicionais(false);
      return;
    }

    const { data: vinculos, error: erroVinculos } = await supabase
      .from("produto_adicionais")
      .select("adicional_id")
      .eq("produto_id", produto.id);

    if (erroVinculos) {
      console.error(
        "Erro ao carregar adicionais do produto:",
        erroVinculos,
      );

      setMensagem(
        "Não foi possível verificar os adicionais deste produto.",
      );
      setCarregandoAdicionais(false);
      return;
    }

    const idsAdicionais = (vinculos ?? []).map(
      (item) => item.adicional_id as string,
    );

    if (idsAdicionais.length === 0) {
      adicionarItemAoCarrinho(produto);
      setCarregandoAdicionais(false);
      return;
    }

    const { data: adicionaisData, error: erroAdicionais } =
      await supabase
        .from("adicionais")
        .select("id, nome, preco")
        .in("id", idsAdicionais)
        .eq("ativo", true)
        .order("nome");

    if (erroAdicionais) {
      console.error(
        "Erro ao carregar dados dos adicionais:",
        erroAdicionais,
      );

      setMensagem(
        "Não foi possível carregar os adicionais deste produto.",
      );
      setCarregandoAdicionais(false);
      return;
    }

    const adicionaisAtivos = adicionaisData ?? [];

    if (adicionaisAtivos.length === 0) {
      adicionarItemAoCarrinho(produto);
      setCarregandoAdicionais(false);
      return;
    }

    setProdutoSelecionado(produto);
    setAdicionaisProduto(adicionaisAtivos);
    setAdicionaisEscolhidos([]);
    setModalAdicionalAberto(true);
    setCarregandoAdicionais(false);
  }

  function fecharModalAdicionais() {
    setProdutoSelecionado(null);
    setAdicionaisProduto([]);
    setAdicionaisEscolhidos([]);
    setModalAdicionalAberto(false);
  }

  function alternarAdicional(adicionalId: string) {
    setAdicionaisEscolhidos((atuais) =>
      atuais.includes(adicionalId)
        ? atuais.filter((id) => id !== adicionalId)
        : [...atuais, adicionalId],
    );
  }

  function confirmarProdutoComAdicionais() {
    if (!produtoSelecionado) return;

    const adicionaisSelecionados = adicionaisProduto
      .filter((adicional) =>
        adicionaisEscolhidos.includes(adicional.id),
      )
      .map((adicional) => ({
        id: adicional.id,
        nome: adicional.nome,
        preco: Number(adicional.preco),
      }));

    adicionarItemAoCarrinho(
      produtoSelecionado,
      adicionaisSelecionados,
    );

    fecharModalAdicionais();
  }

  function aumentarQuantidade(chave: string) {
    setCarrinho((atual) =>
      atual.map((item) =>
        item.chave === chave
          ? {
            ...item,
            quantidade: item.quantidade + 1,
          }
          : item,
      ),
    );
  }

  function diminuirQuantidade(chave: string) {
    setCarrinho((atual) =>
      atual
        .map((item) =>
          item.chave === chave
            ? {
              ...item,
              quantidade: item.quantidade - 1,
            }
            : item,
        )
        .filter((item) => item.quantidade > 0),
    );
  }

  function removerProduto(chave: string) {
    setCarrinho((atual) =>
      atual.filter((item) => item.chave !== chave),
    );
  }

  function limparPedido() {
    setCarrinho([]);
    setMensagem("");
  }
  async function alternarFavorito(
    produto: Produto,
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();

    const novoFavorito = !produto.favorito;

    setProdutos((atuais) =>
      atuais.map((item) =>
        item.id === produto.id
          ? {
            ...item,
            favorito: novoFavorito,
          }
          : item,
      ),
    );

    const { error } = await supabase
      .from("produtos")
      .update({
        favorito: novoFavorito,
      })
      .eq("id", produto.id);

    if (error) {
      console.error("Erro ao favoritar produto:", error);

      setProdutos((atuais) =>
        atuais.map((item) =>
          item.id === produto.id
            ? {
              ...item,
              favorito: produto.favorito,
            }
            : item,
        ),
      );

      setMensagem("Não foi possível alterar o favorito.");
    }
  }

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    return produtos
      .filter((produto) => {
        const categoriaOk =
          categoriaSelecionada === "todas" ||
          produto.categoria_id === categoriaSelecionada;

        const buscaOk =
          !termo ||
          produto.nome.toLowerCase().includes(termo);

        return categoriaOk && buscaOk;
      })
      .sort((a, b) => {
        // Favoritos primeiro
        if (a.favorito !== b.favorito) {
          return a.favorito ? -1 : 1;
        }

        // Depois ordem alfabética
        return a.nome.localeCompare(b.nome, "pt-BR");
      });
  }, [produtos, categoriaSelecionada, busca]);

  const quantidadeTotal = useMemo(
    () =>
      carrinho.reduce(
        (soma, item) => soma + item.quantidade,
        0,
      ),
    [carrinho],
  );

  const total = useMemo(
    () =>
      carrinho.reduce(
        (soma, item) =>
          soma + item.precoUnitario * item.quantidade,
        0,
      ),
    [carrinho],
  );

  const totalAdicionaisModal = useMemo(
    () =>
      adicionaisProduto
        .filter((adicional) =>
          adicionaisEscolhidos.includes(adicional.id),
        )
        .reduce(
          (soma, adicional) =>
            soma + Number(adicional.preco),
          0,
        ),
    [adicionaisProduto, adicionaisEscolhidos],
  );

  const totalProdutoModal =
    Number(produtoSelecionado?.preco ?? 0) +
    totalAdicionaisModal;

  async function finalizarVendaAvulsa(imprimir = false) {
    if (carrinho.length === 0) {
      setMensagem("Adicione pelo menos um produto.");
      setModalFecharComanda(false);
      return;
    }

    let janelaImpressao: Window | null = null;

    if (imprimir) {
      janelaImpressao = window.open(
        "",
        "_blank",
        "width=420,height=720",
      );

      if (!janelaImpressao) {
        alert(
          "O navegador bloqueou a impressão. Permita pop-ups para este site.",
        );
        return;
      }

      janelaImpressao.document.write(
        "<p style='font-family:Arial;padding:20px'>Preparando impressão...</p>",
      );
    }

    setFinalizando(true);
    setMensagem("");

    try {
      const itensImpressao = carrinho.map((item, index) => ({
        id: `${item.produtoId}-${index}`,
        nome: item.nome,
        quantidade: item.quantidade,
        valor_unitario: item.precoUnitario,
        extras: item.adicionais.map((adicional) => ({
          item_id: `${item.produtoId}-${index}`,
          nome: adicional.nome,
          valor: adicional.preco,
        })),
      }));

      const { data, error } = await supabase.rpc(
        "registrar_venda_pdv",
        {
          p_forma_pagamento: formaPagamento,
          p_itens: carrinho.map((item) => ({
            produto_id: item.produtoId,
            quantidade: item.quantidade,
            adicionais: item.adicionais.map(
              (adicional) => adicional.id,
            ),
          })),
        },
      );

      if (error) throw new Error(error.message);

      const totalFinal = Number(data?.total ?? total);

      if (imprimir && janelaImpressao) {
        escreverComprovante(janelaImpressao, {
          numeroComanda: 0,
          clienteNome: "Venda avulsa",
          numeroVenda: data?.numero_venda ?? "",
          total: totalFinal,
          formaPagamento,
          itens: itensImpressao,
        });
      }

      setCarrinho([]);
      setModalFecharComanda(false);

      setMensagem(
        `Venda #${data?.numero_venda ?? ""} de ${moeda(
          totalFinal,
        )} finalizada com sucesso.`,
      );

      await carregarDados();
    } catch (error) {
      if (janelaImpressao && !janelaImpressao.closed) {
        janelaImpressao.close();
      }

      console.error("Erro ao finalizar venda avulsa:", error);

      setMensagem(
        error instanceof Error
          ? error.message
          : "Não foi possível finalizar a venda.",
      );
    } finally {
      setFinalizando(false);
    }
  }

  async function finalizarVenda() {
    if (carrinho.length === 0 && atendimentoAtual?.tipo === "avulsa") {
      setMensagem("Adicione pelo menos um produto.");
      return;
    }

    if (
      atendimentoAtual?.tipo === "comanda" &&
      carrinho.length === 0 &&
      totalComandaAtual <= 0
    ) {
      setMensagem("Adicione pelo menos um produto.");
      return;
    }

    setMensagem("");
    setModalFecharComanda(true);
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-900">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-red-600">
              Silvas&apos; Pizza Frita
            </p>

            <h1 className="text-3xl font-bold">
              Ponto de venda
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/comandas"
              className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-red-700"
            >
              <ClipboardList className="h-5 w-5" />
              Comandas
            </Link>

            <Link
              href="/"
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-semibold transition hover:bg-zinc-50"
            >
              ← Voltar ao menu
            </Link>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 overflow-x-auto rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm">
          {atendimentos.map((atendimento) => {
            const ativo = atendimento.chave === atendimentoAtivo;

            if (atendimento.tipo === "avulsa") {
              return (
                <button
                  key={atendimento.chave}
                  type="button"
                  onClick={() => {
                    setAtendimentoAtivo(atendimento.chave);
                    setMensagem("");
                  }}
                  className={`whitespace-nowrap rounded-xl px-4 py-3 text-sm font-bold transition ${
                    ativo
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                  }`}
                >
                  Venda avulsa
                </button>
              );
            }

            return (
              <div
                key={atendimento.chave}
                className={`flex shrink-0 items-center overflow-hidden rounded-xl text-sm font-bold transition ${
                  ativo
                    ? "bg-red-600 text-white shadow-sm"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setAtendimentoAtivo(atendimento.chave);
                    setMensagem("");
                  }}
                  className="whitespace-nowrap py-3 pl-4 pr-2"
                >
                  #{atendimento.numero} {atendimento.clienteNome || "Cliente"}
                </button>

                <button
                  type="button"
                  onClick={(event) => fecharComandaPeloX(atendimento, event)}
                  disabled={fechandoComandaId === atendimento.comandaId}
                  className={`mr-1 flex h-7 w-7 items-center justify-center rounded-lg transition ${
                    ativo
                      ? "hover:bg-red-700"
                      : "text-zinc-500 hover:bg-zinc-300 hover:text-red-700"
                  } disabled:opacity-40`}
                  title="Finalizar venda"
                  aria-label={`Fechar Comanda #${atendimento.numero}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => {
              setClienteNovaComanda("");
              setModalNovaComanda(true);
              setMensagem("");
            }}
            className="flex whitespace-nowrap items-center gap-2 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
          >
            <Plus className="h-4 w-4" />
            Nova comanda
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_390px]">
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="mb-5 text-sm text-zinc-500">
              Clique nos produtos para adicionar ao pedido.
            </p>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
              <button
                type="button"
                onClick={() =>
                  setCategoriaSelecionada("todas")
                }
                className={`whitespace-nowrap rounded-xl px-4 py-3 font-semibold transition ${categoriaSelecionada === "todas"
                  ? "bg-red-600 text-white"
                  : "bg-zinc-100 hover:bg-zinc-200"
                  }`}
              >
                Todos
              </button>

              {categorias.map((categoria) => (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() =>
                    setCategoriaSelecionada(categoria.id)
                  }
                  className={`whitespace-nowrap rounded-xl px-4 py-3 font-semibold transition ${categoriaSelecionada === categoria.id
                    ? "bg-red-600 text-white"
                    : "bg-zinc-100 hover:bg-zinc-200"
                    }`}
                >
                  {categoria.nome}
                </button>
              ))}
            </div>

            <input
              type="search"
              placeholder="🔍 Procurar produto..."
              value={busca}
              onChange={(event) =>
                setBusca(event.target.value)
              }
              className="mb-5 w-full rounded-xl border border-zinc-300 p-4 text-lg outline-none focus:border-red-500"
            />

            {carregando ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
                Carregando produtos...
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
                Nenhum produto encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {produtosFiltrados.map((produto) => {
                  const quantidadeProduto =
                    quantidadeNoCarrinho(produto.id);

                  return (
                    <div
                      key={produto.id}
                      className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                        produto.controla_estoque && produto.estoque_atual <= 0
                          ? "border-red-400 ring-2 ring-red-100"
                          : "border-zinc-200 hover:-translate-y-1 hover:border-red-500 hover:shadow-xl"
                      }`}
                    >
                      {/* ESTRELA DE FAVORITO */}
                      <button
                        type="button"
                        onClick={(event) =>
                          alternarFavorito(produto, event)
                        }
                        className={`absolute left-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full shadow-md transition hover:scale-105 ${
                          produto.favorito
                            ? "bg-amber-50"
                            : "bg-white/95"
                        }`}
                        title={
                          produto.favorito
                            ? "Remover dos favoritos"
                            : "Adicionar aos favoritos"
                        }
                      >
                        <Star
                          className={`h-4 w-4 ${
                            produto.favorito
                              ? "fill-amber-400 text-amber-500"
                              : "fill-none text-zinc-400"
                          }`}
                          strokeWidth={2.2}
                        />
                      </button>

                      {/* QUANTIDADE NO CARRINHO */}
                      {quantidadeProduto > 0 && (
                        <div className="absolute right-3 top-3 z-30 flex h-9 min-w-9 items-center justify-center rounded-full bg-red-600 px-2 text-sm font-bold text-white shadow-lg">
                          {quantidadeProduto}
                        </div>
                      )}

                      {produto.controla_estoque && (
                        <div
                          className={`absolute left-3 top-14 z-20 rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${
                            produto.estoque_atual <= 0
                              ? "bg-red-600 text-white"
                              : produto.estoque_atual <= produto.estoque_minimo
                                ? "bg-amber-400 text-amber-950"
                                : "bg-white/95 text-zinc-600"
                          }`}
                        >
                          {produto.estoque_atual <= 0
                            ? "SEM ESTOQUE"
                            : `${produto.estoque_atual} restante(s)`}
                        </div>
                      )}

                      {/* ÁREA CLICÁVEL DO PRODUTO */}
                      <button
                        type="button"
                        onClick={() => abrirProduto(produto)}
                        disabled={
                          carregandoAdicionais ||
                          (produto.controla_estoque && produto.estoque_atual <= 0)
                        }
                        className="block w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {produto.imagem_url ? (
                          <img
                            src={produto.imagem_url}
                            alt={produto.nome}
                            className="h-48 w-full bg-white object-contain p-2"
                          />
                        ) : (
                          <div className="flex h-48 w-full items-center justify-center bg-zinc-100 text-5xl">
                            🍕
                          </div>
                        )}

                        <div className="flex min-h-40 flex-col justify-between p-4">
                          <span className="font-semibold text-zinc-900">
                            {produto.nome}
                          </span>

                          <span className="mt-3 text-lg font-bold text-red-600">
                            {moeda(Number(produto.preco))}
                          </span>

                          <div
                            className={`mt-4 rounded-xl py-3 text-center font-semibold text-white ${
                              produto.controla_estoque && produto.estoque_atual <= 0
                                ? "bg-zinc-400"
                                : quantidadeProduto > 0
                                  ? "bg-green-600"
                                  : "bg-red-600"
                            }`}
                          >
                            {produto.controla_estoque && produto.estoque_atual <= 0
                              ? "Indisponível"
                              : quantidadeProduto > 0
                                ? `${quantidadeProduto} no pedido`
                                : "+ Adicionar"}
                          </div>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {atendimentoAtual?.tipo === "comanda"
                ? `Comanda #${atendimentoAtual.numero}`
                : "Pedido"}
            </h2>
            {atendimentoAtual?.tipo === "comanda" && (
              <p className="font-semibold text-red-600">
                {atendimentoAtual.clienteNome || "Cliente"}
              </p>
            )}

            <p className="text-sm text-zinc-500">
              {quantidadeTotal} item(ns)
            </p>
          </div>

          {carrinho.length > 0 && (
            <button
              type="button"
              onClick={limparPedido}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              Limpar
            </button>
          )}
        </div>

        <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
          {carrinho.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              O pedido está vazio.
            </div>
          ) : (
            carrinho.map((item) => (
              <div
                key={item.chave}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm"
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {item.nome}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {moeda(item.precoBase)} base
                    </p>

                    {item.adicionais.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {item.adicionais.map(
                          (adicional) => (
                            <p
                              key={adicional.id}
                              className="text-sm text-green-700"
                            >
                              + {adicional.nome} (
                              {moeda(adicional.preco)})
                            </p>
                          ),
                        )}
                      </div>
                    )}
                  </div>

                  <p className="font-bold">
                    {moeda(
                      item.precoUnitario *
                      item.quantidade,
                    )}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        diminuirQuantidade(item.chave)
                      }
                      className="flex h-11 w-11 items-center justify-center bg-red-50 text-xl font-bold text-red-700 transition hover:bg-red-100"
                      aria-label={`Diminuir quantidade de ${item.nome}`}
                    >
                      −
                    </button>

                    <span className="flex h-11 w-12 items-center justify-center border-x border-zinc-200 text-lg font-bold text-zinc-900">
                      {item.quantidade}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        aumentarQuantidade(item.chave)
                      }
                      className="flex h-11 w-11 items-center justify-center bg-green-50 text-xl font-bold text-green-700 transition hover:bg-green-100"
                      aria-label={`Aumentar quantidade de ${item.nome}`}
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      removerProduto(item.chave)
                    }
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="my-5 border-t border-zinc-200 pt-5">
          <div className="flex items-end justify-between gap-3">
            <span className="font-medium text-zinc-500">
              Total
            </span>

            <strong className="text-right text-4xl font-extrabold text-red-600">
              {moeda(
                atendimentoAtual?.tipo === "comanda"
                  ? totalComandaAtual + total
                  : total,
              )}
            </strong>
          </div>

        </div>
        {atendimentoAtual?.tipo === "avulsa" && (
          <div className="mb-4">
            <p className="mb-2 font-semibold">
              Forma de pagamento
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormaPagamento("Dinheiro")}
                className={`rounded-xl border p-3 font-semibold ${
                  formaPagamento === "Dinheiro"
                    ? "border-green-600 bg-green-50 text-green-700"
                    : "border-zinc-200"
                }`}
              >
                💵 Dinheiro
              </button>

              <button
                type="button"
                onClick={() => setFormaPagamento("Cartão")}
                className={`rounded-xl border p-3 font-semibold ${
                  formaPagamento === "Cartão"
                    ? "border-blue-600 bg-blue-50 text-blue-700"
                    : "border-zinc-200"
                }`}
              >
                💳 Cartão
              </button>

              <button
                type="button"
                onClick={() => setFormaPagamento("Pix")}
                className={`rounded-xl border p-3 font-semibold ${
                  formaPagamento === "Pix"
                    ? "border-teal-600 bg-teal-50 text-teal-700"
                    : "border-zinc-200"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Pix
                </span>
              </button>
            </div>
          </div>
        )}

<button
          type="button"
          onClick={finalizarVenda}
          disabled={
            finalizando ||
            (atendimentoAtual?.tipo === "avulsa" &&
              carrinho.length === 0) ||
            (atendimentoAtual?.tipo === "comanda" &&
              carrinho.length === 0 &&
              totalComandaAtual <= 0)
          }
          className="w-full rounded-2xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-5 text-xl font-bold text-white shadow-lg transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:from-zinc-300 disabled:to-zinc-300"
        >
          {finalizando ? "Finalizando..." : "Finalizar venda"}
        </button>

        {mensagem && (
          <p
            className="mt-4 rounded-xl bg-zinc-100 p-3 text-center text-sm font-medium"
            aria-live="polite"
          >
            {mensagem}
          </p>
        )}
      </aside>
    </div>
      </div>

    {modalFecharComanda && atendimentoAtual && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-200 p-5">
              <div>
                <p className="text-sm font-semibold text-red-600">
                  Finalizar venda
                </p>
                <h2 className="text-xl font-extrabold">
                  {atendimentoAtual.tipo === "comanda"
                    ? `Venda #${atendimentoAtual.numero}`
                    : "Venda avulsa"}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {atendimentoAtual.tipo === "comanda"
                    ? atendimentoAtual.clienteNome || "Cliente"
                    : "Fechamento direto no PDV"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalFecharComanda(false)}
                disabled={finalizando}
                className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100 disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              <div className="mb-5 rounded-2xl bg-zinc-50 p-4 text-center">
                <p className="text-sm font-medium text-zinc-500">
                  Total da venda
                </p>
                <p className="mt-1 text-4xl font-extrabold text-red-600">
                  {moeda(
                    atendimentoAtual.tipo === "comanda"
                      ? totalComandaAtual + total
                      : total,
                  )}
                </p>
              </div>

              <p className="mb-2 text-sm font-bold text-zinc-700">
                Forma de pagamento
              </p>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setFormaPagamento("Dinheiro")}
                  disabled={finalizando}
                  className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                    formaPagamento === "Dinheiro"
                      ? "border-green-600 bg-green-50 text-green-700"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  💵 Dinheiro
                </button>

                <button
                  type="button"
                  onClick={() => setFormaPagamento("Cartão")}
                  disabled={finalizando}
                  className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                    formaPagamento === "Cartão"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  💳 Cartão
                </button>

                <button
                  type="button"
                  onClick={() => setFormaPagamento("Pix")}
                  disabled={finalizando}
                  className={`rounded-xl border px-2 py-3 text-sm font-semibold ${
                    formaPagamento === "Pix"
                      ? "border-teal-600 bg-teal-50 text-teal-700"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <span className="flex items-center justify-center gap-1">
                    <QrCode className="h-4 w-4" />
                    Pix
                  </span>
                </button>
              </div>

              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  onClick={() =>
                    atendimentoAtual.tipo === "comanda"
                      ? fecharComandaNoPdv(true)
                      : finalizarVendaAvulsa(true)
                  }
                  disabled={finalizando}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  <Printer className="h-5 w-5" />
                  {finalizando
                    ? "Finalizando..."
                    : "Finalizar e imprimir"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    atendimentoAtual.tipo === "comanda"
                      ? fecharComandaNoPdv(false)
                      : finalizarVendaAvulsa(false)
                  }
                  disabled={finalizando}
                  className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Finalizar sem imprimir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    {modalNovaComanda && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
        <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-200 p-5">
            <div>
              <p className="text-sm font-semibold text-red-600">Atendimento</p>
              <h2 className="text-2xl font-bold">Nova comanda</h2>
            </div>
            <button
              type="button"
              onClick={() => setModalNovaComanda(false)}
              className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div>
              <label className="mb-2 block text-sm font-semibold">Nome do cliente</label>
              <input
                type="text"
                value={clienteNovaComanda}
                onChange={(event) => setClienteNovaComanda(event.target.value)}
                placeholder="Ex.: João"
                maxLength={80}
                autoFocus
                className="w-full rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
              />
            </div>

          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-zinc-200 bg-zinc-50 p-5">
            <button
              type="button"
              onClick={() => setModalNovaComanda(false)}
              className="rounded-xl border border-zinc-300 bg-white px-4 py-3 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={abrirNovaComanda}
              disabled={abrindoComanda || !clienteNovaComanda.trim()}
              className="rounded-xl bg-red-600 px-4 py-3 font-bold text-white disabled:bg-zinc-300"
            >
              {abrindoComanda ? "Abrindo..." : "Abrir comanda"}
            </button>
          </div>
        </div>
      </div>
    )}

    { modalAdicionalAberto && produtoSelecionado && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
        <div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-2xl">
          <div className="flex items-start justify-between border-b border-zinc-200 p-5">
            <div>
              <p className="text-sm font-semibold text-red-600">
                Personalizar produto
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                {produtoSelecionado.nome}
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Selecione os adicionais desejados.
              </p>
            </div>

            <button
              type="button"
              onClick={fecharModalAdicionais}
              className="rounded-xl px-3 py-2 text-2xl hover:bg-zinc-100"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          <div className="space-y-3 p-5">
            {adicionaisProduto.map((adicional) => {
              const selecionado =
                adicionaisEscolhidos.includes(
                  adicional.id,
                );

              return (
                <label
                  key={adicional.id}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border p-4 transition ${selecionado
                    ? "border-red-500 bg-red-50"
                    : "border-zinc-200 hover:bg-zinc-50"
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selecionado}
                      onChange={() =>
                        alternarAdicional(adicional.id)
                      }
                      className="h-5 w-5"
                    />

                    <span className="font-semibold">
                      {adicional.nome}
                    </span>
                  </div>

                  <span className="font-bold text-green-700">
                    + {moeda(Number(adicional.preco))}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="border-t border-zinc-200 bg-zinc-50 p-5">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600">
                <span>Produto</span>

                <span>
                  {moeda(
                    Number(produtoSelecionado.preco),
                  )}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600">
                <span>Adicionais</span>

                <span>
                  {moeda(totalAdicionaisModal)}
                </span>
              </div>

              <div className="flex items-end justify-between border-t border-zinc-200 pt-3">
                <span className="font-semibold">
                  Total
                </span>

                <strong className="text-3xl text-red-600">
                  {moeda(totalProdutoModal)}
                </strong>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={fecharModalAdicionais}
                className="rounded-xl border border-zinc-300 bg-white px-4 py-4 font-semibold hover:bg-zinc-100"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={confirmarProdutoComAdicionais}
                className="rounded-xl bg-red-600 px-4 py-4 font-bold text-white hover:bg-red-700"
              >
                Adicionar ao pedido
              </button>
            </div>
          </div>
        </div>
      </div>
      )}
    </main>
  );
}
"use client";

import { useMemo, useState } from "react";
import { Pencil, Search, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Adicional } from "./ProdutosTab";

type Props = {
  adicionais: Adicional[];
  carregando: boolean;
  recarregar: () => Promise<void>;
};

export default function AdicionaisTab({
  adicionais,
  carregando,
  recarregar,
}: Props) {
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [adicionalEditando, setAdicionalEditando] =
    useState<Adicional | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alterandoId, setAlterandoId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const adicionaisFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return adicionais;

    return adicionais.filter((adicional) =>
      adicional.nome.toLowerCase().includes(termo),
    );
  }, [adicionais, busca]);

  function limparFormulario() {
    setNome("");
    setPreco("");
    setAtivo(true);
    setAdicionalEditando(null);
  }

  function editarAdicional(adicional: Adicional) {
    setAdicionalEditando(adicional);
    setNome(adicional.nome);
    setPreco(String(adicional.preco));
    setAtivo(adicional.ativo);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function salvarAdicional() {
    const nomeLimpo = nome.trim();
    const precoNumerico = Number(preco.replace(",", "."));

    if (!nomeLimpo) {
      alert("Informe o nome do adicional.");
      return;
    }

    if (!Number.isFinite(precoNumerico) || precoNumerico < 0) {
      alert("Informe um preço válido.");
      return;
    }

    setSalvando(true);

    try {
      if (adicionalEditando) {
        const { error } = await supabase
          .from("adicionais")
          .update({
            nome: nomeLimpo,
            preco: precoNumerico,
            ativo,
          })
          .eq("id", adicionalEditando.id);

        if (error) throw error;

        alert("Adicional atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("adicionais")
          .insert({
            nome: nomeLimpo,
            preco: precoNumerico,
            ativo: true,
          });

        if (error) throw error;

        alert("Adicional cadastrado com sucesso!");
      }

      limparFormulario();
      await recarregar();
    } catch (error) {
      console.error("Erro ao salvar adicional:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o adicional.",
      );
    } finally {
      setSalvando(false);
    }
  }

  async function alternarStatus(adicional: Adicional) {
    setAlterandoId(adicional.id);

    const { error } = await supabase
      .from("adicionais")
      .update({ ativo: !adicional.ativo })
      .eq("id", adicional.id);

    if (error) {
      alert(error.message);
    } else {
      if (adicionalEditando?.id === adicional.id) {
        limparFormulario();
      }
      await recarregar();
    }

    setAlterandoId(null);
  }

  return (
    <>
      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-5 text-xl font-bold">
          {adicionalEditando
            ? `Editando: ${adicionalEditando.nome}`
            : "Novo adicional"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            placeholder="Nome do adicional"
            className="rounded-xl border border-zinc-300 p-3 outline-none focus:border-red-500"
            disabled={salvando}
          />

          <div className="flex overflow-hidden rounded-xl border border-zinc-300 focus-within:border-red-500">
            <span className="flex items-center bg-zinc-50 px-4 text-zinc-500">
              R$
            </span>

            <input
              type="number"
              min="0"
              step="0.01"
              value={preco}
              onChange={(event) => setPreco(event.target.value)}
              placeholder="Preço"
              className="w-full p-3 outline-none"
              disabled={salvando}
            />
          </div>
        </div>

        {adicionalEditando && (
          <label className="mt-4 flex items-center gap-3">
            <input
              type="checkbox"
              checked={ativo}
              onChange={(event) => setAtivo(event.target.checked)}
              className="h-5 w-5"
            />
            <span className="font-medium">Adicional ativo</span>
          </label>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={salvarAdicional}
            disabled={salvando}
            className="rounded-xl bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-700 disabled:bg-zinc-400"
          >
            {salvando
              ? "Salvando..."
              : adicionalEditando
                ? "Salvar alterações"
                : "Salvar adicional"}
          </button>

          {adicionalEditando && (
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
              placeholder="Pesquisar adicional..."
              className="w-full rounded-xl border border-zinc-300 py-3 pl-10 pr-4 outline-none focus:border-red-500"
            />
          </div>
        </div>

        {carregando ? (
          <div className="p-10 text-center text-zinc-500">
            Carregando adicionais...
          </div>
        ) : adicionaisFiltrados.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">
            Nenhum adicional cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50">
                <tr className="border-b">
                  <th className="p-4 text-left">Adicional</th>
                  <th className="p-4 text-left">Preço</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-right">Ações</th>
                </tr>
              </thead>

              <tbody>
                {adicionaisFiltrados.map((adicional) => (
                  <tr key={adicional.id} className="border-b last:border-0">
                    <td className="p-4 font-medium">{adicional.nome}</td>

                    <td className="p-4">
                      R$ {Number(adicional.preco).toFixed(2)}
                    </td>

                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          adicional.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {adicional.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => editarAdicional(adicional)}
                          className="flex items-center gap-2 rounded-lg border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => alternarStatus(adicional)}
                          disabled={alterandoId === adicional.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                            adicional.ativo
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-green-200 text-green-700 hover:bg-green-50"
                          }`}
                        >
                          <XCircle className="h-4 w-4" />
                          {alterandoId === adicional.id
                            ? "Salvando..."
                            : adicional.ativo
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
    </>
  );
}
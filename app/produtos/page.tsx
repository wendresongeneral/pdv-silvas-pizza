'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<any[]>([]);

  useEffect(() => {
    async function carregarProdutos() {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .order('nome');

      if (error) {
        console.error(error);
      } else {
        setProdutos(data || []);
      }
    }

    carregarProdutos();
  }, []);

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-6">Produtos</h1>

      {produtos.length === 0 ? (
        <p>Nenhum produto cadastrado.</p>
      ) : (
        <ul className="space-y-2">
          {produtos.map((produto) => (
            <li
              key={produto.id}
              className="border rounded-lg p-4"
            >
              <strong>{produto.nome}</strong>

              <br />

              R$ {Number(produto.preco).toFixed(2)}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
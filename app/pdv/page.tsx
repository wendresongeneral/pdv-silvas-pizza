export default function Home() {
  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-red-600">
        🍕 PDV - Silvas' Pizza Frita
      </h1>

      <p className="mt-2 text-gray-600">
        Sistema de Controle Interno
      </p>

      <div className="grid grid-cols-2 gap-6 mt-10">

        <a
          href="/pdv"
          className="rounded-xl bg-red-600 text-white p-8 text-2xl text-center hover:bg-red-700"
        >
          🍕 Abrir PDV
        </a>

        <a
          href="/produtos"
          className="rounded-xl bg-blue-600 text-white p-8 text-2xl text-center hover:bg-blue-700"
        >
          📦 Produtos
        </a>

        <a
          href="/estoque"
          className="rounded-xl bg-green-600 text-white p-8 text-2xl text-center hover:bg-green-700"
        >
          🧂 Estoque
        </a>

        <a
          href="/caixa"
          className="rounded-xl bg-yellow-500 text-black p-8 text-2xl text-center hover:bg-yellow-400"
        >
          💰 Caixa
        </a>

      </div>
    </main>
  );
}
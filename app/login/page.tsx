"use client";

import Image from "next/image";
import { Suspense, useActionState } from "react";
import { LockKeyhole, LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "./actions";

const estadoInicial: LoginState = {};

function LoginContent() {
  const params = useSearchParams();

  const [estado, acao, pendente] = useActionState(
    login,
    estadoInicial
  );

  const proximo = params.get("next") || "/";

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-7 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-5 h-24 w-24 overflow-hidden rounded-full border border-zinc-200 bg-white shadow">
            <Image
              src="/logo.jpg"
              alt="Silvas Pizza Frita"
              width={96}
              height={96}
              className="h-full w-full object-cover"
              priority
            />
          </div>

          <p className="text-sm font-semibold text-red-600">
            Silvas&apos; Pizza Frita
          </p>

          <h1 className="mt-1 text-2xl font-extrabold">
            Acesso administrativo
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Entre para acessar PDV, comandas, estoque e relatórios.
          </p>
        </div>

        <form action={acao} className="mt-7 space-y-4">
          <input
            type="hidden"
            name="next"
            value={proximo}
          />

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              E-mail
            </span>

            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-red-500"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Senha
            </span>

            <input
              type="password"
              name="senha"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 outline-none focus:border-red-500"
            />
          </label>

          {estado.erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
              {estado.erro}
            </div>
          )}

          <button
            type="submit"
            disabled={pendente}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white hover:bg-red-700 disabled:bg-zinc-400"
          >
            {pendente ? (
              <>
                <LockKeyhole className="h-5 w-5" />
                Entrando...
              </>
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Entrar
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-100">
          <p className="text-sm text-zinc-500">
            Carregando...
          </p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
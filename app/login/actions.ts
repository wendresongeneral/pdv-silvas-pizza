"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  erro?: string;
};

export async function login(
  _estadoAnterior: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const senha = String(formData.get("senha") ?? "");
  const proximo = String(formData.get("next") ?? "/");

  if (!email || !senha) {
    return {
      erro: "Informe e-mail e senha.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return {
      erro: "E-mail ou senha incorretos.",
    };
  }

  const destino =
    proximo.startsWith("/") &&
    !proximo.startsWith("//") &&
    !proximo.startsWith("/login")
      ? proximo
      : "/";

  redirect(destino);
}
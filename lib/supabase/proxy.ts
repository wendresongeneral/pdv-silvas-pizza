import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

function rotaPublica(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/comanda/") ||
    pathname.startsWith("/api/comanda/")
  );
}

export async function updateSession(
  request: NextRequest,
) {
  let response = NextResponse.next({
    request,
  });

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL!;

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesToSet) {
        cookiesToSet.forEach(
          ({ name, value }) => {
            request.cookies.set(name, value);
          },
        );

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(
          ({ name, value, options }) => {
            response.cookies.set(
              name,
              value,
              options,
            );
          },
        );
      },
    },
  });

  const { data } =
    await supabase.auth.getClaims();

  const autenticado =
    Boolean(data?.claims?.sub);

  const pathname =
    request.nextUrl.pathname;

  if (
    !autenticado &&
    !rotaPublica(pathname)
  ) {
    const login =
      request.nextUrl.clone();

    login.pathname = "/login";
    login.search = "";

    if (pathname !== "/") {
      login.searchParams.set(
        "next",
        pathname,
      );
    }

    return NextResponse.redirect(login);
  }

  if (
    autenticado &&
    pathname === "/login"
  ) {
    const home =
      request.nextUrl.clone();

    home.pathname = "/";
    home.search = "";

    return NextResponse.redirect(home);
  }

  return response;
}
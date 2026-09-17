import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const cookiesToApply: { name: string; value: string; options: CookieOptions }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          cookiesToApply.push(...cookiesToSet);
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path.startsWith("/login") || path.startsWith("/auth");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    cookiesToApply.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    return response;
  }

  // getUser() above already verified this with the Supabase Auth server, so
  // downstream Server Components can trust this header and skip a redundant
  // verification round trip. It's set here, server-side, after
  // verification — a client can't forge it, since middleware always runs
  // first and this call unconditionally overwrites whatever the incoming
  // request header held.
  const requestHeaders = new Headers(request.headers);
  if (user) {
    requestHeaders.set("x-verified-user-id", user.id);
  } else {
    requestHeaders.delete("x-verified-user-id");
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  cookiesToApply.forEach(({ name, value, options }) => response.cookies.set(name, value, options));

  return response;
}

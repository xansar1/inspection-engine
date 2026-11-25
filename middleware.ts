import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error) {
    return NextResponse.json(
      { error: "Test Mode authentication could not be verified." },
      { status: 503 }
    );
  }
  if (!data.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json(
      { error: "Test Mode authorization could not be verified." },
      { status: 503 }
    );
  }
  if (!profile?.is_active || profile.role !== "admin") {
    return NextResponse.redirect(new URL("/inspections", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/inspections/test-mode/:path*"],
};

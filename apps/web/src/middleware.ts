import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware"

const PUBLIC_PATHS = ["/", "/login", "/portal/login", "/forgot-password", "/reset-password", "/auth/callback"]

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

function redirectToLogin(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone()
  url.pathname = pathname
  url.searchParams.set("next", req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/_next")) return NextResponse.next()
  if (isPublicPath(req.nextUrl.pathname)) return NextResponse.next()

  const client = createSupabaseMiddlewareClient(req)
  if (!client) return NextResponse.next()

  const { supabase, res } = client

  const {
    data: { user }
  } = await supabase.auth.getUser()

  if (!user) {
    if (req.nextUrl.pathname.startsWith("/portal")) return redirectToLogin(req, "/portal/login")
    return redirectToLogin(req, "/login")
  }

  const pathname = req.nextUrl.pathname

  let role = (user.user_metadata?.role as string | undefined) || null

  if (!role) {
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
    role = (data?.role as string | undefined) || null
  }

  if (pathname.startsWith("/portal")) {
    if (role && role !== "client") {
      const url = req.nextUrl.clone()
      url.pathname = "/dashboard"
      return NextResponse.redirect(url)
    }
  }

  if (pathname.startsWith("/workspace")) {
    if (role === "client") {
      const url = req.nextUrl.clone()
      url.pathname = "/portal"
      return NextResponse.redirect(url)
    }
  }

  if (pathname === "/dashboard" || pathname.startsWith("/projects") || pathname.startsWith("/tasks") || pathname.startsWith("/clients") || pathname.startsWith("/invoices") || pathname.startsWith("/chat")) {
    if (role === "client") {
      const url = req.nextUrl.clone()
      url.pathname = "/portal"
      return NextResponse.redirect(url)
    }
  }

  return res
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico).*)"]
}

import { NextResponse } from "next/server";
import { verifyAuthToken } from "./lib/jwt";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/usuarios/:path*",
    "/api/usuarios/:path*",
  ],
};

export function middleware(req) {
  const token = req.cookies.get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;
  const url = req.nextUrl;

  if (!session) {
    if (url.pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const rol = session.rol;
  const route = url.pathname;

  // Admin del sistema → acceso global
  if (rol === "admin_sistema") return NextResponse.next();

  // Admin de centro → dashboard y gestión usuarios
  if (rol === "admin_centro") {
    if (
      route.startsWith("/dashboard/admin-centro") ||
      route.startsWith("/usuarios")
    ) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/dashboard/admin-centro", req.url));
  }

  // Usuario operativo → solo su dashboard
  if (rol === "usuario_operativo") {
    if (route.startsWith("/dashboard/usuario-operativo")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/dashboard/usuario-operativo", req.url));
  }

  return NextResponse.next();
}
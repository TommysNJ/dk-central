// middleware.js
import { NextResponse } from "next/server";
import { verifyAuthToken } from "./lib/jwt";

export const runtime = "nodejs";   // <--- 🔥 Necesario para permitir jsonwebtoken

export const config = {
  matcher: ['/dashboard/:path*'],
};

export function middleware(req) {
  console.log("🔥 MIDDLEWARE EJECUTADO:", req.nextUrl.pathname);

  const token = req.cookies.get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;
  const pathname = req.nextUrl.pathname;

  // Si no está autenticado → login
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const rol = session.rol;

  // ==========================================
  // 🔐 BLOQUEO POR CAMBIO OBLIGATORIO DE CLAVE
  // ==========================================
  if (session.must_change_password) {
    const allow =
      pathname === "/dashboard/admin-sistema" ||
      pathname === "/dashboard/admin-centro" ||
      pathname === "/dashboard/usuario-operativo";

    if (!allow) {
      if (rol === "admin_sistema") {
        return NextResponse.redirect(new URL("/dashboard/admin-sistema", req.url));
      }
      if (rol === "admin_centro") {
        return NextResponse.redirect(new URL("/dashboard/admin-centro", req.url));
      }
      if (rol === "usuario_operativo") {
        return NextResponse.redirect(
          new URL("/dashboard/usuario-operativo", req.url)
        );
      }
    }
  }

  // === REGLAS POR ROL ===

  // ⭐ ADMIN SISTEMA 
  if (rol === "admin_sistema") {
    if (
      pathname.startsWith("/dashboard/admin-centro") ||
      pathname.startsWith("/dashboard/usuario-operativo")
    ) {
      return NextResponse.redirect(new URL("/dashboard/admin-sistema", req.url));
    }
    return NextResponse.next();
  }

  // ⭐ ADMIN CENTRO 
  if (rol === "admin_centro") {
    const allow =
      pathname.startsWith("/dashboard/admin-centro") ||
      pathname.startsWith("/dashboard/usuarios") ||
      pathname.startsWith("/dashboard/incidentes") ||
      pathname.startsWith("/dashboard/reportes") ||
      pathname.startsWith("/dashboard/resumenes");

    if (allow) return NextResponse.next();

    return NextResponse.redirect(new URL("/dashboard/admin-centro", req.url));
  }

  // ⭐ USUARIO OPERATIVO 
  if (rol === "usuario_operativo") {
    const allow =
      pathname.startsWith("/dashboard/usuario-operativo") ||
      pathname.startsWith("/dashboard/incidentes") ||
      pathname.startsWith("/dashboard/reportes") ||
      pathname.startsWith("/dashboard/resumenes");

    if (allow) return NextResponse.next();

    return NextResponse.redirect(
      new URL("/dashboard/usuario-operativo", req.url)
    );
  }

  return NextResponse.next();
}
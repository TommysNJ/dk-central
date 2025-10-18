import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";

export function getSession(req) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

/**
 * Autoriza una solicitud según los roles permitidos.
 * @param {Request} req
 * @param {string[]} rolesPermitidos
 * @returns {object|NextResponse}
 */
export async function authorize(req, rolesPermitidos = []) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const session = verifyAuthToken(token);
  if (!session) {
    return NextResponse.json({ message: "Token inválido o expirado" }, { status: 401 });
  }

  if (!rolesPermitidos.includes(session.rol)) {
    return NextResponse.json({ message: "No autorizado" }, { status: 403 });
  }

  return session;
}
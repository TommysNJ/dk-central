import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";

export async function GET(req) {
  const token = req.cookies.get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;
  if (!session) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

  return NextResponse.json({
    id_usuario: session.sub,
    nombre: session.nombre,
    rol: session.rol,
    id_centro_comercial: session.id_centro_comercial,
    area: session.area,
  });
}
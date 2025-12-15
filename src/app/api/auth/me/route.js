import { NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";

export async function GET(req) {
  const token = req.cookies.get("auth_token")?.value;
  const session = token ? verifyAuthToken(token) : null;
  if (!session) return NextResponse.json({ message: "No autenticado" }, { status: 401 });

  // 🔥 Obtener flag real desde BD
  const user = await prisma.usuarios.findUnique({
    where: { id_usuario: session.sub },
    select: {
      must_change_password: true,
    },
  });

  return NextResponse.json({
    id_usuario: session.sub,
    nombre: session.nombre,
    rol: session.rol,
    id_centro_comercial: session.id_centro_comercial,
    area: session.area,
    must_change_password: user.must_change_password, // ✅ AHORA SÍ
  });
}
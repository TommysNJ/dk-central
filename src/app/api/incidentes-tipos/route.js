import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

// Lista de tipos de incidente (para el filtro)
export async function GET(req) {
  const session = await authorize(req, [
    "admin_sistema",
    "admin_centro",
    "usuario_operativo",
  ]);

  if (session instanceof NextResponse) return session;

  const tipos = await prisma.incidentes.findMany({
    where: {
      nombre: { not: "otros" }, 
    },
    orderBy: { nombre: "asc" },
  });

  return NextResponse.json(tipos);
}

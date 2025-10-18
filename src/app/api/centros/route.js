import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

export async function GET(req) {
  const session = await authorize(req, ["admin_sistema", "admin_centro"]);
  if (session instanceof NextResponse) return session;

  const centros = await prisma.centros_comerciales.findMany({
    orderBy: { nombre: "asc" },
    select: { id_centro_comercial: true, nombre: true },
  });

  return NextResponse.json(centros);
}
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Clave para autorizar al microservicio
const BOT_API_KEY = process.env.BOT_API_KEY;

export async function GET(req) {
  const apiKey = req.headers.get("x-api-key");

  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const centros = await prisma.centros_comerciales.findMany({
      select: {
        id_centro_comercial: true,
        nombre: true,
        id_grupo_telegram: true,
      },
      orderBy: { id_centro_comercial: "asc" },
    });

    return NextResponse.json(centros);
  } catch (error) {
    console.error("Error obteniendo centros:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
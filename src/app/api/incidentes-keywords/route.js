import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const BOT_API_KEY = process.env.BOT_API_KEY;

export async function GET(req) {
  const apiKey = req.headers.get("x-api-key");

  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const data = await prisma.keywords_incidentes.findMany({
      include: {
        incidente: true,
      },
      orderBy: {
        id_keyword: "asc",
      },
    });

    const response = data.map((k) => ({
      keyword: k.palabra,
      id_incidente: k.id_incidente,
      incidente: k.incidente.nombre,
      area: k.incidente.area,
    }));

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error obteniendo keywords-incidentes:", error);
    return NextResponse.json(
      { message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

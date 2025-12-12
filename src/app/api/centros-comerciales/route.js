import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";


// 🔐 Misma clave que usa el microservicio / bot
const BOT_API_KEY = process.env.BOT_API_KEY || "CLAVE_SEGURA_DE_AUTENTICACION";
const TELEGRAM_WEBHOOK_URL = process.env.TELEGRAM_CENTROS_WEBHOOK || "";

// 🔹 GET: lista filtrada por ciudad
export async function GET(req) {
  const session = await authorize(req, ["admin_sistema"]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const ciudad = searchParams.get("search") || "";

  const where = ciudad ? { ciudad: { contains: ciudad } } : {};

  const centros = await prisma.centros_comerciales.findMany({
    where,
    orderBy: { id_centro_comercial: "desc" },
  });

  return NextResponse.json(centros);
}

// 🔹 POST: crear centro comercial
export async function POST(req) {
  const session = await authorize(req, ["admin_sistema"]);
  if (session instanceof NextResponse) return session;

  const data = await req.json();
  const { nombre, ciudad, ubicacion, id_grupo_telegram } = data;

  if (!nombre || !ciudad || !id_grupo_telegram) {
    return NextResponse.json(
      { message: "Campos obligatorios faltantes." },
      { status: 400 }
    );
  }


    // Validación del formato del ID del grupo
  const regexGrupo = /^-\d{1,15}$/;
  if (!regexGrupo.test(id_grupo_telegram)) {
    return NextResponse.json(
      { message: "El ID del grupo debe comenzar con '-' y contener hasta 15 dígitos." },
      { status: 400 }
    );
  }

  try {
    const duplicado = await prisma.centros_comerciales.findFirst({
      where: {
        OR: [{ nombre }, { id_grupo_telegram }],
      },
    });

    if (duplicado) {
      let campo = duplicado.nombre === nombre ? "nombre" : "id del grupo";
      return NextResponse.json(
        { message: `El ${campo} del centro comercial ya existe.` },
        { status: 400 }
      );
    }

    const nuevoCentro = await prisma.centros_comerciales.create({
      data: { nombre, ciudad, ubicacion: ubicacion || "", id_grupo_telegram },
    });

    // 🔔 Notificar al servicio de Telegram (webhook) – no rompe nada si falla
    if (TELEGRAM_WEBHOOK_URL) {
      try {
        fetch(TELEGRAM_WEBHOOK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": BOT_API_KEY,
          },
          body: JSON.stringify({
            action: "created",
            id_centro_comercial: nuevoCentro.id_centro_comercial,
            id_grupo_telegram: nuevoCentro.id_grupo_telegram,
            nombre: nuevoCentro.nombre,
          }),
        });
      } catch (err) {
        console.error("⚠️ Error notificando al servicio de Telegram (created):", err);
      }
    }

    return NextResponse.json(nuevoCentro, { status: 201 });
  } catch (error) {
    console.error("Error creando centro comercial:", error);
    return NextResponse.json(
      { message: "Error interno al crear centro comercial" },
      { status: 500 }
    );
  }
}
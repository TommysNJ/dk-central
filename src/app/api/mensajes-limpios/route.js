import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Misma clave que usa el microservicio Python
const BOT_API_KEY = process.env.BOT_API_KEY || "CLAVE_SEGURA_DE_AUTENTICACION";

// Contador global de duplicados (solo para logging, no persistente)
let mensajesDuplicadosCount = 0;

export async function POST(req) {
  const apiKey = req.headers.get("x-api-key");

  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      id_centro_comercial,
      id_mensaje_telegram, 
      contenido_original,
      contenido_limpio,
      remitente,
      fecha_envio,
    } = body;

    // Validaciones básicas
    if (!id_centro_comercial || !id_mensaje_telegram || !contenido_limpio || !fecha_envio) {
      return NextResponse.json(
        { message: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // Verificar si el mensaje ya fue guardado
    const existente = await prisma.mensajes_limpios.findUnique({
      where: {
        id_centro_comercial_id_mensaje_telegram: {
          id_centro_comercial: Number(id_centro_comercial),
          id_mensaje_telegram: Number(id_mensaje_telegram),
        },
      },
    });

    if (existente) {
      mensajesDuplicadosCount++;
      console.log(
        `⚠️ Mensaje duplicado omitido (Centro ${id_centro_comercial}, Telegram ID ${id_mensaje_telegram}). Total omitidos: ${mensajesDuplicadosCount}`
      );

      return NextResponse.json(
        { message: "Mensaje ya registrado" },
        { status: 200 }
      );
    }

    // 🕐 Convertir a hora Ecuador (UTC-5)
    const fechaOriginal = new Date(fecha_envio);
    const fechaEcuador = new Date(fechaOriginal.getTime() - 5 * 60 * 60 * 1000);

    // 💾 Guardar mensaje limpio
    const nuevoMensaje = await prisma.mensajes_limpios.create({
      data: {
        id_centro_comercial: Number(id_centro_comercial),
        id_mensaje_telegram: Number(id_mensaje_telegram),
        contenido_original,
        contenido_limpio,
        remitente,
        fecha_envio: fechaEcuador,
        procesado: false,
      },
    });

    console.log(
      `✅ Mensaje guardado correctamente (Centro ${id_centro_comercial}, Telegram ID ${id_mensaje_telegram})`
    );

    return NextResponse.json(nuevoMensaje, { status: 200 });
  } catch (error) {
    console.error("❌ Error al guardar mensaje:", error);
    return NextResponse.json(
      { message: "Error interno al guardar mensaje" },
      { status: 500 }
    );
  }
}
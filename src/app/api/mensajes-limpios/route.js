import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 🔐 Misma clave que usa el microservicio Python
const BOT_API_KEY = process.env.BOT_API_KEY || "CLAVE_SEGURA_DE_AUTENTICACION";

export async function POST(req) {
  const apiKey = req.headers.get("x-api-key");

  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      id_centro_comercial,
      id_mensaje_telegram, // ✅ nuevo campo
      contenido_original,
      contenido_limpio,
      remitente,
      fecha_envio,
    } = body;

    // ⚠️ Validaciones básicas
    if (!id_centro_comercial || !id_mensaje_telegram || !contenido_limpio || !fecha_envio) {
      return NextResponse.json(
        { message: "Faltan campos obligatorios" },
        { status: 400 }
      );
    }

    // 🧠 Verificar si el mensaje ya fue guardado
    const existente = await prisma.mensajes_limpios.findUnique({
      where: {
        id_centro_comercial_id_mensaje_telegram: {
          id_centro_comercial: Number(id_centro_comercial),
          id_mensaje_telegram: Number(id_mensaje_telegram),
        },
      },
    });

    if (existente) {
      // 🔄 Si el mensaje existe pero no está procesado, reenviarlo a clasificación
      if (!existente.procesado) {
        console.log(
          `🔁 Mensaje duplicado sin procesar detectado (Centro ${id_centro_comercial}, Telegram ID ${id_mensaje_telegram}). Enviando a clasificación...`
        );

        try {
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            process.env.INTERNAL_BASE_URL ||
            "http://localhost:3000";

          const resClasif = await fetch(`${baseUrl}/api/mensajes-clasificados/auto`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": BOT_API_KEY,
            },
            body: JSON.stringify({ id_mensaje_limpio: existente.id_mensaje }),
          });

          if (!resClasif.ok) {
            const err = await resClasif.json().catch(() => ({}));
            console.error(
              "⚠️ No se pudo disparar clasificación de mensaje duplicado sin procesar:",
              resClasif.status,
              err?.message || ""
            );
          } else {
            console.log(`✅ Clasificación lanzada para duplicado ID limpio ${existente.id_mensaje}`);
          }
        } catch (e) {
          console.error("⚠️ Error reenviando mensaje duplicado sin procesar:", e);
        }

        // ✅ Retornamos respuesta informativa
        return NextResponse.json(
          { message: "Mensaje duplicado sin procesar reenviado a clasificación" },
          { status: 200 }
        );
      }

      // Si ya fue procesado (procesado = 1), lo omitimos como antes
      if (existente.procesado) {
  console.log(
    `⚠️ Mensaje duplicado marcado como procesado (Centro ${id_centro_comercial}, Telegram ID ${id_mensaje_telegram})`
  );

  // 🔍 Verificar si realmente existe clasificación asociada
  const clasif = await prisma.mensajes_clasificados.findUnique({
    where: { id_mensaje_limpio: existente.id_mensaje },
  });

  // ❗ Caso especial: procesado = 1 pero sin clasificación → inconsistencia
  if (!clasif) {
    console.warn(
      `⚠️ Inconsistencia: mensaje ${existente.id_mensaje} está procesado pero no tiene clasificación. Enviando a clasificación...`
    );

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.INTERNAL_BASE_URL ||
        "http://localhost:3000";

      const resClasif = await fetch(`${baseUrl}/api/mensajes-clasificados/auto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BOT_API_KEY,
        },
        body: JSON.stringify({ id_mensaje_limpio: existente.id_mensaje }),
      });

      if (!resClasif.ok) {
        const err = await resClasif.json().catch(() => ({}));
        console.error(
          "⚠️ No se pudo disparar clasificación de inconsistencia:",
          resClasif.status,
          err?.message || ""
        );
      } else {
        console.log(`✅ Clasificación corregida para ID ${existente.id_mensaje}`);
      }
    } catch (e) {
      console.error("⚠️ Error enviando a clasificación por inconsistencia:", e);
    }

    return NextResponse.json(
      { message: "Inconsistencia detectada: reclasificación enviada" },
      { status: 200 }
    );
  }

  // 🟢 Caso normal: procesado=1 Y clasificación existente → no hacer nada más
  return NextResponse.json(
    { message: "Mensaje ya registrado y clasificado" },
    { status: 200 }
  );
}
    }

    // 🕐 Convertir a hora Ecuador (UTC-5)
    const fechaOriginal = new Date(fecha_envio);
    const fechaEcuador = new Date(fechaOriginal.getTime() - 5 * 60 * 60 * 1000);

    // 2) Obtener solo el día correcto como string "YYYY-MM-DD"
    const yyyyMmDd = fechaEcuador.toISOString().slice(0, 10);

    // 3) Construir fecha tipo DATE segura y estable (00:00 UTC)
    const fecha_envio_date = new Date(`${yyyyMmDd}T00:00:00.000Z`);

    const fecha_envio_time = fechaEcuador
      .toISOString()
      .split("T")[1]
      .substring(0, 8); // HH:MM:SS

    // 💾 Guardar mensaje limpio
    const nuevoMensaje = await prisma.mensajes_limpios.create({
      data: {
        id_centro_comercial: Number(id_centro_comercial),
        id_mensaje_telegram: Number(id_mensaje_telegram),
        contenido_original,
        contenido_limpio,
        remitente: remitente || "desconocido",
        fecha_envio: fechaEcuador,
        fecha_envio_date,
        fecha_envio_time,
        procesado: false,
      },
    });

    console.log(
      `✅ Mensaje guardado (Centro ${id_centro_comercial}, Telegram ID ${id_mensaje_telegram}, ID limpio ${nuevoMensaje.id_mensaje})`
    );

    // ▶️ Disparar clasificación en tiempo real (llamada interna segura)
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_BASE_URL ||
        process.env.INTERNAL_BASE_URL ||
        "http://localhost:3000";

      const resClasif = await fetch(`${baseUrl}/api/mensajes-clasificados/auto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": BOT_API_KEY, // misma clave
        },
        body: JSON.stringify({ id_mensaje_limpio: nuevoMensaje.id_mensaje }),
      });

      if (!resClasif.ok) {
        const err = await resClasif.json().catch(() => ({}));
        console.error("⚠️ No se pudo disparar clasificación:", resClasif.status, err?.message || "");
      }
    } catch (e) {
      console.error("⚠️ Error invocando clasificación automática:", e);
    }

    return NextResponse.json(nuevoMensaje, { status: 200 });
  } catch (error) {
    console.error("❌ Error al guardar mensaje:", error);
    return NextResponse.json(
      { message: "Error interno al guardar mensaje" },
      { status: 500 }
    );
  }
}
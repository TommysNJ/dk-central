import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

/**
 * GET /api/incidentes
 * Filtros (opcionales): centro, area, estado, fecha, tipo
 * - centro: id_centro_comercial (Int)
 * - area: valor enum de area (recepcion, seguridad, etc.)
 * - estado: nuevo | en_proceso | completado
 * - fecha: YYYY-MM-DD (se compara con fecha_envio_date)
 * - tipo: nombre del incidente (String, ej: "robo")
 */
export async function GET(req) {
  const session = await authorize(req, [
    "admin_sistema",
    "admin_centro",
    "usuario_operativo",
  ]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);

  const centro = searchParams.get("centro") || ""; // id_centro_comercial
  const area = searchParams.get("area") || "";
  const estado = searchParams.get("estado") || "";
  const fecha = searchParams.get("fecha") || ""; // YYYY-MM-DD
  const tipo = searchParams.get("tipo") || ""; // nombre incidente

  // 🔎 Construir filtros
  const where = {
    // filtro por estado si viene
    ...(estado ? { estado } : {}),
    mensaje_limpio: {},
    incidente: {},
  };

  // 🎯 Restricciones por rol
  if (session.rol === "admin_sistema") {
    // puede usar todos los filtros libremente
    if (centro) {
      where.mensaje_limpio.id_centro_comercial = Number(centro);
    }
    if (area) {
      where.incidente.area = area;
    }
  } else if (session.rol === "admin_centro") {
    // solo su centro, NUNCA otro
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;

    // puede filtrar por área si llega
    if (area) {
      where.incidente.area = area;
    }
  } else if (session.rol === "usuario_operativo") {
    // solo su centro y su área
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    where.incidente.area = session.area;
  }

  // filtro por tipo de incidente (nombre)
  if (tipo) {
    where.incidente.nombre = tipo;
  }

  if (fecha) {
    const [y, m, d] = fecha.split("-");

    // Crear fecha EXACTA en UTC 00:00:00
    const fechaUTC = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

    where.mensaje_limpio.fecha_envio_date = fechaUTC;
  }

  try {
    const data = await prisma.mensajes_clasificados.findMany({
      where,
      include: {
        mensaje_limpio: {
          include: {
            centro_comercial: true,
          },
        },
        incidente: true,
      },
      orderBy: {
        mensaje_limpio: {
          fecha_envio: "desc",
        },
      },
    });

    // 🔄 Normalizar respuesta para el frontend
    const incidentes = data.map((i) => ({
      id_mensaje_clasificado: i.id_mensaje_clasificado,
      id_mensaje_limpio: i.id_mensaje_limpio,
      fecha: i.mensaje_limpio.fecha_envio,
      fecha_date: i.mensaje_limpio.fecha_envio_date,
      fecha_time: i.mensaje_limpio.fecha_envio_time,
      centro: i.mensaje_limpio.centro_comercial
        ? i.mensaje_limpio.centro_comercial.nombre
        : null,
      id_centro_comercial: i.mensaje_limpio.id_centro_comercial,
      area: i.incidente.area,
      incidente: i.incidente.nombre,
      mensaje_limpio: i.mensaje_limpio.contenido_limpio,
      estado: i.estado,
      observaciones: i.observaciones || "",
    }));

    return NextResponse.json(incidentes, { status: 200 });
  } catch (error) {
    console.error("❌ Error obteniendo incidentes:", error);
    return NextResponse.json(
      { message: "Error interno al obtener incidentes" },
      { status: 500 }
    );
  }
}

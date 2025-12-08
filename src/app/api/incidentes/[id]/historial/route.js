import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

/**
 * GET /api/incidentes/:id/historial
 * - Admin sistema: puede ver historial de cualquier incidente
 * - Admin centro: solo historial de incidentes de su centro
 * - Usuario operativo: solo historial de incidentes de su centro + su área
 */
export async function GET(req, { params }) {
  const session = await authorize(req, [
    "admin_sistema",
    "admin_centro",
    "usuario_operativo",
  ]);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const idMensajeClasificado = Number(id);

  if (Number.isNaN(idMensajeClasificado)) {
    return NextResponse.json(
      { message: "ID inválido" },
      { status: 400 }
    );
  }

  try {
    // 1) Obtener el incidente base para validar permisos por rol
    const incidente = await prisma.mensajes_clasificados.findUnique({
      where: { id_mensaje_clasificado: idMensajeClasificado },
      include: {
        mensaje_limpio: true,
        incidente: true,
      },
    });

    if (!incidente) {
      return NextResponse.json(
        { message: "Incidente no encontrado" },
        { status: 404 }
      );
    }

    // 2) Validar acceso según rol (mismas reglas que en /api/incidentes)
    if (session.rol === "admin_centro") {
      if (
        incidente.mensaje_limpio.id_centro_comercial !==
        session.id_centro_comercial
      ) {
        return NextResponse.json(
          { message: "No autorizado para ver este historial" },
          { status: 403 }
        );
      }
    } else if (session.rol === "usuario_operativo") {
      if (
        incidente.mensaje_limpio.id_centro_comercial !==
          session.id_centro_comercial ||
        incidente.incidente.area !== session.area
      ) {
        return NextResponse.json(
          { message: "No autorizado para ver este historial" },
          { status: 403 }
        );
      }
    }

    // 3) Consultar historial del incidente (más reciente primero)
    const historial = await prisma.historial_incidentes.findMany({
      where: { id_mensaje_clasificado: idMensajeClasificado },
      include: {
        usuario: true,
      },
      orderBy: [
        { fecha: "desc" },
        { id_historial: "desc" },
      ],
    });

    const data = historial.map((h) => ({
      id_historial: h.id_historial,
      id_mensaje_clasificado: h.id_mensaje_clasificado,
      usuario_nombre: h.usuario?.nombre || "Desconocido",
      estado: h.estado,
      observaciones: h.observaciones || "",
      fecha_cambio: h.fecha_cambio,
      hora_cambio: h.hora_cambio,
    }));

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("❌ Error obteniendo historial de incidente:", error);
    return NextResponse.json(
      { message: "Error interno al obtener historial" },
      { status: 500 }
    );
  }
}
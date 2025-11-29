import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

/**
 * PUT /api/incidentes/:id
 * Body: { estado?, observaciones? }
 * - Solo usuario_operativo
 * - Solo incidentes de su centro + su área
 * - Si ya está completado, no se puede modificar más
 */
export async function PUT(req, { params }) {
  const session = await authorize(req, ["usuario_operativo"]);
  if (session instanceof NextResponse) return session;

  const { id } = await params;
  const body = await req.json();
  const { estado, observaciones } = body;

  // Validar estado si viene
  const allowedEstados = ["revisado", "en_proceso", "completado"];
  if (estado && !allowedEstados.includes(estado)) {
    return NextResponse.json(
      { message: "Estado inválido" },
      { status: 400 }
    );
  }

  try {
    const incidente = await prisma.mensajes_clasificados.findUnique({
      where: { id_mensaje_clasificado: Number(id) },
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

    // 🔒 No permitir cambios si ya está completado
    if (incidente.estado === "completado") {
      return NextResponse.json(
        { message: "El incidente ya está completado y no puede modificarse" },
        { status: 400 }
      );
    }

    // 🔒 Validar que el usuario pertenece al mismo centro y área
    if (
      incidente.mensaje_limpio.id_centro_comercial !==
        session.id_centro_comercial ||
      incidente.incidente.area !== session.area
    ) {
      return NextResponse.json(
        { message: "No autorizado para modificar este incidente" },
        { status: 403 }
      );
    }

    // Construir data de actualización
    const dataUpdate = {};

    if (estado) {
      dataUpdate.estado = estado;
    }

    if (typeof observaciones === "string") {
      dataUpdate.observaciones = observaciones;
    }

    if (Object.keys(dataUpdate).length === 0) {
      return NextResponse.json(
        { message: "No se enviaron cambios válidos" },
        { status: 400 }
      );
    }

    const updated = await prisma.mensajes_clasificados.update({
      where: { id_mensaje_clasificado: Number(id) },
      data: dataUpdate,
      include: {
        mensaje_limpio: true,
        incidente: true,
      },
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("❌ Error actualizando incidente:", error);
    return NextResponse.json(
      { message: "Error interno al actualizar incidente" },
      { status: 500 }
    );
  }
}
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
  let { estado, observaciones } = body;

  // Validar estado si viene
  const allowedEstados = ["nuevo", "en_proceso", "completado"];
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

    // 🔒 Validar centro y área
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

        // =============================
    // 🔥 BLOQUEO DE REGRESIÓN DE ESTADO
    // =============================
    // No permitir volver de EN_PROCESO a NUEVO
    if (
      incidente.estado === "en_proceso" &&
      estado === "nuevo"
    ) {
      return NextResponse.json(
        { message: "No se puede volver al estado nuevo" },
        { status: 400 }
      );
    }

    // =============================
    // 🔥 LÓGICA NUEVA (SIN CAMBIAR ENUMS)
    // =============================

    const dataUpdate = {};

    // Observaciones finales
    const nuevasObservaciones =
      typeof observaciones === "string"
        ? observaciones
        : incidente.observaciones || "";

    // Estado base
    let nuevoEstadoFinal = estado ?? incidente.estado;

    // 👉 CASO CLAVE:
    // Si está en NUEVO y se guarda observación → pasa a EN_PROCESO automáticamente
    if (
      incidente.estado === "nuevo" &&
      typeof observaciones === "string"
    ) {
      nuevoEstadoFinal = "en_proceso";
      dataUpdate.estado = "en_proceso";
    } else if (estado) {
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

    // 👉 Detectar cambios reales
    const hayCambioEstado = nuevoEstadoFinal !== incidente.estado;
    const hayCambioObs =
      (incidente.observaciones || "") !== nuevasObservaciones;

    const debeRegistrarHistorial = hayCambioEstado || hayCambioObs;

    // 🔧 Helper fecha/hora (MISMA LÓGICA QUE YA TENÍAS)
    function buildFechaYHoraCambio() {
      const ahora = new Date();
      const ahoraEcuador = new Date(
        ahora.getTime() - 5 * 60 * 60 * 1000
      );

      const fechaCompleta = new Date(ahoraEcuador.getTime());
      const fechaCambio = new Date(
        ahoraEcuador.getFullYear(),
        ahoraEcuador.getMonth(),
        ahoraEcuador.getDate()
      );
      const horaCambio = ahoraEcuador
        .toISOString()
        .split("T")[1]
        .substring(0, 8);

      return { fechaCompleta, fechaCambio, horaCambio };
    }

    let updated;

    // 🔄 Transacción
    if (debeRegistrarHistorial) {
      const { fechaCompleta, fechaCambio, horaCambio } =
        buildFechaYHoraCambio();

      const [updatedResult] = await prisma.$transaction([
        prisma.mensajes_clasificados.update({
          where: { id_mensaje_clasificado: Number(id) },
          data: dataUpdate,
          include: {
            mensaje_limpio: true,
            incidente: true,
          },
        }),
        prisma.historial_incidentes.create({
          data: {
            id_mensaje_clasificado: incidente.id_mensaje_clasificado,
            id_usuario: session.id_usuario,
            estado: nuevoEstadoFinal,
            observaciones: nuevasObservaciones || null,
            fecha: fechaCompleta,
            fecha_cambio: fechaCambio,
            hora_cambio: horaCambio,
          },
        }),
      ]);

      updated = updatedResult;
    } else {
      updated = await prisma.mensajes_clasificados.update({
        where: { id_mensaje_clasificado: Number(id) },
        data: dataUpdate,
        include: {
          mensaje_limpio: true,
          incidente: true,
        },
      });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    console.error("❌ Error actualizando incidente:", error);
    return NextResponse.json(
      { message: "Error interno al actualizar incidente" },
      { status: 500 }
    );
  }
}
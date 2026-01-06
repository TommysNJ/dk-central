import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

// GET /api/dashboard
// Query:
// - fecha_inicio (YYYY-MM-DD) requerido
// - fecha_fin (YYYY-MM-DD) requerido
// - centro (solo admin_sistema)
// - area (admin_sistema/admin_centro)
export async function GET(req) {
  const session = await authorize(req, [
    "admin_sistema",
    "admin_centro",
    "usuario_operativo",
  ]);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const fechaInicioStr = searchParams.get("fecha_inicio");
  const fechaFinStr = searchParams.get("fecha_fin");
  const centroStr = searchParams.get("centro");
  const areaParam = searchParams.get("area");

  if (!fechaInicioStr || !fechaFinStr) {
    return NextResponse.json(
      { message: "Debe seleccionar una fecha de inicio y una fecha fin." },
      { status: 400 }
    );
  }

  const fechaInicio = new Date(fechaInicioStr);
  const fechaFin = new Date(fechaFinStr);

  if (fechaFin < fechaInicio) {
    return NextResponse.json(
      { message: "La fecha fin no puede ser menor que la fecha de inicio." },
      { status: 400 }
    );
  }

  const diffMs = fechaFin.getTime() - fechaInicio.getTime();
  const diasRango = diffMs / (1000 * 60 * 60 * 24) + 1;

  if (diasRango > 7) {
    return NextResponse.json(
      { message: "El rango máximo permitido es de 7 días." },
      { status: 400 }
    );
  }

  // ==============================
  //  Filtros por rol (igual a reportes)
  //  + EXCLUIR "otros"
  // ==============================
  const where = {
    mensaje_limpio: {
      fecha_envio_date: { gte: fechaInicio, lte: fechaFin },
    },
    incidente: {
      nombre: { not: "otros" },
      area: { not: "otros" },
    },
  };

  const centroId = centroStr ? Number(centroStr) : null;

  if (session.rol === "admin_sistema") {
    if (centroId) where.mensaje_limpio.id_centro_comercial = centroId;
    if (areaParam) where.incidente = { ...where.incidente, area: areaParam };
  } else if (session.rol === "admin_centro") {
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    if (areaParam) where.incidente = { ...where.incidente, area: areaParam };
  } else if (session.rol === "usuario_operativo") {
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    where.incidente = { ...where.incidente, area: session.area };
  }

  // ==============================
  //  Obtener registros (rango <= 7 días, OK)
  // ==============================
  let registros = [];
  try {
    registros = await prisma.mensajes_clasificados.findMany({
      where,
      select: {
        estado: true,
        incidente: { select: { area: true, nombre: true } },
        mensaje_limpio: {
          select: {
            fecha_envio_date: true,
            id_centro_comercial: true,
          },
        },
      },
    });
  } catch (e) {
    console.error("❌ Error dashboard:", e);
    return NextResponse.json(
      { message: "Error interno al generar dashboard" },
      { status: 500 }
    );
  }

  // ==============================
  //  Helpers
  // ==============================
  function toYMD(dateObj) {
    if (!dateObj) return null;
    const d = new Date(dateObj);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // Rellenar días del rango con 0
  const days = [];
  {
    const start = new Date(fechaInicio);
    for (let i = 0; i < diasRango; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.push(toYMD(d));
    }
  }

  // ==============================
  //  Agregaciones
  // ==============================
  const total = registros.length;

  const porAreaMap = new Map(); // area -> count
  const porEstadoMap = new Map(); // estado -> count
  const porDiaMap = new Map(); // yyyy-mm-dd -> count
  const porTipoMap = new Map(); // incidente nombre -> count

  // día -> { nuevo, en_proceso, completado }
  const porDiaEstadoMap = new Map(); // yyyy-mm-dd -> { nuevo:0, en_proceso:0, completado:0 }

  for (const r of registros) {
    const area = r.incidente?.area || null;
    const estado = r.estado || null;
    const tipo = r.incidente?.nombre || null;
    const ymd = toYMD(r.mensaje_limpio?.fecha_envio_date);

    if (area) porAreaMap.set(area, (porAreaMap.get(area) || 0) + 1);
    if (estado) porEstadoMap.set(estado, (porEstadoMap.get(estado) || 0) + 1);
    if (tipo) porTipoMap.set(tipo, (porTipoMap.get(tipo) || 0) + 1);
    if (ymd) porDiaMap.set(ymd, (porDiaMap.get(ymd) || 0) + 1);

    // exacto por día y por estado
    if (ymd) {
      if (!porDiaEstadoMap.has(ymd)) {
        porDiaEstadoMap.set(ymd, { nuevo: 0, en_proceso: 0, completado: 0 });
      }
      if (estado && porDiaEstadoMap.get(ymd)[estado] !== undefined) {
        porDiaEstadoMap.get(ymd)[estado] += 1;
      }
    }
  }

  const porArea = Array.from(porAreaMap.entries())
    .map(([area, total]) => ({ area, total }))
    .sort((a, b) => b.total - a.total);

  const porTipo = Array.from(porTipoMap.entries())
    .map(([tipo, total]) => ({ tipo, total }))
    .sort((a, b) => b.total - a.total);

  const porEstado = ["nuevo", "en_proceso", "completado"].map((estado) => ({
    estado,
    total: porEstadoMap.get(estado) || 0,
  }));

  const porDia = days.map((d) => ({
    fecha: d,
    total: porDiaMap.get(d) || 0,
  }));

  // serie exacta por día+estado (rellena con 0 si no hay registros ese día)
  const porDiaEstado = days.map((d) => {
    const entry = porDiaEstadoMap.get(d) || { nuevo: 0, en_proceso: 0, completado: 0 };
    return {
      fecha: d,
      nuevo: entry.nuevo || 0,
      en_proceso: entry.en_proceso || 0,
      completado: entry.completado || 0,
    };
  });

  // KPIs
  const promedioDiario = diasRango > 0 ? total / diasRango : 0;
  const completados = porEstadoMap.get("completado") || 0;
  const nuevos = porEstadoMap.get("nuevo") || 0;
  const enProceso = porEstadoMap.get("en_proceso") || 0;

  const pctCompletados = total > 0 ? (completados / total) * 100 : 0;
  const backlog = nuevos + enProceso;

  // Top incidente (extra)
  let topIncidente = null;
  let topIncidenteCount = 0;
  for (const [name, c] of porTipoMap.entries()) {
    if (c > topIncidenteCount) {
      topIncidenteCount = c;
      topIncidente = name;
    }
  }

  // ==============================
  //  Response
  // ==============================
  return NextResponse.json({
    resumen: {
      fecha_inicio: fechaInicioStr,
      fecha_fin: fechaFinStr,
      dias_rango: diasRango,
      centro_id:
        session.rol === "admin_sistema" ? centroId : session.id_centro_comercial,
      area:
        session.rol === "usuario_operativo"
          ? session.area
          : areaParam || null,
    },
    kpis: {
      total_incidentes: total,
      promedio_diario: Number(promedioDiario.toFixed(2)),
      pct_completados: Number(pctCompletados.toFixed(1)),
      backlog,
      top_incidente: topIncidente
        ? { nombre: topIncidente, total: topIncidenteCount }
        : null,
    },
    charts: {
      por_area: porArea,
      por_tipo: porTipo,
      por_estado: porEstado,
      por_dia: porDia,
      por_dia_estado: porDiaEstado,
    },
  });
}
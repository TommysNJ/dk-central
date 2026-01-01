import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";

// GET /api/reportes
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
  //  Filtros por rol
  // ==============================
  const where = {
    mensaje_limpio: {
      fecha_envio_date: { gte: fechaInicio, lte: fechaFin },
    },
  };

  const centroId = centroStr ? Number(centroStr) : null;
  if (session.rol === "admin_sistema") {
    if (centroId) where.mensaje_limpio.id_centro_comercial = centroId;
    if (areaParam) where.incidente = { area: areaParam };
  } else if (session.rol === "admin_centro") {
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    if (areaParam) where.incidente = { area: areaParam };
  } else if (session.rol === "usuario_operativo") {
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    where.incidente = { area: session.area };
  }

  // ==============================
  //  Obtener registros
  // ==============================
  const registros = await prisma.mensajes_clasificados.findMany({
    where,
    include: { incidente: true, mensaje_limpio: true },
  });

  if (!registros.length) {
    return NextResponse.json({
      rows: [],
      detalleTipos: [],
      resumen: {
        fecha_inicio: fechaInicioStr,
        fecha_fin: fechaFinStr,
        dias_rango: diasRango,
        centro_id: centroId,
        area: areaParam || (session.rol === "usuario_operativo" ? session.area : null),
      },
    });
  }

  // ==============================
  //  Primera tabla: agregación por área
  // ==============================
  const mapaAreas = new Map();

  for (const reg of registros) {
    const area = reg.incidente.area;

    if (!mapaAreas.has(area)) {
      mapaAreas.set(area, {
        area,
        total: 0,
        incidentesPorNombre: {},
        estados: { nuevo: 0, en_proceso: 0, completado: 0 },
      });
    }

    const entry = mapaAreas.get(area);
    entry.total += 1;

    const nombreInc = reg.incidente.nombre;
    entry.incidentesPorNombre[nombreInc] =
      (entry.incidentesPorNombre[nombreInc] || 0) + 1;

    entry.estados[reg.estado] = (entry.estados[reg.estado] || 0) + 1;
  }

  const rows = Array.from(mapaAreas.values()).map((entry) => {
    let incidenteRecurrente = "-";
    let maxInc = 0;
    for (const [nombre, c] of Object.entries(entry.incidentesPorNombre)) {
      if (c > maxInc) {
        maxInc = c;
        incidenteRecurrente = nombre;
      }
    }

    let estadoMasFrecuente = "-";
    let maxEst = 0;
    for (const [estado, c] of Object.entries(entry.estados)) {
      if (c > maxEst) {
        maxEst = c;
        estadoMasFrecuente = estado;
      }
    }

    return {
      area: entry.area,
      total_incidentes: entry.total,
      incidente_recurrente: incidenteRecurrente,
      estado_mas_frecuente: estadoMasFrecuente,
    };
  });

  // ==============================
  //  Segunda tabla: agregación por tipo de incidente
  // ==============================
  const mapaTipos = new Map();

  for (const reg of registros) {
    const tipo = reg.incidente.nombre;

    if (!mapaTipos.has(tipo)) {
      mapaTipos.set(tipo, {
        tipo,
        total: 0,
        estados: { nuevo: 0, en_proceso: 0, completado: 0 },
      });
    }

    const item = mapaTipos.get(tipo);
    item.total += 1;
    item.estados[reg.estado]++;
  }

  const detalleTipos = Array.from(mapaTipos.values()).map((item) => {
    let estadoMasFrecuente = "-";
    let max = 0;

    for (const [est, count] of Object.entries(item.estados)) {
      if (count > max) {
        max = count;
        estadoMasFrecuente = est;
      }
    }

    return {
      tipo: item.tipo,
      total: item.total,
      estado_mas_frecuente: estadoMasFrecuente,
    };
  });

  return NextResponse.json({
    rows,
    detalleTipos,
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
  });
}
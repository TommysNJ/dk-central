// src/app/api/reportes/resumen-diario/route.js
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/authorize";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BLOCK_SIZE = 120; // 🔥 cantidad de incidentes por bloque

// ============================
// 🧠 Función auxiliar: resumen por bloques
// ============================
async function resumirBloque(incidentesTexto, info) {
  const prompt = `
Eres un analista de seguridad de centros comerciales.

Vas a recibir un bloque parcial de incidentes del día.

Información del reporte:
Fecha: ${info.fecha}
Centro: ${info.centro}
Área filtrada: ${info.area}

INCIDENTES DEL BLOQUE:
${incidentesTexto}

TAREA:
Haz un resumen ejecutivo de este bloque entre 80 a 110 palabras.  
No enumeres los incidentes.  
Extrae solo ideas clave: áreas más frecuentes, tipo de problemas, criticidad y patrones horarios.

No agregues títulos ni explicaciones, solo el resumen del bloque.
  `.trim();

  const res = await openai.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    max_output_tokens: 220,
  });

  return res.output_text || "";
}

// ============================
// 🧠 Función auxiliar: resumen global
// ============================
async function resumenGlobal(resumenesParciales, total, info) {
  const prompt = `
Eres un analista profesional de seguridad en centros comerciales.

Has recibido varios sub-resúmenes parciales generados previamente.
Debes combinarlos en un único párrafo ejecutivo.

Fecha: ${info.fecha}
Centro: ${info.centro}
Área filtrada: ${info.area}

TOTAL DE INCIDENTES REALES: ${total}

SUB-RESÚMENES:
${resumenesParciales.map((r, i) => `Bloque ${i + 1}: ${r}`).join("\n")}

TAREA:
Redacta UN SOLO párrafo en español entre 220-260 palabras.
que incluya:

• el total real de incidentes (${total})
• áreas o tipos más frecuentes  
• nivel general de criticidad  
• franjas horarias más activas  
• recomendación final breve  

No repitas los sub-resúmenes literal.  
No agregues títulos, listas, ni texto adicional.
Solo devuelve el párrafo final.
  `.trim();

  const res = await openai.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    max_output_tokens: 420,
  });

  return res.output_text || "";
}

// ============================
// ✅ NUEVO: resumen global desde resúmenes guardados (para admins)
// ============================
async function resumenGlobalDesdeResumenesGuardados(resumenesGuardados, total, info) {
  const prompt = `
Eres un analista profesional de seguridad en centros comerciales.

Vas a recibir varios resúmenes diarios ya generados por área y centro comercial.
Debes combinarlos en un único párrafo ejecutivo.

Fecha: ${info.fecha}
Centro: ${info.centro}
Área filtrada: ${info.area}

TOTAL DE INCIDENTES REALES: ${total}

RESÚMENES BASE:
${resumenesGuardados.map((r, i) => `Resumen ${i + 1}: ${r}`).join("\n")}

TAREA:
Redacta UN SOLO párrafo en español entre 220-260 palabras.
que incluya:

• el total real de incidentes (${total})
• áreas o tipos más frecuentes  
• nivel general de criticidad  
• franjas horarias más activas  
• recomendación final breve  

No repitas los resúmenes literal.  
No agregues títulos, listas, ni texto adicional.
Solo devuelve el párrafo final.
  `.trim();

  const res = await openai.responses.create({
    model: "gpt-4o-mini",
    input: prompt,
    max_output_tokens: 420,
  });

  return res.output_text || "";
}

// ============================
// 🚀 ROUTE PRINCIPAL (GENERAR / MOSTRAR)
// ============================
export async function POST(req) {
  const session = await authorize(req, [
    "admin_sistema",
    "admin_centro",
    "usuario_operativo",
  ]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { fecha, centro, area } = body;

  if (!fecha) {
    return NextResponse.json(
      { message: "Debe seleccionar una fecha." },
      { status: 400 }
    );
  }

  // Fecha exacta
  const [y, m, d] = fecha.split("-");
  const fechaUTC = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

  // ============================================================
  // 🔥🔥 AQUI VA EL CAMBIO — OBTENER NOMBRE DEL CENTRO Y AREA 🔥🔥
  // ============================================================

  // Obtener nombre real del centro comercial
  let nombreCentro = "Todos";

  if (session.rol === "admin_sistema") {
    if (centro) {
      const c = await prisma.centros_comerciales.findUnique({
        where: { id_centro_comercial: Number(centro) },
      });
      nombreCentro = c?.nombre || "Centro desconocido";
    }
  } else {
    const c = await prisma.centros_comerciales.findUnique({
      where: { id_centro_comercial: session.id_centro_comercial },
    });
    nombreCentro = c?.nombre || "Centro desconocido";
  }

  // Obtener nombre del área
  let nombreArea = "Todas";

  if (session.rol === "usuario_operativo") {
    nombreArea = session.area;
  } else if (area) {
    nombreArea = area;
  }

  // Construir info corregida
  const info = {
    fecha,
    centro: nombreCentro,
    area: nombreArea,
  };

  // ============================================================
  // ✅ NUEVO: Resolver (id_centro_comercial, area) objetivo para resumen guardado
  // - usuario_operativo: SIEMPRE su centro + su área
  // - admin_centro: su centro + (area si viene)
  // - admin_sistema: (centro y area si vienen)
  // ============================================================
  let targetCentroId = null;
  let targetArea = null;

  if (session.rol === "usuario_operativo") {
    targetCentroId = session.id_centro_comercial;
    targetArea = session.area;
  } else if (session.rol === "admin_centro") {
    targetCentroId = session.id_centro_comercial;
    if (area) targetArea = area;
  } else if (session.rol === "admin_sistema") {
    if (centro) targetCentroId = Number(centro);
    if (area) targetArea = area;
  }

  // ============================================================
  // ✅ NUEVO: Si hay centro+área específicos, primero buscar resumen guardado
  // - Si existe: devolverlo sin IA (no editable, sin botón)
  // - Si NO existe y es admin: devolver mensaje de faltante (NO IA)
  // ============================================================
  if (targetCentroId && targetArea) {
    const existente = await prisma.resumenes_diarios.findUnique({
      where: {
        fecha_id_centro_comercial_area: {
          fecha: fechaUTC,
          id_centro_comercial: targetCentroId,
          area: targetArea,
        },
      },
    });

    if (existente) {
      return NextResponse.json({
        resumen: existente.resumen,
        filtros: info,
        resumenGuardado: true,
        editable: false,
      });
    }

    if (session.rol === "admin_sistema" || session.rol === "admin_centro") {
      const c = await prisma.centros_comerciales.findUnique({
        where: { id_centro_comercial: targetCentroId },
      });

      return NextResponse.json(
        {
          message: `Falta resumen de ${fecha}, ${c?.nombre || "Centro desconocido"}, ${targetArea} para poder realizar el resumen general.`,
          filtros: info,
          faltantes: [
            {
              fecha,
              id_centro_comercial: targetCentroId,
              centro: c?.nombre || "Centro desconocido",
              area: targetArea,
            },
          ],
        },
        { status: 400 }
      );
    }
  }

  // ============================
  // FILTROS DE CONSULTA PRISMA (MISMA LÓGICA)
  // ============================
  const where = {
    mensaje_limpio: {
      fecha_envio_date: fechaUTC,
    },
  };

  if (session.rol === "admin_sistema") {
    if (centro) where.mensaje_limpio.id_centro_comercial = Number(centro);
    if (area) where.incidente = { area };
  }

  if (session.rol === "admin_centro") {
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    if (area) where.incidente = { area };
  }

  if (session.rol === "usuario_operativo") {
    where.mensaje_limpio.id_centro_comercial = session.id_centro_comercial;
    where.incidente = { area: session.area };
  }

  // ============================================================
  // ✅ NUEVO: Admins → antes de usar IA desde resúmenes guardados,
  // verificar que existan TODOS los resúmenes requeridos (según incidentes reales)
  // Si falta alguno -> devolver mensaje de faltantes y NO usar IA
  // ============================================================
  if (session.rol === "admin_sistema" || session.rol === "admin_centro") {
    const registrosMin = await prisma.mensajes_clasificados.findMany({
      where,
      select: {
        mensaje_limpio: {
          select: { id_centro_comercial: true },
        },
        incidente: {
          select: { area: true },
        },
      },
      orderBy: { id_mensaje_clasificado: "asc" },
    });

    // Si no hay incidentes, mantenemos la misma respuesta "no hay incidentes"
    if (registrosMin.length === 0) {
      return NextResponse.json({
        resumen:
          "No se encontraron incidentes para los filtros seleccionados. No es necesario generar un resumen para el día indicado.",
        filtros: info,
        resumenGuardado: false,
        editable: false,
      });
    }

    // ✅ total real para admins (se usa para el resumen global)
    const totalIncidentes = registrosMin.length;

    // Uniques centro+area requeridos
    const setPairs = new Set();
    const pairs = [];

    for (const r of registrosMin) {
      const cid = r.mensaje_limpio?.id_centro_comercial;
      const ar = r.incidente?.area;
      if (!cid || !ar) continue;

      const key = `${cid}__${ar}`;
      if (!setPairs.has(key)) {
        setPairs.add(key);
        pairs.push({ id_centro_comercial: cid, area: ar });
      }
    }

    // Consultar qué resúmenes existen en DB para esos pares
    const existentes = await prisma.resumenes_diarios.findMany({
      where: {
        fecha: fechaUTC,
        OR: pairs.map((p) => ({
          id_centro_comercial: p.id_centro_comercial,
          area: p.area,
        })),
      },
      select: {
        id_centro_comercial: true,
        area: true,
        resumen: true,
      },
      orderBy: { id_resumen: "asc" },
    });

    const setExist = new Set(
      existentes.map((e) => `${e.id_centro_comercial}__${e.area}`)
    );

    const faltantesRaw = pairs.filter(
      (p) => !setExist.has(`${p.id_centro_comercial}__${p.area}`)
    );

    if (faltantesRaw.length > 0) {
      const centrosIds = [
        ...new Set(faltantesRaw.map((f) => f.id_centro_comercial)),
      ];

      const centrosDb = await prisma.centros_comerciales.findMany({
        where: { id_centro_comercial: { in: centrosIds } },
        select: { id_centro_comercial: true, nombre: true },
      });

      const mapCentros = {};
      for (const c of centrosDb) mapCentros[c.id_centro_comercial] = c.nombre;

      const faltantes = faltantesRaw.map((f) => ({
        fecha,
        id_centro_comercial: f.id_centro_comercial,
        centro: mapCentros[f.id_centro_comercial] || "Centro desconocido",
        area: f.area,
      }));

      // ============================================================
      // ✅ NUEVO: Mensaje claro sin duplicados y agrupado por centro
      // - admin_centro: "En X faltan resúmenes para: a, b, c"
      // - admin_sistema: "En X faltan... \nEn Y faltan..."
      // ============================================================
      const ORDER_AREAS = [
        "recepcion",
        "administracion",
        "mantenimiento",
        "seguridad",
        "mercadeo",
        "sso",
      ];

      function ordenarAreasUnicas(areas) {
        const set = new Set(areas.filter(Boolean));
        const arr = Array.from(set);
        arr.sort((a, b) => ORDER_AREAS.indexOf(a) - ORDER_AREAS.indexOf(b));
        return arr;
      }

      const agrupado = {};
      for (const f of faltantes) {
        const key = String(f.id_centro_comercial);
        if (!agrupado[key]) {
          agrupado[key] = {
            fecha: f.fecha,
            id_centro_comercial: f.id_centro_comercial,
            centro: f.centro,
            areas: [],
          };
        }
        agrupado[key].areas.push(f.area);
      }

      const faltantesAgrupados = Object.values(agrupado).map((x) => ({
        ...x,
        areas: ordenarAreasUnicas(x.areas),
      }));

      let mensaje;

      if (session.rol === "admin_centro") {
        const uno = faltantesAgrupados[0];
        mensaje = `En ${uno?.centro || "Centro desconocido"} faltan resúmenes para: ${(
          uno?.areas || []
        ).join(", ")}.`;
      } else {
        // admin_sistema
        mensaje = faltantesAgrupados
          .map(
            (x) =>
              `En ${x.centro || "Centro desconocido"} faltan resúmenes para: ${(x.areas || []).join(
                ", "
              )}.`
          )
          .join("\n");
      }

      return NextResponse.json(
        {
          message: mensaje,
          filtros: info,
          faltantes, // (se mantiene tal cual ya lo usabas)
          faltantesAgrupados, // ✅ NUEVO (para UI más clara si luego quieres)
        },
        { status: 400 }
      );
    }

    // Si no faltan, unificamos con IA usando SOLO los resúmenes guardados
    const textos = existentes.map((e) => e.resumen);
    const resumenFinal = await resumenGlobalDesdeResumenesGuardados(
      textos,
      totalIncidentes,
      info
    );

    return NextResponse.json({
      resumen: resumenFinal,
      filtros: info,
      resumenGuardado: false,
      editable: false,
    });
  }

  // ============================================================
  // Desde aquí: usuario_operativo (siempre IA cuando no existe resumen guardado)
  // ============================================================
  const registros = await prisma.mensajes_clasificados.findMany({
    where,
    include: { incidente: true, mensaje_limpio: true },
    orderBy: { id_mensaje_clasificado: "asc" },
  });

  const mensajes = registros.map((r) => {
    const hora = new Date(r.mensaje_limpio.fecha_envio).toLocaleTimeString(
      "es-EC",
      { hour: "2-digit", minute: "2-digit" }
    );
    return `${hora} - ${r.incidente.area} - ${r.incidente.nombre}: ${r.mensaje_limpio.contenido_limpio}`;
  });

  // ============================================
  // 🚨 NO HAY INCIDENTES
  // ============================================
  if (mensajes.length === 0) {
    return NextResponse.json({
      resumen:
        "No se encontraron incidentes para los filtros seleccionados. No es necesario generar un resumen para el día indicado.",
      filtros: info,
      resumenGuardado: false,
      editable: false,
    });
  }

  // ============================================
  // 🧱 DIVIDIR EN BLOQUES
  // ============================================
  const bloques = [];
  for (let i = 0; i < mensajes.length; i += BLOCK_SIZE) {
    bloques.push(mensajes.slice(i, i + BLOCK_SIZE));
  }

  console.log(`🔧 Se crearán ${bloques.length} bloques para resumir...`);

  const resumenesParciales = [];

  // ============================
  // 🔥 RESUMIR CADA BLOQUE
  // ============================
  for (const bloque of bloques) {
    const texto = bloque.join("\n");
    const resumenParcial = await resumirBloque(texto, info);
    resumenesParciales.push(resumenParcial);
  }

  // ============================
  // 🔥 RESUMEN FINAL
  // ============================
  const resumenFinal = await resumenGlobal(
    resumenesParciales,
    mensajes.length,
    info
  );

  return NextResponse.json({
    resumen: resumenFinal,
    filtros: info,
    resumenGuardado: false,
    editable: true,
  });
}

// ============================
// ✅ GUARDAR RESUMEN (usuario_operativo)
// ============================
export async function PUT(req) {
  const session = await authorize(req, ["usuario_operativo"]);
  if (session instanceof NextResponse) return session;

  const body = await req.json();
  const { fecha, resumen } = body;

  if (!fecha) {
    return NextResponse.json(
      { message: "Debe seleccionar una fecha." },
      { status: 400 }
    );
  }

  if (typeof resumen !== "string") {
    return NextResponse.json(
      { message: "Resumen inválido." },
      { status: 400 }
    );
  }

  // Fecha exacta
  const [y, m, d] = fecha.split("-");
  const fechaUTC = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));

  const centroId = session.id_centro_comercial;
  const area = session.area;

  // Si ya existe, NO se debe sobreescribir
  const existente = await prisma.resumenes_diarios.findUnique({
    where: {
      fecha_id_centro_comercial_area: {
        fecha: fechaUTC,
        id_centro_comercial: centroId,
        area,
      },
    },
  });

  if (existente) {
    return NextResponse.json(
      { message: "El resumen ya existe en el sistema para ese día, centro y área." },
      { status: 400 }
    );
  }

  await prisma.resumenes_diarios.create({
    data: {
      fecha: fechaUTC,
      id_centro_comercial: centroId,
      area,
      resumen,
    },
  });

  return NextResponse.json({ message: "Resumen guardado con éxito." });
}
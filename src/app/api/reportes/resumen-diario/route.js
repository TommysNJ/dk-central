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
// 🚀 ROUTE PRINCIPAL
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

  // ============================
  // FILTROS DE CONSULTA PRISMA
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

  // ============================================
  // 🚨 NO HAY INCIDENTES
  // ============================================
  if (mensajes.length === 0) {
    return NextResponse.json({
      resumen:
        "No se encontraron incidentes para los filtros seleccionados. No es necesario generar un resumen para el día indicado.",
      filtros: info,
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
  });
}
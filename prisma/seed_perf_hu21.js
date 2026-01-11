// prisma/seed_perf_hu21.js
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * ================================
 * HU-21 Seed (Rendimiento)
 * - 8 centros
 * - muchos usuarios
 * - 7 dias de mensajes (2026-01-01 .. 2026-01-07)
 * - 400 mensajes por centro por dia (total 22400)
 * - inserta mensajes_limpios + mensajes_clasificados (1 a 1)
 * - mete observaciones en clasificados
 * - mete historial_incidentes (1-3 cambios por incidente)
 * - mete resumenes_diarios (1 por dia/centro/area, max 260 palabras)
 * - fechas con logica Ecuador (UTC-5) igual que tu route de mensajes_limpios
 * ================================
 */

// ---------- util random reproducible ----------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function pad2(n) {
  return String(n).padStart(2, "0");
}

/** ✅ NUEVO: now Ecuador (igual tu backend) */
function nowEcuador() {
  const now = new Date();
  return new Date(now.getTime() - 5 * 60 * 60 * 1000);
}

/**
 * Emula tu logica EXACTA (como tu route):
 * - fechaOriginal = Date(UTC)
 * - fechaEcuador = fechaOriginal - 5h
 * - yyyyMmDd = fechaEcuador.toISOString().slice(0,10)
 * - fecha_envio_date = new Date(`${yyyyMmDd}T00:00:00.000Z`)
 * - fecha_envio_time = HH:MM:SS desde fechaEcuador
 */
function toEcuadorFields(fechaOriginalUtc) {
  const fechaEcuador = new Date(
    fechaOriginalUtc.getTime() - 5 * 60 * 60 * 1000
  );
  const yyyyMmDd = fechaEcuador.toISOString().slice(0, 10);
  const fecha_envio_date = new Date(`${yyyyMmDd}T00:00:00.000Z`);
  const fecha_envio_time = fechaEcuador
    .toISOString()
    .split("T")[1]
    .substring(0, 8);
  return { fechaEcuador, fecha_envio_date, fecha_envio_time };
}

function makeFechaOriginalUTC(yyyy, mm, dd, rng) {
  const hour = 7 + Math.floor(rng() * 17); // 7..23
  const minute = Math.floor(rng() * 60);
  const second = Math.floor(rng() * 60);
  return new Date(Date.UTC(yyyy, mm - 1, dd, hour, minute, second));
}

function normalizeUserTextArea(areaEnum) {
  return (
    {
      recepcion: "Recepcion",
      administracion: "Administracion",
      mantenimiento: "Mantenimiento",
      seguridad: "Seguridad",
      mercadeo: "Mercadeo",
      sso: "SSO",
      otros: "Otros",
    }[areaEnum] || String(areaEnum || "Area")
  );
}

function buildMensajeContenido({
  centroNombre,
  areaEnum,
  incidenteNombre,
  keyword,
  rng,
}) {
  const ubic = pick(rng, [
    "patio de comidas",
    "parqueadero",
    "pasillo principal",
    "entrada",
    "cajeros",
    "zona de tiendas",
    "banos",
    "escaleras electricas",
    "plaza central",
    "accesos",
  ]);

  const sev = pick(rng, ["baja", "media", "alta"]);
  const accion = pick(rng, [
    "se solicita apoyo",
    "se coordina revision",
    "se informa a seguridad",
    "se activa protocolo",
    "se realiza seguimiento",
    "se deja constancia",
    "se notifica al supervisor",
  ]);

  const areaTxt = normalizeUserTextArea(areaEnum);
  const palabra = keyword ? `palabra clave: ${keyword}` : "palabra clave: n/a";

  return `${areaTxt} reporta ${incidenteNombre} en ${ubic} (criticidad: ${sev}) en ${centroNombre}. ${palabra}. ${accion}.`;
}

function buildObservacion({ estado, rng }) {
  // 35% sin observacion
  if (rng() < 0.35) return null;

  const base = pick(rng, [
    "Se registra novedad para seguimiento.",
    "Se informa al encargado del area.",
    "Se valida informacion con camaras.",
    "Se coordina inspeccion en sitio.",
    "Se deja constancia en bitacora.",
    "Se solicita apoyo adicional.",
    "Se realiza verificacion y control.",
  ]);

  const extra =
    estado === "nuevo"
      ? pick(rng, [
          "Pendiente asignacion.",
          "Pendiente validacion inicial.",
          "Se inicia revision preliminar.",
        ])
      : estado === "en_proceso"
      ? pick(rng, [
          "Caso en atencion.",
          "Se mantiene monitoreo.",
          "Se coordina con personal operativo.",
        ])
      : pick(rng, [
          "Caso resuelto.",
          "Se cierra sin novedades adicionales.",
          "Cierre con recomendacion preventiva.",
        ]);

  return `${base} ${extra}`;
}

function pickWeightedAreaPlan({ includeOtros = true }) {
  const areas = [
    "recepcion",
    "administracion",
    "mantenimiento",
    "seguridad",
    "mercadeo",
    "sso",
  ];

  const plan = [];
  const otrosCount = includeOtros ? 20 : 0;
  const remaining = 400 - otrosCount;

  const base = Math.floor(remaining / areas.length); // 63
  const extra = remaining % areas.length; // 2

  for (let i = 0; i < areas.length; i++) {
    const count = base + (i < extra ? 1 : 0);
    for (let k = 0; k < count; k++) plan.push(areas[i]);
  }

  if (includeOtros) for (let k = 0; k < otrosCount; k++) plan.push("otros");

  return plan; // 400
}

async function upsertCentros() {
  const centros = [
    { nombre: "Granados Plaza", ciudad: "Quito" },
    { nombre: "Quicentro Shopping", ciudad: "Quito" },
    { nombre: "Portal Shopping", ciudad: "Quito" },
    { nombre: "San Luis Shopping", ciudad: "Quito" },
    { nombre: "Mall del Pacifico", ciudad: "Manta" },
    { nombre: "San Marino Shopping", ciudad: "Guayaquil" },
    { nombre: "Malteria Plaza", ciudad: "Latacunga" },
    { nombre: "Quicentro Sur", ciudad: "Quito" },
  ];

  const created = [];
  for (const c of centros) {
    const row = await prisma.centros_comerciales.upsert({
      where: { nombre: c.nombre },
      update: { ciudad: c.ciudad },
      create: {
        nombre: c.nombre,
        ciudad: c.ciudad,
        ubicacion: null,
        id_grupo_telegram: `grp_${c.nombre
          .toLowerCase()
          .replace(/[^\w]+/g, "_")}`,
      },
    });
    created.push(row);
  }
  return created;
}

async function createUsers(centros) {
  const passwordPlain = "User12.";
  const hashed = await bcrypt.hash(passwordPlain, 10);

  // admin_centro: 1 por centro
  for (const c of centros) {
    const usuario = `admin_${c.id_centro_comercial}`;
    const correo = `admin.${c.id_centro_comercial}@dkmanagement.com`;

    await prisma.usuarios.upsert({
      where: { usuario },
      update: {},
      create: {
        nombre: `Administrador ${c.nombre}`,
        correo,
        telefono: null,
        usuario,
        password: hashed,
        rol: "admin_centro",
        area: null,
        id_centro_comercial: c.id_centro_comercial,
        must_change_password: false,
      },
    });
  }

  // operativos: por centro x area (6) x 3
  const areasOperativas = [
    "recepcion",
    "administracion",
    "mantenimiento",
    "seguridad",
    "mercadeo",
    "sso",
  ];

  let idx = 1;
  for (const c of centros) {
    for (const a of areasOperativas) {
      for (let k = 0; k < 3; k++) {
        const usuario = `op_${a}_${c.id_centro_comercial}_${k + 1}`;
        const correo = `op.${a}.${c.id_centro_comercial}.${k + 1}@dkmanagement.com`;

        await prisma.usuarios.upsert({
          where: { usuario },
          update: {},
          create: {
            nombre: `Operativo ${idx++} (${a}) - ${c.nombre}`,
            correo,
            telefono: null,
            usuario,
            password: hashed,
            rol: "usuario_operativo",
            area: a,
            id_centro_comercial: c.id_centro_comercial,
            must_change_password: false,
          },
        });
      }
    }
  }

  // extras para búsqueda
  const rng = mulberry32(20260109);
  for (let i = 1; i <= 220; i++) {
    const usuario = `user_${String(i).padStart(3, "0")}`;
    const correo = `user${String(i).padStart(3, "0")}@correo.com`;

    await prisma.usuarios.upsert({
      where: { usuario },
      update: {},
      create: {
        nombre: `Usuario Prueba ${i}`,
        correo,
        telefono: null,
        usuario,
        password: hashed,
        rol: "usuario_operativo",
        area: pick(rng, [
          "recepcion",
          "administracion",
          "mantenimiento",
          "seguridad",
          "mercadeo",
          "sso",
        ]),
        id_centro_comercial: pick(rng, centros).id_centro_comercial,
        must_change_password: false,
      },
    });
  }
}

async function seedMensajes({
  centros,
  incidentes,
  keywordsByIncidenteId,
  operadoresPorCentroArea,
}) {
  const rng = mulberry32(20260109);

  // incidentes por area
  const incByArea = new Map();
  for (const inc of incidentes) {
    if (!incByArea.has(inc.area)) incByArea.set(inc.area, []);
    incByArea.get(inc.area).push(inc);
  }

  // estados con pesos
  const estadoWeights = [
    { estado: "nuevo", w: 0.5 },
    { estado: "en_proceso", w: 0.3 },
    { estado: "completado", w: 0.2 },
  ];
  function pickEstado(r) {
    const x = r();
    let acc = 0;
    for (const e of estadoWeights) {
      acc += e.w;
      if (x <= acc) return e.estado;
    }
    return "nuevo";
  }

  function buildHistorialSteps(finalEstado, rr) {
    const steps = [];
    steps.push("nuevo");

    if (finalEstado === "en_proceso") {
      steps.push("en_proceso");
    } else if (finalEstado === "completado") {
      if (rr() < 0.85) steps.push("en_proceso");
      steps.push("completado");
    }
    return steps;
  }

  // 7 dias
  for (let day = 1; day <= 7; day++) {
    const yyyy = 2026;
    const mm = 1;
    const dd = day;

    console.log(`📅 Sembrando mensajes para 2026-01-${pad2(day)} ...`);

    for (const centro of centros) {
      const telegramBase = day * 100000 + centro.id_centro_comercial * 10000;

      const areaPlan = pickWeightedAreaPlan({ includeOtros: true });
      for (let i = areaPlan.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [areaPlan[i], areaPlan[j]] = [areaPlan[j], areaPlan[i]];
      }

      const mensajesBatch = [];
      const chosen = [];

      for (let i = 0; i < 400; i++) {
        const fechaOriginal = makeFechaOriginalUTC(yyyy, mm, dd, rng);
        const { fechaEcuador, fecha_envio_date, fecha_envio_time } =
          toEcuadorFields(fechaOriginal);

        const areaTarget = areaPlan[i];
        const pool = incByArea.get(areaTarget) || [];
        const inc = pool.length ? pick(rng, pool) : pick(rng, incidentes);

        const kpool = keywordsByIncidenteId.get(inc.id_incidente) || [];
        const keyword = kpool.length ? pick(rng, kpool) : null;

        const estadoFinal = pickEstado(rng);
        const confianza = 0.78 + rng() * 0.21;

        const contenido = buildMensajeContenido({
          centroNombre: centro.nombre,
          areaEnum: inc.area,
          incidenteNombre: inc.nombre,
          keyword,
          rng,
        });

        const id_mensaje_telegram = telegramBase + i + 1;

        mensajesBatch.push({
          id_centro_comercial: centro.id_centro_comercial,
          id_mensaje_telegram,
          contenido_original: contenido,
          contenido_limpio: contenido,
          remitente: `operador_${centro.id_centro_comercial}`,
          fecha_envio: fechaEcuador,
          fecha_envio_date,
          fecha_envio_time,
          procesado: true,
        });

        chosen.push({
          id_mensaje_telegram,
          id_incidente: inc.id_incidente,
          area: inc.area,
          estadoFinal,
          confianza,
          fechaBaseEcuador: fechaEcuador,
        });
      }

      await prisma.mensajes_limpios.createMany({
        data: mensajesBatch,
        skipDuplicates: true,
      });

      const inserted = await prisma.mensajes_limpios.findMany({
        where: {
          id_centro_comercial: centro.id_centro_comercial,
          id_mensaje_telegram: {
            gte: telegramBase + 1,
            lte: telegramBase + 400,
          },
        },
        select: { id_mensaje: true, id_mensaje_telegram: true },
      });

      const mapId = new Map();
      for (const r of inserted) mapId.set(r.id_mensaje_telegram, r.id_mensaje);

      const clasificadosBatch = [];
      const mapClasifByTelegram = new Map();

      for (let i = 0; i < chosen.length; i++) {
        const c = chosen[i];
        const id_mensaje = mapId.get(c.id_mensaje_telegram);
        if (!id_mensaje) continue;

        const rrSeed =
          9000000 + day * 10000 + centro.id_centro_comercial * 100 + i;
        const rr = mulberry32(rrSeed);

        const obs = buildObservacion({ estado: c.estadoFinal, rng: rr });

        clasificadosBatch.push({
          id_mensaje_limpio: id_mensaje,
          id_incidente: c.id_incidente,
          confianza: c.confianza,
          estado: c.estadoFinal,
          observaciones: obs,
        });

        mapClasifByTelegram.set(c.id_mensaje_telegram, {
          area: c.area,
          fechaBaseEcuador: c.fechaBaseEcuador,
          estadoFinal: c.estadoFinal,
          rrSeed,
        });
      }

      await prisma.mensajes_clasificados.createMany({
        data: clasificadosBatch,
        skipDuplicates: true,
      });

      const clasifs = await prisma.mensajes_clasificados.findMany({
        where: {
          mensaje_limpio: {
            id_centro_comercial: centro.id_centro_comercial,
            id_mensaje_telegram: {
              gte: telegramBase + 1,
              lte: telegramBase + 400,
            },
          },
        },
        select: {
          id_mensaje_clasificado: true,
          mensaje_limpio: { select: { id_mensaje_telegram: true } },
        },
      });

      const historialBatch = [];

      for (const row of clasifs) {
        const telegram = row.mensaje_limpio?.id_mensaje_telegram;
        const meta = mapClasifByTelegram.get(telegram);
        if (!meta) continue;

        const rr = mulberry32(meta.rrSeed);

        const key = `${centro.id_centro_comercial}__${meta.area}`;
        const opIds = operadoresPorCentroArea.get(key) || [];
        const fallbackCentroIds =
          operadoresPorCentroArea.get(`${centro.id_centro_comercial}__ALL`) || [];
        const userId =
          (opIds.length ? pick(rr, opIds) : null) ||
          (fallbackCentroIds.length ? pick(rr, fallbackCentroIds) : null);

        if (!userId) continue;

        const steps = buildHistorialSteps(meta.estadoFinal, rr);

        let baseMs = meta.fechaBaseEcuador.getTime();
        for (let s = 0; s < steps.length; s++) {
          const addMin = 2 + Math.floor(rr() * 23);
          baseMs += addMin * 60 * 1000;

          const fechaEcuadorEvento = new Date(baseMs);
          const yyyyMmDd = fechaEcuadorEvento.toISOString().slice(0, 10);
          const fecha_cambio = new Date(`${yyyyMmDd}T00:00:00.000Z`);
          const hora_cambio = fechaEcuadorEvento
            .toISOString()
            .split("T")[1]
            .substring(0, 8);

          const obsH =
            rr() < 0.45
              ? pick(rr, [
                  "Registro automatico de cambio de estado.",
                  "Cambio de estado confirmado por operador.",
                  "Seguimiento realizado en sitio.",
                  "Cierre con recomendacion preventiva.",
                  "Validacion con evidencia.",
                ])
              : null;

          historialBatch.push({
            id_mensaje_clasificado: row.id_mensaje_clasificado,
            id_usuario: userId,
            estado: steps[s],
            observaciones: obsH,
            fecha: fechaEcuadorEvento, // ✅ Ecuador
            fecha_cambio,
            hora_cambio,
          });
        }
      }

      if (historialBatch.length) {
        await prisma.historial_incidentes.createMany({
          data: historialBatch,
          skipDuplicates: false,
        });
      }
    }
  }
}

/* =========================================================
   ✅ NUEVO: RESUMENES DIARIOS (7 días * 8 centros * 7 áreas)
   - 1 por fecha + centro + area (unique)
   - max 260 palabras (generación determinista)
   - fecha guardada como DATE estable (00:00Z del día)
   - fecha_actualizacion en Ecuador (nowEcuador)
   ========================================================= */

function dateUtcDay(yyyy, mm, dd) {
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function clipWords(text, maxWords = 260) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function buildResumenTexto({ rng, centroNombre, areaEnum, fechaStr }) {
  const areaTxt = normalizeUserTextArea(areaEnum);

  const freq = pick(rng, [
    "alta",
    "moderada",
    "baja",
    "intermitente",
    "con picos puntuales",
  ]);

  const franjas = pick(rng, [
    "10:00-12:00",
    "12:00-14:00",
    "15:00-17:00",
    "17:00-19:00",
    "19:00-21:00",
    "08:00-10:00",
  ]);

  const tendencia = pick(rng, [
    "se observaron patrones repetitivos en zonas de alto flujo",
    "los eventos se concentraron en puntos de acceso y circulacion",
    "hubo reportes distribuidos de forma regular durante el dia",
    "se registraron incidentes principalmente en areas comunes",
    "los casos se asociaron a condiciones operativas y de atencion al publico",
  ]);

  const recomendacion = pick(rng, [
    "Se recomienda reforzar rondas preventivas y verificacion en sitio.",
    "Se sugiere revisar procedimientos y tiempos de respuesta del personal.",
    "Se recomienda mantener monitoreo por camaras y control de accesos.",
    "Se sugiere reforzar senaletica preventiva y gestion de riesgo.",
    "Se recomienda coordinar con administracion acciones correctivas puntuales.",
  ]);

  const notaOtros =
    areaEnum === "otros"
      ? "Los registros clasificados como 'otros' se mantienen para trazabilidad y revision posterior de tipificacion."
      : "";

  // Texto pensado para ser <260 palabras (igual lo recortamos por seguridad)
  const raw = `
Resumen diario ${fechaStr} - ${centroNombre} - ${areaTxt}.
Durante la jornada se evidencio una carga ${freq} de novedades reportadas, con mayor actividad en la franja ${franjas}.
En general, ${tendencia}. Se priorizaron acciones de control, seguimiento y registro para asegurar continuidad operativa.
Se realizaron coordinaciones internas para atencion de casos y se dejo constancia para auditoria y trazabilidad.
${notaOtros}
${recomendacion}
  `.trim();

  return clipWords(raw, 260);
}

async function seedResumenesDiarios({ centros }) {
  const rng = mulberry32(7772026);

  const areasAll = [
    "recepcion",
    "administracion",
    "mantenimiento",
    "seguridad",
    "mercadeo",
    "sso",
    "otros",
  ];

  const rows = [];
  for (let day = 1; day <= 7; day++) {
    const fechaISO = `2026-01-${pad2(day)}`;
    const fechaUTC = dateUtcDay(2026, 1, day);

    for (const centro of centros) {
      for (const areaEnum of areasAll) {
        const rr = mulberry32(
          500000 + day * 1000 + centro.id_centro_comercial * 10 + areasAll.indexOf(areaEnum)
        );

        const resumen = buildResumenTexto({
          rng: rr,
          centroNombre: centro.nombre,
          areaEnum,
          fechaStr: fechaISO,
        });

        rows.push({
          fecha: fechaUTC,
          id_centro_comercial: centro.id_centro_comercial,
          area: areaEnum,
          resumen,
          id_usuario: null,
          // si tu DB/Prisma respeta @updatedAt, esto puede sobreescribirse,
          // pero igual lo ponemos para que quede en Ecuador desde seed:
          fecha_actualizacion: nowEcuador(),
        });
      }
    }
  }

  // Insert masivo: 392 registros
  await prisma.resumenes_diarios.createMany({
    data: rows,
    skipDuplicates: true,
  });

  console.log(`🧾 Resumenes diarios insertados: ${rows.length}`);
}

async function main() {
  console.log("🌱 HU-21 Seed (rendimiento) iniciando...");

  // 1) Centros
  const centros = await upsertCentros();
  console.log(`🏬 Centros listos: ${centros.length}`);

  // 2) Usuarios
  await createUsers(centros);
  console.log("👥 Usuarios listos.");

  // 3) Incidentes
  const incidentes = await prisma.incidentes.findMany({
    select: { id_incidente: true, nombre: true, area: true },
  });
  if (!incidentes.length) {
    throw new Error(
      "No hay incidentes en la BD. Ejecuta primero tu seed principal (admin/incidentes/keywords)."
    );
  }

  // 4) Keywords
  const kws = await prisma.keywords_incidentes.findMany({
    select: { id_incidente: true, palabra: true },
  });
  const keywordsByIncidenteId = new Map();
  for (const k of kws) {
    if (!keywordsByIncidenteId.has(k.id_incidente))
      keywordsByIncidenteId.set(k.id_incidente, []);
    keywordsByIncidenteId
      .get(k.id_incidente)
      .push(String(k.palabra || "").toLowerCase());
  }

  // 5) Operadores por centro/area para historial
  const ops = await prisma.usuarios.findMany({
    where: { rol: "usuario_operativo" },
    select: { id_usuario: true, id_centro_comercial: true, area: true },
  });

  const operadoresPorCentroArea = new Map();
  function pushMap(key, id) {
    if (!operadoresPorCentroArea.has(key)) operadoresPorCentroArea.set(key, []);
    operadoresPorCentroArea.get(key).push(id);
  }

  for (const u of ops) {
    if (!u.id_centro_comercial) continue;
    if (u.area) pushMap(`${u.id_centro_comercial}__${u.area}`, u.id_usuario);
    pushMap(`${u.id_centro_comercial}__ALL`, u.id_usuario);
  }

  console.log(
    `📌 Incidentes: ${incidentes.length} | 🔑 Keywords: ${kws.length} | 👷 Ops: ${ops.length}`
  );

  // 6) Mensajes + Clasificados + Historial
  await seedMensajes({
    centros,
    incidentes,
    keywordsByIncidenteId,
    operadoresPorCentroArea,
  });

  // ✅ NUEVO: Resúmenes diarios
  await seedResumenesDiarios({ centros });

  console.log("✅ Mensajes, clasificados, historial y resumenes insertados.");
  console.log("🌱 HU-21 Seed finalizado.");
}

main()
  .catch((e) => {
    console.error("❌ Error en HU-21 seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
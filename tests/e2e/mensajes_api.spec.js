// tests/e2e/mensajes_api.spec.js
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BOT_API_KEY =
  process.env.BOT_API_KEY || "CLAVE_SEGURA_DE_AUTENTICACION";

test.describe("HU23 - Mensajes Limpios + Clasificados AUTO (API)", () => {
  let centro;
  let incidente;

  test.beforeAll(async () => {
    // Limpieza por prefijo (IMPORTANTE: orden por FK)
    await prisma.mensajes_clasificados.deleteMany({
      where: {
        mensaje_limpio: { remitente: { startsWith: "pw_msg_" } },
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { remitente: { startsWith: "pw_msg_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_msg_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_msg_" } },
    });

    // Seed centro
    centro = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_msg_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "-100000099999",
      },
    });

    // Seed incidente (no dependemos del clasificador, pero lo usamos para crear clasificados manualmente)
    incidente = await prisma.incidentes.create({
      data: { nombre: "pw_msg_incidente_1", area: "seguridad" },
    });
  });

  test.afterAll(async () => {
    await prisma.mensajes_clasificados.deleteMany({
      where: {
        mensaje_limpio: { remitente: { startsWith: "pw_msg_" } },
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { remitente: { startsWith: "pw_msg_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_msg_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_msg_" } },
    });

    await prisma.$disconnect();
  });

  test("POST /api/mensajes-limpios: sin x-api-key -> 401", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-limpios", {
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: 90001,
        contenido_original: "o",
        contenido_limpio: "pw_msg_contenido_1",
        remitente: "pw_msg_bot",
        fecha_envio: new Date().toISOString(),
      },
    });

    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.message).toMatch(/no autorizado/i);
  });

  test("POST /api/mensajes-limpios: faltan campos obligatorios -> 400", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-limpios", {
      headers: { "x-api-key": BOT_API_KEY },
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        // falta id_mensaje_telegram y fecha_envio y contenido_limpio
      },
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/faltan campos/i);
  });

  test("POST /api/mensajes-limpios: crea mensaje (aunque clasificación falle) -> 200 + procesado=false", async ({
    request,
  }) => {
    const telegramId = 90002;

    const res = await request.post("/api/mensajes-limpios", {
      headers: { "x-api-key": BOT_API_KEY },
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: telegramId,
        contenido_original: "Hola",
        contenido_limpio: "pw_msg_contenido_nuevo",
        remitente: "pw_msg_bot",
        fecha_envio: "2026-01-11T10:00:00.000Z",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id_mensaje).toBeTruthy();
    expect(body.procesado).toBe(false);

    const db = await prisma.mensajes_limpios.findUnique({
      where: {
        id_centro_comercial_id_mensaje_telegram: {
          id_centro_comercial: centro.id_centro_comercial,
          id_mensaje_telegram: telegramId,
        },
      },
    });
    expect(db).toBeTruthy();
    expect(db.procesado).toBe(false);
    expect(db.remitente).toBe("pw_msg_bot");
  });

  test("POST /api/mensajes-limpios: duplicado sin procesar -> 200 (mensaje informativo)", async ({
    request,
  }) => {
    const telegramId = 90003;

    // pre-creo un mensaje NO procesado
    const ml = await prisma.mensajes_limpios.create({
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: telegramId,
        contenido_original: "o",
        contenido_limpio: "pw_msg_dup_no_proc",
        remitente: "pw_msg_bot",
        fecha_envio: new Date("2026-01-11T12:00:00.000Z"),
        fecha_envio_date: new Date("2026-01-11T00:00:00.000Z"),
        fecha_envio_time: "07:00:00",
        procesado: false,
      },
    });

    const res = await request.post("/api/mensajes-limpios", {
      headers: { "x-api-key": BOT_API_KEY },
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: telegramId,
        contenido_original: "o",
        contenido_limpio: "pw_msg_dup_no_proc",
        remitente: "pw_msg_bot",
        fecha_envio: "2026-01-11T12:00:00.000Z",
      },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/duplicado.*sin procesar/i);

    // debe seguir existiendo
    const db = await prisma.mensajes_limpios.findUnique({
      where: { id_mensaje: ml.id_mensaje },
    });
    expect(db).toBeTruthy();
  });

  test("POST /api/mensajes-limpios: duplicado procesado + con clasificación -> 200 (ya registrado y clasificado)", async ({
    request,
  }) => {
    const telegramId = 90004;

    const ml = await prisma.mensajes_limpios.create({
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: telegramId,
        contenido_original: "o",
        contenido_limpio: "pw_msg_dup_proc",
        remitente: "pw_msg_bot",
        fecha_envio: new Date("2026-01-11T13:00:00.000Z"),
        fecha_envio_date: new Date("2026-01-11T00:00:00.000Z"),
        fecha_envio_time: "08:00:00",
        procesado: true,
      },
    });

    await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: ml.id_mensaje,
        id_incidente: incidente.id_incidente,
        confianza: 0.9,
      },
    });

    const res = await request.post("/api/mensajes-limpios", {
      headers: { "x-api-key": BOT_API_KEY },
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: telegramId,
        contenido_original: "o",
        contenido_limpio: "pw_msg_dup_proc",
        remitente: "pw_msg_bot",
        fecha_envio: "2026-01-11T13:00:00.000Z",
      },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/ya registrado.*clasificado/i);
  });

  test("POST /api/mensajes-clasificados/auto: sin x-api-key -> 401", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-clasificados/auto", {
      data: { id_mensaje_limpio: 999999 },
    });

    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.message).toMatch(/no autorizado/i);
  });

  test("POST /api/mensajes-clasificados/auto: id_mensaje_limpio requerido -> 400", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-clasificados/auto", {
      headers: { "x-api-key": BOT_API_KEY },
      data: {},
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/requerido/i);
  });

  test("POST /api/mensajes-clasificados/auto: mensaje no encontrado -> 404", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-clasificados/auto", {
      headers: { "x-api-key": BOT_API_KEY },
      data: { id_mensaje_limpio: 999999999 },
    });

    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.message).toMatch(/no encontrado/i);
  });

  test("POST /api/mensajes-clasificados/auto: ya clasificado pero procesado=0 -> 200 y corrige procesado=1", async ({
    request,
  }) => {
    const ml = await prisma.mensajes_limpios.create({
      data: {
        id_centro_comercial: centro.id_centro_comercial,
        id_mensaje_telegram: 90005,
        contenido_original: "o",
        contenido_limpio: "pw_msg_auto_ya_clasificado",
        remitente: "pw_msg_bot",
        fecha_envio: new Date("2026-01-11T14:00:00.000Z"),
        fecha_envio_date: new Date("2026-01-11T00:00:00.000Z"),
        fecha_envio_time: "09:00:00",
        procesado: false, // importante
      },
    });

    const clasif = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: ml.id_mensaje,
        id_incidente: incidente.id_incidente,
        confianza: 0.8,
      },
    });

    const res = await request.post("/api/mensajes-clasificados/auto", {
      headers: { "x-api-key": BOT_API_KEY },
      data: { id_mensaje_limpio: ml.id_mensaje },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toMatch(/ya procesado.*clasificado/i);
    expect(data.clasificacion?.id_mensaje_limpio).toBe(clasif.id_mensaje_limpio);

    const mlDb = await prisma.mensajes_limpios.findUnique({
      where: { id_mensaje: ml.id_mensaje },
    });
    expect(mlDb.procesado).toBe(true);
  });
});
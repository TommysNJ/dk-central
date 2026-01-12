// tests/e2e/incidentes_api.spec.js
import { test, expect, request as pwRequest } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../src/lib/jwt.js";

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("; ");
}

// Replica tu lógica de "hoy Ecuador" (UTC-5) y normalización a 00:00 UTC
function todayUTC_EcuadorLikeBackend() {
  const now = new Date();
  const ecuDate = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(ecuDate.getUTCFullYear(), ecuDate.getUTCMonth(), ecuDate.getUTCDate())
  );
}

test.describe("HU23 - Incidentes (API) - ISO/IEC 25010 Security + Functional correctness", () => {
  let api;

  // IDs generados en runtime
  let centro1, centro2;
  let userAdminSistema, userAdminCentroC1, userOperativoC1Seg, userOperativoC2Seg;

  // incidentes (catálogo)
  let incRoboSeg, incFallaMant, incOtrosSeg;

  // mensajes + clasificados (datos operativos)
  let mlTodayC1, mlOtherDayC1, mlTodayC2;
  let mcTodayC1_seg_nuevo, mcTodayC1_mant_enproceso, mcOtherDayC1_seg_completado, mcTodayC2_seg_nuevo, mcTodayC1_otros;

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE_URL });

    // ⚠️ Limpieza en orden por FK
    await prisma.historial_incidentes.deleteMany({});
    await prisma.mensajes_clasificados.deleteMany({});
    await prisma.mensajes_limpios.deleteMany({});
    await prisma.usuarios.deleteMany({
      where: {
        OR: [
          { usuario: { startsWith: "pw_" } },
          { correo: { endsWith: "@test.local" } },
        ],
      },
    });
    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_" } },
    });
    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_group_2",
      },
    });

    // Usuarios (para permisos en authorize + historial)
    userAdminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW Admin Sistema",
        correo: "pw_admin_sistema@test.local",
        usuario: "pw_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    userAdminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW Admin Centro C1",
        correo: "pw_admin_centro_c1@test.local",
        usuario: "pw_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    userOperativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW Operativo C1 Seguridad",
        correo: "pw_operativo_c1_seg@test.local",
        usuario: "pw_operativo_c1_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    userOperativoC2Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW Operativo C2 Seguridad",
        correo: "pw_operativo_c2_seg@test.local",
        usuario: "pw_operativo_c2_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro2.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Catálogo incidentes (usar upsert para evitar choques con datos reales)
incRoboSeg = await prisma.incidentes.upsert({
  where: { nombre: "pw_robo" },
  update: { area: "seguridad" },
  create: { nombre: "pw_robo", area: "seguridad" },
});

    incFallaMant = await prisma.incidentes.upsert({
    where: { nombre: "pw_falla" },
    update: { area: "mantenimiento" },
    create: { nombre: "pw_falla", area: "mantenimiento" },
    });

    // "otros" YA existe en tu BD real (catálogo), no lo creamos: lo recuperamos
    incOtrosSeg = await prisma.incidentes.findUnique({
    where: { nombre: "otros" },
    });

    if (!incOtrosSeg) {
    // Si por alguna razón no existiera, recién lo creamos
    incOtrosSeg = await prisma.incidentes.create({
        data: { nombre: "otros", area: "seguridad" },
    });
    }

    // Fechas
    const todayUTC = todayUTC_EcuadorLikeBackend();
    const otherDayUTC = new Date(Date.UTC(2020, 0, 1)); // 2020-01-01

    const now = new Date();
    const nowIso = now.toISOString();

    // Mensajes limpios
    mlTodayC1 = await prisma.mensajes_limpios.create({
      data: {
        id_mensaje_telegram: 900001,
        id_centro_comercial: centro1.id_centro_comercial,
        contenido_original: "o",
        contenido_limpio: "pw msg c1 hoy",
        remitente: "pw",
        fecha_envio: new Date(nowIso),
        fecha_envio_date: todayUTC,
        fecha_envio_time: "10:00:00",
        procesado: true,
      },
    });

    mlOtherDayC1 = await prisma.mensajes_limpios.create({
      data: {
        id_mensaje_telegram: 900002,
        id_centro_comercial: centro1.id_centro_comercial,
        contenido_original: "o",
        contenido_limpio: "pw msg c1 otro dia",
        remitente: "pw",
        fecha_envio: new Date("2020-01-01T10:00:00.000Z"),
        fecha_envio_date: otherDayUTC,
        fecha_envio_time: "05:00:00",
        procesado: true,
      },
    });

    mlTodayC2 = await prisma.mensajes_limpios.create({
      data: {
        id_mensaje_telegram: 900003,
        id_centro_comercial: centro2.id_centro_comercial,
        contenido_original: "o",
        contenido_limpio: "pw msg c2 hoy",
        remitente: "pw",
        fecha_envio: new Date(nowIso),
        fecha_envio_date: todayUTC,
        fecha_envio_time: "11:00:00",
        procesado: true,
      },
    });

    // Mensajes clasificados
    mcTodayC1_seg_nuevo = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: mlTodayC1.id_mensaje,
        id_incidente: incRoboSeg.id_incidente,
        confianza: 0.9,
        estado: "nuevo",
        observaciones: "",
      },
    });

    mcTodayC1_mant_enproceso = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: mlTodayC1.id_mensaje, // OJO: unique en id_mensaje_limpio, entonces creamos otro ml para mantenimiento
        id_incidente: incFallaMant.id_incidente,
        confianza: 0.8,
        estado: "en_proceso",
        observaciones: "init",
      },
    }).catch(async () => {
      // como id_mensaje_limpio es unique, creamos otro mensaje para este
      const ml = await prisma.mensajes_limpios.create({
        data: {
          id_mensaje_telegram: 900004,
          id_centro_comercial: centro1.id_centro_comercial,
          contenido_original: "o",
          contenido_limpio: "pw msg c1 mant hoy",
          remitente: "pw",
          fecha_envio: new Date(nowIso),
          fecha_envio_date: todayUTC,
          fecha_envio_time: "12:00:00",
          procesado: true,
        },
      });

      return prisma.mensajes_clasificados.create({
        data: {
          id_mensaje_limpio: ml.id_mensaje,
          id_incidente: incFallaMant.id_incidente,
          confianza: 0.8,
          estado: "en_proceso",
          observaciones: "init",
        },
      });
    });

    mcOtherDayC1_seg_completado = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: mlOtherDayC1.id_mensaje,
        id_incidente: incRoboSeg.id_incidente,
        confianza: 0.95,
        estado: "completado",
        observaciones: "final",
      },
    });

    mcTodayC2_seg_nuevo = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: mlTodayC2.id_mensaje,
        id_incidente: incRoboSeg.id_incidente,
        confianza: 0.7,
        estado: "nuevo",
        observaciones: "",
      },
    });

    // “otros” debe ser excluido en GET
    const mlOtros = await prisma.mensajes_limpios.create({
      data: {
        id_mensaje_telegram: 900005,
        id_centro_comercial: centro1.id_centro_comercial,
        contenido_original: "o",
        contenido_limpio: "pw msg otros",
        remitente: "pw",
        fecha_envio: new Date(nowIso),
        fecha_envio_date: todayUTC,
        fecha_envio_time: "13:00:00",
        procesado: true,
      },
    });

    mcTodayC1_otros = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: mlOtros.id_mensaje,
        id_incidente: incOtrosSeg.id_incidente,
        confianza: 0.5,
        estado: "nuevo",
        observaciones: "",
      },
    });
  });

  test.afterAll(async () => {
    await prisma.historial_incidentes.deleteMany({});
    await prisma.mensajes_clasificados.deleteMany({});
    await prisma.mensajes_limpios.deleteMany({});
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_" } },
    });
    await prisma.incidentes.deleteMany({
      where: { nombre: { in: ["pw_robo", "pw_falla", "otros"] } },
    });
    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_" } },
    });

    await prisma.$disconnect();
    await api.dispose();
  });

  // --------------------------
  // GET /api/incidentes
  // --------------------------

  test("GET /api/incidentes: sin auth_token → 401/redirect (depende authorize)", async () => {
    const r = await api.get("/api/incidentes");
    // authorize puede responder 401 JSON o redirect; validamos que NO sea 200
    expect(r.status()).not.toBe(200);
  });

  test("GET /api/incidentes: filtrar por estado sin fecha → 400 y mensaje", async () => {
    const token = signAuthToken({
      sub: userAdminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.get("/api/incidentes?estado=nuevo", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/Debe seleccionar una fecha/i);
  });

  test("GET /api/incidentes: sin filtros → retorna SOLO HOY y excluye 'otros'", async () => {
    const token = signAuthToken({
      sub: userAdminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.get("/api/incidentes", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const items = await r.json();

    // Debe excluir 'otros'
    expect(items.some((x) => String(x.incidente).toLowerCase() === "otros")).toBe(false);

    // Debe ser HOY
    const todayUTC = todayUTC_EcuadorLikeBackend().toISOString().split("T")[0];
    for (const it of items) {
      const d = String(it.fecha_date || "").split("T")[0];
      expect(d).toBe(todayUTC);
    }
  });

  test("GET /api/incidentes: admin_sistema puede filtrar por centro+fecha", async () => {
    const token = signAuthToken({
      sub: userAdminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const today = todayUTC_EcuadorLikeBackend().toISOString().split("T")[0];
    const q = `/api/incidentes?centro=${centro2.id_centro_comercial}&fecha=${today}`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const items = await r.json();
    expect(items.length).toBeGreaterThan(0);

    // Todo debe pertenecer a centro2
    expect(items.every((x) => x.id_centro_comercial === centro2.id_centro_comercial)).toBe(true);
  });

  test("GET /api/incidentes: admin_centro NO puede ver otro centro (aunque mande centro=otro)", async () => {
    const token = signAuthToken({
      sub: userAdminCentroC1.id_usuario,
      rol: "admin_centro",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const today = todayUTC_EcuadorLikeBackend().toISOString().split("T")[0];
    // intenta centro2, pero backend debe forzar centro1
    const q = `/api/incidentes?centro=${centro2.id_centro_comercial}&fecha=${today}`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const items = await r.json();

    // todo debe ser centro1
    expect(items.every((x) => x.id_centro_comercial === centro1.id_centro_comercial)).toBe(true);
  });

  test("GET /api/incidentes: usuario_operativo SOLO su centro + su área (ignora filtro area)", async () => {
    const token = signAuthToken({
      sub: userOperativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const today = todayUTC_EcuadorLikeBackend().toISOString().split("T")[0];
    // intenta pedir mantenimiento, pero backend fuerza seguridad
    const q = `/api/incidentes?area=mantenimiento&fecha=${today}`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const items = await r.json();

    expect(items.every((x) => x.id_centro_comercial === centro1.id_centro_comercial)).toBe(true);
    expect(items.every((x) => x.area === "seguridad")).toBe(true);
  });

  // --------------------------
  // PUT /api/incidentes/:id
  // --------------------------

  test("PUT /api/incidentes/:id: admin_sistema → 403/401 (solo usuario_operativo)", async () => {
    const token = signAuthToken({
      sub: userAdminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.put(`/api/incidentes/${mcTodayC1_seg_nuevo.id_mensaje_clasificado}`, {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { observaciones: "x" },
    });

    expect([401, 403]).toContain(r.status());
  });

  test("PUT /api/incidentes/:id: operativo de otro centro → 403", async () => {
    const token = signAuthToken({
      sub: userOperativoC2Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro2.id_centro_comercial,
      must_change_password: false,
    });

    const r = await api.put(`/api/incidentes/${mcTodayC1_seg_nuevo.id_mensaje_clasificado}`, {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { observaciones: "no debería" },
    });

    expect(r.status()).toBe(403);
  });

  test("PUT /api/incidentes/:id: no permitir editar completado → 400", async () => {
    const token = signAuthToken({
      sub: userOperativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const r = await api.put(`/api/incidentes/${mcOtherDayC1_seg_completado.id_mensaje_clasificado}`, {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { observaciones: "intento editar completado" },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/ya está completado/i);
  });

  test("PUT /api/incidentes/:id: en_proceso → nuevo (regresión) → 400", async () => {
    const token = signAuthToken({
      sub: userOperativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "mantenimiento", // OJO: este incidente es mantenimiento, así que usamos área mantenimiento para autorizar
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    // Para que sea válido por permisos, buscamos el incidente en_proceso de mantenimiento (ya creado)
    const incMant = await prisma.mensajes_clasificados.findFirst({
      where: {
        estado: "en_proceso",
        incidente: { nombre: "pw_falla" },
      },
      include: { mensaje_limpio: true, incidente: true },
    });

    // si el usuario de seguridad no cuadra, creamos un token con área mantenimiento (payload del JWT) para pasar authorize
    const r = await api.put(`/api/incidentes/${incMant.id_mensaje_clasificado}`, {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { estado: "nuevo" },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/No se puede volver/i);
  });

  test("PUT /api/incidentes/:id: si está NUEVO y se guarda observación → pasa a EN_PROCESO + crea historial", async () => {
    const token = signAuthToken({
      sub: userOperativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    // aseguramos estado nuevo
    const before = await prisma.mensajes_clasificados.findUnique({
      where: { id_mensaje_clasificado: mcTodayC1_seg_nuevo.id_mensaje_clasificado },
    });
    expect(before.estado).toBe("nuevo");

    const r = await api.put(`/api/incidentes/${mcTodayC1_seg_nuevo.id_mensaje_clasificado}`, {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { observaciones: "Se coordinó con seguridad" },
    });

    expect(r.status()).toBe(200);
    const updated = await r.json();
    expect(updated.estado).toBe("en_proceso"); // tu lógica

    // historial debe existir
    const hist = await prisma.historial_incidentes.findMany({
      where: { id_mensaje_clasificado: mcTodayC1_seg_nuevo.id_mensaje_clasificado },
      orderBy: { id_historial: "desc" },
    });

    expect(hist.length).toBeGreaterThan(0);
    expect(hist[0].estado).toBe("en_proceso");
    expect(hist[0].observaciones || "").toMatch(/coordinó/i);
  });

  // --------------------------
  // GET /api/incidentes/:id/historial
  // --------------------------

  test("GET /api/incidentes/:id/historial: admin_sistema puede ver", async () => {
    const token = signAuthToken({
      sub: userAdminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.get(`/api/incidentes/${mcTodayC1_seg_nuevo.id_mensaje_clasificado}/historial`, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const items = await r.json();
    expect(Array.isArray(items)).toBe(true);
  });

  test("GET /api/incidentes/:id/historial: admin_centro no puede ver otro centro → 403", async () => {
    const token = signAuthToken({
      sub: userAdminCentroC1.id_usuario,
      rol: "admin_centro",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const r = await api.get(`/api/incidentes/${mcTodayC2_seg_nuevo.id_mensaje_clasificado}/historial`, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(403);
  });

  test("GET /api/incidentes/:id/historial: operativo solo su centro+área → 403 si área no coincide", async () => {
    // Para provocar mismatch, pedimos historial de mantenimiento con token seguridad
    const tokenSeg = signAuthToken({
      sub: userOperativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const incMant = await prisma.mensajes_clasificados.findFirst({
      where: { incidente: { nombre: "pw_falla" } },
    });

    const r = await api.get(`/api/incidentes/${incMant.id_mensaje_clasificado}/historial`, {
      headers: { Cookie: cookieHeader({ auth_token: tokenSeg }) },
    });

    expect(r.status()).toBe(403);
  });
});
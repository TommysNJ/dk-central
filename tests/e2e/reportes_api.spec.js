// tests/e2e/reportes_api.spec.js
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

// YYYY-MM-DD (UTC midnight)
function d(dateStr) {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

test.describe("HU23 - Reportes (API) - ISO/IEC 25010 Security + Functional correctness", () => {
  let api;

  let centro1, centro2;
  let adminSistema, adminCentroC1, operativoC1Seg;

  let incSegRobo, incMantFalla;

  // mensajes y clasificados (dataset)
  // - rango: 2026-01-10 a 2026-01-12
  const FECHA_INI = "2026-01-10";
  const FECHA_FIN = "2026-01-12";

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE_URL });

    // Limpieza por prefijo de pruebas
    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_rep_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { incidente: { nombre: { startsWith: "pw_rep_" } } },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_rep_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_rep_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_rep_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_rep_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_rep_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_rep_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_rep_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_rep_group_2",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW REP Admin Sistema",
        correo: "pw_rep_admin_sistema@test.local",
        usuario: "pw_rep_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW REP Admin Centro C1",
        correo: "pw_rep_admin_centro_c1@test.local",
        usuario: "pw_rep_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW REP Operativo C1 Seguridad",
        correo: "pw_rep_operativo_c1_seg@test.local",
        usuario: "pw_rep_operativo_c1_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Catálogo incidentes
    incSegRobo = await prisma.incidentes.create({
      data: { nombre: "pw_rep_robo", area: "seguridad" },
    });

    incMantFalla = await prisma.incidentes.create({
      data: { nombre: "pw_rep_falla", area: "mantenimiento" },
    });

    // Seed de mensajes/clasificados dentro del rango [2026-01-10..2026-01-12]
    // Centro1:
    // - seguridad: 2 registros (nuevo/en_proceso)
    // - mantenimiento: 1 registro (completado)
    // Centro2:
    // - seguridad: 1 registro (nuevo)
    const seeds = [
      // C1 - seguridad - 2026-01-10
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-10",
        time: "10:00:00",
        incId: incSegRobo.id_incidente,
        estado: "nuevo",
        msg: "pw_rep_c1_seg_1",
      },
      // C1 - seguridad - 2026-01-11
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-11",
        time: "11:00:00",
        incId: incSegRobo.id_incidente,
        estado: "en_proceso",
        msg: "pw_rep_c1_seg_2",
      },
      // C1 - mantenimiento - 2026-01-12
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-12",
        time: "12:00:00",
        incId: incMantFalla.id_incidente,
        estado: "completado",
        msg: "pw_rep_c1_mant_1",
      },
      // C2 - seguridad - 2026-01-11
      {
        centroId: centro2.id_centro_comercial,
        fecha: "2026-01-11",
        time: "09:00:00",
        incId: incSegRobo.id_incidente,
        estado: "nuevo",
        msg: "pw_rep_c2_seg_1",
      },
    ];

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const ml = await prisma.mensajes_limpios.create({
        data: {
          id_mensaje_telegram: 910000 + i,
          id_centro_comercial: s.centroId,
          contenido_original: "o",
          contenido_limpio: s.msg,
          remitente: "pw_rep",
          fecha_envio: new Date(`${s.fecha}T${s.time}.000Z`),
          fecha_envio_date: d(s.fecha),
          fecha_envio_time: s.time,
          procesado: true,
        },
      });

      await prisma.mensajes_clasificados.create({
        data: {
          id_mensaje_limpio: ml.id_mensaje,
          id_incidente: s.incId,
          confianza: 0.9,
          estado: s.estado,
          observaciones: "",
        },
      });
    }
  });

  test.afterAll(async () => {
    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_rep_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { incidente: { nombre: { startsWith: "pw_rep_" } } },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_rep_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_rep_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_rep_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_rep_" } },
    });

    await prisma.$disconnect();
    await api.dispose();
  });

  // --------------------------
  // Validaciones de parámetros
  // --------------------------

  test("GET /api/reportes: sin auth_token → no 200 (depende authorize)", async () => {
    const r = await api.get("/api/reportes?fecha_inicio=2026-01-10&fecha_fin=2026-01-10");
    expect(r.status()).not.toBe(200);
  });

  test("GET /api/reportes: falta fecha_inicio o fecha_fin → 400", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.get("/api/reportes?fecha_inicio=2026-01-10", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/Debe seleccionar una fecha/i);
  });

  test("GET /api/reportes: fecha_fin < fecha_inicio → 400", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.get("/api/reportes?fecha_inicio=2026-01-12&fecha_fin=2026-01-10", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/no puede ser menor/i);
  });

  test("GET /api/reportes: rango > 7 días → 400", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.get("/api/reportes?fecha_inicio=2026-01-01&fecha_fin=2026-01-15", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/máximo permitido.*7/i);
  });

  // --------------------------
  // Reglas por rol (filtros)
  // --------------------------

  test("admin_sistema: puede filtrar por centro + área (respeta filtros)", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const q =
      `/api/reportes?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}` +
      `&centro=${centro2.id_centro_comercial}&area=seguridad`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const j = await r.json();

    // Resumen debe reflejar centro2 y seguridad
    expect(j.resumen.centro_id).toBe(centro2.id_centro_comercial);
    expect(j.resumen.area).toBe("seguridad");

    // Para centro2 solo sembramos 1 seguridad → total debería ser 1 en esa área
    // rows agrega por área
    expect(Array.isArray(j.rows)).toBe(true);
    expect(j.rows.length).toBeGreaterThan(0);

    const rowSeg = j.rows.find((x) => x.area === "seguridad");
    expect(rowSeg).toBeTruthy();
    expect(rowSeg.total_incidentes).toBe(1);

    // detalleTipos agrupa por tipo
    const tipoRobo = j.detalleTipos.find((x) => x.tipo === "pw_rep_robo");
    expect(tipoRobo).toBeTruthy();
    expect(tipoRobo.total).toBe(1);
  });

  test("admin_centro: ignora centro enviado y fuerza su centro", async () => {
    const token = signAuthToken({
      sub: adminCentroC1.id_usuario,
      rol: "admin_centro",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    // intenta pedir centro2, pero backend debe forzar centro1
    const q =
      `/api/reportes?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}` +
      `&centro=${centro2.id_centro_comercial}&area=seguridad`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const j = await r.json();

    // Resumen centro_id debe ser el centro del admin_centro (centro1)
    expect(j.resumen.centro_id).toBe(centro1.id_centro_comercial);

    // En centro1 seguridad sembramos 2 → total seguridad = 2
    const rowSeg = j.rows.find((x) => x.area === "seguridad");
    expect(rowSeg).toBeTruthy();
    expect(rowSeg.total_incidentes).toBe(2);
  });

  test("usuario_operativo: ignora area enviada y fuerza su área", async () => {
    const token = signAuthToken({
      sub: operativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      id_centro_comercial: centro1.id_centro_comercial,
      area: "seguridad",
      must_change_password: false,
    });

    // intenta pedir mantenimiento, pero backend fuerza seguridad
    const q =
      `/api/reportes?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}` +
      `&area=mantenimiento`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const j = await r.json();

    expect(j.resumen.centro_id).toBe(centro1.id_centro_comercial);
    expect(j.resumen.area).toBe("seguridad");

    // En centro1 seguridad = 2
    const rowSeg = j.rows.find((x) => x.area === "seguridad");
    expect(rowSeg).toBeTruthy();
    expect(rowSeg.total_incidentes).toBe(2);

    // Y NO debería aparecer mantenimiento, porque operativo se limita a su área
    expect(j.rows.some((x) => x.area === "mantenimiento")).toBe(false);
  });

  test("sin registros en rango: devuelve rows/detalleTipos vacíos + resumen", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const q = `/api/reportes?fecha_inicio=2030-01-01&fecha_fin=2030-01-02`;

    const r = await api.get(q, {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
    });

    expect(r.status()).toBe(200);
    const j = await r.json();

    expect(Array.isArray(j.rows)).toBe(true);
    expect(j.rows.length).toBe(0);
    expect(Array.isArray(j.detalleTipos)).toBe(true);
    expect(j.detalleTipos.length).toBe(0);
    expect(j.resumen).toBeTruthy();
    expect(j.resumen.fecha_inicio).toBe("2030-01-01");
    expect(j.resumen.fecha_fin).toBe("2030-01-02");
  });
});
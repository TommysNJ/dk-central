// tests/e2e/resumenes_diarios_api.spec.js
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

function fechaUTCFromYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

test.describe("HU23 - Resúmenes diarios (API)", () => {
  let api;

  let centro1, centro2;
  let adminSistema, adminCentroC1, operativoC1Seg;

  let incSeg, incMant;

  const FECHA = "2026-01-11";
  const FECHA_UTC = fechaUTCFromYMD(FECHA);

  // Resúmenes base (guardados)
  const RESUMEN_SEG = "Resumen guardado de Seguridad (seed).";
  const RESUMEN_MANT = "Resumen guardado de Mantenimiento (seed).";

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE_URL });

    // Limpieza por prefijo
    await prisma.resumenes_diarios.deleteMany({
      where: { resumen: { contains: "seed resumenes_api" } },
    });

    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_resapi_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { incidente: { nombre: { startsWith: "pw_resapi_" } } },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_resapi_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_resapi_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_resapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_resapi_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_resapi_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_resapi_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_resapi_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_resapi_group_2",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW RESAPI Admin Sistema",
        correo: "pw_resapi_admin_sistema@test.local",
        usuario: "pw_resapi_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW RESAPI Admin Centro C1",
        correo: "pw_resapi_admin_centro_c1@test.local",
        usuario: "pw_resapi_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW RESAPI Operativo C1 Seguridad",
        correo: "pw_resapi_operativo_c1_seg@test.local",
        usuario: "pw_resapi_operativo_c1_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Incidentes
    incSeg = await prisma.incidentes.create({
      data: { nombre: "pw_resapi_robo", area: "seguridad" },
    });

    incMant = await prisma.incidentes.create({
      data: { nombre: "pw_resapi_falla", area: "mantenimiento" },
    });

    // Seed de incidentes reales (para que admins puedan pedir resumen general y aparezcan faltantes)
    // Creamos mensajes en (centro1, seguridad) y (centro2, mantenimiento)
    const seeds = [
      {
        centroId: centro1.id_centro_comercial,
        area: "seguridad",
        incId: incSeg.id_incidente,
        msg: "pw_resapi_c1_seg_1",
        telId: 810001,
      },
      {
        centroId: centro2.id_centro_comercial,
        area: "mantenimiento",
        incId: incMant.id_incidente,
        msg: "pw_resapi_c2_mant_1",
        telId: 810002,
      },
    ];

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];
      const ml = await prisma.mensajes_limpios.create({
        data: {
          id_mensaje_telegram: s.telId,
          id_centro_comercial: s.centroId,
          contenido_original: "o",
          contenido_limpio: s.msg,
          remitente: "pw_resapi",
          fecha_envio: new Date(`${FECHA}T10:00:00.000Z`),
          fecha_envio_date: FECHA_UTC,
          fecha_envio_time: "10:00:00",
          procesado: true,
        },
      });

      await prisma.mensajes_clasificados.create({
        data: {
          id_mensaje_limpio: ml.id_mensaje,
          id_incidente: s.incId,
          confianza: 0.9,
          estado: "nuevo",
          observaciones: "",
        },
      });
    }

    // ✅ Seed de resumen guardado SOLO para (centro1, seguridad)
    await prisma.resumenes_diarios.create({
      data: {
        fecha: FECHA_UTC,
        id_centro_comercial: centro1.id_centro_comercial,
        area: "seguridad",
        resumen: `seed resumenes_api: ${RESUMEN_SEG}`,
        id_usuario: operativoC1Seg.id_usuario,
        fecha_actualizacion: new Date(),
      },
    });

    // ❌ NO creamos (centro2, mantenimiento) a propósito -> para que admin_sistema en resumen general reciba faltantes (sin IA)
  });

  test.afterAll(async () => {
    await prisma.resumenes_diarios.deleteMany({
      where: { resumen: { contains: "seed resumenes_api" } },
    });

    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_resapi_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { incidente: { nombre: { startsWith: "pw_resapi_" } } },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_resapi_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_resapi_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_resapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_resapi_" } },
    });

    await prisma.$disconnect();
    await api.dispose();
  });

  test("POST /api/resumen-diario: sin auth_token → 401/redirect", async () => {
    const r = await api.post("/api/resumen-diario", {
      data: { fecha: FECHA },
    });
    expect(r.status()).not.toBe(200);
  });

  test("POST /api/resumen-diario: falta fecha → 400", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.post("/api/resumen-diario", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
      data: { centro: centro1.id_centro_comercial, area: "seguridad" },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/Debe seleccionar una fecha/i);
  });

  test("usuario_operativo: POST devuelve resumen guardado (no editable)", async () => {
    const token = signAuthToken({
      sub: operativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const r = await api.post("/api/resumen-diario", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
      data: { fecha: FECHA }, // operativo ignora centro/area
    });

    expect(r.status()).toBe(200);
    const j = await r.json();

    expect(j.resumenGuardado).toBe(true);
    expect(j.editable).toBe(false);
    expect(String(j.resumen)).toContain("seed resumenes_api");
  });

  test("usuario_operativo: PUT NO puede sobreescribir si ya existe", async () => {
    const token = signAuthToken({
      sub: operativoC1Seg.id_usuario,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const r = await api.put("/api/resumen-diario", {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { fecha: FECHA, resumen: "intento overwrite" },
    });

    expect(r.status()).toBe(400);
    const j = await r.json();
    expect(j.message).toMatch(/ya existe/i);
  });

  test("admin_centro: POST con área específica devuelve resumen guardado y editable:true", async () => {
    const token = signAuthToken({
      sub: adminCentroC1.id_usuario,
      rol: "admin_centro",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const r = await api.post("/api/resumen-diario", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
      data: { fecha: FECHA, area: "seguridad" },
    });

    expect(r.status()).toBe(200);
    const j = await r.json();

    expect(j.resumenGuardado).toBe(true);
    expect(j.editable).toBe(true); // 👈 regla del backend
    expect(String(j.resumen)).toContain("seed resumenes_api");
  });

  test("admin_centro: PUT puede actualizar resumen existente", async () => {
    const token = signAuthToken({
      sub: adminCentroC1.id_usuario,
      rol: "admin_centro",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    const nuevo = "seed resumenes_api: editado por admin_centro";

    const r = await api.put("/api/resumen-diario", {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { fecha: FECHA, resumen: nuevo, area: "seguridad" },
    });

    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.message).toMatch(/actualizado|éxito/i);

    const db = await prisma.resumenes_diarios.findUnique({
      where: {
        fecha_id_centro_comercial_area: {
          fecha: FECHA_UTC,
          id_centro_comercial: centro1.id_centro_comercial,
          area: "seguridad",
        },
      },
    });

    expect(db.resumen).toBe(nuevo);
    expect(db.id_usuario).toBe(adminCentroC1.id_usuario);
  });

  test("admin_sistema: POST resumen general (sin centro/area) → 400 por faltantes (sin IA)", async () => {
    const token = signAuthToken({
      sub: adminSistema.id_usuario,
      rol: "admin_sistema",
      must_change_password: false,
    });

    const r = await api.post("/api/resumen-diario", {
      headers: { Cookie: cookieHeader({ auth_token: token }) },
      data: { fecha: FECHA }, // general
    });

    expect(r.status()).toBe(400);
    const j = await r.json();

    expect(String(j.message || "")).toMatch(/faltan resúmenes/i);
    expect(Array.isArray(j.faltantes)).toBe(true);
    expect(j.faltantes.length).toBeGreaterThan(0);
  });
});
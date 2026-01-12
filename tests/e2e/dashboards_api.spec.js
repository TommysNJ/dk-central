// tests/e2e/dashboards_api.spec.js
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../src/lib/jwt.js";

const prisma = new PrismaClient();
const COOKIE_NAME = "auth_token";

function fechaUTCFromYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

test.describe("HU23 - Dashboards (API)", () => {
  let centro1, centro2;
  let adminSistema, adminCentroC1, operativoC1Seg;

  let incSegRobo, incMantFalla, incOtros;

  let tokenAdminSistema, tokenAdminCentro, tokenOperativo;

  const FECHA_INI = "2026-01-10";
  const FECHA_FIN = "2026-01-12";

  const FECHA_INI_UTC = fechaUTCFromYMD(FECHA_INI);
  const FECHA_FIN_UTC = fechaUTCFromYMD(FECHA_FIN);

  test.beforeAll(async () => {
    // ✅ Limpieza por prefijo (IMPORTANTE: borrar clasificados por mensaje_limpio)
    await prisma.mensajes_clasificados.deleteMany({
      where: {
        mensaje_limpio: { contenido_limpio: { startsWith: "pw_dashapi_" } },
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_dashapi_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_dashapi_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_dashapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_dashapi_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_dashapi_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_dashapi_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_dashapi_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_dashapi_group_2",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW DASHAPI Admin Sistema",
        correo: "pw_dashapi_admin_sistema@test.local",
        usuario: "pw_dashapi_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW DASHAPI Admin Centro C1",
        correo: "pw_dashapi_admin_centro_c1@test.local",
        usuario: "pw_dashapi_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW DASHAPI Operativo C1 Seguridad",
        correo: "pw_dashapi_operativo_c1_seg@test.local",
        usuario: "pw_dashapi_operativo_c1_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Incidentes (incluye uno "otros" para validar exclusión)
    incSegRobo = await prisma.incidentes.create({
      data: { nombre: "pw_dashapi_robo", area: "seguridad" },
    });

    incMantFalla = await prisma.incidentes.create({
      data: { nombre: "pw_dashapi_falla", area: "mantenimiento" },
    });

    // ✅ FIX: "otros" ya existe en tu BD (nombre es UNIQUE). Reusar si existe.
    incOtros = await prisma.incidentes.findUnique({
      where: { nombre: "otros" },
    });

    if (!incOtros) {
      incOtros = await prisma.incidentes.create({
        data: { nombre: "otros", area: "otros" },
      });
    }

    // Seed
    const seeds = [
      // C1 - seguridad
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-10",
        time: "10:00:00",
        incId: incSegRobo.id_incidente,
        estado: "nuevo",
        msg: "pw_dashapi_c1_seg_1",
      },
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-11",
        time: "11:00:00",
        incId: incSegRobo.id_incidente,
        estado: "en_proceso",
        msg: "pw_dashapi_c1_seg_2",
      },
      // C1 - mantenimiento
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-12",
        time: "12:00:00",
        incId: incMantFalla.id_incidente,
        estado: "completado",
        msg: "pw_dashapi_c1_mant_1",
      },
      // C2 - seguridad
      {
        centroId: centro2.id_centro_comercial,
        fecha: "2026-01-11",
        time: "09:00:00",
        incId: incSegRobo.id_incidente,
        estado: "nuevo",
        msg: "pw_dashapi_c2_seg_1",
      },
      // "otros" (debe excluirse por backend)
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-11",
        time: "08:00:00",
        incId: incOtros.id_incidente,
        estado: "nuevo",
        msg: "pw_dashapi_otros_1",
      },
    ];

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];

      const ml = await prisma.mensajes_limpios.create({
        data: {
          id_mensaje_telegram: 770000 + i,
          id_centro_comercial: s.centroId,
          contenido_original: "o",
          contenido_limpio: s.msg,
          remitente: "pw_dashapi",
          fecha_envio: new Date(`${s.fecha}T${s.time}.000Z`),
          fecha_envio_date: new Date(`${s.fecha}T00:00:00.000Z`),
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

    // Tokens
    tokenAdminSistema = signAuthToken({
      sub: adminSistema.id_usuario,
      nombre: adminSistema.nombre,
      correo: adminSistema.correo,
      rol: "admin_sistema",
      must_change_password: false,
    });

    tokenAdminCentro = signAuthToken({
      sub: adminCentroC1.id_usuario,
      nombre: adminCentroC1.nombre,
      correo: adminCentroC1.correo,
      rol: "admin_centro",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });

    tokenOperativo = signAuthToken({
      sub: operativoC1Seg.id_usuario,
      nombre: operativoC1Seg.nombre,
      correo: operativoC1Seg.correo,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro1.id_centro_comercial,
      must_change_password: false,
    });
  });

  test.afterAll(async () => {
    await prisma.mensajes_clasificados.deleteMany({
      where: {
        mensaje_limpio: { contenido_limpio: { startsWith: "pw_dashapi_" } },
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_dashapi_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_dashapi_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_dashapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_dashapi_" } },
    });

    await prisma.$disconnect();
  });

  test("GET /api/dashboard: valida fecha obligatoria", async ({ request }) => {
    const res = await request.get(`/api/dashboard`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` },
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/fecha de inicio/i);
  });

  test("GET /api/dashboard: rango > 7 días -> 400", async ({ request }) => {
    const res = await request.get(
      `/api/dashboard?fecha_inicio=2026-01-01&fecha_fin=2026-01-10`,
      { headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` } }
    );

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/máximo.*7/i);
  });

  test("Admin sistema: sin filtros centro/area -> total excluye 'otros' y agrega ambos centros", async ({
    request,
  }) => {
    const res = await request.get(
      `/api/dashboard?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}`,
      { headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` } }
    );

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.kpis.total_incidentes).toBe(4);

    const porEstado = data.charts.por_estado;
    const map = Object.fromEntries(porEstado.map((x) => [x.estado, x.total]));
    expect(map.nuevo).toBe(2);
    expect(map.en_proceso).toBe(1);
    expect(map.completado).toBe(1);

    const porArea = Object.fromEntries(
      data.charts.por_area.map((x) => [x.area, x.total])
    );
    expect(porArea.seguridad).toBe(3);
    expect(porArea.mantenimiento).toBe(1);

    expect(data.charts.por_dia).toHaveLength(3);
    const porDia = Object.fromEntries(
      data.charts.por_dia.map((x) => [x.fecha, x.total])
    );
    expect(porDia["2026-01-10"]).toBe(1);
    expect(porDia["2026-01-11"]).toBe(2);
    expect(porDia["2026-01-12"]).toBe(1);
  });

  test("Admin sistema: filtro centro=centro1 -> total solo centro1 (excluye 'otros')", async ({
    request,
  }) => {
    const res = await request.get(
      `/api/dashboard?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}&centro=${centro1.id_centro_comercial}`,
      { headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` } }
    );

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.kpis.total_incidentes).toBe(3);
    expect(data.resumen.centro_id).toBe(centro1.id_centro_comercial);
  });

  test("Admin centro: ignora centro query y restringe a su centro", async ({ request }) => {
    const res = await request.get(
      `/api/dashboard?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}&centro=${centro2.id_centro_comercial}`,
      { headers: { Cookie: `${COOKIE_NAME}=${tokenAdminCentro}` } }
    );

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.kpis.total_incidentes).toBe(3);
    expect(data.resumen.centro_id).toBe(centro1.id_centro_comercial);
  });

  test("Usuario operativo: restringe a su centro + su área (seguridad)", async ({ request }) => {
    const res = await request.get(
      `/api/dashboard?fecha_inicio=${FECHA_INI}&fecha_fin=${FECHA_FIN}&area=mantenimiento`,
      { headers: { Cookie: `${COOKIE_NAME}=${tokenOperativo}` } }
    );

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    expect(data.kpis.total_incidentes).toBe(2);
    expect(data.resumen.area).toBe("seguridad");

    const porArea = Object.fromEntries(
      data.charts.por_area.map((x) => [x.area, x.total])
    );
    expect(porArea.seguridad).toBe(2);
    expect(porArea.mantenimiento).toBeUndefined();
  });
});
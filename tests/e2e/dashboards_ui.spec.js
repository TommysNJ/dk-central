// tests/e2e/dashboards_ui.spec.js
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../src/lib/jwt.js";

const prisma = new PrismaClient();
const COOKIE_NAME = "auth_token";

async function setAuthCookie(page, token) {
  const baseURL = process.env.BASE_URL || "http://localhost:3000";
  const u = new URL(baseURL);

  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: u.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

// Helper select por placeholder-option (tu UI no tiene aria-label en selects)
function selectWithOption(page, optionText) {
  return page.locator("select").filter({
    has: page.locator("option", { hasText: optionText }),
  });
}

// Helper para inputs date por label visible (igual que reportes)
function dateInputByLabel(page, labelText) {
  return page
    .locator(".report-filter-group")
    .filter({ has: page.getByText(labelText) })
    .locator('input[type="date"]');
}

test.describe("HU23 - Dashboards (UI mínima)", () => {
  let centro1, centro2;
  let adminSistema, adminCentroC1, operativoC1Seg;

  let incSegRobo, incMantFalla, incOtros;

  let tokenAdminSistema, tokenAdminCentro, tokenOperativo;

  // Seed para que el dashboard tenga data estable
  const FECHA_INI = "2026-01-10";
  const FECHA_FIN = "2026-01-12";

  test.beforeAll(async () => {
    // ✅ Limpieza robusta por prefijo (evita FK)
    await prisma.mensajes_clasificados.deleteMany({
      where: {
        mensaje_limpio: { contenido_limpio: { startsWith: "pw_dashui_" } },
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_dashui_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_dashui_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_dashui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_dashui_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_dashui_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_dashui_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_dashui_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_dashui_group_2",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW DASHUI Admin Sistema",
        correo: "pw_dashui_admin_sistema@test.local",
        usuario: "pw_dashui_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW DASHUI Admin Centro C1",
        correo: "pw_dashui_admin_centro_c1@test.local",
        usuario: "pw_dashui_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW DASHUI Operativo C1 Seguridad",
        correo: "pw_dashui_operativo_c1_seg@test.local",
        usuario: "pw_dashui_operativo_c1_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Incidentes + "otros"
    incSegRobo = await prisma.incidentes.create({
      data: { nombre: "pw_dashui_robo", area: "seguridad" },
    });

    incMantFalla = await prisma.incidentes.create({
      data: { nombre: "pw_dashui_falla", area: "mantenimiento" },
    });

    // ✅ FIX: "otros" es UNIQUE y ya puede existir en BD
    incOtros = await prisma.incidentes.findUnique({
      where: { nombre: "otros" },
    });

    if (!incOtros) {
      incOtros = await prisma.incidentes.create({
        data: { nombre: "otros", area: "otros" },
      });
    }

    // Seeds (mismo patrón del API test)
    // Total esperado sin "otros" = 4
    const seeds = [
      // C1 - seguridad
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-10",
        time: "10:00:00",
        incId: incSegRobo.id_incidente,
        estado: "nuevo",
        msg: "pw_dashui_c1_seg_1",
      },
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-11",
        time: "11:00:00",
        incId: incSegRobo.id_incidente,
        estado: "en_proceso",
        msg: "pw_dashui_c1_seg_2",
      },
      // C1 - mantenimiento
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-12",
        time: "12:00:00",
        incId: incMantFalla.id_incidente,
        estado: "completado",
        msg: "pw_dashui_c1_mant_1",
      },
      // C2 - seguridad
      {
        centroId: centro2.id_centro_comercial,
        fecha: "2026-01-11",
        time: "09:00:00",
        incId: incSegRobo.id_incidente,
        estado: "nuevo",
        msg: "pw_dashui_c2_seg_1",
      },
      // "otros" excluido
      {
        centroId: centro1.id_centro_comercial,
        fecha: "2026-01-11",
        time: "08:00:00",
        incId: incOtros.id_incidente,
        estado: "nuevo",
        msg: "pw_dashui_otros_1",
      },
    ];

    for (let i = 0; i < seeds.length; i++) {
      const s = seeds[i];

      const ml = await prisma.mensajes_limpios.create({
        data: {
          id_mensaje_telegram: 880000 + i,
          id_centro_comercial: s.centroId,
          contenido_original: "o",
          contenido_limpio: s.msg,
          remitente: "pw_dashui",
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
        mensaje_limpio: { contenido_limpio: { startsWith: "pw_dashui_" } },
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_dashui_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_dashui_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_dashui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_dashui_" } },
    });

    await prisma.$disconnect();
  });

  test("Admin sistema: ve filtros Centro Comercial y Área", async ({ page }) => {
    await setAuthCookie(page, tokenAdminSistema);
    await page.goto("/dashboard/dashboards", { waitUntil: "domcontentloaded" });

    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(1);

    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(1);
  });

  test("Admin centro: NO ve Centro Comercial, SÍ ve Área", async ({ page }) => {
    await setAuthCookie(page, tokenAdminCentro);
    await page.goto("/dashboard/dashboards", { waitUntil: "domcontentloaded" });

    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(0);

    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(1);
  });

  test("Usuario operativo: NO ve Centro Comercial, NO ve Área, y puede filtrar dashboard", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenOperativo);
    await page.goto("/dashboard/dashboards", { waitUntil: "domcontentloaded" });

    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(0);

    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(0);

    // Fechas (por label)
    const iniInput = dateInputByLabel(page, "Fecha inicio");
    const finInput = dateInputByLabel(page, "Fecha fin");
    await expect(iniInput).toHaveCount(1);
    await expect(finInput).toHaveCount(1);

    await iniInput.fill(FECHA_INI);
    await finInput.fill(FECHA_FIN);

    // Filtrar
    await page.getByRole("button", { name: /^Filtrar$/i }).click();

    // Debe renderizar KPIs y charts
    await expect(page.locator(".dash-kpis .kpi-card")).toHaveCount(5);
    await expect(page.locator(".dash-charts .dash-chart-card")).toHaveCount(6);

    // KPI "Total de incidentes" para operativo (C1 + seguridad) = 2
    const totalCard = page.locator(".kpi-card").filter({
      has: page.getByText("Total de incidentes"),
    });
    await expect(totalCard).toHaveCount(1);

    const totalValue = totalCard.locator(".kpi-value");
    await expect(totalValue).toHaveText("2");
  });
});
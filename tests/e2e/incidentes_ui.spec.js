// tests/e2e/incidentes_ui.spec.js
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../src/lib/jwt.js";

const prisma = new PrismaClient();
const COOKIE_NAME = "auth_token";

function todayUTC_EcuadorLikeBackend() {
  const now = new Date();
  const ecuDate = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  return new Date(Date.UTC(ecuDate.getUTCFullYear(), ecuDate.getUTCMonth(), ecuDate.getUTCDate()));
}

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

// Helpers para encontrar selects por option placeholder
function selectWithOption(page, optionText) {
  return page.locator("select").filter({
    has: page.locator("option", { hasText: optionText }),
  });
}

test.describe("HU23 - Incidentes (UI mínima)", () => {
  let centro;
  let adminSistema;
  let operativoSeg;
  let incidenteSeg;
  let ml;
  let mc;

  let tokenAdminSistema;
  let tokenOperativo;

  test.beforeAll(async () => {
    // Limpieza mínima de data de pruebas (si se quedó algo)
    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_ui_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: {
        OR: [
          { incidente: { nombre: { startsWith: "pw_ui_" } } },
        ],
      },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_ui_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_ui_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_ui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_ui_" } },
    });

    // Crear centro
    centro = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_ui_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_ui_group_1",
      },
    });

    // Crear usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW UI Admin Sistema",
        correo: "pw_ui_admin_sistema@test.local",
        usuario: "pw_ui_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoSeg = await prisma.usuarios.create({
      data: {
        nombre: "PW UI Operativo Seguridad",
        correo: "pw_ui_operativo_seg@test.local",
        usuario: "pw_ui_operativo_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Crear incidente (NO "otros")
    incidenteSeg = await prisma.incidentes.create({
      data: { nombre: "pw_ui_robo", area: "seguridad" },
    });

    // Crear mensaje + clasificado HOY (para que la tabla tenga 1 fila)
    const todayUTC = todayUTC_EcuadorLikeBackend();
    const now = new Date();

    ml = await prisma.mensajes_limpios.create({
      data: {
        id_mensaje_telegram: 990001,
        id_centro_comercial: centro.id_centro_comercial,
        contenido_original: "pw_ui_original",
        contenido_limpio: "pw_ui_msg_hoy",
        remitente: "pw_ui",
        fecha_envio: now,
        fecha_envio_date: todayUTC,
        fecha_envio_time: "10:00:00",
        procesado: true,
      },
    });

    mc = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: ml.id_mensaje,
        id_incidente: incidenteSeg.id_incidente,
        confianza: 0.9,
        estado: "nuevo",
        observaciones: "",
      },
    });

    // Tokens reales (alineados con authorize/me)
    tokenAdminSistema = signAuthToken({
      sub: adminSistema.id_usuario,
      nombre: adminSistema.nombre,
      correo: adminSistema.correo,
      rol: "admin_sistema",
      must_change_password: false,
    });

    tokenOperativo = signAuthToken({
      sub: operativoSeg.id_usuario,
      nombre: operativoSeg.nombre,
      correo: operativoSeg.correo,
      rol: "usuario_operativo",
      area: "seguridad",
      id_centro_comercial: centro.id_centro_comercial,
      must_change_password: false,
    });
  });

  test.afterAll(async () => {
    // Limpieza final
    await prisma.historial_incidentes.deleteMany({
      where: { id_mensaje_clasificado: mc?.id_mensaje_clasificado },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { id_mensaje_clasificado: mc?.id_mensaje_clasificado },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { id_mensaje: ml?.id_mensaje },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_ui_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_ui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_ui_" } },
    });

    await prisma.$disconnect();
  });

  test("Admin sistema: ve filtro Centro Comercial", async ({ page }) => {
    await setAuthCookie(page, tokenAdminSistema);

    await page.goto("/dashboard/incidentes", { waitUntil: "domcontentloaded" });

    // En tu UI no hay label/aria-label, así que buscamos el select por su option placeholder
    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(1);
    await expect(centroSelect.first()).toBeVisible();
  });

  test("Usuario operativo: NO ve filtro Área y puede abrir historial", async ({ page }) => {
    await setAuthCookie(page, tokenOperativo);

    await page.goto("/dashboard/incidentes", { waitUntil: "domcontentloaded" });

    // Usuario operativo NO ve el select de Área (solo admin_sistema / admin_centro)
    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(0);

    // Esperar a que cargue al menos 1 fila (sembrada en beforeAll)
    await expect(page.getByText("No existen incidentes que coincidan con los filtros.")).toHaveCount(0);

    // Botón historial (📄) por title
    const btn = page.locator('button[title="Ver historial de cambios"]').first();
    await expect(btn).toBeVisible();
    await btn.click();

    // Modal
    await expect(page.getByText("Historial del incidente")).toBeVisible();

    // Puede estar vacío (depende si hay historial), pero el modal debe abrir
    // y mostrar el mensaje del incidente
    await expect(page.getByText(/Mensaje:/i)).toBeVisible();
  });
});
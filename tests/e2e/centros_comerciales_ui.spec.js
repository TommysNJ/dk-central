// tests/e2e/centros_comerciales_ui.spec.js
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

// Helpers modal (sin htmlFor/id)
function modalRoot(page) {
  return page.locator(".modal .modal-content").first();
}
function inputAfterLabel(modal, labelText) {
  return modal.locator(`label:has-text("${labelText}") + input`);
}

test.describe("HU23 - Centros Comerciales (UI mínima)", () => {
  let adminSistema, adminCentro;
  let tokenAdminSistema, tokenAdminCentro;

  test.beforeAll(async () => {
    // Limpieza por prefijo
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_ccui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_ccui_" } },
    });

    // Centros seed para búsqueda
    await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_ccui_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "-100000010001",
      },
    });

    await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_ccui_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "-100000010002",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW CCUI Admin Sistema",
        correo: "pw_ccui_admin_sistema@test.local",
        telefono: "0999999911",
        usuario: "pw_ccui_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentro = await prisma.usuarios.create({
      data: {
        nombre: "PW CCUI Admin Centro",
        correo: "pw_ccui_admin_centro@test.local",
        telefono: "0999999912",
        usuario: "pw_ccui_admin_centro",
        password: "x",
        rol: "admin_centro",
        // le ponemos cualquier centro existente para que la sesión sea válida
        id_centro_comercial: (
          await prisma.centros_comerciales.findFirst({
            where: { nombre: "pw_ccui_centro_1" },
          })
        )?.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    tokenAdminSistema = signAuthToken({
      sub: adminSistema.id_usuario,
      nombre: adminSistema.nombre,
      correo: adminSistema.correo,
      rol: "admin_sistema",
      must_change_password: false,
    });

    tokenAdminCentro = signAuthToken({
      sub: adminCentro.id_usuario,
      nombre: adminCentro.nombre,
      correo: adminCentro.correo,
      rol: "admin_centro",
      id_centro_comercial: adminCentro.id_centro_comercial,
      must_change_password: false,
    });
  });

  test.afterAll(async () => {
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_ccui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_ccui_" } },
    });

    await prisma.$disconnect();
  });

  test("Solo admin_sistema: admin_centro NO debe poder usar/operar la pantalla", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminCentro);
    await page.goto("/dashboard/centros-comerciales", {
      waitUntil: "domcontentloaded",
    });

    // ✅ En tu app, parece que NO redirige ni muestra error.
    // Entonces validamos que NO tenga los controles de la pantalla.
    await expect(
      page.getByRole("button", { name: /Crear Centro Comercial/i })
    ).toHaveCount(0);

    await expect(page.getByPlaceholder("Buscar por ciudad...")).toHaveCount(0);

    // Tampoco debería ver la tabla de esta pantalla
    await expect(
      page.getByRole("columnheader", { name: /ID Grupo Telegram/i })
    ).toHaveCount(0);
  });

  test("Admin sistema: puede buscar por ciudad y ver resultados", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminSistema);
    await page.goto("/dashboard/centros-comerciales", {
      waitUntil: "domcontentloaded",
    });

    await page.getByPlaceholder("Buscar por ciudad...").fill("Quito");
    await page.getByRole("button", { name: /Buscar/i }).click();

    await expect(page.getByText("pw_ccui_centro_1")).toBeVisible();
    await expect(page.getByText("pw_ccui_centro_2")).toHaveCount(0);
  });

  test("Admin sistema: puede crear y eliminar centro con modal confirmación", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminSistema);
    await page.goto("/dashboard/centros-comerciales", {
      waitUntil: "domcontentloaded",
    });

    // abrir modal crear
    await page
      .getByRole("button", { name: /Crear Centro Comercial/i })
      .click();

    const modal = modalRoot(page);
    await expect(
      modal.getByRole("heading", { name: /Crear Nuevo Centro Comercial/i })
    ).toBeVisible();

    const suffix = Date.now();
    const nombre = `pw_ccui_new_${suffix}`;
    const ciudad = "Cuenca";
    const ubicacion = "Test";
    const idGrupo = `-${100000000000 + (suffix % 1000000)}`; // válido para POST

    await inputAfterLabel(modal, "Nombre").fill(nombre);
    await inputAfterLabel(modal, "Ciudad").fill(ciudad);
    await inputAfterLabel(modal, "Ubicación").fill(ubicacion);
    await inputAfterLabel(modal, "ID Grupo Telegram").fill(idGrupo);

    await modal.getByRole("button", { name: /Crear Centro/i }).click();

    // éxito
    await expect(page.getByText("Centro comercial creado con éxito.")).toBeVisible();
    await page.getByRole("button", { name: /Aceptar/i }).click();
    await expect(page.getByText("Centro comercial creado con éxito.")).toHaveCount(0);

    // buscar por ciudad para encontrarlo rápido
    await page.getByPlaceholder("Buscar por ciudad...").fill(ciudad);
    await page.getByRole("button", { name: /Buscar/i }).click();
    await expect(page.getByText(nombre)).toBeVisible();

    // eliminar desde la fila
    const row = page.locator("tr", { has: page.getByText(nombre) });
    await row.locator("button.delete").click();

    await expect(page.getByText("¿Deseas eliminar este centro comercial?")).toBeVisible();
    await page.getByRole("button", { name: /Confirmar/i }).click();

    // refrescar búsqueda
    await page.getByRole("button", { name: /Buscar/i }).click();
    await expect(page.getByText(nombre)).toHaveCount(0);
  });
});
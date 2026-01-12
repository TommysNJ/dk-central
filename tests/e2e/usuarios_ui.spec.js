// tests/e2e/usuarios_ui.spec.js
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

// Helpers para trabajar dentro del modal (sin htmlFor / id)
function modalRoot(page) {
  // tu modal usa: <div className="modal"><div className="modal-content">...
  return page.locator(".modal .modal-content").first();
}

function inputAfterLabel(modal, labelText) {
  // <label>Texto</label> <input ... />
  return modal.locator(`label:has-text("${labelText}") + input`);
}

function selectAfterLabel(modal, labelText) {
  // <label>Texto</label> <select ... />
  return modal.locator(`label:has-text("${labelText}") + select`);
}

test.describe("HU23 - Usuarios (UI mínima)", () => {
  let centro1, centro2;
  let adminSistema, adminCentroC1;

  let tokenAdminSistema, tokenAdminCentro;

  test.beforeAll(async () => {
    // Limpieza por prefijo
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_usrui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_usrui_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_usrui_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_usrui_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_usrui_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_usrui_group_2",
      },
    });

    // Usuarios base
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW USRUI Admin Sistema",
        correo: "pw_usrui_admin_sistema@gmail.com",
        telefono: "0999999971",
        usuario: "pw_usrui_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW USRUI Admin Centro C1",
        correo: "pw_usrui_admin_centro_c1@gmail.com",
        telefono: "0999999972",
        usuario: "pw_usrui_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    // Seed: operativo en centro2 (para demostrar que admin_centro NO lo ve)
    await prisma.usuarios.create({
      data: {
        nombre: "PW USRUI Operativo C2",
        correo: "pw_usrui_operativo_c2@gmail.com",
        telefono: "0999999973",
        usuario: "pw_usrui_operativo_c2",
        password: "x",
        rol: "usuario_operativo",
        area: "mantenimiento",
        id_centro_comercial: centro2.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

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
  });

  test.afterAll(async () => {
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_usrui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_usrui_" } },
    });

    await prisma.$disconnect();
  });

  test("Admin sistema: puede abrir modal y ve Centro Comercial + Rol", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminSistema);
    await page.goto("/dashboard/usuarios", { waitUntil: "domcontentloaded" });

    // abrir modal
    await page.getByRole("button", { name: /Crear Usuario/i }).click();

    const modal = modalRoot(page);

    // heading modal
    await expect(
      modal.getByRole("heading", { name: /Crear Nuevo Usuario/i })
    ).toBeVisible();

    // ✅ admin_sistema: ve label Centro Comercial y Rol dentro del modal (no tabla)
    await expect(
      modal.locator('label:has-text("Centro Comercial")')
    ).toBeVisible();

    await expect(modal.locator('label:has-text("Rol")')).toBeVisible();

    // cerrar
    await modal.locator("button.close-btn").click();
    await expect(
      page.getByRole("heading", { name: /Crear Nuevo Usuario/i })
    ).toHaveCount(0);
  });

  test("Admin centro: abre modal y NO ve Centro Comercial ni Rol; crea usuario operativo en su centro", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminCentro);
    await page.goto("/dashboard/usuarios", { waitUntil: "domcontentloaded" });

    await page.getByRole("button", { name: /Crear Usuario/i }).click();
    const modal = modalRoot(page);

    await expect(
      modal.getByRole("heading", { name: /Crear Nuevo Usuario/i })
    ).toBeVisible();

    // ✅ admin_centro: dentro del modal NO existen estos labels
    await expect(
      modal.locator('label:has-text("Centro Comercial")')
    ).toHaveCount(0);

    await expect(modal.locator('label:has-text("Rol")')).toHaveCount(0);

    // llenar formulario (operativo)
    const suffix = Date.now();
    const correo = `pw_usrui_new_${suffix}@gmail.com`;
    const usuario = `pw_usrui_new_${suffix}`;

    await inputAfterLabel(modal, "Nombre").fill("PW USRUI Operativo Nuevo");
    await inputAfterLabel(modal, "Correo").fill(correo);
    await inputAfterLabel(modal, "Teléfono").fill("0999999979");

    // área select
    await selectAfterLabel(modal, "Área").selectOption("seguridad");

    await inputAfterLabel(modal, "Usuario").fill(usuario);
    await inputAfterLabel(modal, "Contraseña").fill("Aa1!aaaa");

    // botón submit dentro del modal
    await modal.getByRole("button", { name: /Crear Usuario/i }).click();

    // modal éxito
    await expect(page.getByText("Usuario creado con éxito.")).toBeVisible();
    await page.getByRole("button", { name: /Aceptar/i }).click();
    await expect(page.getByText("Usuario creado con éxito.")).toHaveCount(0);

    // buscar por correo para asegurarlo en tabla
    await page.getByPlaceholder("Correo o nombre...").fill(correo);
    await page.getByRole("button", { name: /Buscar/i }).click();

    await expect(page.getByText(correo)).toBeVisible();
    await expect(page.getByText("Usuario Operativo")).toBeVisible();
  });

  test("Admin centro: en tabla NO ve usuarios de otros centros; y puede eliminar con modal confirmación", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminCentro);
    await page.goto("/dashboard/usuarios", { waitUntil: "domcontentloaded" });

    // el usuario seed de centro2 NO debería aparecer para admin_centro
    await page
      .getByPlaceholder("Correo o nombre...")
      .fill("pw_usrui_operativo_c2");
    await page.getByRole("button", { name: /Buscar/i }).click();

    await expect(page.getByText("pw_usrui_operativo_c2@gmail.com")).toHaveCount(
      0
    );

    // crear uno para eliminar (en centro1)
    await page.getByRole("button", { name: /Crear Usuario/i }).click();
    const modal = modalRoot(page);

    const suffix = Date.now();
    const correo = `pw_usrui_del_${suffix}@gmail.com`;
    const usuario = `pw_usrui_del_${suffix}`;

    await inputAfterLabel(modal, "Nombre").fill("PW USRUI Operativo Delete");
    await inputAfterLabel(modal, "Correo").fill(correo);
    await inputAfterLabel(modal, "Teléfono").fill("0999999978");
    await selectAfterLabel(modal, "Área").selectOption("seguridad");
    await inputAfterLabel(modal, "Usuario").fill(usuario);
    await inputAfterLabel(modal, "Contraseña").fill("Aa1!aaaa");

    await modal.getByRole("button", { name: /Crear Usuario/i }).click();

    await expect(page.getByText("Usuario creado con éxito.")).toBeVisible();
    await page.getByRole("button", { name: /Aceptar/i }).click();
    await expect(page.getByText("Usuario creado con éxito.")).toHaveCount(0);

    // buscar y eliminar
    await page.getByPlaceholder("Correo o nombre...").fill(correo);
    await page.getByRole("button", { name: /Buscar/i }).click();
    await expect(page.getByText(correo)).toBeVisible();

    // click botón eliminar (✖) dentro de la fila del usuario
    const row = page.locator("tr", { has: page.getByText(correo) });
    await row.locator("button.delete").click();

    // modal confirmación
    await expect(page.getByText("¿Deseas eliminar este usuario?")).toBeVisible();
    await page.getByRole("button", { name: /Confirmar/i }).click();

    // ya no debe aparecer al buscar de nuevo
    await page.getByRole("button", { name: /Buscar/i }).click();
    await expect(page.getByText(correo)).toHaveCount(0);
  });
});
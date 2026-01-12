// tests/e2e/auth_roles.spec.js
import { test, expect } from "@playwright/test";

const COOKIE_NAME = "auth_token";

// Helper: set cookie auth_token
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

test.describe("HU23 - Autenticación y Roles (middleware)", () => {
  test("Sin sesión: /dashboard/* redirige a /login", async ({ page }) => {
    await page.goto("/dashboard/admin-sistema", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("Admin sistema: si intenta entrar a admin-centro → redirige a admin-sistema", async ({ page }) => {
    const token = process.env.ADMIN_SISTEMA_TOKEN;
    expect(token, "Falta ADMIN_SISTEMA_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    await page.goto("/dashboard/admin-centro", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/admin-sistema$/);
  });

  test("Admin sistema: si intenta entrar a usuario-operativo → redirige a admin-sistema", async ({ page }) => {
    const token = process.env.ADMIN_SISTEMA_TOKEN;
    expect(token, "Falta ADMIN_SISTEMA_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    await page.goto("/dashboard/usuario-operativo", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/admin-sistema$/);
  });

  test("Admin centro: permite /dashboard/incidentes", async ({ page }) => {
    const token = process.env.ADMIN_CENTRO_TOKEN;
    expect(token, "Falta ADMIN_CENTRO_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    await page.goto("/dashboard/incidentes", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/incidentes$/);
  });

  test("Admin centro: bloquea /dashboard/admin-sistema → redirige a /dashboard/admin-centro", async ({ page }) => {
    const token = process.env.ADMIN_CENTRO_TOKEN;
    expect(token, "Falta ADMIN_CENTRO_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    await page.goto("/dashboard/admin-sistema", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/admin-centro$/);
  });

  test("Usuario operativo: permite /dashboard/reportes", async ({ page }) => {
    const token = process.env.USUARIO_OPERATIVO_TOKEN;
    expect(token, "Falta USUARIO_OPERATIVO_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    await page.goto("/dashboard/reportes", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/reportes$/);
  });

  test("Usuario operativo: bloquea /dashboard/usuarios → redirige a /dashboard/usuario-operativo", async ({ page }) => {
    const token = process.env.USUARIO_OPERATIVO_TOKEN;
    expect(token, "Falta USUARIO_OPERATIVO_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    await page.goto("/dashboard/usuarios", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/usuario-operativo$/);
  });

  test("must_change_password=true: bloquea rutas y fuerza a dashboard de rol", async ({ page }) => {
    // Este token debe tener must_change_password=true y rol=admin_centro (por ejemplo).
    const token = process.env.ADMIN_CENTRO_MUST_CHANGE_TOKEN;
    expect(token, "Falta ADMIN_CENTRO_MUST_CHANGE_TOKEN en .env.test/.env").toBeTruthy();

    await setAuthCookie(page, token);

    // Intenta entrar a una ruta permitida normalmente para admin_centro,
    // pero must_change_password=true debe forzar a /dashboard/admin-centro
    await page.goto("/dashboard/incidentes", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/admin-centro$/);

    // Y si entra a su dashboard de rol, debe permitirlo
    await page.goto("/dashboard/admin-centro", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/dashboard\/admin-centro$/);
  });
});
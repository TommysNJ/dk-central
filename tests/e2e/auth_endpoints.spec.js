// tests/e2e/auth_endpoints.spec.js
import { test, expect, request as pwRequest } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";

// Helpers reales del sistema (NO mock)
import { signAuthToken } from "../../src/lib/jwt.js";
import { decrypt } from "../../src/lib/crypto.js";

const prisma = new PrismaClient();
const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

// Usuario aislado SOLO para tests
const TEST_USUARIO = "pw_2fa_user";
const TEST_CORREO = "pw_2fa_user@test.local";

// Helper cookies
function cookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("; ");
}

test.describe("HU23 - Endpoints críticos de seguridad (2FA y force-change)", () => {
  let api;
  let userId;

  test.beforeAll(async () => {
    api = await pwRequest.newContext({ baseURL: BASE_URL });

    // Limpieza previa
    await prisma.usuarios.deleteMany({
      where: {
        OR: [{ usuario: TEST_USUARIO }, { correo: TEST_CORREO }],
      },
    });

    // Crear usuario real en BD
    const user = await prisma.usuarios.create({
      data: {
        nombre: "Playwright 2FA",
        correo: TEST_CORREO,
        usuario: TEST_USUARIO,
        password: await bcrypt.hash("TempPass1!", 10),
        rol: "admin_centro",
        area: "seguridad",
        id_centro_comercial: 1,
        must_change_password: true,
        two_factor_enabled: false,
      },
    });

    userId = user.id_usuario;
  });

  test.afterAll(async () => {
    await prisma.usuarios.deleteMany({
      where: { id_usuario: userId },
    });
    await prisma.$disconnect();
    await api.dispose();
  });

  // =====================================================
  // 🔐 FORCE CHANGE PASSWORD
  // =====================================================

  test("force-change: sin auth_token → 401", async () => {
    const r = await api.post("/api/auth/password/force-change", {
      data: { password: "NuevaPass1!" },
    });

    expect(r.status()).toBe(401);
  });

  test("force-change: password débil → 400", async () => {
    const token = signAuthToken({
      sub: userId,
      rol: "admin_centro",
      must_change_password: true,
    });

    const r = await api.post("/api/auth/password/force-change", {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { password: "123" },
    });

    expect(r.status()).toBe(400);
  });

  test("force-change: password válida → 200 y flag actualizado", async () => {
    const token = signAuthToken({
      sub: userId,
      rol: "admin_centro",
      must_change_password: true,
    });

    const r = await api.post("/api/auth/password/force-change", {
      headers: {
        Cookie: cookieHeader({ auth_token: token }),
        "Content-Type": "application/json",
      },
      data: { password: "NuevaPass1!" },
    });

    expect(r.status()).toBe(200);

    const u = await prisma.usuarios.findUnique({
      where: { id_usuario: userId },
    });

    expect(u.must_change_password).toBe(false);
  });

  // =====================================================
  // 🔐 2FA SETUP
  // =====================================================

  test("2fa/setup: sin cookie → 401", async () => {
    const r = await api.post("/api/auth/2fa/setup", { data: {} });
    expect(r.status()).toBe(401);
  });

  test("2fa/setup: devuelve QR cuando no hay token", async () => {
    const r = await api.post("/api/auth/2fa/setup", {
      headers: {
        Cookie: cookieHeader({ "2fa_setup_user": userId }),
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.qr).toMatch(/^data:image\/png;base64,/);
  });

  test("2fa/setup: token válido → activa 2FA", async () => {
    // Leer secret cifrado
    const u = await prisma.usuarios.findUnique({
      where: { id_usuario: userId },
    });

    const secret = decrypt(u.two_factor_secret);

    const token = speakeasy.totp({
      secret,
      encoding: "base32",
    });

    const r = await api.post("/api/auth/2fa/setup", {
      headers: {
        Cookie: cookieHeader({ "2fa_setup_user": userId }),
        "Content-Type": "application/json",
      },
      data: { token },
    });

    expect(r.status()).toBe(200);

    const u2 = await prisma.usuarios.findUnique({
      where: { id_usuario: userId },
    });

    expect(u2.two_factor_enabled).toBe(true);
  });

  test("2fa/setup: ya activado → mensaje informativo", async () => {
    const r = await api.post("/api/auth/2fa/setup", {
      headers: {
        Cookie: cookieHeader({ "2fa_setup_user": userId }),
        "Content-Type": "application/json",
      },
      data: {},
    });

    expect(r.status()).toBe(200);
    const j = await r.json();
    expect(j.message).toMatch(/ya activado/i);
  });
});
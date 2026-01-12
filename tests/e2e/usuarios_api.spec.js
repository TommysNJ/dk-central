// tests/e2e/usuarios_api.spec.js
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../src/lib/jwt.js";

const prisma = new PrismaClient();
const COOKIE_NAME = "auth_token";

test.describe("HU23 - Usuarios (API)", () => {
  let centro1, centro2;
  let adminSistema, adminCentroC1, operativoC1Seg;

  let tokenAdminSistema, tokenAdminCentro, tokenOperativo;

  test.beforeAll(async () => {
    // Limpieza por prefijo
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_usrapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_usrapi_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: { nombre: "pw_usrapi_centro_1", ciudad: "Quito", ubicacion: "Test", id_grupo_telegram: "pw_usrapi_group_1" },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: { nombre: "pw_usrapi_centro_2", ciudad: "Guayaquil", ubicacion: "Test", id_grupo_telegram: "pw_usrapi_group_2" },
    });

    // Usuarios base
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW USRAPI Admin Sistema",
        correo: "pw_usrapi_admin_sistema@gmail.com",
        telefono: "0999999991",
        usuario: "pw_usrapi_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW USRAPI Admin Centro C1",
        correo: "pw_usrapi_admin_centro_c1@gmail.com",
        telefono: "0999999992",
        usuario: "pw_usrapi_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW USRAPI Operativo C1 Seguridad",
        correo: "pw_usrapi_operativo_c1_seg@gmail.com",
        telefono: "0999999993",
        usuario: "pw_usrapi_operativo_c1_seg",
        password: "x",
        rol: "usuario_operativo",
        area: "seguridad",
        id_centro_comercial: centro1.id_centro_comercial,
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
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_usrapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_usrapi_" } },
    });

    await prisma.$disconnect();
  });

  test("Operativo NO puede listar usuarios (403/401)", async ({ request }) => {
    const res = await request.get(`/api/usuarios?search=`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenOperativo}` },
    });

    expect([401, 403]).toContain(res.status());
  });

  test("Admin sistema: GET lista usuarios (200)", async ({ request }) => {
    const res = await request.get(`/api/usuarios?search=pw_usrapi_`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` },
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBeTruthy();
    expect(data.length).toBeGreaterThanOrEqual(3);
  });

  test("Admin centro: GET solo ve usuarios_operativo de su centro", async ({ request }) => {
    const res = await request.get(`/api/usuarios?search=pw_usrapi_`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenAdminCentro}` },
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // solo operativos y solo del centro1
    for (const u of data) {
      expect(u.rol).toBe("usuario_operativo");
      expect(u.id_centro_comercial).toBe(centro1.id_centro_comercial);
    }
  });

  test("Admin sistema: puede crear usuario_operativo en centro2", async ({ request }) => {
    const payload = {
      nombre: "PW USRAPI Nuevo Operativo C2",
      correo: `pw_usrapi_new_op_c2_${Date.now()}@gmail.com`,
      telefono: "0999999988",
      usuario: `pw_usrapi_new_op_c2_${Date.now()}`,
      password: "Aa1!aaaa",
      rol: "usuario_operativo",
      area: "mantenimiento",
      nombre_centro_comercial: centro2.nombre,
    };

    const res = await request.post(`/api/usuarios`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: payload,
    });

    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created.rol).toBe("usuario_operativo");
    expect(created.area).toBe("mantenimiento");
    expect(created.id_centro_comercial).toBe(centro2.id_centro_comercial);
  });

  test("Admin centro: puede crear usuario_operativo SOLO en su centro", async ({ request }) => {
    const payload = {
      nombre: "PW USRAPI Nuevo Operativo C1",
      correo: `pw_usrapi_new_op_c1_${Date.now()}@gmail.com`,
      telefono: "0999999987",
      usuario: `pw_usrapi_new_op_c1_${Date.now()}`,
      password: "Aa1!aaaa",
      rol: "usuario_operativo",
      area: "seguridad",
      // aunque mande un centro, backend debe asignar el suyo (y UI ni lo manda)
      nombre_centro_comercial: centro2.nombre,
    };

    const res = await request.post(`/api/usuarios`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminCentro}`,
        "Content-Type": "application/json",
      },
      data: payload,
    });

    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created.rol).toBe("usuario_operativo");
    expect(created.id_centro_comercial).toBe(centro1.id_centro_comercial);
  });

  test("Admin centro: NO debe poder crear admin_sistema/admin_centro (esperado 403/400)", async ({
    request,
  }) => {
    const payload = {
      nombre: "PW USRAPI Intento Admin Sistema",
      correo: `pw_usrapi_bad_${Date.now()}@gmail.com`,
      telefono: "0999999986",
      usuario: `pw_usrapi_bad_${Date.now()}`,
      password: "Aa1!aaaa",
      rol: "admin_sistema",
      area: "seguridad",
    };

    const res = await request.post(`/api/usuarios`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminCentro}`,
        "Content-Type": "application/json",
      },
      data: payload,
    });

    // ✅ esto es lo correcto según tu HU (si hoy falla, falta validación en backend)
    expect([400, 403]).toContain(res.status());
  });

  test("Admin centro: NO puede editar usuario de otro centro (403)", async ({ request }) => {
    // crear usuario en centro2 (por admin_sistema)
    const correo = `pw_usrapi_edit_other_${Date.now()}@gmail.com`;
    const usuario = `pw_usrapi_edit_other_${Date.now()}`;

    const createRes = await request.post(`/api/usuarios`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre: "PW USRAPI Operativo Centro2",
        correo,
        telefono: "0999999985",
        usuario,
        password: "Aa1!aaaa",
        rol: "usuario_operativo",
        area: "mantenimiento",
        nombre_centro_comercial: centro2.nombre,
      },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    // intentar editar desde admin_centro (centro1)
    const putRes = await request.put(`/api/usuarios/${created.id_usuario}`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminCentro}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre: "EDITADO",
        correo,
        telefono: "0999999985",
        usuario,
        password: "",
        rol: "usuario_operativo",
        area: "mantenimiento",
        nombre_centro_comercial: centro2.nombre,
      },
    });

    expect(putRes.status()).toBe(403);
  });

  test("Admin sistema: puede eliminar usuario", async ({ request }) => {
    // crear usuario temporal
    const correo = `pw_usrapi_del_${Date.now()}@gmail.com`;
    const usuario = `pw_usrapi_del_${Date.now()}`;

    const createRes = await request.post(`/api/usuarios`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre: "PW USRAPI Temp Delete",
        correo,
        telefono: "0999999984",
        usuario,
        password: "Aa1!aaaa",
        rol: "usuario_operativo",
        area: "seguridad",
        nombre_centro_comercial: centro1.nombre,
      },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();

    const delRes = await request.delete(`/api/usuarios/${created.id_usuario}`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` },
    });

    expect(delRes.status()).toBe(200);
    const msg = await delRes.json();
    expect(msg.message).toMatch(/eliminado/i);
  });
});
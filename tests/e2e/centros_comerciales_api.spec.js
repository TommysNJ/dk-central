// tests/e2e/centros_comerciales_api.spec.js
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signAuthToken } from "../../src/lib/jwt.js";

const prisma = new PrismaClient();
const COOKIE_NAME = "auth_token";

test.describe("HU23 - Centros Comerciales (API)", () => {
  let adminSistema, adminCentro;
  let tokenAdminSistema, tokenAdminCentro;

  let seedCentro1, seedCentro2;

  test.beforeAll(async () => {
    // Limpieza por prefijo
    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_ccapi_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_ccapi_" } },
    });

    // Seed centros
    seedCentro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_ccapi_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "-100000000001",
      },
    });

    seedCentro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_ccapi_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "-100000000002",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW CCAPI Admin Sistema",
        correo: "pw_ccapi_admin_sistema@test.local",
        telefono: "0999999901",
        usuario: "pw_ccapi_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentro = await prisma.usuarios.create({
      data: {
        nombre: "PW CCAPI Admin Centro",
        correo: "pw_ccapi_admin_centro@test.local",
        telefono: "0999999902",
        usuario: "pw_ccapi_admin_centro",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: seedCentro1.id_centro_comercial,
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
      id_centro_comercial: seedCentro1.id_centro_comercial,
      must_change_password: false,
    });
  });

  test.afterAll(async () => {
    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_ccapi_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_ccapi_" } },
    });

    await prisma.$disconnect();
  });

  test("GET /api/centros-comerciales: requiere admin_sistema", async ({
    request,
  }) => {
    const res = await request.get(`/api/centros-comerciales`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenAdminCentro}` },
    });

    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/centros-comerciales: filtra por ciudad (search)", async ({
    request,
  }) => {
    const res = await request.get(`/api/centros-comerciales?search=Quito`, {
      headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` },
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();

    // Debe incluir el centro de Quito y no incluir el de Guayaquil
    const nombres = data.map((x) => x.nombre);
    expect(nombres).toContain("pw_ccapi_centro_1");
    expect(nombres).not.toContain("pw_ccapi_centro_2");
  });

  test("POST /api/centros-comerciales: valida campos obligatorios", async ({
    request,
  }) => {
    const res = await request.post(`/api/centros-comerciales`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: { nombre: "pw_ccapi_x" }, // faltan ciudad + id_grupo_telegram
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/faltantes/i);
  });

  test("POST /api/centros-comerciales: valida formato id_grupo_telegram (POST)", async ({
    request,
  }) => {
    const res = await request.post(`/api/centros-comerciales`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre: "pw_ccapi_bad_group",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "100123", // ❌ no empieza con -
      },
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/debe comenzar con/i);
  });

  test("POST /api/centros-comerciales: crea centro y bloquea duplicado por nombre", async ({
    request,
  }) => {
    const suffix = Date.now();
    const nombre = `pw_ccapi_new_${suffix}`;

    const res1 = await request.post(`/api/centros-comerciales`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre,
        ciudad: "Cuenca",
        ubicacion: "Test",
        id_grupo_telegram: `-${100000000000 + (suffix % 1000000)}`, // válido POST
      },
    });

    expect(res1.status()).toBe(201);
    const created = await res1.json();
    expect(created.nombre).toBe(nombre);

    // duplicado por nombre
    const res2 = await request.post(`/api/centros-comerciales`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre,
        ciudad: "Cuenca",
        ubicacion: "Test",
        id_grupo_telegram: "-100000099999",
      },
    });

    expect(res2.status()).toBe(400);
    const data2 = await res2.json();
    expect(data2.message).toMatch(/ya existe/i);
  });

  test("PUT /api/centros-comerciales/:id valida formato id_grupo_telegram (PUT)", async ({
    request,
  }) => {
    const res = await request.put(
      `/api/centros-comerciales/${seedCentro1.id_centro_comercial}`,
      {
        headers: {
          Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
          "Content-Type": "application/json",
        },
        data: {
          nombre: seedCentro1.nombre,
          ciudad: seedCentro1.ciudad,
          ubicacion: seedCentro1.ubicacion,
          id_grupo_telegram: "-12", // ❌ PUT exige 5..15 dígitos
        },
      }
    );

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/entre 5 a 15/i);
  });

  test("DELETE /api/centros-comerciales/:id elimina", async ({ request }) => {
    // crear uno para borrar
    const suffix = Date.now();
    const resCreate = await request.post(`/api/centros-comerciales`, {
      headers: {
        Cookie: `${COOKIE_NAME}=${tokenAdminSistema}`,
        "Content-Type": "application/json",
      },
      data: {
        nombre: `pw_ccapi_del_${suffix}`,
        ciudad: "Loja",
        ubicacion: "Test",
        id_grupo_telegram: `-${100000000000 + (suffix % 1000000)}`,
      },
    });

    expect(resCreate.status()).toBe(201);
    const created = await resCreate.json();

    const resDel = await request.delete(
      `/api/centros-comerciales/${created.id_centro_comercial}`,
      { headers: { Cookie: `${COOKIE_NAME}=${tokenAdminSistema}` } }
    );

    expect(resDel.status()).toBe(200);
    const data = await resDel.json();
    expect(data.message).toMatch(/eliminado/i);
  });
});
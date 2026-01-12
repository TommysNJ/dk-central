// tests/e2e/resumenes_diarios_ui.spec.js
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

function fechaUTCFromYMD(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

test.describe("HU23 - Resúmenes diarios (UI mínima)", () => {
  let centro1, centro2;
  let adminSistema, adminCentroC1, operativoC1Seg;

  let incSeg, incMant;

  let tokenAdminSistema, tokenAdminCentro, tokenOperativo;

  const FECHA = "2026-01-11";
  const FECHA_UTC = fechaUTCFromYMD(FECHA);

  test.beforeAll(async () => {
    // Limpieza por prefijo
    await prisma.resumenes_diarios.deleteMany({
      where: { resumen: { contains: "seed resumenes_ui" } },
    });

    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_resui_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { incidente: { nombre: { startsWith: "pw_resui_" } } },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_resui_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_resui_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_resui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_resui_" } },
    });

    // Centros
    centro1 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_resui_centro_1",
        ciudad: "Quito",
        ubicacion: "Test",
        id_grupo_telegram: "pw_resui_group_1",
      },
    });

    centro2 = await prisma.centros_comerciales.create({
      data: {
        nombre: "pw_resui_centro_2",
        ciudad: "Guayaquil",
        ubicacion: "Test",
        id_grupo_telegram: "pw_resui_group_2",
      },
    });

    // Usuarios
    adminSistema = await prisma.usuarios.create({
      data: {
        nombre: "PW RESUI Admin Sistema",
        correo: "pw_resui_admin_sistema@test.local",
        usuario: "pw_resui_admin_sistema",
        password: "x",
        rol: "admin_sistema",
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    adminCentroC1 = await prisma.usuarios.create({
      data: {
        nombre: "PW RESUI Admin Centro C1",
        correo: "pw_resui_admin_centro_c1@test.local",
        usuario: "pw_resui_admin_centro_c1",
        password: "x",
        rol: "admin_centro",
        id_centro_comercial: centro1.id_centro_comercial,
        must_change_password: false,
        two_factor_enabled: true,
      },
    });

    operativoC1Seg = await prisma.usuarios.create({
      data: {
        nombre: "PW RESUI Operativo C1 Seguridad",
        correo: "pw_resui_operativo_c1_seg@test.local",
        usuario: "pw_resui_operativo_c1_seg",
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
      data: { nombre: "pw_resui_robo", area: "seguridad" },
    });

    incMant = await prisma.incidentes.create({
      data: { nombre: "pw_resui_falla", area: "mantenimiento" },
    });

    // Seed de incidentes reales (para que admin_sistema pueda obtener faltantes)
    const seeds = [
      // (centro1, seguridad)
      {
        centroId: centro1.id_centro_comercial,
        incId: incSeg.id_incidente,
        msg: "pw_resui_c1_seg_1",
        telId: 830001,
      },
      // (centro2, mantenimiento) -> faltará resumen guardado para provocar modal faltantes
      {
        centroId: centro2.id_centro_comercial,
        incId: incMant.id_incidente,
        msg: "pw_resui_c2_mant_1",
        telId: 830002,
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
          remitente: "pw_resui",
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

    // ✅ Seed resumen guardado SOLO (centro1, seguridad)
    await prisma.resumenes_diarios.create({
      data: {
        fecha: FECHA_UTC,
        id_centro_comercial: centro1.id_centro_comercial,
        area: "seguridad",
        resumen: "seed resumenes_ui: resumen guardado Seguridad.",
        id_usuario: operativoC1Seg.id_usuario,
        fecha_actualizacion: new Date(),
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
    await prisma.resumenes_diarios.deleteMany({
      where: { resumen: { contains: "seed resumenes_ui" } },
    });

    await prisma.historial_incidentes.deleteMany({
      where: { usuario: { usuario: { startsWith: "pw_resui_" } } },
    });

    await prisma.mensajes_clasificados.deleteMany({
      where: { incidente: { nombre: { startsWith: "pw_resui_" } } },
    });

    await prisma.mensajes_limpios.deleteMany({
      where: { contenido_limpio: { startsWith: "pw_resui_" } },
    });

    await prisma.usuarios.deleteMany({
      where: { usuario: { startsWith: "pw_resui_" } },
    });

    await prisma.incidentes.deleteMany({
      where: { nombre: { startsWith: "pw_resui_" } },
    });

    await prisma.centros_comerciales.deleteMany({
      where: { nombre: { startsWith: "pw_resui_" } },
    });

    await prisma.$disconnect();
  });

  test("Admin sistema: ve filtros Centro Comercial y Área y recibe modal de faltantes en resumen general", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminSistema);
    await page.goto("/dashboard/resumenes", { waitUntil: "domcontentloaded" });

    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(1);

    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(1);

    // Fecha
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toHaveCount(1);
    await dateInput.fill(FECHA);

    // Generar (sin centro/area) -> debe dar faltantes y abrir modal
    await page.getByRole("button", { name: /Generar Resumen Diario/i }).click();

    // ✅ FIX strict mode: validar el heading del modal (único)
    const modalTitle = page.getByRole("heading", { name: "Faltan resúmenes" });
    await expect(modalTitle).toBeVisible();

    // Y que el texto informativo exista
    await expect(
      page.getByText(/faltan resúmenes/i).first()
    ).toBeVisible();

    // Cerrar modal (hay 1 botón "Aceptar" dentro del modal)
    await page.getByRole("button", { name: /^Aceptar$/i }).click();

    // ✅ FIX: confirmar que el modal se fue (por heading)
    await expect(modalTitle).toHaveCount(0);
  });

  test("Usuario operativo: NO ve Centro, NO ve Área; al generar trae resumen guardado y NO puede editar ni guardar", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenOperativo);
    await page.goto("/dashboard/resumenes", { waitUntil: "domcontentloaded" });

    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(0);

    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(0);

    // Fecha
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill(FECHA);

    // Generar
    await page.getByRole("button", { name: /Generar Resumen Diario/i }).click();

    // Textarea aparece y debe estar deshabilitada
    const textarea = page.locator("textarea.resumenes-textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeDisabled();

    // No debe mostrar botón Guardar
    await expect(page.getByRole("button", { name: /^Guardar$/i })).toHaveCount(0);

    // Debe contener el resumen seed
    await expect(textarea).toHaveValue(/seed resumenes_ui/i);
  });

  test("Admin centro: NO ve Centro, SÍ ve Área; al generar resumen guardado puede editar y guardar", async ({
    page,
  }) => {
    await setAuthCookie(page, tokenAdminCentro);
    await page.goto("/dashboard/resumenes", { waitUntil: "domcontentloaded" });

    const centroSelect = selectWithOption(page, "Centro Comercial");
    await expect(centroSelect).toHaveCount(0);

    const areaSelect = selectWithOption(page, "Área");
    await expect(areaSelect).toHaveCount(1);

    // Seleccionar área seguridad (para que calce con el resumen guardado)
    await areaSelect.first().selectOption("seguridad");

    // Fecha
    const dateInput = page.locator('input[type="date"]').first();
    await dateInput.fill(FECHA);

    // Generar -> devuelve resumen guardado con editable:true para admin_centro
    await page.getByRole("button", { name: /Generar Resumen Diario/i }).click();

    const textarea = page.locator("textarea.resumenes-textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();

    // Botón Guardar debe aparecer
    const guardarBtn = page.getByRole("button", { name: /^Guardar$/i });
    await expect(guardarBtn).toBeVisible();

    // Editar y guardar
    const nuevoTexto = "seed resumenes_ui: editado por admin_centro";
    await textarea.fill(nuevoTexto);
    await guardarBtn.click();

    // Modal éxito
    await expect(page.getByText("Resumen guardado con éxito.")).toBeVisible();
    await page.getByRole("button", { name: /Aceptar/i }).click();
    await expect(page.getByText("Resumen guardado con éxito.")).toHaveCount(0);

    // Verificar DB actualizado
    const db = await prisma.resumenes_diarios.findUnique({
      where: {
        fecha_id_centro_comercial_area: {
          fecha: FECHA_UTC,
          id_centro_comercial: centro1.id_centro_comercial,
          area: "seguridad",
        },
      },
    });

    expect(db.resumen).toBe(nuevoTexto);
    expect(db.id_usuario).toBe(adminCentroC1.id_usuario);
  });
});
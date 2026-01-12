// tests/e2e/mensajes_ui.spec.js
import { test, expect } from "@playwright/test";

const BOT_API_KEY =
  process.env.BOT_API_KEY || "CLAVE_SEGURA_DE_AUTENTICACION";

test.describe("HU23 - Mensajes (UI mínima / seguridad desde cliente)", () => {
  test("Cliente no autorizado: POST /api/mensajes-limpios sin x-api-key -> 401", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-limpios", {
      data: {
        id_centro_comercial: 1,
        id_mensaje_telegram: 1,
        contenido_limpio: "x",
        fecha_envio: new Date().toISOString(),
      },
    });

    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.message).toMatch(/no autorizado/i);
  });

  test("Cliente autorizado pero payload inválido: POST /api/mensajes-limpios -> 400", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-limpios", {
      headers: { "x-api-key": BOT_API_KEY },
      data: {},
    });

    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.message).toMatch(/faltan campos/i);
  });

  test("Cliente no autorizado: POST /api/mensajes-clasificados/auto sin x-api-key -> 401", async ({
    request,
  }) => {
    const res = await request.post("/api/mensajes-clasificados/auto", {
      data: { id_mensaje_limpio: 123 },
    });

    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data.message).toMatch(/no autorizado/i);
  });
});
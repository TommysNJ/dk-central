import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = "http://localhost:3000";
const BOT_API_KEY = "";
const ttfb = new Trend("ttfb");

// ✅ Debe existir ya en DB (créalo 1 vez antes)
const ID_CENTRO_EXISTENTE = 1;
const ID_TELEGRAM_EXISTENTE = 110001;

export const options = {
  scenarios: {
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 10 },
        { duration: "20s", target: 25 },
        { duration: "20s", target: 25 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 30 },
        { duration: "15s", target: 60 },
        { duration: "15s", target: 80 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"], // ✅ ahora sí debería ser bajo
    "http_req_duration{scenario:stress}": ["p(95)<800"],
  },
};

export default function () {
  const payload = {
    id_centro_comercial: ID_CENTRO_EXISTENTE,
    id_mensaje_telegram: ID_TELEGRAM_EXISTENTE, // ✅ siempre duplicado
    contenido_original: "dup",
    contenido_limpio: "dup",
    remitente: "k6",
    fecha_envio: new Date().toISOString(),
  };

  const res = http.post(`${BASE_URL}/api/mensajes-limpios`, JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", "x-api-key": BOT_API_KEY },
    tags: { endpoint: "api/mensajes-limpios" },
    timeout: "10s",
  });

  ttfb.add(res.timings.waiting);

  if (res.status !== 200 && res.status !== 201) {
    console.log(`STATUS=${res.status}`);
    console.log(`BODY=${(res.body || "").slice(0, 200)}`);
  }

  check(res, {
    "status 200/201": (r) => r.status === 200 || r.status === 201,
  });

  sleep(0.2);
}
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = "http://localhost:3000";
const BOT_API_KEY = "";
const ttfb = new Trend("ttfb");

// Centros: IDs 1..8 (como tu seed_perf)
const CENTROS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// textos sample (ligeros)
const TEXTOS = [
  "Seguridad reporta robo en pasillo principal.",
  "Mantenimiento reporta fuga de agua en baños.",
  "Recepción reporta objeto perdido en área de comidas.",
  "Se reporta accidente en escalera eléctrica.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function headers() {
  return {
    "Content-Type": "application/json",
    "x-api-key": BOT_API_KEY,
  };
}

/**
 * ✅ ID único y en rango INT32:
 * - Mantén el valor < 2,147,483,647 para evitar "out of range"
 * - Usamos una base fija + offsets por VU/ITER
 */
function makeTelegramId() {
  const base = 1000000; // 1,000,000
  const vuPart = (__VU % 2000) * 1000; // hasta 1,999,000
  const iterPart = (__ITER % 900); // 0..899
  return base + vuPart + iterPart; // máx ~ 2,999,899 (seguro)
}

export const options = {
  scenarios: {
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 2 },
        { duration: "20s", target: 6 },
        { duration: "20s", target: 6 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 8 },
        { duration: "15s", target: 12 },
        { duration: "15s", target: 16 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"], 
    "http_req_duration{scenario:stress}": ["p(95)<2500"], 
  },
};

export default function () {
  const nowIso = new Date().toISOString();
  const texto = pick(TEXTOS);

  const payload = {
    id_centro_comercial: Number(pick(CENTROS)),
    id_mensaje_telegram: Number(makeTelegramId()), // ✅ ÚNICO => fuerza pipeline
    contenido_original: texto,
    contenido_limpio: texto,
    remitente: "k6",
    fecha_envio: nowIso,
  };

  const url = `${BASE_URL}/api/mensajes-limpios`;

  const res = http.post(url, JSON.stringify(payload), {
    headers: headers(),
    tags: { endpoint: "api/pipeline-mensajes" },
    timeout: "90s", // ✅ realista para tu pipeline actual
  });

  ttfb.add(res.timings.waiting);

  // Esperado:
  // - 200 (tu route devuelve 200 al crear)
  // - 201 no aplica aquí, pero lo dejamos por si cambias luego
  if (res.status !== 200 && res.status !== 201) {
    console.log(`STATUS=${res.status} URL=${url}`);
    console.log(`BODY=${(res.body || "").slice(0, 300)}`);
  }

  check(res, {
    "status 200/201": (r) => r.status === 200 || r.status === 201,
    "json ok": (r) => {
      try {
        const j = r.json();
        return typeof j === "object" && j !== null;
      } catch {
        return false;
      }
    },
  });

  // ✅ Pausa pequeña para no matar la laptop
  sleep(Math.random() * 0.4 + 0.2);
}
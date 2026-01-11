import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics"; // ✅ mismo patrón

const BASE_URL = "http://localhost:3000";
const AUTH_TOKEN =
  "";

const ttfb = new Trend("ttfb"); // ✅ igual que incidentes/dashboard

// Seed: 2026-01-01 .. 2026-01-07
const FECHAS = [
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  "2026-01-04",
  "2026-01-05",
  "2026-01-06",
  "2026-01-07",
];

// Centros: IDs 1..8 (por tu seed_perf)
const CENTROS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const AREAS = [
  "recepcion",
  "administracion",
  "mantenimiento",
  "seguridad",
  "mercadeo",
  "sso",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * k6 NO soporta URLSearchParams.
 * Armamos querystring a mano.
 */
function toQuery(params) {
  const parts = [];
  for (const k in params) {
    const v = params[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Tu backend autentica por cookie auth_token
 */
function headers() {
  const h = {};
  if (AUTH_TOKEN) h["Cookie"] = `auth_token=${AUTH_TOKEN}`;
  return h;
}

/**
 * Rango válido [inicio, fin]:
 * - fin >= inicio
 * - máximo 7 días (FECHAS ya es de 7 días)
 */
function pickDateRange() {
  const i = Math.floor(Math.random() * FECHAS.length);
  const j = i + Math.floor(Math.random() * (FECHAS.length - i));
  return { fecha_inicio: FECHAS[i], fecha_fin: FECHAS[j] };
}

export const options = {
  scenarios: {
    load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 10 },
        { duration: "40s", target: 25 },
        { duration: "40s", target: 25 },
        { duration: "20s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "15s", target: 30 },
        { duration: "30s", target: 60 },
        { duration: "30s", target: 80 },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2500"],
    "http_req_duration{scenario:stress}": ["p(95)<2500"],
  },
};

export default function () {
  const { fecha_inicio, fecha_fin } = pickDateRange();

  // /api/reportes requiere fecha_inicio y fecha_fin SIEMPRE
  // admin_sistema además puede enviar centro y area
  const query = toQuery({
    fecha_inicio,
    fecha_fin,
    centro: Math.random() < 0.6 ? pick(CENTROS) : "",
    area: Math.random() < 0.6 ? pick(AREAS) : "",
  });

  const url = `${BASE_URL}/api/reportes${query}`;

  const res = http.get(url, {
    headers: headers(),
    tags: { endpoint: "api/reportes" },
  });

  ttfb.add(res.timings.waiting);

  if (res.status !== 200) {
    console.log(`STATUS=${res.status} URL=${url}`);
    console.log(`BODY=${(res.body || "").slice(0, 200)}`);
  }

  check(res, {
    "status 200": (r) => r.status === 200,
    "json object": (r) => {
      try {
        const j = r.json();
        return j && typeof j === "object" && !Array.isArray(j);
      } catch {
        return false;
      }
    },
    // shape mínimo esperado
    "has rows + detalleTipos + resumen": (r) => {
      try {
        const j = r.json();
        return !!(j && j.rows && j.detalleTipos && j.resumen);
      } catch {
        return false;
      }
    },
    // rows y detalleTipos deberían ser arrays (aunque sean [])
    "rows/detalleTipos arrays": (r) => {
      try {
        const j = r.json();
        return Array.isArray(j.rows) && Array.isArray(j.detalleTipos);
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 0.5 + 0.2);
}
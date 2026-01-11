import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics"; // ✅ añadido (solo lo necesario)

const BASE_URL = "http://localhost:3000";
const AUTH_TOKEN =
  "";

const ttfb = new Trend("ttfb"); // ✅ añadido (solo lo necesario)


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

// Centros: asumiendo IDs 1..8 (por tu seed_perf)
const CENTROS = ["1", "2", "3", "4", "5", "6", "7", "8"];

const AREAS = [
  "recepcion",
  "administracion",
  "mantenimiento",
  "seguridad",
  "mercadeo",
  "sso",
];
const ESTADOS = ["nuevo", "en_proceso", "completado"];

// Tipos comunes (según tu seed principal)
const TIPOS = [
  "robo",
  "pelea",
  "persona sospechosa",
  "objeto perdido",
  "caida",
  "inconsciencia",
  "accidente en escalera",
  "emergencia medica",
  "fuga de agua",
  "iluminacion danada",
  "cableado suelto",
  "ascensor en falla",
  "queja de cliente",
  "perdida de documentos",
  "publicidad",
  "montaje de evento",
  "retiro material publicitario",
  "ruido excesivo",
  "vehiculo mal estacionado",
  // otros se excluye en tu backend
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
    http_req_duration: ["p(95)<1500"],
    "http_req_duration{scenario:stress}": ["p(95)<2500"],
  },
};

export default function () {
  // admin_sistema permite centro libre
  const query = toQuery({
    centro: pick(CENTROS),
    fecha: pick(FECHAS),
    area: Math.random() < 0.6 ? pick(AREAS) : "",
    estado: Math.random() < 0.5 ? pick(ESTADOS) : "",
    tipo: Math.random() < 0.4 ? pick(TIPOS) : "",
  });

  const url = `${BASE_URL}/api/incidentes${query}`;

  const res = http.get(url, {
    headers: headers(),
    tags: { endpoint: "api/incidentes" },
  });

  ttfb.add(res.timings.waiting); // ✅ añadido (solo lo necesario)

  if (res.status !== 200) { // ✅ añadido (solo lo necesario)
    console.log(`STATUS=${res.status} URL=${url}`);
    console.log(`BODY=${(res.body || "").slice(0, 200)}`);
  }

  check(res, {
    "status 200": (r) => r.status === 200,
    "array json": (r) => {
      try {
        return Array.isArray(r.json());
      } catch {
        return false;
      }
    },
  });

  sleep(Math.random() * 0.5 + 0.2);
}
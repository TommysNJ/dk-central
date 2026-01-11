import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = "http://localhost:3000";
const AUTH_TOKEN =
  "";

const ttfb = new Trend("ttfb");

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

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function headers() {
  const h = {};
  if (AUTH_TOKEN) h["Cookie"] = `auth_token=${AUTH_TOKEN}`;
  return h;
}

function toQuery(params) {
  const parts = [];
  for (const k in params) {
    const v = params[k];
    if (v === undefined || v === null || v === "") continue;
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

// ✅ setup: pre-cargar IDs reales para evitar 404 random
export function setup() {
  const ids = [];
  const h = headers();

  // intentamos sacar IDs de varias fechas (por si alguna fecha no tiene data)
  for (let i = 0; i < FECHAS.length; i++) {
    const fecha = FECHAS[i];
    const query = toQuery({ fecha });
    const url = `${BASE_URL}/api/incidentes${query}`;

    const res = http.get(url, { headers: h, tags: { endpoint: "api/incidentes", method: "GET" } });

    if (res.status === 200) {
      try {
        const arr = res.json();
        if (Array.isArray(arr)) {
          for (const it of arr) {
            if (it && it.id_mensaje_clasificado) ids.push(it.id_mensaje_clasificado);
            if (ids.length >= 300) break; // pool suficiente
          }
        }
      } catch {
        // ignore
      }
    }

    if (ids.length >= 300) break;
  }

  // Si quedó vacío, igual devolvemos [] y el test lo reporta claramente con checks fallidos
  return { ids };
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

export default function (data) {
  const ids = (data && data.ids) || [];

  // si no hay IDs, fallamos “rápido” para que sea obvio el problema
  if (!ids.length) {
    check(null, {
      "setup obtuvo ids (revisa seed/fecha/token)": () => false,
    });
    sleep(1);
    return;
  }

  const id = pick(ids);
  const url = `${BASE_URL}/api/incidentes/${id}/historial`;

  const res = http.get(url, {
    headers: headers(),
    tags: { endpoint: "api/incidentes/:id/historial", method: "GET" },
  });

  ttfb.add(res.timings.waiting);

  if (res.status !== 200) {
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
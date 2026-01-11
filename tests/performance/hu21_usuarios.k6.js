import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = "http://localhost:3000";
const AUTH_TOKEN =
  "";

const ttfb = new Trend("ttfb");

// búsquedas típicas para probar el OR (nombre/correo/usuario)
const SEARCH_TERMS = [
  "", // listar todo (ojo: puede ser grande, pero es realista)
  "admin",
  "operativo",
  "@",
  "09",
  "a",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
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
  // =========================
  // 1) GET /api/usuarios (PERF)
  // =========================
  const query = toQuery({
    search: Math.random() < 0.7 ? pick(SEARCH_TERMS) : "", // 70% con búsqueda
  });

  const url = `${BASE_URL}/api/usuarios${query}`;

  const res = http.get(url, {
    headers: headers(),
    tags: { endpoint: "api/usuarios", method: "GET" },
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

  // ===================================================
  // 2) (OPCIONAL) POST /api/usuarios (SMOKE apagado)
  //    ⚠️ No recomendado para stress: crea usuarios + email/DNS
  // ===================================================
  const DO_POST_SMOKE = false; // ✅ cambia a true solo si quieres probar 1-2 creaciones
  if (DO_POST_SMOKE && Math.random() < 0.02) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;

    // ⚠️ Usa un dominio real (tu backend valida MX). Ideal: tu propio dominio.
    // Si pones example.com puede que falle por MX según tu validador.
    const payload = {
      nombre: `Perf User ${uniq}`,
      correo: `perf_${uniq}@tu-dominio-real.com`,
      telefono: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`,
      usuario: `perf_${uniq}`,
      password: "Aa1!aaaa", // cumple tu regex
      rol: "usuario_operativo",
      area: "mantenimiento",
      // como eres admin_sistema, puedes crear o usar existente:
      nombre_centro_comercial: "Granados Plaza",
    };

    const postUrl = `${BASE_URL}/api/usuarios`;

    const postRes = http.post(postUrl, JSON.stringify(payload), {
      headers: {
        ...headers(),
        "Content-Type": "application/json",
      },
      tags: { endpoint: "api/usuarios", method: "POST" },
    });

    if (postRes.status !== 201 && postRes.status !== 400) {
      console.log(`POST STATUS=${postRes.status} URL=${postUrl}`);
      console.log(`POST BODY=${(postRes.body || "").slice(0, 200)}`);
    }

    check(postRes, {
      "post status 201 or 400": (r) => r.status === 201 || r.status === 400,
    });
  }

  sleep(Math.random() * 0.5 + 0.2);
}
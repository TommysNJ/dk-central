"use client";

import { useEffect, useMemo, useState } from "react";
import "@/styles/usuarios.css";
import "@/styles/reportes.css";
import "@/styles/dashboards.css";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  LabelList,
  BarChart as ReBarChart,
} from "recharts";

function truncateLabel(str, max = 16) {
  const s = String(str || "");
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function VerticalInsideBarLabel(props) {
  const { x, y, width, height, value } = props;
  if (!value) return null;

  const cx = x + width / 2;
  const cy = y + height / 2;

  // Si la barra es demasiado pequeña, no pintamos el texto
  if (height < 26) return null;

  // ✅ truncado dinámico según altura disponible (mejor para nombres largos)
  const approxChars = Math.max(10, Math.min(22, Math.floor((height - 8) / 6)));
  const txt = truncateLabel(value, approxChars);

  return (
    <text
      x={cx}
      y={cy}
      textAnchor="middle"
      dominantBaseline="middle"
      transform={`rotate(-90 ${cx} ${cy})`}
      className="dash-bar-label"
    >
      {txt}
    </text>
  );
}

function renderPieValueLabel({ value, percent }) {
  if (!value || value <= 0) return "";
  const pct = percent ? Math.round(percent * 100) : 0;
  return `${value} (${pct}%)`;
}

// ✅ paleta azul → morado
const BAR_COLORS = [
  "#0ea5e9", // sky
  "#2563eb", // blue
  "#1d4ed8", // blue darker
  "#4f46e5", // indigo
  "#6d28d9", // violet
  "#7c3aed", // purple
];

const PIE_COLORS = ["#94a3b8", "#fbbf24", "#22c55e"];

export default function DashboardsIncidentesPage() {
  const [rol, setRol] = useState(null);
  const [areaUsuario, setAreaUsuario] = useState(null);
  const [idCentroUsuario, setIdCentroUsuario] = useState(null);

  const [centros, setCentros] = useState([]);

  // filtros
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroArea, setFiltroArea] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dashboardGenerado, setDashboardGenerado] = useState(false);

  const [resumen, setResumen] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [charts, setCharts] = useState(null);

  const [filtrosAplicados, setFiltrosAplicados] = useState(null);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return;

      const me = await res.json();
      setRol(me.rol);
      setAreaUsuario(me.area);
      setIdCentroUsuario(me.id_centro_comercial);

      if (me.rol === "admin_sistema" || me.rol === "admin_centro") {
        const resCentros = await fetch("/api/centros");
        if (resCentros.ok) setCentros(await resCentros.json());
      }

      // default HOY-HOY
      const hoy = new Date();
      const yyyy = hoy.getFullYear();
      const mm = String(hoy.getMonth() + 1).padStart(2, "0");
      const dd = String(hoy.getDate()).padStart(2, "0");
      const hoyStr = `${yyyy}-${mm}-${dd}`;

      setFechaInicio(hoyStr);
      setFechaFin(hoyStr);

      const filtrosIniciales = {
        fecha_inicio: hoyStr,
        fecha_fin: hoyStr,
        centro: "",
        area: "",
      };

      setFiltrosAplicados(filtrosIniciales);
      await loadDashboard({ rol: me.rol, ...filtrosIniciales });
      setDashboardGenerado(true);
    }
    init();
  }, []);

  function mapAreaLabel(v) {
    return (
      {
        recepcion: "Recepción",
        administracion: "Administración",
        mantenimiento: "Mantenimiento",
        seguridad: "Seguridad",
        mercadeo: "Mercadeo",
        sso: "SSO",
      }[v] || v || "-"
    );
  }

  function mapEstadoLabel(v) {
    return (
      {
        nuevo: "Nuevo",
        en_proceso: "En Proceso",
        completado: "Completado",
      }[v] || v || "-"
    );
  }

  function formatearFecha(f) {
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  }

  function buildSubtitulo() {
    if (!resumen) return "Selecciona un rango de fechas para ver el dashboard.";

    const { fecha_inicio, fecha_fin, area, centro_id, dias_rango } = resumen;

    let txtCentro = "Todos";
    if (rol === "admin_sistema" && centro_id) {
      const c = centros.find((x) => x.id_centro_comercial === Number(centro_id));
      txtCentro = c ? c.nombre : "Centro seleccionado";
    }
    if (rol !== "admin_sistema") {
      const c = centros.find((x) => x.id_centro_comercial === Number(idCentroUsuario));
      txtCentro = c ? c.nombre : "Centro asignado";
    }

    let txtArea = "Todas";
    if (rol === "usuario_operativo") txtArea = mapAreaLabel(areaUsuario);
    else if (area) txtArea = mapAreaLabel(area);

    const rango =
      fecha_inicio === fecha_fin
        ? `Fecha: ${formatearFecha(fecha_inicio)}`
        : `Rango: ${formatearFecha(fecha_inicio)} a ${formatearFecha(fecha_fin)} (${dias_rango} días)`;

    return `Centros incluidos: ${txtCentro} | Áreas: ${txtArea} | ${rango}`;
  }

  async function loadDashboard(
    { rol, fecha_inicio, fecha_fin, centro, area },
    options = {}
  ) {
    const { background = false } = options;
    if (!background) setLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("fecha_inicio", fecha_inicio);
      params.set("fecha_fin", fecha_fin);

      if (rol === "admin_sistema" && centro) params.set("centro", centro);
      if ((rol === "admin_sistema" || rol === "admin_centro") && area)
        params.set("area", area);

      const res = await fetch(`/api/dashboard?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setResumen(data.resumen || null);
        setKpis(data.kpis || null);
        setCharts(data.charts || null);
      } else {
        setErrorMsg(data.message || "Error al cargar dashboard.");
        setResumen(null);
        setKpis(null);
        setCharts(null);
      }
    } catch (e) {
      console.error("Error dashboard:", e);
      setErrorMsg("Error al cargar dashboard.");
      setResumen(null);
      setKpis(null);
      setCharts(null);
    } finally {
      if (!background) setLoading(false);
    }
  }

  async function onFiltrar(e) {
    e.preventDefault();
    if (!rol) return;

    setErrorMsg("");
    setDashboardGenerado(true);

    if (!fechaInicio || !fechaFin) {
      setErrorMsg("Debe seleccionar una fecha de inicio y fin.");
      return;
    }

    const ini = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    if (fin < ini) {
      setErrorMsg("La fecha fin no puede ser menor que la fecha de inicio.");
      return;
    }

    const dias = (fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24) + 1;
    if (dias > 7) {
      setErrorMsg("El rango máximo permitido es de 7 días.");
      return;
    }

    const nuevosFiltros = {
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
      centro: filtroCentro,
      area: filtroArea,
    };

    setFiltrosAplicados(nuevosFiltros);
    await loadDashboard({ rol, ...nuevosFiltros });
  }

  // tiempo real
  useEffect(() => {
    if (!rol || !filtrosAplicados) return;

    const interval = setInterval(() => {
      loadDashboard({ rol, ...filtrosAplicados }, { background: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [rol, filtrosAplicados]);

  const dataPorArea = useMemo(() => {
    const arr = charts?.por_area || [];
    return arr.map((x) => ({ ...x, area_label: mapAreaLabel(x.area) }));
  }, [charts]);

  const dataPorTipo = useMemo(() => {
    const arr = charts?.por_tipo || [];
    // Top 12 para que no se vuelva ilegible
    return arr.slice(0, 12).map((x) => ({ ...x, tipo_label: x.tipo }));
  }, [charts]);

  // ✅ Top 5 tipos (barras horizontales) - mejor lectura
  const dataTopTipos = useMemo(() => {
    const arr = charts?.por_tipo || [];
    return arr.slice(0, 5).map((x) => ({
      ...x,
      tipo_label: truncateLabel(x.tipo, 22),
    }));
  }, [charts]);

  const dataPorEstado = useMemo(() => {
    const arr = charts?.por_estado || [];
    return arr.map((x) => ({ ...x, estado_label: mapEstadoLabel(x.estado) }));
  }, [charts]);

  const dataPorDia = useMemo(() => {
    const arr = charts?.por_dia || [];
    return arr.map((x) => {
      const [y, m, d] = (x.fecha || "").split("-");
      const label = y && m && d ? `${d}/${m}` : x.fecha;
      return { ...x, fecha_label: label };
    });
  }, [charts]);

  // ✅ Heatmap día vs estado (EXACTO desde backend: por_dia_estado)
  const heatmap = useMemo(() => {
    const rowsRaw = charts?.por_dia_estado || [];
    const estados = ["nuevo", "en_proceso", "completado"];

    const rows = rowsRaw.map((r) => {
      const [y, m, d] = (r.fecha || "").split("-");
      const fecha_label = y && m && d ? `${d}/${m}` : r.fecha;
      return {
        fecha: r.fecha,
        fecha_label,
        nuevo: r.nuevo || 0,
        en_proceso: r.en_proceso || 0,
        completado: r.completado || 0,
      };
    });

    let max = 0;
    for (const r of rows) {
      for (const est of estados) max = Math.max(max, r[est] || 0);
    }

    return { rows, estados, max };
  }, [charts]);

  function heatBg(value, max) {
    // 0 => verde fijo
    if (!value || value <= 0) return "#22c55e"; // green-500

    // si max es 0 o no viene, deja amarillo suave
    if (!max || max <= 0) return "#fde047"; // yellow-300

    const t = Math.max(0, Math.min(1, value / max));

    // Rangos por porcentaje del máximo
    // 0-33%: amarillo, 33-66%: naranja, 66-100%: rojo
    if (t < 0.33) {
        // amarillo: suave -> fuerte
        // yellow-200 -> yellow-500
        return t < 0.165 ? "#fef08a" : "#eab308";
    }

    if (t < 0.66) {
        // naranja: suave -> fuerte
        // orange-200 -> orange-600
        return t < 0.495 ? "#fed7aa" : "#ea580c";
    }

    // rojo: suave -> fuerte
    // red-300 -> red-700
    return t < 0.83 ? "#fca5a5" : "#b91c1c";
  }

  // ✅ Tooltips: evitar índice (0,1,2...) y mostrar label real
  function tooltipLabelFromPayload(payload, fallback = "") {
    const p = payload?.[0]?.payload;
    return (
      p?.area_label ||
      p?.tipo_label ||
      p?.tipo ||
      p?.area ||
      fallback
    );
  }

  if (!rol) return <p>Cargando...</p>;

  const esAdminSistema = rol === "admin_sistema";
  const esAdminCentro = rol === "admin_centro";

  return (
    <div className="main-content-inner">
      {/* FILTROS */}
      <div className="filter-panel">
        <form onSubmit={onFiltrar} className="report-filters dash-filter-form">
          <div className="report-filters-row">
            <div className="report-filter-group">
              <label className="label small-label">Fecha inicio</label>
              <input
                className="input"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>

            <div className="report-filter-group">
              <label className="label small-label">Fecha fin</label>
              <input
                className="input"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>

            {esAdminSistema && (
              <div className="report-filter-group no-label">
                <select
                  className="input"
                  value={filtroCentro}
                  onChange={(e) => setFiltroCentro(e.target.value)}
                >
                  <option value="">Centro Comercial</option>
                  {centros.map((c) => (
                    <option key={c.id_centro_comercial} value={c.id_centro_comercial}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(esAdminSistema || esAdminCentro) && (
              <div className="report-filter-group no-label">
                <select
                  className="input"
                  value={filtroArea}
                  onChange={(e) => setFiltroArea(e.target.value)}
                >
                  <option value="">Área</option>
                  <option value="recepcion">Recepción</option>
                  <option value="administracion">Administración</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="seguridad">Seguridad</option>
                  <option value="mercadeo">Mercadeo</option>
                  <option value="sso">SSO</option>
                </select>
              </div>
            )}

            <div className="report-filter-actions">
              <button type="submit" className="filter-btn">
                {loading ? "Filtrando..." : "Filtrar"}
              </button>
            </div>
          </div>

          {errorMsg && <p className="error-text report-error">{errorMsg}</p>}
        </form>
      </div>

      {/* DASHBOARD */}
      <div className="table-panel">
        <div className="report-header centered">
          <h2 className="report-title">Dashboard de Incidentes</h2>
          <p className="report-subtitle">{buildSubtitulo()}</p>
        </div>

        {dashboardGenerado && (!kpis || !charts) ? (
          <p className="report-empty centered">No existen datos para el rango seleccionado.</p>
        ) : kpis && charts ? (
          <>
            {/* KPI CARDS */}
            <div className="dash-kpis">
              <KpiCard title="Total de incidentes" value={kpis.total_incidentes ?? 0} />
              <KpiCard title="Promedio diario" value={kpis.promedio_diario ?? 0} />
              <KpiCard title="% Completados" value={`${kpis.pct_completados ?? 0}%`} />
              <KpiCard title="Backlog (Nuevo + En Proceso)" value={kpis.backlog ?? 0} />
              <KpiCard
                title="Incidente más frecuente"
                value={kpis.top_incidente ? kpis.top_incidente.nombre : "-"}
                subvalue={kpis.top_incidente ? `${kpis.top_incidente.total} casos` : ""}
              />
            </div>

            {/* CHARTS (6) */}
            <div className="dash-charts">
              {/* 1) Barras por área */}
              <div className="card dash-chart-card">
                <h3 className="dash-chart-title">Incidentes por área</h3>
                <div className="dash-chart-box-sm">
                  <ResponsiveContainer>
                    <BarChart data={dataPorArea}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis hide />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(label, payload) =>
                          tooltipLabelFromPayload(payload, String(label))
                        }
                        formatter={(value) => [value, "Total"]}
                      />
                      <Bar dataKey="total">
                        {dataPorArea.map((_, idx) => (
                          <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                        ))}
                        <LabelList dataKey="area_label" content={<VerticalInsideBarLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2) Barras por tipo */}
              <div className="card dash-chart-card">
                <h3 className="dash-chart-title">Incidentes por tipo</h3>
                <div className="dash-chart-box-sm">
                  <ResponsiveContainer>
                    <BarChart data={dataPorTipo}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis hide />
                      <YAxis allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(label, payload) =>
                          tooltipLabelFromPayload(payload, String(label))
                        }
                        formatter={(value) => [value, "Total"]}
                      />
                      <Bar dataKey="total">
                        {dataPorTipo.map((_, idx) => (
                          <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                        ))}
                        <LabelList dataKey="tipo_label" content={<VerticalInsideBarLabel />} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 3) Pie por estado */}
              <div className="card dash-chart-card">
                <h3 className="dash-chart-title">Distribución por estado</h3>
                <div className="dash-chart-box-sm">
                  <ResponsiveContainer>
                    <PieChart>
                      <Tooltip />
                      <Legend />
                      <Pie
                        data={dataPorEstado}
                        dataKey="total"
                        nameKey="estado_label"
                        outerRadius={110}
                        label={renderPieValueLabel}
                        labelLine={false}
                        isAnimationActive={false}
                      >
                        {dataPorEstado.map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 4) Top 5 tipos (horizontal) */}
              <div className="card dash-chart-card">
                <h3 className="dash-chart-title">Top 5 tipos (ranking)</h3>
                <div className="dash-chart-box-sm">
                  <ResponsiveContainer>
                    <ReBarChart data={dataTopTipos} layout="vertical" margin={{ left: 8, right: 18 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} />
                      <YAxis type="category" dataKey="tipo_label" width={130} />
                      <Tooltip
                        labelFormatter={(label) => String(label)}
                        formatter={(value) => [value, "Total"]}
                      />
                      <Bar dataKey="total">
                        {dataTopTipos.map((_, idx) => (
                          <Cell key={idx} fill={BAR_COLORS[idx % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 5) Línea por día */}
              <div className="card dash-chart-card">
                <h3 className="dash-chart-title">Incidentes por día</h3>
                <div className="dash-chart-box-md">
                  <ResponsiveContainer>
                    <LineChart data={dataPorDia}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="fecha_label" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="total" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 6) Heatmap día vs estado (EXACTO) */}
              <div className="card dash-chart-card">
                <h3 className="dash-chart-title">Heatmap (Día vs Estado)</h3>
                <div className="dash-chart-box-lg">
                  <div className="dash-heatmap">
                    {/* Header row */}
                    <div />
                    <div className="dash-heatmap-header">Nuevo</div>
                    <div className="dash-heatmap-header">En Proceso</div>
                    <div className="dash-heatmap-header">Completado</div>

                    {/* ✅ Render fila por fila (alineado) */}
                    {heatmap.rows.map((r) => (
                      <div key={r.fecha} className="dash-heatmap-row">
                        <div className="dash-heatmap-rowlabel">{r.fecha_label}</div>

                        {["nuevo", "en_proceso", "completado"].map((est) => {
                          const v = r[est] || 0;
                          return (
                            <div
                              key={`${r.fecha}-${est}`}
                              className="dash-heatmap-cell"
                              style={{ background: heatBg(v, heatmap.max) }}
                              title={`${mapEstadoLabel(est)}: ${v}`}
                            >
                              {v}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function KpiCard({ title, value, subvalue }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      {subvalue ? <div className="kpi-subvalue">{subvalue}</div> : null}
    </div>
  );
}
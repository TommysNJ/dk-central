"use client";

import { useEffect, useState } from "react";
import "@/styles/usuarios.css";
import "@/styles/reportes.css";

export default function ReportesPage() {
  const [rol, setRol] = useState(null);
  const [areaUsuario, setAreaUsuario] = useState(null);
  const [idCentroUsuario, setIdCentroUsuario] = useState(null);

  const [centros, setCentros] = useState([]);

  // ================================
  // FILTROS DEL REPORTE
  // ================================
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroArea, setFiltroArea] = useState("");

  const [rows, setRows] = useState([]);
  const [detalleTipos, setDetalleTipos] = useState([]);
  const [resumen, setResumen] = useState(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 🔥 NUEVO: controla si ya se intentó generar el reporte
  const [reporteGenerado, setReporteGenerado] = useState(false);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const me = await res.json();
        setRol(me.rol);
        setAreaUsuario(me.area);
        setIdCentroUsuario(me.id_centro_comercial);

        if (me.rol === "admin_sistema" || me.rol === "admin_centro") {
          const resCentros = await fetch("/api/centros");
          if (resCentros.ok) setCentros(await resCentros.json());
        }
      }
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
      }[v] || "-"
    );
  }

  function mapEstadoLabel(v) {
    return (
      {
        en_proceso: "En Proceso",
        completado: "Completado",
        nuevo: "Nuevo",
      }[v] || "-"
    );
  }

  // ================================
  // GENERAR REPORTE
  // ================================
  async function generarReporte(e) {
    e.preventDefault();
    if (!rol) return;

    setErrorMsg("");
    setReporteGenerado(true); // 🔥 MARCAMOS que ya se intentó generar

    if (!fechaInicio || !fechaFin) {
      setErrorMsg("Debe seleccionar una fecha de inicio y fin.");
      return;
    }

    const ini = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    if (fin < ini) {
      setErrorMsg("La fecha fin no puede ser menor.");
      return;
    }

    const diferencia =
      (fin.getTime() - ini.getTime()) / (1000 * 60 * 60 * 24) + 1;
    if (diferencia > 7) {
      setErrorMsg("El rango máximo permitido es de 7 días.");
      return;
    }

    const params = new URLSearchParams();
    params.set("fecha_inicio", fechaInicio);
    params.set("fecha_fin", fechaFin);

    if (rol === "admin_sistema" && filtroCentro)
      params.set("centro", filtroCentro);

    if ((rol === "admin_sistema" || rol === "admin_centro") && filtroArea)
      params.set("area", filtroArea);

    setLoading(true);

    try {
      const res = await fetch(`/api/reportes?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows || []);
        setDetalleTipos(data.detalleTipos || []);
        setResumen(data.resumen || null);
      } else {
        setErrorMsg(data.message || "Error al generar el reporte.");
        setRows([]);
      }
    } catch {
      setErrorMsg("Error al generar el reporte.");
      setRows([]);
    }

    setLoading(false);
  }

  function formatearFecha(f) {
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  }

  function buildSubtitulo() {
    if (!resumen) return "Genera un reporte con los filtros superiores.";

    const { fecha_inicio, fecha_fin, area, centro_id, dias_rango } = resumen;

    let txtCentro = "Todos";

    if (rol === "admin_sistema" && centro_id) {
      const c = centros.find(
        (x) => x.id_centro_comercial === Number(centro_id)
      );
      txtCentro = c ? c.nombre : "Centro seleccionado";
    }

    if (rol !== "admin_sistema") {
      const c = centros.find(
        (x) => x.id_centro_comercial === Number(idCentroUsuario)
      );
      txtCentro = c ? c.nombre : "Centro asignado";
    }

    let txtArea = "Todas";
    if (area) txtArea = mapAreaLabel(area);

    const rango =
      fecha_inicio === fecha_fin
        ? `Fecha: ${formatearFecha(fecha_inicio)}`
        : `Rango: ${formatearFecha(fecha_inicio)} a ${formatearFecha(
            fecha_fin
          )} (${dias_rango} días)`;

    return `Centros incluidos: ${txtCentro} | Áreas: ${txtArea} | ${rango}`;
  }

  if (!rol) return <p>Cargando...</p>;

  const esAdminSistema = rol === "admin_sistema";
  const esAdminCentro = rol === "admin_centro";

  return (
    <div className="main-content-inner">
      {/* ===================== FILTROS REPORTE ===================== */}
      <div className="filter-panel">
        <form onSubmit={generarReporte} className="report-filters">
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
                    <option
                      key={c.id_centro_comercial}
                      value={c.id_centro_comercial}
                    >
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
                {loading ? "Generando..." : "Generar Reporte"}
              </button>
            </div>
          </div>

          {errorMsg && <p className="error-text report-error">{errorMsg}</p>}
        </form>
      </div>

      {/* ===================== RESULTADOS ===================== */}
      <div className="table-panel">
        <div className="report-header centered">
          <h2 className="report-title">Reporte de Incidentes</h2>
          <p className="report-subtitle">{buildSubtitulo()}</p>
        </div>

        {reporteGenerado && rows.length === 0 ? (
          <p className="report-empty centered">
            No existen datos para el rango seleccionado.
          </p>
        ) : rows.length > 0 ? (
          <>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Total de Incidentes</th>
                  <th>Incidente más Recurrente</th>
                  <th>Estado más Frecuente</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{mapAreaLabel(r.area)}</td>
                    <td>{r.total_incidentes}</td>
                    <td>{r.incidente_recurrente || "-"}</td>
                    <td>{mapEstadoLabel(r.estado_mas_frecuente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="report-header centered" style={{ marginTop: 32 }}>
              <h2 className="report-title">Detalle por Tipo de Incidente</h2>
            </div>

            <table className="report-table">
              <thead>
                <tr>
                  <th>Tipo de Incidente</th>
                  <th>Total</th>
                  <th>Estado más Frecuente</th>
                </tr>
              </thead>
              <tbody>
                {detalleTipos.map((t, i) => (
                  <tr key={i}>
                    <td>{t.tipo}</td>
                    <td>{t.total}</td>
                    <td>{mapEstadoLabel(t.estado_mas_frecuente)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
      </div>
    </div>
  );
}
// src/app/dashboard/reportes/page.jsx
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
  // FILTROS DEL REPORTE (PANEL SUPERIOR)
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

  // =======================================
  // FILTROS EXCLUSIVOS PARA RESUMEN DIARIO
  // =======================================
  const [fechaResumen, setFechaResumen] = useState("");
  const [centroResumen, setCentroResumen] = useState("");
  const [areaResumen, setAreaResumen] = useState("");
  const [loadingResumen, setLoadingResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState("");
  const [resumenIA, setResumenIA] = useState(null);

  // NUEVO: controla qué se debe mostrar en la sección de resultados
  const [modoResultado, setModoResultado] = useState(null);

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
        revisado: "Revisado",
      }[v] || "-"
    );
  }

  // ================================
  // GENERAR REPORTE — PANEL SUPERIOR
  // ================================
  async function generarReporte(e) {
    e.preventDefault();
    if (!rol) return;

    setErrorMsg("");
    setErrorResumen("");
    setResumenIA(null);
    setModoResultado("reporte"); // <-- NUEVO

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
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setDetalleTipos(data.detalleTipos || []);
        setResumen(data.resumen || null);
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Error al generar el reporte.");
        setRows([]);
        setDetalleTipos([]);
        setResumen(null);
      }
    } catch (err) {
      setErrorMsg("Error al generar el reporte.");
      setRows([]);
      setDetalleTipos([]);
      setResumen(null);
    }

    setLoading(false);
  }

  // ================================
  // GENERAR RESUMEN DIARIO IA
  // ================================
  async function generarResumenIA() {
    setErrorResumen("");
    setErrorMsg("");
    setResumenIA(null);

    setModoResultado("resumen"); // <-- NUEVO
    setRows([]);
    setDetalleTipos([]);
    setResumen(null);

    if (!fechaResumen) {
      setErrorResumen("Debe seleccionar una fecha.");
      return;
    }

    const payload = {
      fecha: fechaResumen,
      centro: centroResumen || null,
      area: areaResumen || null,
    };

    setLoadingResumen(true);

    try {
      const res = await fetch("/api/reportes/resumen-diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorResumen(data.message || "Error generando resumen IA.");
        setLoadingResumen(false);
        return;
      }

      setResumenIA(data.resumen);
    } catch (err) {
      setErrorResumen("Error de conexión con el generador IA.");
    }

    setLoadingResumen(false);
  }

  function formatearFecha(f) {
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  }

  // Subtítulo del reporte “normal”
  function buildSubtitulo() {
    if (!resumen) return "Genera un reporte con los filtros superiores.";

    const { fecha_inicio, fecha_fin, area, centro_id, dias_rango } = resumen;

    let txtCentro = "Todos";

    if (rol === "admin_sistema") {
      if (centro_id) {
        const c = centros.find(
          (x) => x.id_centro_comercial === Number(centro_id)
        );
        txtCentro = c ? c.nombre : "Centro seleccionado";
      }
    }

    if (rol === "admin_centro" || rol === "usuario_operativo") {
      const c = centros.find(
        (x) => x.id_centro_comercial === Number(idCentroUsuario)
      );
      txtCentro = c ? c.nombre : "Centro asignado";
    }

    let txtArea = "Todas";

    if (rol === "admin_sistema" || rol === "admin_centro") {
      if (area) txtArea = mapAreaLabel(area);
    }

    if (rol === "usuario_operativo") {
      txtArea = mapAreaLabel(areaUsuario);
    }

    const rango =
      fecha_inicio === fecha_fin
        ? `Fecha: ${formatearFecha(fecha_inicio)}`
        : `Rango: ${formatearFecha(fecha_inicio)} a ${formatearFecha(
            fecha_fin
          )} (${dias_rango} días)`;

    if (rol === "usuario_operativo") {
      return `Áreas: ${txtArea} | ${rango}`;
    }

    return `Centros incluidos: ${txtCentro} | Áreas: ${txtArea} | ${rango}`;
  }

  // 🔥 NUEVO: subtítulo para el Resumen Diario IA
  function buildSubtituloResumenIA() {
    if (!fechaResumen) return "Genera un resumen diario con los filtros superiores.";

    // Centro
    let txtCentro = "Todos";
    if (rol === "admin_sistema") {
      if (centroResumen) {
        const c = centros.find(
          (x) => x.id_centro_comercial === Number(centroResumen)
        );
        txtCentro = c ? c.nombre : "Centro seleccionado";
      }
    } else {
      // admin_centro y usuario_operativo usan su centro asignado
      const c = centros.find(
        (x) => x.id_centro_comercial === Number(idCentroUsuario)
      );
      txtCentro = c ? c.nombre : "Centro asignado";
    }

    // Área
    let txtArea = "Todas";
    if (rol === "admin_sistema" || rol === "admin_centro") {
      if (areaResumen) txtArea = mapAreaLabel(areaResumen);
    }
    if (rol === "usuario_operativo") {
      txtArea = mapAreaLabel(areaUsuario);
    }

    const fechaTxt = `Fecha: ${formatearFecha(fechaResumen)}`;

    return `Centro Comercial: ${txtCentro} | Área: ${txtArea} | ${fechaTxt}`;
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
            {/* Fecha inicio */}
            <div className="report-filter-group">
              <label className="label small-label">Fecha inicio</label>
              <input
                className="input"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>

            {/* Fecha fin */}
            <div className="report-filter-group">
              <label className="label small-label">Fecha fin</label>
              <input
                className="input"
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
              />
            </div>

            {/* Centro Comercial */}
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

            {/* Área */}
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

            {/* Botón */}
            <div className="report-filter-actions">
              <button type="submit" className="filter-btn">
                {loading ? "Generando..." : "Generar Reporte"}
              </button>
            </div>
          </div>

          {errorMsg && <p className="error-text report-error">{errorMsg}</p>}
        </form>
      </div>

      {/* ===================== PANEL RESUMEN DIARIO ===================== */}
      <div className="filter-panel report-resumen-panel">
        <div className="report-filters-row">
          <div className="report-filter-group">
            <input
              className="input"
              type="date"
              value={fechaResumen}
              onChange={(e) => setFechaResumen(e.target.value)}
            />
          </div>

          {esAdminSistema && (
            <div className="report-filter-group no-label">
              <select
                className="input"
                value={centroResumen}
                onChange={(e) => setCentroResumen(e.target.value)}
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
                value={areaResumen}
                onChange={(e) => setAreaResumen(e.target.value)}
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
        </div>

        {errorResumen && (
          <p className="error-text report-error">{errorResumen}</p>
        )}

        <div className="report-filter-actions">
          <button className="filter-btn" onClick={generarResumenIA}>
            {loadingResumen ? "Generando IA..." : "Generar Resumen Diario"}
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* =============== SECCIÓN DE RESULTADOS ÚNICA ============== */}
      {/* ========================================================= */}
      <div className="table-panel">
        {/* ===================== RESUMEN IA ===================== */}
        {modoResultado === "resumen" && resumenIA && (
          <>
            <div className="report-header centered">
              <h2 className="report-title">Resumen Diario (IA)</h2>
              <p className="report-subtitle">{buildSubtituloResumenIA()}</p>
            </div>
            <p className="report-body">{resumenIA}</p>
          </>
        )}

        {/* ===================== REPORTE NORMAL ===================== */}
        {modoResultado === "reporte" && (
          <>
            <div className="report-header centered">
              <h2 className="report-title">Reporte de Incidentes</h2>
              <p className="report-subtitle">{buildSubtitulo()}</p>
            </div>

            {rows.length === 0 ? (
              <p className="report-empty centered">
                No existen datos para el rango seleccionado.
              </p>
            ) : (
              <>
                {/* TABLA POR ÁREA */}
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

                {/* TABLA DETALLE */}
                <div
                  className="report-header centered"
                  style={{ marginTop: "32px" }}
                >
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import "@/styles/usuarios.css";
import "@/styles/reportes.css";

export default function ResumenesPage() {
  const [rol, setRol] = useState(null);
  const [areaUsuario, setAreaUsuario] = useState(null);
  const [idCentroUsuario, setIdCentroUsuario] = useState(null);
  const [centros, setCentros] = useState([]);

  const [fechaResumen, setFechaResumen] = useState("");
  const [centroResumen, setCentroResumen] = useState("");
  const [areaResumen, setAreaResumen] = useState("");

  const [loadingResumen, setLoadingResumen] = useState(false);
  const [errorResumen, setErrorResumen] = useState("");
  const [resumenIA, setResumenIA] = useState(null);

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

  // ================================
  // GENERAR RESUMEN IA (AHORA CON FORM)
  // ================================
  async function generarResumenIA(e) {
    e.preventDefault(); // 🔥 IGUAL QUE REPORTES

    setErrorResumen("");
    setResumenIA(null);

    if (!fechaResumen) {
      setErrorResumen("Debe seleccionar una fecha.");
      return;
    }

    setLoadingResumen(true);

    try {
      const res = await fetch("/api/reportes/resumen-diario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaResumen,
          centro: centroResumen || null,
          area: areaResumen || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorResumen(data.message || "Error generando resumen IA.");
      } else {
        setResumenIA(data.resumen);
      }
    } catch {
      setErrorResumen("Error de conexión con el generador IA.");
    }

    setLoadingResumen(false);
  }

  function formatearFecha(f) {
    const [y, m, d] = f.split("-");
    return `${d}/${m}/${y}`;
  }

  function buildSubtitulo() {
    let txtCentro = "Todos";
    let txtArea = "Todas";

    // Centro
    if (rol === "admin_sistema" && centroResumen) {
        const c = centros.find(
        (x) => x.id_centro_comercial === Number(centroResumen)
        );
        txtCentro = c ? c.nombre : "Centro seleccionado";
    }

    if (rol !== "admin_sistema") {
        const c = centros.find(
        (x) => x.id_centro_comercial === Number(idCentroUsuario)
        );
        txtCentro = c ? c.nombre : "Centro asignado";
    }

    // Área
    if (rol === "usuario_operativo") {
        txtArea = areaUsuario; 
    } else if (areaResumen) {
        txtArea = areaResumen;
    }

    return `Centro Comercial: ${txtCentro} | Área: ${txtArea} | Fecha: ${formatearFecha(
        fechaResumen
    )}`;
    }

  if (!rol) return <p>Cargando...</p>;

  const esAdminSistema = rol === "admin_sistema";
  const esAdminCentro = rol === "admin_centro";

  return (
    <div className="main-content-inner">
      {/* ===================== FILTROS ===================== */}
      <div className="filter-panel">
        {/* 🔥 AHORA ES FORM, IGUAL QUE REPORTES */}
        <form onSubmit={generarResumenIA} className="report-filters">
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

            <div className="report-filter-actions">
              <button type="submit" className="filter-btn">
                {loadingResumen ? "Generando IA..." : "Generar Resumen Diario"}
              </button>
            </div>
          </div>

          {/* 🔥 ERROR DEBAJO, IGUAL QUE REPORTES */}
          {errorResumen && (
            <p className="error-text report-error">{errorResumen}</p>
          )}
        </form>
      </div>

      {/* ===================== RESULTADOS ===================== */}
      <div className="table-panel">
        <div className="report-header centered">
          <h2 className="report-title">Resumen Diario (IA)</h2>
          <p className="report-subtitle">
            {resumenIA
              ? buildSubtitulo()
              : "Genera un resumen con los filtros superiores."}
          </p>
        </div>

        {resumenIA && <p className="report-body">{resumenIA}</p>}
      </div>
    </div>
  );
}
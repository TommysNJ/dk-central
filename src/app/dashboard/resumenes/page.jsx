"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

  // ✅ NUEVO (solo lo necesario)
  const [editableResumen, setEditableResumen] = useState(false);
  const [mostrarGuardar, setMostrarGuardar] = useState(false);
  const [textoResumen, setTextoResumen] = useState("");
  const [faltantesResumen, setFaltantesResumen] = useState([]);

  // ✅ NUEVO: modales
  const [faltantesModal, setFaltantesModal] = useState({
    open: false,
    message: "",
    agrupados: [],
  });

  const [successModal, setSuccessModal] = useState("");

  // ✅ NUEVO: textarea auto height
  const textareaRef = useRef(null);

  function autoResizeTextarea() {
    const el = textareaRef.current;
    if (!el) return;

    // reset para recalcular correctamente
    el.style.height = "auto";

    // tope máximo (px)
    const MAX_HEIGHT = 900;

    const next = Math.min(el.scrollHeight, MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }

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

  // ✅ Ajustar alto cuando cambia el texto (resumen generado o editado)
  useEffect(() => {
    autoResizeTextarea();
  }, [textoResumen]);

  // ================================
  // ✅ NUEVO: GUARDAR RESUMEN (usuario_operativo)
  // ================================
  async function guardarResumen() {
    setErrorResumen("");

    if (!fechaResumen) {
      setErrorResumen("Debe seleccionar una fecha.");
      return;
    }

    setLoadingResumen(true);

    try {
      const res = await fetch("/api/resumen-diario", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: fechaResumen,
          resumen: textoResumen || "",
          area: areaResumen || null,   
          centro: centroResumen || null, 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorResumen(data.message || "Error guardando el resumen.");
      } else {
        // 🔥 usuario_operativo: una vez guardado, ya no se debe editar ni mostrar botón
        // 🔥 admin_centro: siempre puede seguir editando y guardando
        if (rol === "usuario_operativo") {
          setEditableResumen(false);
          setMostrarGuardar(false);
        }

        // ✅ Modal éxito
        setSuccessModal("guardado");
      }
    } catch {
      setErrorResumen("Error de conexión al guardar el resumen.");
    }

    setLoadingResumen(false);
  }

  // ================================
  // GENERAR RESUMEN IA (AHORA CON FORM)
  // ================================
  async function generarResumenIA(e) {
    e.preventDefault(); // 🔥 IGUAL QUE REPORTES

    setErrorResumen("");
    setResumenIA(null);

    // ✅ reset UI resumen
    setEditableResumen(false);
    setMostrarGuardar(false);
    setTextoResumen("");
    setFaltantesResumen([]);

    // ✅ cerrar modales
    setFaltantesModal({ open: false, message: "", agrupados: [] });

    if (!fechaResumen) {
      setErrorResumen("Debe seleccionar una fecha.");
      return;
    }

    setLoadingResumen(true);

    try {
      const res = await fetch("/api/resumen-diario", {
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
        const faltantes = Array.isArray(data.faltantes) ? data.faltantes : [];
        setFaltantesResumen(faltantes);

        // ✅ Si es caso de faltantes: SOLO modal, NO panel
        if (faltantes.length > 0) {
          setFaltantesModal({
            open: true,
            message: data.message || "",
            agrupados: Array.isArray(data.faltantesAgrupados)
              ? data.faltantesAgrupados
              : [],
          });
        } else {
          // ✅ Errores normales sí van al panel
          setErrorResumen(data.message || "Error generando resumen IA.");
        }
      } else {
        setResumenIA(data.resumen);
        setTextoResumen(data.resumen || "");

        // ✅ editable solo cuando backend diga editable:true
        const editable = !!data.editable;
        setEditableResumen(editable);

        // ✅ botón guardar solo cuando es editable (usuario operativo) y resumen no guardado
        setMostrarGuardar(editable);
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

          {/* ✅ YA NO MOSTRAMOS FALTANTES AQUÍ (ahora van solo en modal) */}
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

        {/* ✅ NUEVO: si hay resumen, mostrar textarea (editable o no) + botón guardar solo si aplica */}
        {resumenIA && (
          <>
            <div className="resumenes-textarea-wrap">
              <textarea
                ref={textareaRef}
                className="resumenes-textarea input"
                value={textoResumen}
                onChange={(e) => {
                  setTextoResumen(e.target.value);
                  autoResizeTextarea();
                }}
                disabled={!editableResumen}
              />
            </div>

            {mostrarGuardar && (
              <div className="resumenes-actions">
                <button
                  className="submit-btn resumenes-guardar-btn"
                  onClick={guardarResumen}
                  disabled={loadingResumen}
                >
                  {loadingResumen ? "Guardando..." : "Guardar"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ✅ Modal faltantes */}
      {faltantesModal.open &&
        createPortal(
          <InfoModal
            title="Faltan resúmenes"
            message={faltantesModal.message}
            faltantesAgrupados={faltantesModal.agrupados}
            onClose={() =>
              setFaltantesModal({ open: false, message: "", agrupados: [] })
            }
          />,
          document.body
        )}

      {/* ✅ Modal éxito guardar */}
      {successModal &&
        createPortal(
          <SuccessModal
            mode={successModal}
            onClose={() => setSuccessModal("")}
          />,
          document.body
        )}
    </div>
  );
}

function SuccessModal({ mode, onClose }) {
  let mensaje = "";
  if (mode === "guardado") mensaje = "Resumen guardado con éxito.";

  return (
    <div className="modal success-modal">
      <div className="modal-content success-content">
        <h3>{mensaje}</h3>
        <button className="submit-btn" onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  );
}

function InfoModal({ title, message, faltantesAgrupados, onClose }) {
  return (
    <div className="modal">
      <div className="modal-content resumenes-info-modal">
        <button className="close-btn" onClick={onClose}>
          ✖
        </button>
        <h3 className="resumenes-modal-title">{title}</h3>

        {/* ✅ Texto informativo */}
        {message && <p className="resumenes-modal-text-info">{message}</p>}

        {/* ✅ Separar por centro comercial */}
        {Array.isArray(faltantesAgrupados) && faltantesAgrupados.length > 0 && (
          <div className="resumenes-faltantes-list">
            {faltantesAgrupados.map((c) => (
              <div
                className="resumenes-faltantes-centro"
                key={`${c.id_centro_comercial}-${c.fecha}`}
              >
                <div className="resumenes-faltantes-centro-title">
                  {c.centro}
                </div>
                <div className="resumenes-faltantes-areas">
                  {Array.isArray(c.areas) ? c.areas.join(", ") : ""}
                </div>
              </div>
            ))}
          </div>
        )}

        <button className="submit-btn" onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  );
}
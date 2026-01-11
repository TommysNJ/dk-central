"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "@/styles/usuarios.css";

export default function IncidentesPage() {
  const [rol, setRol] = useState(null);
  const [areaUsuario, setAreaUsuario] = useState(null);
  const [idCentroUsuario, setIdCentroUsuario] = useState(null);

  const [centros, setCentros] = useState([]);
  const [tiposIncidente, setTiposIncidente] = useState([]);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ NUEVO: error debajo del form, igual que ResumenesPage
  const [errorIncidentes, setErrorIncidentes] = useState("");

  // Filtros (valores en los controles)
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

  // ⭐️ Filtros realmente aplicados a la tabla (los últimos con los que se hizo búsqueda)
  const [filtrosAplicados, setFiltrosAplicados] = useState(null);

  // Modals usuario operativo
  const [obsModal, setObsModal] = useState({
    open: false,
    incidente: null,
    texto: "",
  });

  const [estadoModal, setEstadoModal] = useState({
    open: false,
    incidente: null,
    nuevoEstado: "",
  });

  const [successModal, setSuccessModal] = useState("");

  // 🔥 NUEVO: Modal de historial
  const [historialModal, setHistorialModal] = useState({
    open: false,
    incidente: null,
    items: [],
    loading: false,
    error: "",
  });

  // ==========================
  //   Cargar rol y datos base
  // ==========================
  useEffect(() => {
    async function init() {
      const resMe = await fetch("/api/auth/me");
      if (resMe.ok) {
        const me = await resMe.json();
        setRol(me.rol);
        setAreaUsuario(me.area);
        setIdCentroUsuario(me.id_centro_comercial);

        if (me.rol === "admin_sistema") {
          const resCentros = await fetch("/api/centros");
          if (resCentros.ok) {
            setCentros(await resCentros.json());
          }
        }

        const resTipos = await fetch("/api/incidentes-tipos");
        if (resTipos.ok) {
          setTiposIncidente(await resTipos.json());
        }

        // 🔹 Calcular fecha de HOY (formato YYYY-MM-DD)
        const hoy = new Date();
        const yyyy = hoy.getFullYear();
        const mm = String(hoy.getMonth() + 1).padStart(2, "0");
        const dd = String(hoy.getDate()).padStart(2, "0");
        const hoyStr = `${yyyy}-${mm}-${dd}`;

        // ❌ NO usamos setFiltroFecha(hoyStr);
        // Dejamos el input vacío como quieres.

        // 🔹 Filtros iniciales: SOLO HOY (pero no mostrado en el input)
        const filtrosIniciales = {
          centro: "",
          area: "",
          tipo: "",
          estado: "",
          fecha: hoyStr, // ⭐ Se envía al backend, pero NO al input
        };

        setFiltrosAplicados(filtrosIniciales);

        await loadIncidentes({
          rol: me.rol,
          ...filtrosIniciales,
        });
      }
    }
    init();
  }, []);

  async function loadIncidentes(
    { rol, centro, area, tipo, estado, fecha },
    options = {}
  ) {
    const { background = false } = options;

    if (!background) {
      setLoading(true);
    }

    // ✅ NUEVO: limpiar error solo cuando es acción de usuario (no background)
    if (!background) setErrorIncidentes("");

    try {
      const params = new URLSearchParams();

      if (rol === "admin_sistema" && centro) params.set("centro", centro);

      if ((rol === "admin_sistema" || rol === "admin_centro") && area)
        params.set("area", area);

      if (tipo) params.set("tipo", tipo);
      if (estado) params.set("estado", estado);
      if (fecha) params.set("fecha", fecha);

      const query = params.toString();
      const url = query ? `/api/incidentes?${query}` : "/api/incidentes";

      const res = await fetch(url);

      if (res.ok) {
        setItems(await res.json());
        return true; // ✅ NUEVO: éxito
      }

      // ✅ NUEVO: traer mensaje del backend
      const data = await res.json().catch(() => ({}));
      const msg = data.message || "Error al filtrar incidentes.";

      // ✅ NUEVO: si es 400 (ej: falta fecha), mostrar error y NO borrar tabla
      if (res.status === 400) {
        if (!background) setErrorIncidentes(msg);
        return false;
      }

      // otros errores: mostramos y limpiamos
      if (!background) setErrorIncidentes(msg);
      setItems([]);
      return false;
    } catch (e) {
      console.error("Error cargando incidentes:", e);
      if (!background) setErrorIncidentes("Error de conexión al cargar incidentes.");
      setItems([]);
      return false;
    } finally {
      if (!background) {
        setLoading(false);
      }
    }
  }

  async function onFiltrar(e) {
    e.preventDefault();
    if (!rol) return;

    // ✅ NUEVO: limpiar error al intentar filtrar
    setErrorIncidentes("");

    const nuevosFiltros = {
      centro: filtroCentro,
      area: filtroArea,
      tipo: filtroTipo,
      estado: filtroEstado,
      fecha: filtroFecha,
    };

    // ✅ NUEVO: primero intentamos filtrar; solo si OK guardamos filtrosAplicados
    const ok = await loadIncidentes({
      rol,
      ...nuevosFiltros,
    });

    if (ok) {
      // Guardar filtros aplicados (para el auto-refresh)
      setFiltrosAplicados(nuevosFiltros);
    }
  }

  // ==========================
  //   Auto-refresh de incidentes
  // ==========================
  useEffect(() => {
    if (!rol || !filtrosAplicados) return;

    // ⏱ Pooling cada 15 segundos para revisar nuevos mensajes
    const interval = setInterval(() => {
      loadIncidentes(
        {
          rol,
          ...filtrosAplicados,
        },
        { background: true } // 👈 no mostramos "Filtrando..."
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [rol, filtrosAplicados]);

  // ==========================
  //   Helpers UI
  // ==========================

  const showCentroCol = rol === "admin_sistema";
  const showAreaCol = rol !== "usuario_operativo";

  function mapEstadoLabel(valor) {
    if (valor === "en_proceso") return "En Proceso";
    if (valor === "completado") return "Completado";
    return "Nuevo";
  }

  function mapAreaLabel(valor) {
    if (!valor) return "-";
    const map = {
      recepcion: "Recepción",
      administracion: "Administración",
      mantenimiento: "Mantenimiento",
      seguridad: "Seguridad",
      mercadeo: "Mercadeo",
      sso: "SSO",
    };
    return map[valor] || valor;
  }

  function estadoBadgeClass(estado) {
    if (estado === "completado") return "badge-completado";
    if (estado === "en_proceso") return "badge-en-proceso";
    return "badge-nuevo";
  }

  function handleChangeArea(e) {
    const value = e.target.value;
    setFiltroArea(value);

    if (filtroTipo) {
      const tipoObj = tiposIncidente.find((t) => t.nombre === filtroTipo);
      if (tipoObj && value && tipoObj.area !== value) {
        setFiltroTipo("");
      }
    }
  }

  function handleChangeTipo(e) {
    const value = e.target.value;
    setFiltroTipo(value);

    if (!value) return;

    const tipoObj = tiposIncidente.find((t) => t.nombre === value);
    if (!tipoObj) return;

    if (rol === "admin_sistema" || rol === "admin_centro") {
      setFiltroArea(tipoObj.area);
    }
  }

  // ==========================
  //   Modals usuario operativo
  // ==========================

  function abrirObsModal(item) {
    if (item.estado === "completado") return;
    setObsModal({
      open: true,
      incidente: item,
      texto: item.observaciones || "",
    });
  }

  function cerrarObsModal() {
    setObsModal({ open: false, incidente: null, texto: "" });
  }

  async function guardarObservaciones() {
    const { incidente, texto } = obsModal;
    if (!incidente) return;

    const res = await fetch(
      `/api/incidentes/${incidente.id_mensaje_clasificado}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observaciones: texto }),
      }
    );

    if (res.ok) {
      cerrarObsModal();

      // 🔁 Recargar con los filtros aplicados actualmente
      const filtros = filtrosAplicados || {
        centro: filtroCentro,
        area: filtroArea,
        tipo: filtroTipo,
        estado: filtroEstado,
        fecha: filtroFecha,
      };

      await loadIncidentes({
        rol,
        ...filtros,
      });

      setSuccessModal("obs");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Error al actualizar observaciones");
    }
  }

  function cambiarEstadoSelect(item, nuevoEstado) {
    if (item.estado === "completado") return;

    if (nuevoEstado === "completado") {
      setEstadoModal({
        open: true,
        incidente: item,
        nuevoEstado,
      });
    } else {
      actualizarEstado(item, nuevoEstado);
    }
  }

  function cerrarEstadoModal() {
    setEstadoModal({ open: false, incidente: null, nuevoEstado: "" });
  }

  async function confirmarCambioEstado() {
    const { incidente, nuevoEstado } = estadoModal;
    if (!incidente || !nuevoEstado) return;
    await actualizarEstado(incidente, nuevoEstado);
    cerrarEstadoModal();
  }

  async function actualizarEstado(incidente, nuevoEstado) {
    const res = await fetch(
      `/api/incidentes/${incidente.id_mensaje_clasificado}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      }
    );

    if (res.ok) {
      // 🔁 Recargar con los filtros aplicados actualmente
      const filtros = filtrosAplicados || {
        centro: filtroCentro,
        area: filtroArea,
        tipo: filtroTipo,
        estado: filtroEstado,
        fecha: filtroFecha,
      };

      await loadIncidentes({
        rol,
        ...filtros,
      });

      setSuccessModal("estado");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Error al actualizar estado");
    }
  }

  // ==========================
  //   Historial (modal)
  // ==========================

  async function abrirHistorial(item) {
    setHistorialModal({
      open: true,
      incidente: item,
      items: [],
      loading: true,
      error: "",
    });

    try {
      const res = await fetch(
        `/api/incidentes/${item.id_mensaje_clasificado}/historial`
      );
      if (res.ok) {
        const data = await res.json();
        setHistorialModal((prev) => ({
          ...prev,
          items: data,
          loading: false,
        }));
      } else {
        const j = await res.json().catch(() => ({}));
        setHistorialModal((prev) => ({
          ...prev,
          loading: false,
          error: j.message || "Error al cargar el historial",
        }));
      }
    } catch (e) {
      console.error("Error cargando historial:", e);
      setHistorialModal((prev) => ({
        ...prev,
        loading: false,
        error: "Error al cargar el historial",
      }));
    }
  }

  function cerrarHistorial() {
    setHistorialModal({
      open: false,
      incidente: null,
      items: [],
      loading: false,
      error: "",
    });
  }

  if (!rol) {
    return <p>Cargando...</p>;
  }

  const contenido = (
    <div className="main-content-inner">
      {/* ================= FILTROS ================= */}
      <div className="filter-panel">
        <form onSubmit={onFiltrar} className="search-group">
          {rol === "admin_sistema" && (
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
          )}

          {(rol === "admin_sistema" || rol === "admin_centro") && (
            <select
              className="input"
              value={filtroArea}
              onChange={handleChangeArea}
            >
              <option value="">Área</option>
              <option value="recepcion">Recepción</option>
              <option value="administracion">Administración</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="seguridad">Seguridad</option>
              <option value="mercadeo">Mercadeo</option>
              <option value="sso">SSO</option>
            </select>
          )}

          <select
            className="input"
            value={filtroTipo}
            onChange={handleChangeTipo}
          >
            <option value="">Tipo de incidente</option>
            {tiposIncidente
              .filter((t) => {
                if (rol === "usuario_operativo") {
                  return t.area === areaUsuario;
                }
                return !filtroArea || t.area === filtroArea;
              })
              .map((t) => (
                <option key={t.id_incidente} value={t.nombre}>
                  {t.nombre}
                </option>
              ))}
          </select>

          <select
            className="input"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="">Estado</option>
            <option value="nuevo">Nuevo</option>
            <option value="en_proceso">En Proceso</option>
            <option value="completado">Completado</option>
          </select>

          <input
            className="input"
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
          />

          <button className="filter-btn" type="submit">
            {loading ? "Filtrando..." : "Filtrar"}
          </button>
        </form>

        {/* ✅ NUEVO: mismo patrón que ResumenesPage (debajo del form) */}
        {errorIncidentes && (
          <p className="error-text report-error">{errorIncidentes}</p>
        )}
      </div>

      {/* ================= TABLA ================= */}
      <div className="table-panel">
        <table>
          <thead>
            <tr>
              {/* 🔥 NUEVA COLUMNA: botón trazabilidad */}
              <th className="col-traza"></th>
              <th className="col-hora">Hora</th>
              <th className="col-fecha">Fecha</th>

              {showCentroCol && <th className="col-centro">Centro</th>}
              {showAreaCol && <th className="col-area">Área</th>}
              <th className="col-incidente">Incidente</th>
              <th className="col-mensaje">Mensaje</th>
              <th className="col-observacion">Observación</th>
              <th>Estado</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    showCentroCol ? (showAreaCol ? 9 : 8) : showAreaCol ? 8 : 7
                  }
                  className="no-incidentes-cell"
                >
                  No existen incidentes que coincidan con los filtros.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                let fechaStr = "-";
                if (item.fecha_date) {
                  const f = item.fecha_date;
                  fechaStr = f
                    .split("T")[0]
                    .split("-")
                    .reverse()
                    .join("/");
                }

                const esOperativo = rol === "usuario_operativo";
                const bloqueado = item.estado === "completado";

                return (
                  <tr key={item.id_mensaje_clasificado}>
                    {/* 🔥 BOTÓN TRAZABILIDAD */}
                    <td className="col-traza">
                      <button
                        className="actions-button-plain"
                        title="Ver historial de cambios"
                        onClick={() => abrirHistorial(item)}
                      >
                        📄
                      </button>
                    </td>

                    {/* 🔥 CELDA DE HORA */}
                    <td className="col-hora">{item.fecha_time || "-"}</td>

                    {/* FECHA */}
                    <td className="col-fecha">{fechaStr}</td>

                    {showCentroCol && (
                      <td className="col-centro">{item.centro || "-"}</td>
                    )}

                    {showAreaCol && (
                      <td className="col-area">{mapAreaLabel(item.area)}</td>
                    )}

                    <td className="col-incidente">{item.incidente}</td>

                    {/* ============= COLUMNA MENSAJE ============= */}
                    <td className="col-mensaje">{item.mensaje_limpio}</td>

                    <td className="col-observacion">
                      {esOperativo ? (
                        <div className="obs-cell">
                          <span className="obs-text">
                            {item.observaciones || "-"}
                          </span>
                          <button
                            className="actions-button-plain"
                            title={
                              bloqueado
                                ? "Incidente completado, no editable"
                                : "Editar observación"
                            }
                            disabled={bloqueado}
                            onClick={() => abrirObsModal(item)}
                          >
                            ✎
                          </button>
                        </div>
                      ) : (
                        <span>{item.observaciones || "-"}</span>
                      )}
                    </td>

                    <td>
                      {esOperativo ? (
                        <select
                          className={`input ${estadoBadgeClass(item.estado)}`}
                          value={item.estado}
                          disabled={bloqueado}
                          onChange={(e) =>
                            cambiarEstadoSelect(item, e.target.value)
                          }
                        >
                          {/* Solo mostrar Nuevo si aún está en nuevo */}
                          {item.estado === "nuevo" && (
                            <option value="nuevo">Nuevo</option>
                          )}
                          <option value="en_proceso">En Proceso</option>
                          <option value="completado">Completado</option>
                        </select>
                      ) : (
                        <span
                          className={`badge ${estadoBadgeClass(item.estado)}`}
                        >
                          {mapEstadoLabel(item.estado)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ================= MODALES ================= */}

      {/* Modal Observaciones */}
      {obsModal.open &&
        createPortal(
          <div className="modal">
            <div className="modal-content">
              <button className="close-btn" onClick={cerrarObsModal}>
                ✖
              </button>
              <h3>Editar Observación</h3>
              <textarea
                className="input textarea-observacion"
                value={obsModal.texto}
                onChange={(e) =>
                  setObsModal((prev) => ({ ...prev, texto: e.target.value }))
                }
                placeholder="Describe las acciones realizadas..."
              />
              <button className="submit-btn" onClick={guardarObservaciones}>
                Guardar
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Modal confirmación estado completado */}
      {estadoModal.open &&
        createPortal(
          <div className="modal delete-modal">
            <div className="modal-content delete-content">
              <h3>
                ¿Deseas marcar este incidente como{" "}
                <strong>Completado</strong>?
              </h3>
              <p>
                Una vez completado, ya no podrás modificar ni la observación ni
                el estado.
              </p>
              <div className="delete-buttons">
                <button className="cancel-btn" onClick={cerrarEstadoModal}>
                  Cancelar
                </button>
                <button className="confirm-btn" onClick={confirmarCambioEstado}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Modal éxito */}
      {successModal &&
        createPortal(
          <SuccessModal
            mode={successModal}
            onClose={() => setSuccessModal("")}
          />,
          document.body
        )}

      {/* 🔥 Modal Historial */}
      {historialModal.open &&
        createPortal(
          <div className="modal">
            <div className="modal-content historial-modal">
              <button className="close-btn" onClick={cerrarHistorial}>
                ✖
              </button>
              <h3>Historial del incidente</h3>
              {historialModal.incidente && (
                <div className="historial-mensaje">
                  <strong>Mensaje:</strong>{historialModal.incidente.mensaje_limpio}
                </div>
              )}

              {historialModal.loading && <p>Cargando historial...</p>}
              {historialModal.error && (
                <p className="error-text">{historialModal.error}</p>
              )}

              {!historialModal.loading &&
                !historialModal.error &&
                historialModal.items.length === 0 && (
                  <p className="historial-empty">
                    No existen cambios registrados para este incidente.
                  </p>
                )}

              {!historialModal.loading &&
                !historialModal.error &&
                historialModal.items.length > 0 && (
                  <table className="historial-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Hora</th>
                        <th>Usuario</th>
                        <th>Estado</th>
                        <th>Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historialModal.items.map((h) => {
                        let fechaStr = "-";
                        if (h.fecha_cambio) {
                          const f = h.fecha_cambio;
                          fechaStr = f
                            .split("T")[0]
                            .split("-")
                            .reverse()
                            .join("/");
                        }

                        return (
                          <tr key={h.id_historial}>
                            <td>{fechaStr}</td>
                            <td>{h.hora_cambio || "-"}</td>
                            <td className="historial-usuario">
                              {h.usuario_nombre}
                            </td>
                            <td>{mapEstadoLabel(h.estado)}</td>
                            <td>{h.observaciones || "-"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );

  return contenido;
}

function SuccessModal({ mode, onClose }) {
  let mensaje = "";
  if (mode === "obs") mensaje = "Observaciones actualizadas con éxito.";
  if (mode === "estado")
    mensaje = "Estado del incidente actualizado con éxito.";

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
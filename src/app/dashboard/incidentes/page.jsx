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

  // Filtros
  const [filtroCentro, setFiltroCentro] = useState("");
  const [filtroArea, setFiltroArea] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroFecha, setFiltroFecha] = useState("");

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

        await loadIncidentes({
          rol: me.rol,
          centro: "",
          area: "",
          tipo: "",
          estado: "",
          fecha: "",
        });
      }
    }
    init();
  }, []);

  async function loadIncidentes({
    rol,
    centro,
    area,
    tipo,
    estado,
    fecha,
  }) {
    setLoading(true);
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
      } else {
        setItems([]);
      }
    } catch (e) {
      console.error("Error cargando incidentes:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function onFiltrar(e) {
    e.preventDefault();
    if (!rol) return;

    await loadIncidentes({
      rol,
      centro: filtroCentro,
      area: filtroArea,
      tipo: filtroTipo,
      estado: filtroEstado,
      fecha: filtroFecha,
    });
  }

  // ==========================
  //   Helpers UI
  // ==========================

  const showCentroCol = rol === "admin_sistema";
  const showAreaCol = rol !== "usuario_operativo";

  function mapEstadoLabel(valor) {
    if (valor === "en_proceso") return "En Proceso";
    if (valor === "completado") return "Completado";
    return "Revisado";
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
    return "badge-revisado";
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
      await loadIncidentes({
        rol,
        centro: filtroCentro,
        area: filtroArea,
        tipo: filtroTipo,
        estado: filtroEstado,
        fecha: filtroFecha,
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
      await loadIncidentes({
        rol,
        centro: filtroCentro,
        area: filtroArea,
        tipo: filtroTipo,
        estado: filtroEstado,
        fecha: filtroFecha,
      });
      setSuccessModal("estado");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.message || "Error al actualizar estado");
    }
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
            <option value="revisado">Revisado</option>
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
      </div>

      {/* ================= TABLA ================= */}
      <div className="table-panel">
        <table>
          <thead>
            <tr>
              {/* 🔥 AÑADIDO */}
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
                    showCentroCol ? (showAreaCol ? 8 : 7) : showAreaCol ? 7 : 6
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
                  fechaStr = f.split("T")[0]
                    .split("-")
                    .reverse()
                    .join("/");
                }

                const esOperativo = rol === "usuario_operativo";
                const bloqueado = item.estado === "completado";

                return (
                  <tr key={item.id_mensaje_clasificado}>

                    {/* 🔥 CELDA DE HORA */}
                    <td className="col-hora">{item.fecha_time || "-"}</td>

                    {/* FECHA */}
                    <td className="col-fecha">{fechaStr}</td>

                    {showCentroCol && (
                      <td className="col-centro">{item.centro || "-"}</td>
                    )}

                    {showAreaCol && <td className="col-area">{mapAreaLabel(item.area)}</td>}

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
                          <option value="revisado">Revisado</option>
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
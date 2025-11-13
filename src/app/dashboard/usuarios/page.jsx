"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "@/styles/usuarios.css";

export default function UsuariosPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [rolActual, setRolActual] = useState("");
  const [idCentroActual, setIdCentroActual] = useState(null);
  const [deleteData, setDeleteData] = useState({ open: false, id: null }); // ✅ nuevo estado para modal eliminar

  async function load() {
    const res = await fetch(`/api/usuarios?search=${encodeURIComponent(query)}`);
    if (res.ok) setItems(await res.json());
    else setItems([]);
  }

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setRolActual(data.rol);
        setIdCentroActual(data.id_centro_comercial);
      }
      await load();
    }
    init();
  }, []);

  async function onSearch(e) {
    e.preventDefault();
    await load();
  }

  async function confirmDelete(id) {
    setDeleteData({ open: true, id }); // ✅ abre el modal de confirmación
  }

  async function handleConfirmDelete() {
    const { id } = deleteData;
    const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert("Error al eliminar");
    setDeleteData({ open: false, id: null });
  }

  function handleCancelDelete() {
    setDeleteData({ open: false, id: null });
  }

  return (
    <div className="main-content-inner">
      <div className="filter-panel">
        <button
          onClick={() => openModal(null, rolActual, idCentroActual)}
          className="create-btn"
        >
          Crear Usuario
        </button>
        <form onSubmit={onSearch} className="search-group">
          <input
            className="input"
            type="text"
            placeholder="Correo o nombre..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="filter-btn">Buscar</button>
        </form>
      </div>

      <div className="table-panel">
        <table>
          <thead>
            <tr>
              <th>Teléfono</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Área</th>
              <th>Centro Comercial</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((u) => (
                <tr key={u.id_usuario}>
                  <td>{u.telefono || "-"}</td>
                  <td>{u.nombre}</td>
                  <td>{u.correo}</td>
                  <td>{u.area || "-"}</td>
                  <td>{u.centro_comercial?.nombre || "-"}</td>
                  <td>{u.usuario}</td>
                  <td>{mapRol(u.rol)}</td>
                  <td className="actions">
                    <button
                      title="Editar"
                      onClick={() => openModal(u, rolActual, idCentroActual)}
                    >
                      ✎
                    </button>
                    <button
                      title="Eliminar"
                      className="delete"
                      onClick={() => confirmDelete(u.id_usuario)} // ✅ ahora abre modal
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" style={{ textAlign: "center" }}>
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <UserModal
        onSaved={load}
        rolActual={rolActual}
        idCentroActual={idCentroActual}
      />

      {/* ✅ Modal de confirmación de eliminación */}
      {deleteData.open &&
        createPortal(
          <DeleteModal
            onCancel={handleCancelDelete}
            onConfirm={handleConfirmDelete}
          />,
          document.body
        )}
    </div>
  );
}

function mapRol(r) {
  if (r === "admin_sistema") return "Administrador del Sistema";
  if (r === "admin_centro") return "Administrador del Centro Comercial";
  return "Usuario Operativo";
}

let setModalStateGlobal;
function openModal(user = null, rolActual = "", idCentro = null) {
  setModalStateGlobal({ open: true, user, rolActual, idCentro });
}

function closeModal() {
  if (setModalStateGlobal) {
    setModalStateGlobal((prev) => ({
      ...prev,
      open: false,
      user: null,
    }));
  }
}

function UserModal({ onSaved, rolActual }) {
  const [state, setState] = useState({ open: false, user: null });
  setModalStateGlobal = setState;
  const editing = !!state.user;

  const [form, setForm] = useState({
    nombre: "",
    correo: "",
    telefono: "",
    usuario: "",
    password: "",
    rol: "usuario_operativo",
    area: "",
    nombre_centro_comercial: "",
  });

  const [errors, setErrors] = useState({});
  const [centros, setCentros] = useState([]);
  const [successModal, setSuccessModal] = useState("");

  useEffect(() => {
    async function fetchCentros() {
      if (rolActual === "admin_sistema") {
        const res = await fetch("/api/centros");
        if (res.ok) setCentros(await res.json());
      }
    }
    fetchCentros();
  }, [rolActual]);

  useEffect(() => {
    if (state.user) {
      setForm({
        nombre: state.user.nombre,
        correo: state.user.correo,
        telefono: state.user.telefono || "",
        usuario: state.user.usuario,
        password: "",
        rol: state.user.rol,
        area: state.user.area || "",
        nombre_centro_comercial: state.user.centro_comercial?.nombre || "",
      });
    } else {
      setForm({
        nombre: "",
        correo: "",
        telefono: "",
        usuario: "",
        password: "",
        rol: "usuario_operativo",
        area: "",
        nombre_centro_comercial: "",
      });
    }
    setErrors({});
  }, [state.user]);

  useEffect(() => {
    if (!state.open) {
      setForm({
        nombre: "",
        correo: "",
        telefono: "",
        usuario: "",
        password: "",
        rol: "usuario_operativo",
        area: "",
        nombre_centro_comercial: "",
      });
      setErrors({});
    }
  }, [state.open]);

  async function save() {
    setErrors({});
    const payload = { ...form };

    if (rolActual === "admin_centro") {
      payload.rol = "usuario_operativo";
      delete payload.nombre_centro_comercial;
    }

    const res = editing
      ? await fetch(`/api/usuarios/${state.user.id_usuario}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/usuarios`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      closeModal();
      onSaved();

      if (editing) setSuccessModal("editado");
      else setSuccessModal("creado");
    } else {
      const data = await res.json();
      const msg = data.message || "Error";

      // 🔹 Si el backend dice "Campos obligatorios faltantes", solo pinta los campos vacíos
      if (msg.includes("faltantes")) {
        const emptyFields = {};
        if (!payload.nombre) emptyFields.nombre = true;
        if (!payload.correo) emptyFields.correo = true;
        if (!payload.telefono) emptyFields.telefono = true;
        if (!payload.usuario) emptyFields.usuario = true;
        if (!editing && !payload.password) emptyFields.password = true;
        if (!payload.area && payload.rol === "usuario_operativo") emptyFields.area = true;
        if (
          !payload.nombre_centro_comercial &&
          rolActual === "admin_sistema" &&
          (payload.rol === "admin_centro" || payload.rol === "usuario_operativo")
        ) {
          emptyFields.nombre_centro_comercial = true;
        }
        setErrors({ ...emptyFields, general: msg });
        return;
      }

      if (msg.includes("correo")) setErrors({ correo: msg });
      else if (msg.includes("teléfono")) setErrors({ telefono: msg });
      else if (msg.includes("centro"))
        setErrors({ nombre_centro_comercial: msg });
      else if (msg.includes("área") || msg.includes("area"))
        setErrors({ area: msg });
      else if (msg.includes("usuario")) setErrors({ usuario: msg });
      else if (msg.includes("contraseña")) setErrors({ password: msg });
      else if (msg.includes("número")) setErrors({ telefono: msg });
      else setErrors({ general: msg });
    }
  }

  if (!state.open) {
    if (successModal)
      return createPortal(
        <SuccessModal
          onClose={() => setSuccessModal("")}
          mode={successModal}
        />,
        document.body
      );
    return null;
  }

  const isAreaDisabled =
    rolActual === "admin_sistema" &&
    (form.rol === "admin_centro" || form.rol === "admin_sistema");

  const isCentroDisabled =
    rolActual === "admin_sistema" && form.rol === "admin_sistema";

  const modalContent = (
    <>
      <div className="modal">
        <div className="modal-content">
          <button className="close-btn" onClick={closeModal}>
            ✖
          </button>
          <h3>{editing ? "Editar Usuario" : "Crear Nuevo Usuario"}</h3>

          <label className="label">Nombre</label>
          <input
            className={`input ${errors.nombre ? "input-error" : ""}`}
            type="text"
            placeholder="Ingresa nombre completo"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />

          <label className="label">Correo</label>
          <input
            className={`input ${errors.correo ? "input-error" : ""}`}
            type="email"
            placeholder="ejemplo@correo.com"
            value={form.correo}
            onChange={(e) => setForm({ ...form, correo: e.target.value })}
          />
          {errors.correo && <p className="error-text">{errors.correo}</p>}

          <label className="label">Teléfono</label>
          <input
            className={`input ${errors.telefono ? "input-error" : ""}`}
            type="tel"
            placeholder="0999999999"
            maxLength="10"
            value={form.telefono}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, "");
              setForm({ ...form, telefono: value });
            }}
          />
          {errors.telefono && <p className="error-text">{errors.telefono}</p>}

          {rolActual === "admin_sistema" && (
            <>
              <label className="label">Centro Comercial</label>
              <select
                className={`input ${errors.nombre_centro_comercial ? "input-error" : ""}`}
                value={form.nombre_centro_comercial}
                disabled={isCentroDisabled}
                onChange={(e) =>
                  setForm({ ...form, nombre_centro_comercial: e.target.value })
                }
              >
                <option value="">Selecciona un centro</option>
                {centros.map((c) => (
                  <option key={c.id_centro_comercial} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {errors.nombre_centro_comercial && (
                <p className="error-text">{errors.nombre_centro_comercial}</p>
              )}
            </>
          )}

          <label className="label">Área</label>
          <select
            className={`input ${errors.area ? "input-error" : ""}`}
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            disabled={isAreaDisabled}
          >
            <option value="">Selecciona un área</option>
            <option value="recepcion">Recepción</option>
            <option value="administracion">Administración</option>
            <option value="mantenimiento">Mantenimiento</option>
            <option value="seguridad">Seguridad</option>
            <option value="mercadeo">Mercadeo</option>
            <option value="sso">SSO</option>
          </select>
          {errors.area && <p className="error-text">{errors.area}</p>}

          <label className="label">Usuario</label>
          <input
            className={`input ${errors.usuario ? "input-error" : ""}`}
            type="text"
            placeholder="Nombre de usuario"
            value={form.usuario}
            onChange={(e) => setForm({ ...form, usuario: e.target.value })}
          />
          {errors.usuario && <p className="error-text">{errors.usuario}</p>}

          <label className="label">Contraseña</label>
          <input
            className={`input ${errors.password ? "input-error" : ""}`}
            type="password"
            placeholder="**********"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          {errors.password && <p className="error-text">{errors.password}</p>}

          {rolActual === "admin_sistema" && (
            <>
              <label className="label">Rol</label>
              <select
                className="input"
                value={form.rol}
                onChange={(e) => {
                  const newRol = e.target.value;
                  if (newRol === "admin_centro" || newRol === "admin_sistema") {
                    setForm({
                      ...form,
                      rol: newRol,
                      area: "",
                      nombre_centro_comercial:
                        newRol === "admin_sistema"
                          ? ""
                          : form.nombre_centro_comercial,
                    });
                  } else {
                    setForm({ ...form, rol: newRol });
                  }
                }}
              >
                <option value="usuario_operativo">Usuario Operativo</option>
                <option value="admin_centro">
                  Administrador del Centro Comercial
                </option>
                <option value="admin_sistema">
                  Administrador del Sistema
                </option>
              </select>
            </>
          )}

          {errors.general && (
            <p className="error-text" style={{ textAlign: "center" }}>
              {errors.general}
            </p>
          )}

          <button className="submit-btn" onClick={save}>
            {editing ? "Guardar" : "Crear Usuario"}
          </button>
        </div>
      </div>

      {successModal &&
        createPortal(
          <SuccessModal
            onClose={() => setSuccessModal("")}
            mode={successModal}
          />,
          document.body
        )}
    </>
  );

  return createPortal(modalContent, document.body);
}

function SuccessModal({ onClose, mode }) {
  return (
    <div className="modal success-modal">
      <div className="modal-content success-content">
        <h3>
          {mode === "editado"
            ? "Usuario editado con éxito."
            : "Usuario creado con éxito."}
        </h3>
        <button className="submit-btn" onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  );
}

// ✅ Nuevo modal de confirmación
function DeleteModal({ onCancel, onConfirm }) {
  return (
    <div className="modal delete-modal">
      <div className="modal-content delete-content">
        <h3>¿Deseas eliminar este usuario?</h3>
        <div className="delete-buttons">
          <button className="cancel-btn" onClick={onCancel}>
            Cancelar
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
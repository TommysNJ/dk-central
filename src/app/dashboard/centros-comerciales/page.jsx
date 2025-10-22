"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import "@/styles/usuarios.css";

export default function CentrosComercialesPage() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [deleteData, setDeleteData] = useState({ open: false, id: null });

  async function load() {
    const res = await fetch(`/api/centros-comerciales?search=${encodeURIComponent(query)}`);
    if (res.ok) setItems(await res.json());
    else setItems([]);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSearch(e) {
    e.preventDefault();
    await load();
  }

  function confirmDelete(id) {
    setDeleteData({ open: true, id });
  }

  async function handleConfirmDelete() {
    const { id } = deleteData;
    const res = await fetch(`/api/centros-comerciales/${id}`, { method: "DELETE" });
    if (res.ok) await load();
    else alert("Error al eliminar centro comercial");
    setDeleteData({ open: false, id: null });
  }

  function handleCancelDelete() {
    setDeleteData({ open: false, id: null });
  }

  return (
    <div className="main-content-inner">
      <div className="filter-panel">
        <button onClick={() => openModal(null)} className="create-btn">
          Crear Centro Comercial
        </button>
        <form onSubmit={onSearch} className="search-group">
          <input
            className="input"
            type="text"
            placeholder="Buscar por ciudad..."
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
              <th>Nombre</th>
              <th>Ciudad</th>
              <th>Ubicación</th>
              <th>ID Grupo Telegram</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((c) => (
                <tr key={c.id_centro_comercial}>
                  <td>{c.nombre}</td>
                  <td>{c.ciudad}</td>
                  <td>{c.ubicacion || "-"}</td>
                  <td>{c.id_grupo_telegram}</td>
                  <td className="actions">
                    <button title="Editar" onClick={() => openModal(c)}>
                      ✎
                    </button>
                    <button
                      title="Eliminar"
                      className="delete"
                      onClick={() => confirmDelete(c.id_centro_comercial)}
                    >
                      ✖
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" style={{ textAlign: "center" }}>
                  Sin datos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <CentroModal onSaved={load} />

      {deleteData.open &&
        createPortal(
          <DeleteModal onCancel={handleCancelDelete} onConfirm={handleConfirmDelete} />,
          document.body
        )}
    </div>
  );
}

let setModalStateGlobal;
function openModal(centro = null) {
  setModalStateGlobal({ open: true, centro });
}

function closeModal() {
  if (setModalStateGlobal) {
    setModalStateGlobal((prev) => ({
      ...prev,
      open: false,
      centro: null,
    }));
  }
}

function CentroModal({ onSaved }) {
  const [state, setState] = useState({ open: false, centro: null });
  setModalStateGlobal = setState;
  const editing = !!state.centro;

  const [form, setForm] = useState({
    nombre: "",
    ciudad: "",
    ubicacion: "",
    id_grupo_telegram: "",
  });

  const [errors, setErrors] = useState({});
  const [successModal, setSuccessModal] = useState("");

  useEffect(() => {
    if (state.centro) {
      setForm({
        nombre: state.centro.nombre,
        ciudad: state.centro.ciudad,
        ubicacion: state.centro.ubicacion || "",
        id_grupo_telegram: state.centro.id_grupo_telegram,
      });
    } else {
      setForm({
        nombre: "",
        ciudad: "",
        ubicacion: "",
        id_grupo_telegram: "",
      });
    }
    setErrors({});
  }, [state.centro]);

  useEffect(() => {
    if (!state.open) {
      setForm({
        nombre: "",
        ciudad: "",
        ubicacion: "",
        id_grupo_telegram: "",
      });
      setErrors({});
    }
  }, [state.open]);

  async function save() {
    setErrors({});
    const payload = { ...form };

    const res = editing
      ? await fetch(`/api/centros-comerciales/${state.centro.id_centro_comercial}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch(`/api/centros-comerciales`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    if (res.ok) {
      closeModal();
      onSaved();
      setSuccessModal(editing ? "editado" : "creado");
    } else {
      const data = await res.json();
      const msg = data.message || "Error";

      // 🔹 Si el backend devuelve "Campos obligatorios faltantes"
      if (msg.includes("faltantes")) {
        const emptyFields = {};
        if (!payload.nombre) emptyFields.nombre = true;
        if (!payload.ciudad) emptyFields.ciudad = true;
        if (!payload.id_grupo_telegram) emptyFields.id_grupo_telegram = true;
        setErrors({ ...emptyFields, general: msg });
        return;
      }

      if (msg.includes("nombre")) setErrors({ nombre: msg });
      else if (msg.includes("ciudad")) setErrors({ ciudad: msg });
      else if (msg.includes("grupo") || msg.includes("ID del grupo"))
        setErrors({ id_grupo_telegram: msg });
      else setErrors({ general: msg });
    }
  }

  if (!state.open) {
    if (successModal)
      return createPortal(
        <SuccessModal onClose={() => setSuccessModal("")} mode={successModal} />,
        document.body
      );
    return null;
  }

  const modalContent = (
    <>
      <div className="modal">
        <div className="modal-content">
          <button className="close-btn" onClick={closeModal}>
            ✖
          </button>
          <h3>{editing ? "Editar Centro Comercial" : "Crear Nuevo Centro Comercial"}</h3>

          <label className="label">Nombre</label>
          <input
            className={`input ${errors.nombre ? "input-error" : ""}`}
            type="text"
            placeholder="Nombre del centro comercial"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          {errors.nombre && <p className="error-text">{errors.nombre}</p>}

          <label className="label">Ciudad</label>
          <input
            className={`input ${errors.ciudad ? "input-error" : ""}`}
            type="text"
            placeholder="Ciudad"
            value={form.ciudad}
            onChange={(e) => setForm({ ...form, ciudad: e.target.value })}
          />
          {errors.ciudad && <p className="error-text">{errors.ciudad}</p>}

          <label className="label">Ubicación</label>
          <input
            className="input"
            type="text"
            placeholder="Dirección o referencia"
            value={form.ubicacion}
            onChange={(e) => setForm({ ...form, ubicacion: e.target.value })}
          />

          <label className="label">ID Grupo Telegram</label>
          <input
            className={`input ${errors.id_grupo_telegram ? "input-error" : ""}`}
            type="text"
            placeholder="Ejemplo: -1001234567890"
            value={form.id_grupo_telegram}
            onChange={(e) => setForm({ ...form, id_grupo_telegram: e.target.value })}
          />
          {errors.id_grupo_telegram && (
            <p className="error-text">{errors.id_grupo_telegram}</p>
          )}

          {errors.general && (
            <p className="error-text" style={{ textAlign: "center" }}>
              {errors.general}
            </p>
          )}

          <button className="submit-btn" onClick={save}>
            {editing ? "Guardar" : "Crear Centro"}
          </button>
        </div>
      </div>

      {successModal &&
        createPortal(
          <SuccessModal onClose={() => setSuccessModal("")} mode={successModal} />,
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
            ? "Centro comercial editado con éxito."
            : "Centro comercial creado con éxito."}
        </h3>
        <button className="submit-btn" onClick={onClose}>
          Aceptar
        </button>
      </div>
    </div>
  );
}

function DeleteModal({ onCancel, onConfirm }) {
  return (
    <div className="modal delete-modal">
      <div className="modal-content delete-content">
        <h3>¿Deseas eliminar este centro comercial?</h3>
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
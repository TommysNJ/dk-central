"use client";
import { useEffect, useState } from "react";

export default function AdminCentroHome() {
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then(res => res.json())
      .then(data => {
        if (data.must_change_password) {
          setShowModal(true);

          // 🔒 Bloquear botón atrás
          window.history.pushState(null, "", window.location.href);
          window.addEventListener("popstate", preventBack);
        }
      });

    return () => {
      window.removeEventListener("popstate", preventBack);
    };
  }, []);

  function preventBack() {
    window.history.pushState(null, "", window.location.href);
    setShowModal(true); // 🔥 fuerza el modal de nuevo
  }

  async function changePassword() {
    setError("");

    const res = await fetch("/api/auth/password/force-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message);
      return;
    }

    // ✅ Ahora sí se libera navegación
    setShowModal(false);
    window.removeEventListener("popstate", preventBack);

    // ✅ NUEVO: cerrar sesión y volver a login para emitir JWT nuevo
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <>
      <div className="card">
        <h1 style={{ color: "#0a5594", textAlign: "center" }}>
          Bienvenido Administrador del Centro Comercial
        </h1>
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <img src="/logo.jpg" alt="DK" width={380} height={380} />
        </div>
      </div>

      {showModal && (
        <div className="modal">
          <div className="modal-content">
            <h3>Cambio obligatorio de contraseña</h3>

            <label className="label">Nueva contraseña</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            {error && <p className="error-text">{error}</p>}

            <button className="submit-btn" onClick={changePassword}>
              Cambiar contraseña
            </button>
          </div>
        </div>
      )}
    </>
  );
}
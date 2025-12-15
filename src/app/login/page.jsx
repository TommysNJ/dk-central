"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import "@/styles/globals.css";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);

  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qr2FA, setQr2FA] = useState("");

  // 🔑 Recuperar contraseña (RESTAURADO)
  const [showRecover, setShowRecover] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverMsg, setRecoverMsg] = useState("");
  const [recoverSuccess, setRecoverSuccess] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password, twoFactorCode }),
    });

    setLoading(false);
    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Error de autenticación");
      return;
    }

    if (data.twoFactorSetupRequired) {
      await start2FASetup();
      return;
    }

    if (data.twoFactorRequired) {
      setTwoFactorRequired(true);
      setError("");
      return;
    }

    const { rol } = data;
    if (rol === "admin_sistema") router.replace("/dashboard/admin-sistema");
    else if (rol === "admin_centro") router.replace("/dashboard/admin-centro");
    else router.replace("/dashboard/usuario-operativo");
  }

  // =============================
  // 🔐 iniciar setup 2FA
  // =============================
  async function start2FASetup() {
    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const data = await res.json();
    setQr2FA(data.qr);
    setShowSetup2FA(true);
  }

  // =============================
  // 🔐 confirmar setup 2FA
  // =============================
  async function confirm2FASetup() {
    setError("");

    const res = await fetch("/api/auth/2fa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: twoFactorCode,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message || "Código incorrecto");
      return;
    }

    setShowSetup2FA(false);
    setTwoFactorCode("");
    setTwoFactorRequired(false);

    await onSubmit(new Event("submit"));
  }

  // =============================
  // 🔑 enviar correo recuperación
  // =============================
  async function sendRecoverEmail() {
    setRecoverMsg("");
    setRecoverSuccess(false);

    const res = await fetch("/api/auth/password/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo: recoverEmail }),
    });

    const data = await res.json();

    setRecoverMsg(data.message);

    if (data.exists) {
      setRecoverSuccess(true); // 👈 ocultará el botón
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <form onSubmit={onSubmit} className="login-form">
          <h1 className="login-title">Bienvenido</h1>

          <label className="label">Usuario</label>
          <input
            className="input"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Usuario"
          />

          <label className="label">Contraseña</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
          />

          {twoFactorRequired && (
            <>
              <label className="label">Código Authenticator</label>
              <input
                className="input"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
              />
            </>
          )}

          {/* 🔑 Recuperar contraseña (MISMO LUGAR QUE PEDISTE) */}
          <p
            className="label"
            style={{ cursor: "pointer", textAlign: "right" }}
            onClick={() => {
              setRecoverEmail("");
              setRecoverMsg("");
              setShowRecover(true);
            }}
          >
            ¿Olvidaste tu contraseña?
          </p>

          {error && (
            <p style={{ color: "#b91c1c", marginTop: 8 }}>{error}</p>
          )}

          <button
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: 14 }}
          >
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>

      <div className="login-right">
        <Image src="/logo.jpg" alt="DK" width={300} height={300} />
      </div>

      {/* 🔐 MODAL SETUP 2FA */}
      {showSetup2FA && (
        <div className="modal">
          <div className="modal-content">
            <h3>Configurar Autenticador</h3>

            <p style={{ marginBottom: 12 }}>
              Escanea el código QR con Google Authenticator, Authy u otra app.
            </p>

            <img
              src={qr2FA}
              alt="QR Authenticator"
              style={{ display: "block", margin: "0 auto 16px" }}
            />

            <label className="label">Código generado</label>
            <input
              className="input"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="123456"
              maxLength={6}
            />

            {error && (
              <p className="error-text" style={{ textAlign: "center" }}>
                {error}
              </p>
            )}

            <button className="submit-btn" onClick={confirm2FASetup}>
              Activar autenticador
            </button>
          </div>
        </div>
      )}

      {/* 🔑 MODAL RECUPERAR CONTRASEÑA (RESTAURADO) */}
      {showRecover && (
        <div className="modal">
          <div className="modal-content">
            <button
              className="close-btn"
              onClick={() => setShowRecover(false)}
            >
              ✖
            </button>

            <h3>Recuperar contraseña</h3>

            <label className="label">Correo electrónico</label>
            <input
              className="input"
              type="email"
              value={recoverEmail}
              onChange={(e) => setRecoverEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
            />

            {recoverMsg && (
              <p className="fade-in" style={{ textAlign: "center" }}>
                {recoverMsg}
              </p>
            )}

            {!recoverSuccess && (
              <button className="submit-btn" onClick={sendRecoverEmail}>
                Enviar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
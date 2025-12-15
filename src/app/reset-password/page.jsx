"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/styles/globals.css";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 🔒 Si no hay token, no permitir acceso
  useEffect(() => {
    if (!token) {
      router.replace("/login");
    }
  }, [token, router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        password,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.message || "Error al restablecer contraseña");
      return;
    }

    setSuccess("Contraseña actualizada correctamente");

    // 🔁 Redirigir al login luego de unos segundos
    setTimeout(() => {
      router.replace("/login");
    }, 2500);
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <form onSubmit={onSubmit} className="login-form">
          <h1 className="login-title">Nueva contraseña</h1>

          <label className="label">Nueva contraseña</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="********"
          />

          <label className="label">Confirmar contraseña</label>
          <input
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="********"
          />

          {error && (
            <p className="error-text" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}

          {success && (
            <p
              className="fade-in"
              style={{ color: "#166534", marginTop: 8, textAlign: "center" }}
            >
              {success}
            </p>
          )}

          <button
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: 14 }}
          >
            {loading ? "Guardando..." : "Actualizar contraseña"}
          </button>
        </form>
      </div>

      <div className="login-right">
        {/* Se mantiene coherencia visual con login */}
      </div>
    </div>
  );
}
"use client";
import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import "@/styles/globals.css";

export default function LoginPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usuario, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const j = await res.json();
      setError(j.message || "Error de autenticación");
      return;
    }
    const { rol } = await res.json();
    if (rol === "admin_sistema") router.replace("/dashboard/admin-sistema");
    else if (rol === "admin_centro") router.replace("/dashboard/admin-centro");
    else router.replace("/dashboard/usuario-operativo");
  }

  return (
    <div className="login-wrap">
      <div className="login-left">
        <form onSubmit={onSubmit} className="login-form">
          <h1 className="login-title">Bienvenido</h1>
          <label className="label">Usuario</label>
          <input className="input" value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="Usuario" />
          <label className="label">Contraseña</label>
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Contraseña" />
          {error && <p style={{color:"#b91c1c",marginTop:8}}>{error}</p>}
          <button className="btn-primary" disabled={loading} style={{marginTop:14}}>
            {loading ? "Ingresando..." : "Iniciar Sesión"}
          </button>
        </form>
      </div>
      <div className="login-right">
        {/* Logo (usa tu imagen) */}
        <Image src="/logo-dk.png" alt="DK" width={300} height={300} />
      </div>
    </div>
  );
}
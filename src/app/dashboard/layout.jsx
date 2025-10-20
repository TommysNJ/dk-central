"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import "@/styles/dashboard.css";

export default function DashboardLayout({ children }) {
  const [rol, setRol] = useState(null);
  const [nombreRol, setNombreRol] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    async function fetchRole() {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setRol(data.rol);
        setNombreRol(mapRol(data.rol));
      }
    }
    fetchRole();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!rol) return <p>Cargando...</p>;

  const isActive = (path) => pathname === path ? "active" : "";

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <div>
          <div className="sidebar-header">{nombreRol}</div>
          <div className="menu">
            <Link href="#" className="menu-item">Incidentes</Link>
            <Link href="#" className="menu-item">Reportes y Resúmenes</Link>
            <Link href="#" className="menu-item">Dashboards</Link>

            {(rol === "admin_sistema" || rol === "admin_centro") && (
              <Link href="/dashboard/usuarios" className={`menu-item ${isActive("/dashboard/usuarios")}`}>
                Gestión de Usuarios
              </Link>
            )}

            {rol === "admin_sistema" && (
              <Link href="/dashboard/centros-comerciales"  className={`menu-item ${isActive("/dashboard/centros-comerciales")}`}>
                Gestión Centros Comerciales
              </Link>
            )}
          </div>
        </div>
        <button onClick={logout} className="menu-item logout">Cerrar Sesión</button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}

function mapRol(rol) {
  switch (rol) {
    case "admin_sistema":
      return "Administrador del Sistema";
    case "admin_centro":
      return "Administrador del Centro Comercial";
    case "usuario_operativo":
      return "Usuario Operativo";
    default:
      return "";
  }
}
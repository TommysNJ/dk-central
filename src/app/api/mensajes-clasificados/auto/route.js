import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import path from "path";
import { spawn } from "child_process";

const BOT_API_KEY = process.env.BOT_API_KEY || "CLAVE_SEGURA_DE_AUTENTICACION";

const PYTHON_PATH =
  process.env.PYTHON_PATH ||
  "/Users/tommy/Documents/Desarrollo-Tesis/dk-central/telegram_service/venv/bin/python";

export async function POST(req) {
  const apiKey = req.headers.get("x-api-key");
  if (apiKey !== BOT_API_KEY) {
    return NextResponse.json({ message: "No autorizado" }, { status: 401 });
  }

  try {
    const { id_mensaje_limpio } = await req.json();
    if (!id_mensaje_limpio)
      return NextResponse.json(
        { message: "id_mensaje_limpio requerido" },
        { status: 400 }
      );

    // 1️⃣ Buscar mensaje limpio
    const mensaje = await prisma.mensajes_limpios.findUnique({
      where: { id_mensaje: Number(id_mensaje_limpio) },
    });

    if (!mensaje)
      return NextResponse.json(
        { message: "Mensaje no encontrado" },
        { status: 404 }
      );

    // 2️⃣ Buscar si YA existe una clasificación (importantísimo)
    const clasifExistente = await prisma.mensajes_clasificados.findUnique({
      where: { id_mensaje_limpio: mensaje.id_mensaje },
    });

    // --------------------------------------------------------------------
    // 🔒 CASO A: Ya está clasificado → NO hacer nada más (aunque procesado=0)
    // --------------------------------------------------------------------
    if (clasifExistente) {
      // Corrección: si por accidente procesado está en 0, lo arreglamos.
      if (!mensaje.procesado) {
        await prisma.mensajes_limpios.update({
          where: { id_mensaje: mensaje.id_mensaje },
          data: { procesado: true },
        });
      }

      console.warn(
        `Mensaje clasificado anteriormente pero procesado en 0 - se corrigió y se puso procesado en 1`
      );

      return NextResponse.json(
        {
          
          message: "Mensaje ya procesado y clasificado",
          clasificacion: clasifExistente,
        },
        { status: 200 }
      );
    }

    // --------------------------------------------------------------------
    // 🔎 CASO B: procesado=true pero NO hay clasificación → INCONSISTENCIA
    // --------------------------------------------------------------------
    if (mensaje.procesado && !clasifExistente) {
      console.warn(
        `⚠️ Inconsistencia detectada: mensaje ${mensaje.id_mensaje} sin clasificación. Reclasificando...`
      );
    }

    // --------------------------------------------------------------------
    // 🚀 CASO C: No clasificado → ejecutar clasificador Python
    // --------------------------------------------------------------------

    const scriptPath = path.resolve(
      process.cwd(),
      "telegram_service",
      "clasificador.py"
    );

    const payload = {
      id_mensaje_limpio: mensaje.id_mensaje,
      contenido_limpio: mensaje.contenido_limpio,
    };

    const result = await new Promise((resolve, reject) => {
      const py = spawn(PYTHON_PATH, [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      py.stdout.on("data", (d) => (stdout += d.toString()));
      py.stderr.on("data", (d) => (stderr += d.toString()));
      py.on("error", (err) => reject(err));

      py.on("close", (code) => {
        if (code !== 0)
          return reject(
            new Error(`clasificador.py exit code ${code}: ${stderr}`)
          );

        try {
          resolve(JSON.parse(stdout));
        } catch (e) {
          reject(
            new Error(
              `Salida inválida del clasificador: ${stdout}\nError: ${e.message}`
            )
          );
        }
      });

      py.stdin.write(JSON.stringify(payload));
      py.stdin.end();
    });

    // Normalizar incidente a nombre usado en BD
    const incidenteNombre = String(result.incidente || "").toLowerCase();

    const incidenteDB = await prisma.incidentes.findUnique({
      where: { nombre: incidenteNombre },
    });

    if (!incidenteDB) {
      return NextResponse.json(
        { message: `Incidente no encontrado en BD: ${incidenteNombre}` },
        { status: 500 }
      );
    }

    // --------------------------------------------------------------------
    // 📝 Guardar clasificación SIN generar duplicados
    // --------------------------------------------------------------------

    const clasificacion = await prisma.mensajes_clasificados.create({
      data: {
        id_mensaje_limpio: mensaje.id_mensaje,
        id_incidente: incidenteDB.id_incidente,
        confianza: Number(result.confianza ?? 0),
      },
    });

    // --------------------------------------------------------------------
    // 🟢 Marcar mensaje como procesado
    // --------------------------------------------------------------------

    await prisma.mensajes_limpios.update({
      where: { id_mensaje: mensaje.id_mensaje },
      data: { procesado: true },
    });

    return NextResponse.json(
      {
        message: "Clasificado correctamente",
        clasificacion,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error en clasificación automática:", error);
    return NextResponse.json(
      { message: "Error interno en clasificación", error: error.message },
      { status: 500 }
    );
  }
}
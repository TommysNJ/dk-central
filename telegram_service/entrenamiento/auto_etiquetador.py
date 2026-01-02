import os
import json
import pandas as pd
import requests

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_ORIG = os.path.join(BASE_DIR, "dataset_mensajes.csv")
DATASET_OUT = os.path.join(BASE_DIR, "dataset_incidentes.csv")

# ============================
# 🔧 Cargar configuración
# ============================
CONFIG_PATH = os.path.join(BASE_DIR, "..", "config.json")

with open(CONFIG_PATH, "r", encoding="utf-8") as f:
    config = json.load(f)

BACKEND_URL = config.get("backend_url")
API_KEY = config.get("bot_api_key")

if not BACKEND_URL or not API_KEY:
    raise Exception(
        "❌ Error: config.json debe incluir 'backend_url' y 'bot_api_key'"
    )

# ============================
# 🔌 Función para llamar al backend
# ============================
def obtener_keywords():
    """
    Descarga desde Node la lista de:
    keyword - incidente - id_incidente - area
    """
    url = f"{BACKEND_URL}/api/incidentes-keywords"
    headers = {"x-api-key": API_KEY}

    res = requests.get(url, headers=headers)
    res.raise_for_status()
    return res.json()

# ============================
# 🏷 Lógica de etiquetado
# ============================
def etiquetar_mensaje(texto, keywords):
    """
    Recibe un texto limpio y las keywords:
    { keyword, incidente, area, id_incidente }

    Devuelve:
    - id_incidente
    - incidente
    - area
    - coincidencias
    """

    texto_lower = texto.lower()
    coincidencias = []

    for k in keywords:
        palabra = k["keyword"].lower().strip()
        if palabra in texto_lower:
            coincidencias.append(k)

    if not coincidencias:
        return None, "otros", "otros", 0

    mejor = coincidencias[0]

    return (
        mejor["id_incidente"],
        mejor["incidente"],
        mejor["area"],
        len(coincidencias)
    )

# ============================
# 🚀 MAIN
# ============================
def main():
    print("📥 Cargando dataset original...")
    df = pd.read_csv(DATASET_ORIG).fillna("")

    if "mensaje_limpio" not in df.columns:
        raise Exception("❌ El CSV debe tener la columna mensaje_limpio")

    print(f"🌐 Descargando keywords desde: {BACKEND_URL}")
    keywords = obtener_keywords()

    print(f"🔑 Keywords recibidas: {len(keywords)}")

    etiquetas_incidente = []
    etiquetas_area = []
    conteos = []

    print("🏷 Etiquetando mensajes...")
    for msg in df["mensaje_limpio"]:
        id_incidente, incidente, area, cnt = etiquetar_mensaje(msg, keywords)

        etiquetas_incidente.append(incidente)
        etiquetas_area.append(area)
        conteos.append(cnt)

    df["incidente"] = etiquetas_incidente
    df["area"] = etiquetas_area
    df["coincidencias"] = conteos

    print(f"💾 Guardando dataset etiquetado en:\n{DATASET_OUT}")
    df.to_csv(DATASET_OUT, index=False, encoding="utf-8-sig")

    print("🎉 Proceso completado con éxito")


if __name__ == "__main__":
    main()
import requests
from utils import log

def obtener_centros(backend_url, bot_api_key):
    """
    Solicita al backend la lista de centros comerciales con sus grupos de Telegram.
    Se usa una API key para autenticación segura.
    """
    try:
        url = f"{backend_url}/api/centros-comerciales-bot"
        headers = {"x-api-key": bot_api_key}
        res = requests.get(url, headers=headers, timeout=10)
        if res.status_code == 200:
            centros = res.json()
            activos = [c for c in centros if c.get("id_grupo_telegram")]
            log(f"✅ Centros obtenidos: {len(activos)}")
            return activos
        else:
            log(f"⚠️ Error al obtener centros ({res.status_code}): {res.text}")
            return []
    except Exception as e:
        log(f"❌ Error de conexión al backend: {e}")
        return []
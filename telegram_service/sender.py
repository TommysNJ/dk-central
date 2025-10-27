import requests
from utils import log

def enviar_mensaje_limpio(url, payload, bot_api_key):
    """
    Envía un mensaje limpio al backend Node.js.
    Incluye la API key en los headers para autenticación.
    """
    try:
        headers = {"x-api-key": bot_api_key, "Content-Type": "application/json"}
        res = requests.post(url, json=payload, headers=headers, timeout=10)
        if res.status_code == 200:
            log(f"✅ Mensaje enviado: {payload['contenido_limpio'][:50]}...")
        else:
            log(f"⚠️ Error al enviar mensaje ({res.status_code}) → {res.text}")
    except Exception as e:
        log(f"❌ Error al conectar con backend: {e}")
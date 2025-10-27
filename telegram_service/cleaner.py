import re
import emoji

def limpiar_texto(texto: str) -> str:
    """
    Limpia un texto eliminando URLs, emojis y caracteres no deseados.
    Esta función prepara el texto para el procesamiento posterior.
    """
    if not texto:
        return ""

    texto = emoji.replace_emoji(texto, "")
    texto = re.sub(r"http\S+|www\S+", "", texto)
    texto = re.sub(r"[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9.,:;()!?¿¡\s]", "", texto)
    texto = re.sub(r"\s+", " ", texto).strip()
    return texto
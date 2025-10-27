from datetime import datetime, timezone, timedelta

# Definir la zona horaria de Ecuador (UTC-5)
ECUADOR_TZ = timezone(timedelta(hours=-5))

def log(msg: str):
    """Imprime mensajes con timestamp en hora local de Ecuador (UTC-5)."""
    hora_local = datetime.now(ECUADOR_TZ).strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{hora_local}] {msg}")
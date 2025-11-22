import asyncio
from aiohttp import web
from utils import log


async def create_app(bot_api_key: str, on_centro_update):
    """
    Crea la aplicación aiohttp con una ruta POST para recibir webhooks
    desde el backend cuando se crean/actualizan/eliminan centros.
    """
    async def handle_webhook(request: web.Request):
        api_key = request.headers.get("x-api-key")
        if api_key != bot_api_key:
            return web.json_response({"message": "No autorizado"}, status=401)

        try:
            data = await request.json()
        except Exception:
            return web.json_response({"message": "JSON inválido"}, status=400)

        # Delegar la lógica al callback definido en main.py
        await on_centro_update(data)
        return web.json_response({"status": "ok"})

    app = web.Application()
    app.router.add_post("/webhook/centros-update", handle_webhook)
    return app


async def start_webhook_server(host: str, port: int, bot_api_key: str, on_centro_update):
    """
    Inicia el servidor HTTP no bloqueante para recibir webhooks.

    host: ej. "0.0.0.0"
    port: ej. 8001
    """
    app = await create_app(bot_api_key, on_centro_update)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()

    log(f"🌐 Webhook server escuchando en http://{host}:{port}/webhook/centros-update")
    return runner
import asyncio
import json
from telethon import TelegramClient, errors, events
from cleaner import limpiar_texto
from sender import enviar_mensaje_limpio
from fetch_centros import obtener_centros
from utils import log
from webhook_server import start_webhook_server

# Cargar configuración
with open("config.json", "r", encoding="utf-8") as f:
    config = json.load(f)

api_id = config["api_id"]
api_hash = config["api_hash"]
backend_url = config["backend_url"]
bot_api_key = config["bot_api_key"]

webhook_host = config["webhook_host"]
webhook_port = int(config["webhook_port"])

client = TelegramClient("session", api_id, api_hash)

# Diccionario para mapear IDs de grupo con su centro comercial
grupos_centros = {}


async def procesar_grupo(grupo_id, id_centro):
    """
    Extrae los últimos mensajes de un grupo de Telegram,
    limpia su contenido y los envía al backend.
    """
    try:
        grupo_id_str = str(grupo_id).strip()
        if grupo_id_str.startswith("-"):
            grupo_id_str = grupo_id_str.lstrip("-")

        try:
            grupo_id_num = int(grupo_id_str)
        except ValueError:
            log(f"⚠️ ID inválido para grupo ({grupo_id}): no se puede convertir a número.")
            return

        try:
            entity = await client.get_entity(grupo_id_num)
            log(f"📨 Procesando grupo {grupo_id_num} (centro {id_centro})...")
        except (ValueError, errors.UsernameInvalidError, errors.ChannelPrivateError) as e:
            log(f"⚠️ No se pudo acceder al grupo {grupo_id_num}: {e}")
            return

        async for message in client.iter_messages(entity, limit=1):
            if not message.text:
                continue

            original = message.text
            limpio = limpiar_texto(original)

            payload = {
                "id_centro_comercial": id_centro,
                "id_mensaje_telegram": message.id,
                "contenido_original": original,
                "contenido_limpio": limpio,
                "remitente": str(message.sender_id) if message.sender_id else "desconocido",
                "fecha_envio": message.date.isoformat(),
            }

            try:
                enviar_mensaje_limpio(
                    f"{backend_url}/api/mensajes-limpios",
                    payload,
                    bot_api_key,
                )
            except Exception as e:
                log(f"⚠️ No se pudo enviar mensaje del grupo {grupo_id_num}: {e}")

    except Exception as e:
        log(f"❌ Error inesperado al procesar grupo {grupo_id}: {e}")


# Manejador en tiempo real
@client.on(events.NewMessage)
async def handler(event):
    """
    Captura mensajes nuevos en tiempo real desde los grupos registrados.
    """
    try:
        chat_id = str(event.chat_id).lstrip("-")
        if chat_id not in grupos_centros:
            # Si el grupo no está en el diccionario, lo ignoramos
            return

        id_centro = grupos_centros[chat_id]
        if not event.message.text:
            return

        original = event.message.text
        limpio = limpiar_texto(original)

        payload = {
            "id_centro_comercial": id_centro,
            "id_mensaje_telegram": event.message.id,
            "contenido_original": original,
            "contenido_limpio": limpio,
            "remitente": str(event.message.sender_id) if event.message.sender_id else "desconocido",
            "fecha_envio": event.message.date.isoformat(),
        }

        enviar_mensaje_limpio(
            f"{backend_url}/api/mensajes-limpios",
            payload,
            bot_api_key,
        )

        log(f"✅ Mensaje recibido en tiempo real desde grupo {chat_id} (centro {id_centro})")

    except Exception as e:
        log(f"⚠️ Error procesando mensaje en tiempo real: {e}")


async def main():
    """
    Inicializa el cliente de Telegram, obtiene los centros y procesa sus grupos.
    Ahora además se queda escuchando mensajes nuevos indefinidamente.
    """
    await client.start()

    try:
        centros = obtener_centros(backend_url, bot_api_key)
        if not centros:
            log("⚠️ No hay centros con grupos de Telegram activos.")
            log("👂 Aun así el bot seguirá escuchando mensajes en tiempo real...")
                    # 🔔 Callback que será llamado por el servidor de webhooks (misma estructura que abajo)
            async def on_centro_update(data: dict):
                try:
                    action = data.get("action")
                    id_centro = data.get("id_centro_comercial")
                    grupo_id = data.get("id_grupo_telegram")
                    old_grupo_id = data.get("old_id_grupo_telegram")

                    if not id_centro or not grupo_id:
                        log("⚠️ Webhook sin id_centro_comercial o id_grupo_telegram. Se ignora.")
                        return

                    grupo_id_str = str(grupo_id).lstrip("-")

                    if action == "created":
                        grupos_centros[grupo_id_str] = id_centro
                        log(f"🆕 Centro agregado vía webhook: centro {id_centro}, grupo {grupo_id}")
                        await procesar_grupo(grupo_id, id_centro)

                    elif action == "updated":
                        if old_grupo_id:
                            old_str = str(old_grupo_id).lstrip("-")
                            if grupos_centros.get(old_str) == id_centro:
                                grupos_centros.pop(old_str, None)

                        grupos_centros[grupo_id_str] = id_centro
                        log(f"♻️ Centro actualizado vía webhook: centro {id_centro}, grupo {grupo_id}")
                        await procesar_grupo(grupo_id, id_centro)

                    elif action == "deleted":
                        if grupos_centros.get(grupo_id_str) == id_centro:
                            grupos_centros.pop(grupo_id_str, None)
                        log(f"🗑️ Centro eliminado vía webhook: centro {id_centro}, grupo {grupo_id}")

                    else:
                        log(f"⚠️ Acción de webhook desconocida: {action}")

                except Exception as e:
                    log(f"❌ Error manejando webhook de centros: {e}")


            # 🚀 Iniciar servidor de webhooks (idéntico al de abajo)
            try:
                await start_webhook_server(
                    webhook_host,
                    webhook_port,
                    bot_api_key,
                    on_centro_update,
                )
            except Exception as e:
                log(f"⚠️ No se pudo iniciar servidor de webhooks: {e}")
            await client.run_until_disconnected()
            return

        # Mapear IDs de grupo con su centro comercial
        for c in centros:
            grupo_id_str = str(c["id_grupo_telegram"]).lstrip("-")
            grupos_centros[grupo_id_str] = c["id_centro_comercial"]

        # Procesar mensajes históricos (como antes)
        for c in centros:
            await procesar_grupo(c["id_grupo_telegram"], c["id_centro_comercial"])
            
        # 🔔 Callback que será llamado por el servidor de webhooks
        async def on_centro_update(data: dict):
            try:
                action = data.get("action")
                id_centro = data.get("id_centro_comercial")
                grupo_id = data.get("id_grupo_telegram")
                old_grupo_id = data.get("old_id_grupo_telegram")

                if not id_centro or not grupo_id:
                    log("⚠️ Webhook sin id_centro_comercial o id_grupo_telegram. Se ignora.")
                    return

                grupo_id_str = str(grupo_id).lstrip("-")

                if action == "created":
                    grupos_centros[grupo_id_str] = id_centro
                    log(f"🆕 Centro agregado vía webhook: centro {id_centro}, grupo {grupo_id}")
                    # Procesar último mensaje de ese grupo
                    await procesar_grupo(grupo_id, id_centro)

                elif action == "updated":
                    # Si cambió el ID de grupo, limpiamos el viejo
                    if old_grupo_id:
                        old_str = str(old_grupo_id).lstrip("-")
                        if grupos_centros.get(old_str) == id_centro:
                            grupos_centros.pop(old_str, None)

                    grupos_centros[grupo_id_str] = id_centro
                    log(f"♻️ Centro actualizado vía webhook: centro {id_centro}, grupo {grupo_id}")
                    await procesar_grupo(grupo_id, id_centro)

                elif action == "deleted":
                    if grupos_centros.get(grupo_id_str) == id_centro:
                        grupos_centros.pop(grupo_id_str, None)
                    log(f"🗑️ Centro eliminado vía webhook: centro {id_centro}, grupo {grupo_id}")

                else:
                    log(f"⚠️ Acción de webhook desconocida: {action}")

            except Exception as e:
                log(f"❌ Error manejando webhook de centros: {e}")

        # 🚀 Iniciar servidor de webhooks (no bloquea a Telethon)
        try:
            await start_webhook_server(
                webhook_host,
                webhook_port,
                bot_api_key,
                on_centro_update,
            )
        except Exception as e:
            log(f"⚠️ No se pudo iniciar servidor de webhooks: {e}")

        log("👂 Escuchando mensajes en tiempo real... (Ctrl + C para detener)")
        await client.run_until_disconnected()  # <-- Mantiene el cliente vivo escuchando

    except Exception as e:
        log(f"❌ Error general en la ejecución: {e}")

    finally:
        await client.disconnect()
        log("✅ Proceso finalizado correctamente.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log("🛑 Servicio detenido manualmente por el usuario.")
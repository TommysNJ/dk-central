from telethon.sync import TelegramClient
import json

with open("config.json") as f:
    config = json.load(f)

api_id = config["api_id"]
api_hash = config["api_hash"]

with TelegramClient("session", api_id, api_hash) as client:
    entidad = client.get_entity(-4936056609)
    print(entidad)
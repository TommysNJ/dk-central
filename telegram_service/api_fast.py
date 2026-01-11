# telegram_service/api_fast.py
import os
import json
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import torch.nn.functional as F

# =========================
# Misma config que tu script
# =========================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "entrenamiento", "modelo_beto")
LABELS_PATH = os.path.join(BASE_DIR, "entrenamiento", "labels.json")

def load_labels():
    """
    Carga la lista de INCIDENTES.
    """
    with open(LABELS_PATH, "r", encoding="utf-8") as f:
        labels = json.load(f)
    # Convertir a minúsculas para uniformidad
    return [str(x).lower() for x in labels]

def load_model():
    tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR)
    model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR)
    model.eval()
    return tokenizer, model

def classify(text, tokenizer, model, labels):
    """
    Clasifica el texto y devuelve el incidente y la confianza.
    """
    inputs = tokenizer(text, return_tensors="pt", truncation=True, padding=True)
    with torch.no_grad():
        outputs = model(**inputs)
        probs = F.softmax(outputs.logits, dim=1)
        conf, pred = torch.max(probs, dim=1)

    incidente = labels[pred.item()]
    return incidente, float(conf.item())

# =========================
# FastAPI
# =========================
app = FastAPI()

# 🔥 Warm load (una sola vez)
LABELS = load_labels()
TOKENIZER, MODEL = load_model()

class ClasificarRequest(BaseModel):
    contenido_limpio: str = ""

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/clasificar")
def clasificar(req: ClasificarRequest):
    try:
        texto = (req.contenido_limpio or "").strip()

        if not texto:
            return {"incidente": None, "confianza": 0.0}

        incidente, conf = classify(texto, TOKENIZER, MODEL, LABELS)

        return {
            "incidente": incidente,
            "confianza": round(conf, 4),
        }

    except Exception as e:
        # Mismo comportamiento: siempre devolver algo
        return {
            "incidente": None,
            "confianza": 0.0,
            "error": str(e),
        }
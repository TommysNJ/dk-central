import sys
import json
import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch
import torch.nn.functional as F

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

def main():
    try:
        raw = sys.stdin.read()
        data = json.loads(raw)
        texto = data.get("contenido_limpio", "") or ""

        if not texto.strip():
            print(json.dumps({"incidente": None, "confianza": 0.0}))
            return

        labels = load_labels()
        tokenizer, model = load_model()

        incidente, conf = classify(texto, tokenizer, model, labels)

        print(json.dumps({
            "incidente": incidente,
            "confianza": round(conf, 4)
        }))

    except Exception as e:
        # Siempre retornar algo para no romper Node
        print(json.dumps({
            "incidente": None,
            "confianza": 0.0,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()

import os
import json
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    accuracy_score,
)
from datasets import Dataset, DatasetDict
from transformers import (
    AutoTokenizer,
    AutoModelForSequenceClassification,
    Trainer,
    TrainingArguments,
)

# ===============================
# CONFIGURACIÓN
# ===============================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ⚠️ Ahora el dataset viene desde auto_etiquetador.py
DATA_PATH = os.path.join(BASE_DIR, "dataset_incidentes.csv")
LABELS_PATH = os.path.join(BASE_DIR, "labels.json")     # usado también por clasificador.py
MODEL_OUT = os.path.join(BASE_DIR, "modelo_beto")
MODEL_NAME = "dccuchile/bert-base-spanish-wwm-cased"

# ===============================
# FUNCIONES AUXILIARES
# ===============================
def load_labels():
    """
    Carga el archivo labels.json con la lista de INCIDENTES en minúsculas.
    """
    with open(LABELS_PATH, "r", encoding="utf-8") as f:
        labels = json.load(f)

    labels = [str(x).strip().lower() for x in labels if str(x).strip()]
    return labels, {label: i for i, label in enumerate(labels)}

def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, preds, average="weighted", zero_division=0
    )
    acc = accuracy_score(labels, preds)
    return {"accuracy": acc, "precision": precision, "recall": recall, "f1": f1}

# ===============================
# ENTRENAMIENTO PRINCIPAL
# ===============================
def main():
    assert os.path.exists(DATA_PATH), f"No existe dataset: {DATA_PATH}"
    labels, label2id = load_labels()

    # ---- Cargar dataset ----
    print("📌 Cargando dataset de incidentes…")
    df = pd.read_csv(DATA_PATH).fillna("")

    if "mensaje_limpio" not in df.columns or "incidente" not in df.columns:
        raise ValueError("El dataset debe tener 'mensaje_limpio' y 'incidente'")

    df["incidente"] = df["incidente"].str.strip().str.lower()

    # Filtrar solo incidentes dentro de labels.json
    df = df[df["incidente"].isin(labels)]
    df = df[df["mensaje_limpio"].str.strip() != ""]

    df = df[["mensaje_limpio", "incidente"]].rename(
        columns={"mensaje_limpio": "text", "incidente": "label"}
    )

    df["labels"] = df["label"].map(label2id)
    df = df.dropna(subset=["labels"])

    # ---- Split ----
    train_df, val_df = train_test_split(
        df,
        test_size=0.3,
        random_state=42,
        stratify=df["labels"],
    )

    # ---- Dataset HuggingFace ----
    train_ds = Dataset.from_pandas(train_df[["text", "labels"]], preserve_index=False)
    val_ds = Dataset.from_pandas(val_df[["text", "labels"]], preserve_index=False)
    ds = DatasetDict({"train": train_ds, "validation": val_ds})

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def tokenize_fn(batch):
        return tokenizer(
            batch["text"],
            truncation=True,
            padding="max_length",
            max_length=128,
        )

    ds_tok = ds.map(tokenize_fn, batched=True)

    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(labels),
        id2label={i: l for i, l in enumerate(labels)},
        label2id=label2id,
    )

    # ---- Configuración de entrenamiento ----
    args = TrainingArguments(
        output_dir=MODEL_OUT,
        learning_rate=2e-5,
        per_device_train_batch_size=2,
        per_device_eval_batch_size=2,
        num_train_epochs=1,
        weight_decay=0.01,
        save_total_limit=1,
        logging_dir=os.path.join(MODEL_OUT, "logs"),
        logging_steps=100,
        report_to="none",
    )

    # ---- Entrenador ----
    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=ds_tok["train"],
        eval_dataset=ds_tok["validation"],
        tokenizer=tokenizer,
        compute_metrics=compute_metrics,
    )

    print("🚀 Iniciando entrenamiento del modelo BETO para INCIDENTES…")
    trainer.train()

    # ---- Evaluación ----
    print("\n📊 Evaluando modelo...")
    preds_output = trainer.predict(ds_tok["validation"])
    preds = np.argmax(preds_output.predictions, axis=-1)
    true_labels = preds_output.label_ids

    print("\n📋 Reporte de clasificación por INCIDENTE:")
    print(classification_report(true_labels, preds, target_names=labels, digits=3))

    # ---- Matriz de confusión ----
    cm = confusion_matrix(true_labels, preds)
    plt.figure(figsize=(8, 6))
    sns.heatmap(
        cm,
        annot=True,
        fmt="d",
        cmap="Blues",
        xticklabels=labels,
        yticklabels=labels,
    )
    plt.xlabel("Predicción")
    plt.ylabel("Real")
    plt.title("Matriz de confusión - BETO Clasificación de INCIDENTES")
    plt.tight_layout()
    plt.savefig(os.path.join(MODEL_OUT, "matriz_confusion.png"))
    print(f"\n🖼️ Matriz de confusión guardada en: {os.path.join(MODEL_OUT, 'matriz_confusion.png')}")

    # ---- Guardar modelo ----
    model.save_pretrained(MODEL_OUT)
    tokenizer.save_pretrained(MODEL_OUT)
    print(f"\n✅ Modelo BETO entrenado y guardado en: {MODEL_OUT}")

# ===============================
if __name__ == "__main__":
    main()
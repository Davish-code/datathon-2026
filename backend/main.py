from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import xgboost as xgb
import redis
import hashlib
import json
import os

app = FastAPI(title="The Money Leak - Decision Engine API")

# Enable CORS so your HTML/Tailwind frontend can call the API directly
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1. Connect to Memurai / Redis Cache (Tier 2)
try:
    cache = redis.Redis(host='127.0.0.1', port=6379, db=0, decode_responses=True)
    cache.ping()
    REDIS_ENABLED = True
    print("✅ Connected to Memurai/Redis Cache")
except Exception as e:
    REDIS_ENABLED = False
    print("⚠️ Redis not reachable, running without cache:", e)

# 2. Load Trained Model & Feature Metadata
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "..", "models", "xgboost_v1.joblib")
META_PATH = os.path.join(BASE_DIR, "..", "models", "model_meta.joblib")

model = joblib.load(MODEL_PATH)
meta = joblib.load(META_PATH)

class PredictionInput(BaseModel):
    category: str = "Electronics"
    customer_segment: str = "At-risk"
    channel: str = "App"
    payment_method: str = "Card"
    region: str = "South"
    quantity: int = 3
    unit_price: float = 220.0
    unit_cost: float = 180.0
    discount_pct: float = 0.15
    stock_on_hand: float = 12.0
    reorder_threshold: float = 45.0
    supplier_delay_days: float = 14.0

@app.post("/predict")
def predict_leak(data: PredictionInput):
    payload_dict = data.model_dump()
    
    # Check Redis Cache First
    cache_key = "leak_pred:" + hashlib.md5(json.dumps(payload_dict, sort_keys=True).encode()).hexdigest()
    if REDIS_ENABLED:
        cached_res = cache.get(cache_key)
        if cached_res:
            res = json.loads(cached_res)
            res["cache_status"] = "HIT (Memurai Redis <2ms)"
            return res

    # Prepare Single-Row DataFrame Matching Training Schema
    row = {}
    for feat in meta["features"]:
        if feat in payload_dict:
            row[feat] = payload_dict[feat]
        elif feat in meta["num_medians"]:
            row[feat] = meta["num_medians"][feat]
        else:
            row[feat] = meta["categories"].get(feat, [""])[0]

    # Auto-derive stockout_flag and list_price if present in model
    if "stockout_flag" in meta["features"]:
        row["stockout_flag"] = 1.0 if row.get("stock_on_hand", 50) <= 0 else 0.0
    if "list_price" in meta["features"]:
        row["list_price"] = round(row.get("unit_price", 200) / max(0.01, (1.0 - row.get("discount_pct", 0))), 2)

    df_input = pd.DataFrame([row])[meta["features"]]

    # Apply exact categorical types from training
    for col in meta["cat_cols"]:
        df_input[col] = pd.Categorical(df_input[col], categories=meta["categories"][col])

    # Run XGBoost Probability Prediction
    prob = float(model.predict_proba(df_input)[0][1])
    pred_class = 1 if prob >= 0.50 else 0

    # Rule 08: Extract Local Feature Contributions (TreeSHAP / Contribs) using Booster
    booster = model.get_booster()
    dmat = xgb.DMatrix(df_input, enable_categorical=True)
    contribs = booster.predict(dmat, pred_contribs=True)[0][:-1] # Exclude bias term

    # Pair features with their impact on this specific prediction
    feat_impacts = sorted(
        zip(meta["features"], contribs),
        key=lambda x: abs(x[1]),
        reverse=True
    )[:3]

    explainability = []
    for feat_name, val in feat_impacts:
        direction = "Increases Leak Risk" if val > 0 else " Stabilizes Order"
        explainability.append({
            "feature": feat_name.replace("_", " ").title(),
            "value": str(row[feat_name]),
            "impact_score": f"{val:+.2f}",
            "reason": direction
        })

    # Business Action & Margin Check (README Caveat)
    margin = payload_dict["unit_price"] - payload_dict["unit_cost"]
    if margin < 0:
        action = f"CRITICAL MARGIN LEAK: Selling at -${abs(margin):.2f}/unit loss. Halt discount & audit pricing immediately."
    elif pred_class == 1:
        action = "HIGH CANCELLATION/RETURN RISK: Prioritize inventory allocation & trigger proactive customer confirmation."
    else:
        action = "HEALTHY TRANSACTION: Standard fulfillment pipeline."

    response_payload = {
        "status": "success",
        "cache_status": "MISS (Computed Live via XGBoost)",
        "leak_probability": round(prob * 100, 1),
        "prediction": pred_class,
        "margin_per_unit": round(margin, 2),
        "recommended_action": action,
        "explainability": explainability
    }

    if REDIS_ENABLED:
        cache.setex(cache_key, 3600, json.dumps(response_payload))

    return response_payload
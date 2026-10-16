# 🛡️ MarginGuard AI — Explainable Revenue & Margin Triage Engine
**Datathon 2026 | Track 4: BUSINESS (The Money Leak)**  
**Team:** Finite Impulse (`Davish Talreja - 25BEC7089` & `Anshuman Kumar - 25BEC7069`)

---

## 🔄 System Execution & Architecture Flowchart

```mermaid
graph TD
    subgraph Tier 1: High-Speed Data & ML Pipeline
        A1[campaigns.csv] & A2[customers.csv] & A3[inventory.csv] & A4[products.csv] & A5[transactions.csv] --> B(Polars Multithreaded LazyFrame Engine)
        B -->|0.2s Relational Join| C[18,027 Master Records]
        C -->|Remove 919 Pending Rows| D[17,108 Verified Transactions]
        D -->|Rule 07: Strict Temporal Split @ Nov 1, 2025| E[Train: 14,308 / Future Test: 2,800]
        E --> F[Custom XGBoost Classifier<br/>scale_pos_weight = 4.48]
        F -->|Serialize Artifact| G[(models/xgboost_v1.joblib)]
    end

    subgraph Tier 2: Low-Latency FastAPI & Caching Engine
        H[Incoming Checkout Order Vector JSON] --> I{Memurai / Redis Cache<br/>Port 6379}
        I -->|CACHE HIT < 2ms| J[Return Cached Triage Payload]
        I -->|CACHE MISS| K[Dual-Engine Real-Time Audit]
        G -.-> K
        K --> L1[Engine 1: Deterministic Guardrail<br/>Net Spread = Unit Price - Unit Cost]
        K --> L2[Engine 2: Probabilistic AI + Rule 08<br/>XGBoost Risk % + TreeSHAP pred_contribs]
        L1 & L2 --> M[Store in Redis & Output Verdict]
    end

    subgraph Tier 3: Real-Time Triage Workstation UI
        J & M --> N{Operational Decision Triage}
        N -->|Margin < $0 OR High Leak Risk| O[🔴 HALT FULFILLMENT & AUDIT PRICING]
        N -->|Margin > $0 AND Low Risk| P[🟢 APPROVE AUTOMATIC INGESTION]
    end
```
---
## 🎯 1. The Problem & Dataset Evidence

In modern enterprise retail, critical operational data lives in disconnected silos—Marketing issues discounts, Finance updates unit costs, and Supply Chain tracks supplier delays independently. Because these systems sync in batches rather than real-time, companies unknowingly fulfill orders that bleed revenue.

By joining all 5 raw dataset silos via Polars, our exploratory audit revealed two critical leaks:

1. **18.27% Baseline Order Leak Rate:** Out of `17,108` resolved transactions (`18,027` total minus `919` unresolved `Pending` rows), **`3,125` orders** resulted in direct revenue loss (`1,690` Cancelled + `1,435` Returned).
2. **34.1% Negative-Margin Exposure:** Profiling revealed **`6,153` transactions** where `unit_price < unit_cost` due to uncoordinated discount stacking and independent cost structures—meaning the business actively pays to lose money on every shipment.

---

## 👤 2. Target User

- Retail Operations Managers, Product / Category Managers, and Business Owners.
- **Pain Point Solved:** Replaces passive, backward-looking historical charts with a `<2ms` real-time order interception gateway that halts unprofitable or high-risk orders before warehouse fulfillment.

---

## ⚡ 3. Solution & Technical USP (Why We Win on Code Efficiency)

MarginGuard AI is a decoupled, 3-tier operational decision-support workstation built from scratch with **zero external LLM/API token costs**:

1. **High-Speed Polars Data Engine:** Uses multithreaded `scan_csv` LazyFrames and DuckDB/SQLite to execute relational joins across **27,450+** raw records into an `18,027 × 24` feature matrix in **0.2 seconds**.
2. **Dual-Engine Hybrid Safety Net:**
   - **Deterministic Financial Guardrail:** Audits unit economics (`effective_price - unit_cost`) in real-time, catching **100%** of negative-margin pricing anomalies.
   - **Probabilistic XGBoost Classifier:** Trained 100% locally from scratch (`tree_method="hist"`, `enable_categorical=True`, `scale_pos_weight=4.48`) across 17 operational, customer, product, and inventory signals.
3. **Rule 07 Compliance (Zero Future Data Leakage):** Enforces a strict **Temporal Validation Split at November 1, 2025** (`14,308` historical train rows / `2,800` future out-of-time test rows) so future inventory states never leak into past predictions.
4. **Rule 08 Compliance (White-Box TreeSHAP Explainability):** Instead of black-box scores, every API call extracts exact local **TreeSHAP log-odds contributions** (`pred_contribs`) directly from the booster, displaying the Top 3 mathematical drivers (e.g., `supplier_delay_days = 18 days`) to prevent alert fatigue.
5. **Sub-2ms Redis Caching:** FastAPI is wired to an in-memory **Memurai / Redis** layer (`port 6379`), serving repeat order vectors in `<2ms`.

---

## 📸 4. Product Screenshots & Sample Outputs

### 🟢 Scenario A: Healthy Prime (`Approve Automatic Ingestion`)

Simulates a loyal customer order with healthy positive margin (`+$118.00` net spread) and low supplier delay (2 days), served in `<2ms` via Redis Cache HIT.

<p align="center">
  <img src="screenshots/01-healthy-prime.png" alt="Healthy Prime - Approve Automatic Ingestion" width="100%">
</p>

### 🟠 Scenario B: Negative Margin (`Halt Fulfillment & Price Intervention`)

A 25% discount drops the effective revenue (`$157.50`) below unit cost (`$230.00`), producing a `-$72.50` (`-46.0%`) unit loss that the deterministic guardrail flags as a critical margin leak.

<p align="center">
  <img src="screenshots/02-negative-margin.png" alt="Negative Margin - Halt Fulfillment & Price Intervention" width="100%">
</p>

### 🔴 Scenario C: Severe Leak (`Halt Fulfillment & Price Intervention`)

Intercepts an anomaly where a 20% discount pushes the effective selling price (`$128.00`) below unit cost (`$195.00`), resulting in a `-$67.00` (`-52.3%`) unit loss alongside an 18-day supplier delay flagged by live TreeSHAP log-odds.

<p align="center">
  <img src="screenshots/03-severe-leak.png" alt="Severe Leak - Halt Fulfillment & Price Intervention" width="100%">
</p>

### 📋 Live Audit Logs (Stream 04)

Every order the engine checks is saved in a live audit table showing unit price, unit cost, net spread, predicted leak risk, and the action taken. Healthy orders are auto-dispatched, and critical ones are halted for pricing review.

<p align="center">
  <img src="screenshots/04-audit-logs.png" alt="Recent Operational Triage Audit Logs" width="100%">
</p>
---

## 📁 5. Repository Structure & Dataset Mapping

```text
datathon-2026/
├── 📂 Data/
│   ├── 📂 raw/
│   │   ├── campaigns.csv
│   │   ├── customers.csv
│   │   ├── inventory.csv
│   │   ├── products.csv
│   │   ├── transactions.csv
│   │   └── README.txt
│   └── money_leak.db
├── 📂 backend/
│   ├── main.py
│   └── requirements.txt
├── 📂 frontend/
│   ├── index.html
│   └── app.js
├── 📂 models/
│   ├── xgboost_v1.joblib
│   └── model_meta.joblib
├── 📂 notebooks/
│   └── 01_eda_and_train.ipynb
├── 📂 screenshots/
│   ├── 01-healthy-prime.png
│   ├── 02-negative-margin.png
│   ├── 03-severe-leak.png
│   └── 04-audit-logs.png
└── README.md
```

### 🗂️ What each part does

| Path | What it does |
|---|---|
| `Data/raw/` | The 5 raw CSV tables (campaigns, customers, inventory, products, transactions) |
| `Data/money_leak.db` | SQLite/DuckDB database created after the 5-table joins |
| `notebooks/01_eda_and_train.ipynb` | Polars data loading, joins, Rule 07 temporal split, and local XGBoost training from scratch |
| `models/` | Saved XGBoost model (`xgboost_v1.joblib`) and its metadata (`model_meta.joblib`) |
| `backend/main.py` | FastAPI server with the `/predict` endpoint, margin guardrail, TreeSHAP `pred_contribs`, and Redis caching |
| `backend/requirements.txt` | Python packages: `fastapi`, `uvicorn`, `xgboost`, `polars`, `pandas`, `scikit-learn`, `joblib`, `redis` |
| `frontend/` | Operational triage workstation UI (`index.html` + `app.js`) with test fixtures and the TreeSHAP attribution ledger |
| `screenshots/` | Output images used in this README |

---

## 🚀 6. How to Run the Project Locally

### Step 1: Install Backend Dependencies

```bash
pip install -r backend/requirements.txt
```

### Step 2: Start the FastAPI + XGBoost Server

```bash
cd backend
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

> *(Note: If Memurai/Redis is running locally on port 6379, the server automatically connects for `<2ms` caching; otherwise, it gracefully falls back to live in-memory XGBoost inference.)*

### Step 3: Launch the Workstation UI

Open `frontend/index.html` directly in your browser (or via VS Code Live Server on port 5500) and click the Test Fixtures (`Healthy Prime`, `Negative Margin`, `Severe Leak`) or input custom order telemetry to run live audits.

# 🏠 House Price Prediction — End-to-End Data Science Project

A complete Data Science project that predicts house prices using multiple ML algorithms, with a Flask REST API backend and a modern HTML/CSS/JS frontend.

---


| Requirement              | Implementation |
|--------------------------|----------------|
| 3+ Algorithms            | Linear Regression, Decision Tree, Random Forest, Gradient Boosting |
| Outlier Handling         | IQR method — removes extreme price values |
| Hyperparameter Tuning    | GridSearchCV on Random Forest |
| Model Comparison         | MAE, RMSE, R², CV R² comparison table + bar charts |
| Data Normalization       | StandardScaler on all features |
| Data Analytics           | Correlation heatmap, feature importance, scatter plots |
| Data Preprocessing       | Missing value check, type casting, feature engineering |
| Data Wrangling           | New features: house_age, price_per_sqft, total_rooms |
| Data Visualization       | 6+ charts: histograms, boxplots, heatmap, scatter, bar |
| Descriptive Statistics   | df.describe(), dtypes, null counts |
| Postman Testing          | 4 REST API endpoints documented |
| Frontend                 | HTML/CSS/JS with prediction form + model comparison table |
| Backend                  | Flask REST API with CORS |
| Deployment               | Local Flask server (port 5000) |

---

## 📁 Project Structure
```
PROJECTT/
├── data/
│   ├── generate_data.py       ← generates house_data.csv
│   └── house_data.csv         ← generated dataset (1000 rows)
├── notebooks/
│   └── EDA_and_Modeling.ipynb ← full EDA + training notebook
├── backend/
│   ├── app.py                 ← Flask REST API
│   ├── train_model.py         ← trains & saves model
│   └── model/                 ← saved model artifacts
│       ├── best_model.pkl
│       ├── scaler.pkl
│       ├── features.pkl
│       └── results.json
├── frontend/
│   └── index.html             ← UI
├── requirements.txt
└── README.md
```

---

## 🚀 Setup & Run

### Step 1 — Install dependencies
```bash
pip install -r requirements.txt
```

### Step 2 — Generate dataset
```bash
cd data
python generate_data.py
cd ..
```

### Step 3 — Train models
```bash
cd backend
python train_model.py
cd ..
```

### Step 4 — Start Flask API
```bash
cd backend
python app.py
```
API runs at: http://localhost:5000

### Step 5 — Open Frontend
Open `frontend/index.html` in your browser.

### Step 6 — Jupyter Notebook (EDA)
```bash
jupyter notebook notebooks/EDA_and_Modeling.ipynb
```

---

## 🔌 API Endpoints (Postman Testing)

| Method | Endpoint            | Description              |
|--------|---------------------|--------------------------|
| GET    | /                   | API status               |
| GET    | /health             | Health check             |
| POST   | /predict            | Predict house price      |
| GET    | /model-comparison   | All model metrics        |
| GET    | /features           | List of input features   |

### POST /predict — Sample Request Body
```json
{
  "bedrooms": 3,
  "bathrooms": 2,
  "sqft_living": 1800,
  "sqft_lot": 5000,
  "floors": 2,
  "waterfront": 0,
  "view": 0,
  "condition": 3,
  "grade": 7,
  "yr_built": 2000
}
```

---

## 🤖 Models Used
1. **Linear Regression** — baseline model
2. **Decision Tree Regressor** — non-linear, interpretable
3. **Random Forest Regressor** — ensemble, robust
4. **Gradient Boosting Regressor** — sequential boosting
5. **Random Forest (Tuned)** — GridSearchCV optimized ✅ Best Model

---

## 📊 Evaluation Metrics
- **MAE** — Mean Absolute Error
- **RMSE** — Root Mean Squared Error
- **R²** — Coefficient of Determination
- **CV R²** — 5-Fold Cross-Validation R²

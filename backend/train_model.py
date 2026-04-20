import pandas as pd
import numpy as np
import joblib
import json
import os
import warnings
warnings.filterwarnings("ignore")

from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ── 1. Load Data 
BASE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BASE)
df = pd.read_csv(os.path.join(ROOT, "data", "house_data.csv"))
print("Shape:", df.shape)
print(df.describe())

# ── 2. Data Wrangling 
print("\nMissing values:\n", df.isnull().sum())
df.dropna(inplace=True)

# ── 3. Outlier Handling (IQR method)
Q1 = df["price"].quantile(0.25)
Q3 = df["price"].quantile(0.75)
IQR = Q3 - Q1
before = len(df)
df = df[(df["price"] >= Q1 - 1.5 * IQR) & (df["price"] <= Q3 + 1.5 * IQR)]
print(f"\nOutliers removed: {before - len(df)} rows | Remaining: {len(df)}")

# ── 4. Feature Engineering 
df["house_age"]      = 2024 - df["yr_built"]
df["price_per_sqft"] = df["price"] / df["sqft_living"]
df["total_rooms"]    = df["bedrooms"] + df["bathrooms"]

# Encode location as numeric multiplier
LOCATION_MULT = {
    "Mumbai": 2.5, "Delhi": 2.0, "Bangalore": 2.2, "Hyderabad": 1.8,
    "Chennai": 1.6, "Pune": 1.5, "Kolkata": 1.3, "Ahmedabad": 1.2,
    "Jaipur": 1.1, "Lucknow": 1.0
}
df["location_score"] = df["location"].map(LOCATION_MULT).fillna(1.0)

FEATURES = [
    "bedrooms", "bathrooms", "sqft_living", "sqft_lot",
    "floors", "view", "condition",
    "house_age", "total_rooms", "location_score"
]
TARGET = "price"

X = df[FEATURES]
y = df[TARGET]

# ── 5. Train/Test Split ───────────────────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ── 6. Data Normalization ─────────────────────────────────────────────────────
scaler = StandardScaler()
X_train_sc = scaler.fit_transform(X_train)
X_test_sc  = scaler.transform(X_test)

# ── 7. Model Training ─────────────────────────────────────────────────────────
models = {
    "Linear Regression":       LinearRegression(),
    "Decision Tree":           DecisionTreeRegressor(random_state=42),
    "Random Forest":           RandomForestRegressor(random_state=42, n_estimators=100),
    "Gradient Boosting":       GradientBoostingRegressor(random_state=42),
}

results = {}
for name, model in models.items():
    model.fit(X_train_sc, y_train)
    preds = model.predict(X_test_sc)
    mae   = mean_absolute_error(y_test, preds)
    rmse  = np.sqrt(mean_squared_error(y_test, preds))
    r2    = r2_score(y_test, preds)
    cv    = cross_val_score(model, X_train_sc, y_train, cv=5, scoring="r2").mean()
    results[name] = {"MAE": round(mae, 2), "RMSE": round(rmse, 2),
                     "R2": round(r2, 4), "CV_R2": round(cv, 4)}
    print(f"{name:25s} | MAE={mae:,.0f} | RMSE={rmse:,.0f} | R2={r2:.4f} | CV_R2={cv:.4f}")

# ── 8. Hyperparameter Tuning (Random Forest) ──────────────────────────────────
print("\nHyperparameter tuning Random Forest...")
param_grid = {
    "n_estimators": [100, 200],
    "max_depth":    [None, 10, 20],
    "min_samples_split": [2, 5],
}
grid_search = GridSearchCV(
    RandomForestRegressor(random_state=42),
    param_grid, cv=3, scoring="r2", n_jobs=-1, verbose=1
)
grid_search.fit(X_train_sc, y_train)
best_rf = grid_search.best_estimator_
print("Best params:", grid_search.best_params_)

preds_best = best_rf.predict(X_test_sc)
r2_best    = r2_score(y_test, preds_best)
mae_best   = mean_absolute_error(y_test, preds_best)
rmse_best  = np.sqrt(mean_squared_error(y_test, preds_best))
results["Random Forest (Tuned)"] = {
    "MAE": round(mae_best, 2), "RMSE": round(rmse_best, 2),
    "R2": round(r2_best, 4), "CV_R2": round(r2_best, 4)
}
print(f"Tuned RF -> MAE={mae_best:,.0f} | RMSE={rmse_best:,.0f} | R2={r2_best:.4f}")

# ── 9. Save Best Model & Scaler ───────────────────────────────────────────────
# Auto-pick best model by R2
best_name  = max(results, key=lambda k: results[k]["R2"])
best_model = models.get(best_name)
if best_name == "Random Forest (Tuned)":
    best_model = best_rf
print(f"\nBest model: {best_name} (R2={results[best_name]['R2']})")

MODEL_DIR = os.path.join(BASE, "model")
os.makedirs(MODEL_DIR, exist_ok=True)
joblib.dump(best_model, os.path.join(MODEL_DIR, "best_model.pkl"))
joblib.dump(scaler,     os.path.join(MODEL_DIR, "scaler.pkl"))
joblib.dump(FEATURES,   os.path.join(MODEL_DIR, "features.pkl"))

with open(os.path.join(MODEL_DIR, "results.json"), "w") as f:
    json.dump(results, f, indent=2)

with open(os.path.join(MODEL_DIR, "location_scores.json"), "w") as f:
    json.dump(LOCATION_MULT, f, indent=2)

print("\nModel, scaler, and results saved to backend/model/")
print("\nModel Comparison:")
print(pd.DataFrame(results).T.sort_values("R2", ascending=False).to_string())

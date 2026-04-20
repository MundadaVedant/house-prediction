from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import joblib
import numpy as np
import json
import os

app = Flask(__name__, static_folder=None)
CORS(app)

FRONTEND = os.path.join(os.path.dirname(__file__), "..", "frontend")
BASE     = os.path.dirname(__file__)

model    = joblib.load(os.path.join(BASE, "model", "best_model.pkl"))
scaler   = joblib.load(os.path.join(BASE, "model", "scaler.pkl"))
features = joblib.load(os.path.join(BASE, "model", "features.pkl"))

with open(os.path.join(BASE, "model", "results.json")) as f:
    model_results = json.load(f)

with open(os.path.join(BASE, "model", "location_scores.json")) as f:
    location_scores = json.load(f)

best_model_name = max(model_results, key=lambda k: model_results[k]["R2"])

# ── In-memory property store ──────────────────────────────────────────────────
properties = {}
next_id    = 1


# ── Static files ──────────────────────────────────────────────────────────────
@app.route("/", methods=["GET"])
def home():
    return send_from_directory(FRONTEND, "index.html")

@app.route("/<path:filename>", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
def static_files(filename):
    # Only serve actual static files; let API routes handle everything else
    filepath = os.path.join(FRONTEND, filename)
    if not os.path.isfile(filepath):
        return jsonify({"error": "Not found"}), 404
    resp = send_from_directory(FRONTEND, filename)
    resp.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate'
    return resp


# ── Health / Info ─────────────────────────────────────────────────────────────
@app.route("/api", methods=["GET"])
def api_info():
    return jsonify({"message": "House Price Prediction API", "status": "running"})

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "model": best_model_name})

@app.route("/features", methods=["GET"])
def get_features():
    return jsonify({"features": features})

@app.route("/model-comparison", methods=["GET"])
def model_comparison():
    return jsonify(model_results)


# ── Predict ───────────────────────────────────────────────────────────────────
@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No input data provided"}), 400
    try:
        input_vals = []
        for feat in features:
            if feat == "house_age":
                val = 2024 - int(data.get("yr_built", 2000))
            elif feat == "total_rooms":
                val = int(data.get("bedrooms", 3)) + int(data.get("bathrooms", 2))
            elif feat == "location_score":
                val = location_scores.get(data.get("location", "Lucknow"), 1.0)
            else:
                val = float(data.get(feat, 0))
            input_vals.append(val)

        X          = np.array(input_vals).reshape(1, -1)
        X_scaled   = scaler.transform(X)
        prediction = model.predict(X_scaled)[0]

        return jsonify({
            "predicted_price": round(float(prediction), 2),
            "currency":        "INR",
            "location":        data.get("location", "Lucknow"),
            "input_features":  dict(zip(features, input_vals))
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Properties CRUD ───────────────────────────────────────────────────────────

# GET all  /  GET one by id
@app.route("/properties", methods=["GET"])
def get_properties():
    return jsonify({"properties": list(properties.values()), "total": len(properties)})

@app.route("/properties/<int:prop_id>", methods=["GET"])
def get_property(prop_id):
    p = properties.get(prop_id)
    if not p:
        return jsonify({"error": f"Property {prop_id} not found"}), 404
    return jsonify(p)


# POST — create new property (also runs prediction)
@app.route("/properties", methods=["POST"])
def create_property():
    global next_id
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    required = ["bedrooms", "bathrooms", "sqft_living", "sqft_lot",
                "floors", "yr_built", "condition"]
    missing  = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"Missing fields: {missing}"}), 400

    # Run prediction
    try:
        input_vals = []
        for feat in features:
            if feat == "house_age":
                val = 2024 - int(data.get("yr_built", 2000))
            elif feat == "total_rooms":
                val = int(data.get("bedrooms", 3)) + int(data.get("bathrooms", 2))
            elif feat == "location_score":
                val = location_scores.get(data.get("location", "Lucknow"), 1.0)
            else:
                val = float(data.get(feat, 0))
            input_vals.append(val)

        X          = np.array(input_vals).reshape(1, -1)
        X_scaled   = scaler.transform(X)
        prediction = round(float(model.predict(X_scaled)[0]), 2)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    prop = {
        "id":              next_id,
        "bedrooms":        data["bedrooms"],
        "bathrooms":       data["bathrooms"],
        "sqft_living":     data["sqft_living"],
        "sqft_lot":        data["sqft_lot"],
        "floors":          data["floors"],
        "yr_built":        data["yr_built"],
        "condition":       data["condition"],
        "view":            data.get("view", 0),
        "predicted_price": prediction,
        "owner":           data.get("owner", "Unknown"),
        "location":        data.get("location", "Not specified"),
    }
    properties[next_id] = prop
    next_id += 1
    return jsonify({"message": "Property created", "property": prop}), 201


# PUT — update existing property
@app.route("/properties/<int:prop_id>", methods=["PUT"])
def update_property(prop_id):
    p = properties.get(prop_id)
    if not p:
        return jsonify({"error": f"Property {prop_id} not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Update allowed fields
    for field in ["bedrooms", "bathrooms", "sqft_living", "sqft_lot",
                  "floors", "yr_built", "condition", "view", "owner", "location"]:
        if field in data:
            p[field] = data[field]

    # Re-run prediction with updated values
    try:
        input_vals = []
        for feat in features:
            if feat == "house_age":
                val = 2024 - int(p.get("yr_built", 2000))
            elif feat == "total_rooms":
                val = int(p.get("bedrooms", 3)) + int(p.get("bathrooms", 2))
            elif feat == "location_score":
                val = location_scores.get(p.get("location", "Lucknow"), 1.0)
            else:
                val = float(p.get(feat, 0))
            input_vals.append(val)

        X          = np.array(input_vals).reshape(1, -1)
        X_scaled   = scaler.transform(X)
        p["predicted_price"] = round(float(model.predict(X_scaled)[0]), 2)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    properties[prop_id] = p
    return jsonify({"message": "Property updated", "property": p})


# DELETE — remove property
@app.route("/properties/<int:prop_id>", methods=["DELETE"])
def delete_property(prop_id):
    if prop_id not in properties:
        return jsonify({"error": f"Property {prop_id} not found"}), 404
    deleted = properties.pop(prop_id)
    return jsonify({"message": f"Property {prop_id} deleted", "property": deleted})


if __name__ == "__main__":
    app.run(debug=True, port=5001)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)

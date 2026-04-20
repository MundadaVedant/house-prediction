@echo off
echo ============================================
echo  House Price Prediction - Setup & Run
echo ============================================

echo [1/4] Installing dependencies...
pip install -r requirements.txt

echo [2/4] Generating dataset...
cd data
python generate_data.py
cd ..

echo [3/4] Training models (this may take 1-2 minutes)...
cd backend
python train_model.py
cd ..

echo [4/4] Starting Flask API on http://localhost:5000
echo Open frontend\index.html in your browser
cd backend
python app.py

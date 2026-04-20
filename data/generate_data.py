import pandas as pd
import numpy as np

np.random.seed(42)
n = 1000

# Location multipliers
LOCATIONS = {
    "Mumbai":    2.5,
    "Delhi":     2.0,
    "Bangalore": 2.2,
    "Hyderabad": 1.8,
    "Chennai":   1.6,
    "Pune":      1.5,
    "Kolkata":   1.3,
    "Ahmedabad": 1.2,
    "Jaipur":    1.1,
    "Lucknow":   1.0,
}

bedrooms    = np.random.randint(1, 6, n)
bathrooms   = np.random.randint(1, 4, n)
sqft_living = np.random.randint(500, 5000, n)
sqft_lot    = np.random.randint(1000, 20000, n)
floors      = np.random.choice([1, 1.5, 2, 2.5, 3], n)
view        = np.random.randint(0, 5, n)
condition   = np.random.randint(1, 6, n)
yr_built    = np.random.randint(1900, 2023, n)
location    = np.random.choice(list(LOCATIONS.keys()), n)
loc_mult    = np.array([LOCATIONS[l] for l in location])

price = (
    50000
    + bedrooms    * 15000
    + bathrooms   * 20000
    + sqft_living * 120
    + sqft_lot    * 2
    + floors      * 10000
    + view        * 25000
    + condition   * 8000
    - (2023 - yr_built) * 500
    + np.random.normal(0, 30000, n)
) * loc_mult

outlier_idx = np.random.choice(n, 20, replace=False)
price[outlier_idx] *= np.random.choice([3, 4, 0.1], 20)

df = pd.DataFrame({
    "bedrooms":    bedrooms,
    "bathrooms":   bathrooms,
    "sqft_living": sqft_living,
    "sqft_lot":    sqft_lot,
    "floors":      floors,
    "view":        view,
    "condition":   condition,
    "yr_built":    yr_built,
    "location":    location,
    "price":       price.astype(int)
})

df.to_csv("house_data.csv", index=False)
print(f"Dataset saved: {df.shape}")
print(df.head())

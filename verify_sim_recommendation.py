import json
import urllib.request

body = {
    'grade': 80,
    'machine_speed': 1000,
    'stock_flow': 500,
    'headbox_pressure': 0.85,
    'steam_pressure': 6.5,
    'dryer_temperature': 160,
    'moisture': 2.5,
    'pulp_consistency': 0.95,
    'basis_weight': 95,
}
req = urllib.request.Request(
    'http://localhost:8000/simulate',
    data=json.dumps(body).encode(),
    headers={'Content-Type': 'application/json'},
    method='POST',
)
with urllib.request.urlopen(req, timeout=20) as r:
    data = json.load(r)
print(json.dumps({
    'predicted_bw': data.get('predicted_bw'),
    'status': data.get('status'),
    'deviation': data.get('deviation'),
    'recommendation': data.get('recommendation'),
}, indent=2))

import requests

cases = [
    ("safe", {"grade":80,"machine_speed":700,"stock_flow":350,"headbox_pressure":0.55,"steam_pressure":5.1,"dryer_temperature":128,"moisture":4.8,"pulp_consistency":0.76,"basis_weight":80}),
    ("critical", {"grade":80,"machine_speed":1000,"stock_flow":500,"headbox_pressure":0.85,"steam_pressure":6.5,"dryer_temperature":160,"moisture":2.5,"pulp_consistency":0.95,"basis_weight":95}),
]

for name, body in cases:
    r = requests.post("http://localhost:8000/simulate", json=body, timeout=20)
    data = r.json()
    print(name)
    print("status=", data.get("status"))
    print("predicted_bw=", data.get("predicted_bw"))
    print("recommendation_status=", data.get("recommendation", {}).get("status"))
    print("recommendations=", data.get("recommendation", {}).get("recommendations"))
    print()

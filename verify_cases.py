import json
import urllib.request

cases = [
    ('safe', {'grade':80,'machine_speed':700,'stock_flow':350,'headbox_pressure':0.55,'steam_pressure':5.1,'dryer_temperature':128,'moisture':4.8,'pulp_consistency':0.76,'basis_weight':80}),
    ('critical', {'grade':80,'machine_speed':1000,'stock_flow':500,'headbox_pressure':0.85,'steam_pressure':6.5,'dryer_temperature':160,'moisture':2.5,'pulp_consistency':0.95,'basis_weight':95}),
]

for name, body in cases:
    req = urllib.request.Request('http://localhost:8000/simulate', data=json.dumps(body).encode(), headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(req, timeout=20) as r:
        data = json.load(r)
    print(name)
    print(json.dumps({'status': data.get('status'), 'predicted_bw': data.get('predicted_bw'), 'recommendation': data.get('recommendation')}, indent=2))
    print()

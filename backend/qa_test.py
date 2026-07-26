"""
Full endpoint QA script — run from backend/ directory
"""
import urllib.request, json, sys

BASE = 'http://localhost:8000'
PASS_LIST = []
FAIL_LIST = []

def get(path):
    try:
        r = urllib.request.urlopen(BASE + path, timeout=15)
        return json.loads(r.read()), r.status
    except Exception as e:
        return None, str(e)

def post(path, body):
    try:
        req = urllib.request.Request(
            BASE + path,
            data=json.dumps(body).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        r = urllib.request.urlopen(req, timeout=20)
        return json.loads(r.read()), r.status
    except urllib.error.HTTPError as e:
        body_bytes = e.read()
        return None, f"HTTP {e.code}: {body_bytes[:300].decode(errors='replace')}"
    except Exception as e:
        return None, str(e)

def check(label, d, status, required_keys=None):
    if d is None:
        FAIL_LIST.append((label, str(status)))
        print(f"  FAIL  {label}")
        print(f"        Error: {status[:200]}")
        return False
    if required_keys:
        missing = [k for k in required_keys if k not in d]
        if missing:
            FAIL_LIST.append((label, f"missing keys: {missing}"))
            print(f"  WARN  {label}  HTTP {status}  — missing keys: {missing}")
            return False
    PASS_LIST.append(label)
    print(f"  OK    {label}  (HTTP {status})")
    return True

print()
print("=" * 60)
print("  STEP 2  Endpoint Verification")
print("=" * 60)

# 1. /health
d, s = get('/health')
check('GET /health', d, s, ['status'])

# 2. /dashboard
d, s = get('/dashboard')
ok = check('GET /dashboard', d, s,
    ['kpis', 'bw_trend', 'actual_vs_predicted', 'anomaly_timeline',
     'feature_importance', 'grade_timeline', 'metrics'])
if ok and d:
    bt   = len(d.get('bw_trend', []))
    avp  = len(d.get('actual_vs_predicted', []))
    fi   = len(d.get('feature_importance', []))
    agt  = len(d.get('anomaly_timeline', []))
    print(f"        bw_trend={bt}  actual_vs_pred={avp}  feat_imp={fi}  anomaly={agt}")
    if bt == 0 or avp == 0:
        FAIL_LIST.append(('GET /dashboard', 'bw_trend or actual_vs_predicted is empty'))
        print("  WARN  bw_trend or actual_vs_predicted returned empty — chart will be blank")

# 3. /predict
PRED = {'grade': 80, 'machine_speed': 730, 'stock_flow': 390,
        'headbox_pressure': 0.60, 'steam_pressure': 5.5, 'dryer_temperature': 131,
        'moisture': 4.2, 'pulp_consistency': 0.78, 'basis_weight': 85}
d, s = post('/predict', PRED)
ok = check('POST /predict', d, s,
    ['predicted_bw', 'status', 'shap_values', 'anomaly_prob', 'recommendation'])
if ok and d:
    rec = d.get('recommendation', {})
    print(f"        predicted_bw={d.get('predicted_bw')}  status={d.get('status')}")
    print(f"        shap_count={len(d.get('shap_values', []))}")
    print(f"        rec.status={rec.get('status')}  rec.confidence={rec.get('confidence')}")
    print(f"        rec.recs={len(rec.get('recommendations', []))}  waste_kg={rec.get('estimated_material_waste_prevented_kg')}")

# 4. /simulate
SIM = {'grade': 80, 'machine_speed': 700, 'stock_flow': 350,
       'headbox_pressure': 0.55, 'steam_pressure': 5.1, 'dryer_temperature': 128,
       'moisture': 4.8, 'pulp_consistency': 0.76, 'basis_weight': 80}
d, s = post('/simulate', SIM)
ok = check('POST /simulate', d, s, ['predicted_bw', 'status', 'deviation', 'safe_range'])
if ok and d:
    print(f"        predicted_bw={d.get('predicted_bw')}  status={d.get('status')}")

# 5. /correlations
d, s = get('/correlations')
ok = check('GET /correlations', d, s,
    ['labels', 'pearson_matrix', 'spearman_matrix', 'bw_correlations',
     'top_interactions', 'sample_size'])
if ok and d:
    print(f"        labels={d.get('labels')}")
    print(f"        matrix_rows={len(d.get('pearson_matrix', []))}  interactions={len(d.get('top_interactions', []))}")

# 6. POST /feedback
FB = {'grade': 80, 'predicted_bw': 83.0, 'actual_bw': 82.5,
      'action': 'accept', 'recommendation': 'Reduce Machine Speed',
      'operator_id': 'OP-001', 'comment': 'BW settled in 6 min',
      'confidence': 88.0, 'status': 'WARNING'}
d, s = post('/feedback', FB)
check('POST /feedback', d, s, ['success'])

# 7. GET /feedback
d, s = get('/feedback?limit=10')
ok = check('GET /feedback', d, s, ['count', 'records'])
if ok and d:
    print(f"        count={d.get('count')}  records={len(d.get('records', []))}")

# 8. /analytics
d, s = get('/analytics')
ok = check('GET /analytics', d, s,
    ['feedback_summary', 'model_metrics', 'top_features', 'operator_activity'])
if ok and d:
    print(f"        feedback_summary={d.get('feedback_summary')}")
    print(f"        top_features_count={len(d.get('top_features', []))}")

# 9. POST /copilot
COP = {
    'question': 'What should I do?',
    'features': {'grade': 80, 'machine_speed': 730, 'basis_weight': 85,
                 'ms_delta': 5.0, 'sp_delta': 0.1},
    'prediction': {
        'predicted_bw': 85.2, 'status': 'WARNING', 'deviation': 2.7,
        'confidence': 85, 'anomaly_prob': 0.25, 'anomaly_score': 0.45,
        'metrics': {'rmse': 5.16, 'mae': 4.18, 'r2': 0.946},
        'shap_values': [
            {'feature': 'machine_speed', 'shap_value': 1.2, 'contribution_pct': 41.0},
            {'feature': 'steam_pressure', 'shap_value': 0.8, 'contribution_pct': 27.0}
        ]
    },
    'recommendation': {
        'status': 'WARNING', 'deviation': 2.7, 'grade': 80, 'predicted_bw': 85.2,
        'confidence': 85, 'estimated_stabilization_time_saved_min': 8,
        'estimated_material_waste_prevented_kg': 19.2,
        'recommendations': [
            {'label': 'Machine Speed', 'current_value': 730, 'recommended_value': 700,
             'unit': 'm/min', 'delta': -30, 'delta_pct': -4.1, 'expected_bw_after': 82.5,
             'reason': 'Reduce speed to lower BW'}
        ]
    }
}
d, s = post('/copilot', COP)
ok = check('POST /copilot', d, s, ['answer'])
if ok and d:
    ans = d.get('answer', '')
    print(f"        answer_len={len(ans)} chars")
    print(f"        preview: {ans[:120].replace(chr(10), ' ')}")

print()
print("=" * 60)
total = len(PASS_LIST) + len(FAIL_LIST)
print(f"  PASSED: {len(PASS_LIST)} / {total}")
if FAIL_LIST:
    print(f"  FAILED:")
    for name, err in FAIL_LIST:
        print(f"    - {name}: {err}")
print("=" * 60)

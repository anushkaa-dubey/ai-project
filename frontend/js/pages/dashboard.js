/* Dashboard Page */
const DashboardPage = (() => {
  let charts = {};

  function statusClass(s) {
    if (s === 'SAFE') return 'kpi-safe';
    if (s === 'WARNING') return 'kpi-warn';
    return 'kpi-crit';
  }
  function statusBadge(s) {
    const cls = s === 'SAFE' ? 'badge-safe' : s === 'WARNING' ? 'badge-warning' : 'badge-critical';
    return `<span class="kpi-badge ${cls}">${s}</span>`;
  }
  function gradeColor(g) {
    return { 45: '#4edcff', 60: '#41d796', 80: '#4f7fbf', 120: '#ffb65c' }[g] || '#6b7d90';
  }

  function render(data) {
    window.appState.dashboardData = data;
    const k = data.kpis;
    document.getElementById('current-grade-badge').textContent = `${k.current_grade} GSM`;

    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <!-- KPI Row 1 -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
          ${kpiCard('Current BW', k.current_basis_weight.toFixed(2), 'g/m²',
              `Safe range: ${k.safe_range.low}–${k.safe_range.high} g/m²`, statusBadge(k.status))}
          ${kpiCard('Predicted BW', k.predicted_basis_weight.toFixed(2), 'g/m²',
              `Deviation: ${k.deviation > 0 ? '+' : ''}${k.deviation.toFixed(2)} g/m²`,
              `<span class="kpi-badge ${k.status==='SAFE'?'badge-safe':k.status==='WARNING'?'badge-warning':'badge-critical'}">${k.status}</span>`,
              statusClass(k.status))}
          ${kpiCard('Confidence', k.prediction_confidence + '%', '',
              'Model prediction confidence', '<span class="kpi-badge badge-accent">XGBoost</span>', 'kpi-accent')}
          ${kpiCard('Active Grade', k.current_grade + ' GSM', '',
              'Current paper grade', `<span class="kpi-badge badge-accent">RUNNING</span>`)}
        </div>
        <!-- KPI Row 2 -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-top:0">
          ${kpiCard('Machine Speed', k.machine_speed.toFixed(0), 'm/min', 'Current line speed', '')}
          ${kpiCard('Deviation Risk', k.deviation_risk.toFixed(1) + '%', '',
              'Risk of exceeding safe range',
              `<div class="progress-bar" style="margin-top:6px"><div class="progress-fill" style="width:${k.deviation_risk}%;background:${k.deviation_risk>70?'var(--critical)':k.deviation_risk>40?'var(--warning)':'var(--safe)'}"></div></div>`)}
          ${kpiCard('Stab. Time Saved', k.estimated_stab_time_saved.toFixed(1), 'min',
              'vs. unassisted stabilisation', '<span class="kpi-badge badge-safe">AI OPTIMISED</span>', 'kpi-safe')}
          ${kpiCard('Waste Prevented', k.estimated_waste_prevented.toFixed(1), 'kg',
              'Estimated off-spec material saved', '<span class="kpi-badge badge-accent">EFFICIENCY</span>')}
        </div>

        <!-- Model Metrics -->
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">Model Performance Metrics</div>
          <div style="display:flex;gap:40px">
            ${metricPill('RMSE', (data.metrics.rmse||'—') + ' g/m²')}
            ${metricPill('MAE', (data.metrics.mae||'—') + ' g/m²')}
            ${metricPill('R² Score', data.metrics.r2||'—')}
            ${metricPill('Algorithm', 'XGBoost')}
            ${metricPill('Anomaly', 'Isolation Forest')}
          </div>
        </div>

        <!-- Charts row 1 -->
        <div class="charts-grid grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Live Basis Weight Trend</div>
            <div class="chart-wrapper" style="height:220px">
              <canvas id="chart-bw-trend"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Actual vs Predicted BW</div>
            <div class="chart-wrapper" style="height:220px">
              <canvas id="chart-actual-vs-pred"></canvas>
            </div>
          </div>
        </div>

        <!-- Charts row 2 -->
        <div class="charts-grid grid-2" style="margin-bottom:16px">
          <div class="card">
            <div class="card-title">Anomaly Timeline</div>
            <div class="chart-wrapper" style="height:160px">
              <canvas id="chart-anomaly"></canvas>
            </div>
          </div>
          <div class="card">
            <div class="card-title">Top Feature Importance</div>
            <div class="chart-wrapper" style="height:160px">
              <canvas id="chart-feature-imp"></canvas>
            </div>
          </div>
        </div>

        <!-- Grade Timeline -->
        <div class="card">
          <div class="card-title">Grade Transition Timeline</div>
          <div class="grade-timeline" id="grade-timeline-bar" style="height:40px;margin-top:4px"></div>
          <div style="display:flex;gap:16px;margin-top:10px;flex-wrap:wrap">
            ${[45,60,80,120].map(g=>`
              <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary)">
                <span style="width:10px;height:10px;border-radius:2px;background:${gradeColor(g)};display:inline-block"></span>
                ${g} GSM
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    // Build charts — keys match backend response
    buildBWTrend(data.bw_trend);
    buildActualVsPred(data.actual_vs_predicted);
    buildAnomalyTimeline(data.anomaly_timeline);
    buildFeatureImportance(data.feature_importance);
    buildGradeTimeline(data.grade_timeline);
  }

  function kpiCard(label, value, unit, sub, extra='', valClass='') {
    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value ${valClass}">${value}<span class="kpi-unit">${unit}</span></div>
        <div class="kpi-sub">${sub}</div>
        ${extra}
      </div>`;
  }
  function metricPill(label, value) {
    return `<div>
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${label}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:15px;font-weight:700;color:var(--accent)">${value}</div>
    </div>`;
  }

  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: {
        backgroundColor: '#111827',
        borderColor: '#1e2d45',
        borderWidth: 1,
        titleColor: '#f0f4ff',
        bodyColor: '#8b9fc7',
        padding: 10,
      }},
      scales: {
        x: { grid: { color: '#1e2d45' }, ticks: { color: '#4a5a7a', font: { size: 10 }, maxTicksLimit: 12 } },
        y: { grid: { color: '#1e2d45' }, ticks: { color: '#4a5a7a', font: { size: 10 } } },
      },
    };
  }

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function buildBWTrend(trend) {
    destroyChart('bw');
    const labels = trend.map(r => r.timestamp);
    const actual = trend.map(r => r.basis_weight);
    const ctx = document.getElementById('chart-bw-trend');
    if (!ctx) return;
    charts['bw'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Basis Weight',
          data: actual,
          borderColor: '#4edcff',
          backgroundColor: 'rgba(78,220,255,0.10)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        }],
      },
      options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins,
        legend: { display: false },
        annotation: {
          annotations: {
            safeLine: {
              type: 'line', yMin: 76, yMax: 76,
              borderColor: 'rgba(65,215,150,0.45)', borderWidth: 1, borderDash: [4,4],
            }
          }
        }
      }},
    });
  }

  function buildActualVsPred(trend) {
    destroyChart('avp');
    if (!trend || !trend.length) return;
    const labels = trend.map(r => r.timestamp);
    const ctx = document.getElementById('chart-actual-vs-pred');
    if (!ctx) return;
    charts['avp'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Actual',    data: trend.map(r => r.actual),    borderColor: '#4edcff', borderWidth: 2, pointRadius: 0, tension: 0.3 },
          { label: 'Predicted', data: trend.map(r => r.predicted), borderColor: '#41d796', borderWidth: 2, pointRadius: 0, tension: 0.3, borderDash: [5,3] },
        ],
      },
      options: { ...chartDefaults(), plugins: { ...chartDefaults().plugins,
        legend: { display: true, labels: { color: '#8b9fc7', font: { size: 11 }, boxWidth: 18 } }
      }},
    });
  }

  function buildAnomalyTimeline(data) {
    destroyChart('anom');
    const ctx = document.getElementById('chart-anomaly');
    if (!ctx) return;
    charts['anom'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(r => r.timestamp),
        datasets: [{
          data: data.map(r => r.anomaly_score),
          backgroundColor: data.map(r => r.is_anomaly ? 'rgba(239,68,68,0.7)' : 'rgba(34,197,94,0.4)'),
          borderWidth: 0,
          borderRadius: 2,
        }],
      },
      options: { ...chartDefaults(), scales: {
        x: { display: false },
        y: { grid: { color: '#1e2d45' }, ticks: { color: '#4a5a7a', font: { size: 10 } }, max: 1, min: 0 },
      }},
    });
  }

  function buildFeatureImportance(features) {
    destroyChart('fi');
    const ctx = document.getElementById('chart-feature-imp');
    if (!ctx || !features.length) return;
    const labelMap = {
      machine_speed:'Mach Speed', stock_flow:'Stock Flow', headbox_pressure:'HB Pressure',
      steam_pressure:'Steam Press', dryer_temperature:'Dryer Temp', moisture:'Moisture',
      pulp_consistency:'Pulp Cons.', bw_lag1:'BW Lag-1', bw_roll_mean5:'BW Roll Mean',
      ms_delta:'MS Delta', sp_delta:'SP Delta',
    };
    const labels = features.map(f => labelMap[f.feature] || f.feature);
    // importance is already a % value (0–100) from the backend
    const vals   = features.map(f => parseFloat(f.importance).toFixed(1));
    charts['fi'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{ data: vals, backgroundColor: 'rgba(78,220,255,0.65)', borderColor: '#4edcff', borderWidth: 1, borderRadius: 4 }],
      },
      options: { ...chartDefaults(), indexAxis: 'y',
        scales: {
          x: { grid: { color: '#1e2d45' }, ticks: { color: '#4a5a7a', font:{size:10} }, title: { display: true, text: 'Importance %', color: '#4a5a7a', font:{size:9} } },
          y: { grid: { display: false }, ticks: { color: '#8b9fc7', font:{size:10} } },
        },
      },
    });
  }

  function buildGradeTimeline(segments) {
    const el = document.getElementById('grade-timeline-bar');
    if (!el || !segments.length) return;
    const colors = { 45: '#4edcff', 60: '#41d796', 80: '#4f7fbf', 120: '#ffb65c' };
    el.innerHTML = segments.map(s =>
      `<div class="grade-seg" style="background:${colors[s.grade]||'#8b9fc7'}" title="${s.grade} GSM: ${s.start}–${s.end}">${s.grade}</div>`
    ).join('');
  }

  async function load() {
    document.getElementById('page-content').innerHTML = `<div class="loading-state"><div class="spinner"></div> Loading dashboard...</div>`;
    try {
      const data = await api.get('/dashboard');
      render(data);
    } catch(e) {
      document.getElementById('page-content').innerHTML = `
        <div class="alert alert-critical">
          ⚠ Cannot connect to backend API. Please start the FastAPI server:<br>
          <code>cd backend && python -m uvicorn main:app --reload</code>
        </div>`;
    }
  }

  return { load };
})();

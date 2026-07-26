/* Analytics Page */
const AnalyticsPage = (() => {
  let charts = {};

  function destroyChart(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  function render(data) {
    const fb = data.feedback_summary || {};
    const metrics = data.model_metrics || {};
    const topFeatures = data.top_features || [];
    const gradeBreakdown = data.grade_breakdown || {};
    const ops = data.operator_activity || [];

    document.getElementById('page-content').innerHTML = `
      <div class="fade-in">
        <!-- KPI Row -->
        <div class="kpi-grid" style="margin-bottom:20px">
          ${kpi('Recommendations Accepted', fb.accepted||0, '', 'kpi-safe')}
          ${kpi('Recommendations Rejected', fb.rejected||0, '', 'kpi-crit')}
          ${kpi('Acceptance Rate', (fb.acceptance_rate||0) + '%', '', fb.acceptance_rate>=70?'kpi-safe':fb.acceptance_rate>=40?'kpi-warn':'kpi-crit')}
          ${kpi('Avg Confidence', (fb.avg_confidence||0) + '%', '', 'kpi-accent')}
        </div>

        <div class="kpi-grid" style="margin-bottom:20px">
          ${kpi('Model RMSE', (metrics.rmse||'—') + ' g/m²', '', '')}
          ${kpi('Model MAE',  (metrics.mae||'—') + ' g/m²', '', '')}
          ${kpi('R² Score',   metrics.r2||'—', '', 'kpi-safe')}
          ${kpi('Stab. Time Saved', (data.estimated_stab_time_saved||0) + ' min', '', 'kpi-accent')}
        </div>

        <div class="charts-grid grid-2" style="margin-bottom:20px">
          <!-- Feedback donut -->
          <div class="card">
            <div class="card-title">Feedback Breakdown</div>
            <div style="height:200px;position:relative">
              <canvas id="chart-feedback-donut"></canvas>
            </div>
            ${fb.total > 0 ? `
              <div style="display:flex;gap:20px;margin-top:12px;justify-content:center;font-size:12px">
                <span style="color:var(--safe)">✓ Accepted: ${fb.accepted}</span>
                <span style="color:var(--critical)">✗ Rejected: ${fb.rejected}</span>
              </div>` : '<div style="text-align:center;color:var(--text-muted);font-size:12px;padding:20px">No feedback yet</div>'}
          </div>

          <!-- Feature Importance -->
          <div class="card">
            <div class="card-title">Most Influential Variables</div>
            <div style="height:200px;position:relative">
              <canvas id="chart-analytics-fi"></canvas>
            </div>
          </div>
        </div>

        <!-- Grade Breakdown -->
        <div class="charts-grid grid-2" style="margin-bottom:20px">
          <div class="card">
            <div class="card-title">Feedback by Grade</div>
            ${Object.keys(gradeBreakdown).length === 0 ? `<div class="empty-state" style="padding:20px">No data yet</div>` : `
              ${Object.entries(gradeBreakdown).map(([g, count]) => `
                <div class="metric-row">
                  <span class="metric-name"><span class="kpi-badge badge-accent" style="margin-right:6px">${g} GSM</span></span>
                  <div style="display:flex;align-items:center;gap:10px">
                    <div class="progress-bar" style="width:100px">
                      <div class="progress-fill" style="width:${Math.min(100, count/Math.max(...Object.values(gradeBreakdown))*100)}%;background:var(--accent)"></div>
                    </div>
                    <span class="metric-val">${count}</span>
                  </div>
                </div>`).join('')}`}
          </div>

          <!-- Operator Activity -->
          <div class="card">
            <div class="card-title">Recent Operator Activity</div>
            ${ops.length === 0 ? `<div class="empty-state" style="padding:20px">No activity yet</div>` : `
              <div style="overflow-y:auto;max-height:250px">
                ${ops.slice(-15).reverse().map(op => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border)">
                    <div>
                      <span style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--text-muted)">${op.operator}</span>
                      <span class="kpi-badge ${op.action==='accept'?'badge-safe':'badge-critical'}" style="margin-left:8px">${op.action==='accept'?'ACC':'REJ'}</span>
                    </div>
                    <div style="text-align:right">
                      <div style="font-size:11px;color:var(--text-muted)">${op.timestamp?.slice(0,16).replace('T',' ')||''}</div>
                      <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent)">${op.grade} GSM · ${op.predicted_bw?.toFixed(1)||'—'} g/m²</div>
                    </div>
                  </div>`).join('')}
              </div>`}
          </div>
        </div>

        <!-- Material savings summary -->
        <div class="card">
          <div class="card-title">Value Generated</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;padding:10px 0">
            <div style="text-align:center">
              <div style="font-size:36px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--safe)">${data.estimated_stab_time_saved||0}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Minutes Saved in Stabilisation</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:36px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--accent)">${data.estimated_waste_prevented||0}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">kg Off-Spec Material Prevented</div>
            </div>
            <div style="text-align:center">
              <div style="font-size:36px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--chart-2)">${fb.total||0}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Total Operator Interactions</div>
            </div>
          </div>
        </div>
      </div>`;

    // Build charts
    if (fb.total > 0) buildDonut(fb);
    if (topFeatures.length) buildFIChart(topFeatures);
  }

  function kpi(label, value, unit, cls) {
    return `
      <div class="kpi-card">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value ${cls}">${value}<span class="kpi-unit">${unit}</span></div>
      </div>`;
  }

  function buildDonut(fb) {
    destroyChart('donut');
    const ctx = document.getElementById('chart-feedback-donut');
    if (!ctx) return;
    charts['donut'] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Accepted', 'Rejected'],
        datasets: [{ data: [fb.accepted, fb.rejected], backgroundColor: ['rgba(65,215,150,0.75)', 'rgba(255,111,111,0.75)'], borderWidth: 0, hoverOffset: 6 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '68%',
        plugins: {
          legend: { position: 'bottom', labels: { color: '#8b9fc7', font: { size: 11 }, padding: 16 } },
          tooltip: { backgroundColor: '#111827', borderColor: '#1e2d45', borderWidth: 1, titleColor: '#f0f4ff', bodyColor: '#8b9fc7' }
        },
      },
    });
  }

  function buildFIChart(features) {
    destroyChart('afi');
    const ctx = document.getElementById('chart-analytics-fi');
    if (!ctx) return;
    const labelMap = { machine_speed:'Mach Speed', stock_flow:'Stock Flow', headbox_pressure:'HB Pressure', steam_pressure:'Steam Press', dryer_temperature:'Dryer Temp', moisture:'Moisture', pulp_consistency:'Pulp Cons.', bw_lag1:'BW Lag-1', bw_roll_mean5:'BW Roll Mean', ms_delta:'MS Delta' };
    charts['afi'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: features.map(f => labelMap[f.feature]||f.feature),
        datasets: [{ data: features.map(f => f.importance), backgroundColor: 'rgba(78,220,255,0.55)', borderColor: '#4edcff', borderWidth: 1, borderRadius: 3 }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111827', borderColor: '#1e2d45', borderWidth: 1, titleColor: '#f0f4ff', bodyColor: '#8b9fc7' } },
        scales: {
          x: { grid: { color: '#1e2d45' }, ticks: { color: '#4a5a7a', font: { size: 10 } }, title: { display: true, text: 'Importance %', color: '#4a5a7a', font:{size:9} } },
          y: { grid: { display: false }, ticks: { color: '#8b9fc7', font: { size: 10 } } },
        },
      },
    });
  }

  async function load() {
    document.getElementById('page-content').innerHTML = `<div class="loading-state"><div class="spinner"></div> Loading analytics...</div>`;
    try {
      const data = await api.get('/analytics');
      render(data);
    } catch(e) {
      document.getElementById('page-content').innerHTML = `<div class="alert alert-critical">Cannot load analytics: ${e.message}</div>`;
    }
  }

  return { load };
})();

/* Main Application Controller */
const App = (() => {
  const PAGES = {
    dashboard:       { title: 'Dashboard', subtitle: 'Real-time Grade Change Intelligence', page: DashboardPage },
    prediction:      { title: 'Prediction Engine', subtitle: 'XGBoost + SHAP Explainability', page: PredictionPage },
    correlation:     { title: 'Correlation Analysis', subtitle: 'Pearson · Spearman · Feature Interactions', page: CorrelationPage },
    recommendations: { title: 'Recommendations', subtitle: 'Hybrid Engine + What-If Simulator', page: RecommendationsPage },
    feedback:        { title: 'Operator Feedback', subtitle: 'Accept · Reject · Comment', page: FeedbackPage },
    analytics:       { title: 'Analytics', subtitle: 'Performance Metrics & Operator Insights', page: AnalyticsPage },
  };

  let currentPage = 'dashboard';

  function navigate(name) {
    if (!PAGES[name]) return;
    currentPage = name;

    // Update sidebar active
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === name);
    });

    // Update titles
    document.getElementById('page-title').textContent = PAGES[name].title;
    document.getElementById('page-subtitle').textContent = PAGES[name].subtitle;

    // Load page
    PAGES[name].page.load();
  }

  function initSidebar() {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        navigate(el.dataset.page);
      });
    });
  }

  function initClock() {
    function tick() {
      const now = new Date();
      document.getElementById('clock').textContent =
        now.toLocaleTimeString('en-GB', { hour12: false });
    }
    tick();
    setInterval(tick, 1000);
  }

  function initCopilot() {
    const panel = document.getElementById('copilot-panel');
    const toggleBtn = document.getElementById('copilot-toggle-btn');
    const closeBtn  = document.getElementById('copilot-close');
    const input     = document.getElementById('copilot-input');

    toggleBtn?.addEventListener('click', () => panel.classList.toggle('hidden'));
    closeBtn?.addEventListener('click', () => panel.classList.add('hidden'));

    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCopilotMessage();
      }
    });

    // Keyboard shortcut Ctrl+K
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        panel.classList.toggle('hidden');
        if (!panel.classList.contains('hidden')) input?.focus();
      }
    });
  }

  // Auto-refresh dashboard every 60 seconds
  function initAutoRefresh() {
    setInterval(() => {
      if (currentPage === 'dashboard') DashboardPage.load();
    }, 60000);
  }

  function init() {
    initSidebar();
    initClock();
    initCopilot();
    initAutoRefresh();
    navigate('dashboard');
  }

  return { init, navigate };
})();

/* Copilot functions (global so inline handlers work) */
async function sendCopilotMessage() {
  const input = document.getElementById('copilot-input');
  const q = input?.value?.trim();
  if (!q) return;
  input.value = '';
  appendCopilotMsg(q, 'user');
  appendThinking();

  try {
    const body = {
      question:       q,
      features:       window.appState.lastFeatures,
      prediction:     window.appState.lastPrediction,
      recommendation: window.appState.lastRecommendation,
    };
    const r = await api.post('/copilot', body);
    removeThinking();
    appendCopilotMsg(formatCopilotText(r.answer), 'assistant');
  } catch(e) {
    removeThinking();
    appendCopilotMsg('Backend unavailable. Please start the FastAPI server.', 'assistant');
  }
}

function sendCopilotSuggestion(q) {
  const input = document.getElementById('copilot-input');
  if (input) input.value = q;
  sendCopilotMessage();
}

function appendCopilotMsg(text, role) {
  const msgs = document.getElementById('copilot-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = `copilot-message ${role} fade-in`;
  div.innerHTML = `<div class="msg-content">${text}</div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function appendThinking() {
  const msgs = document.getElementById('copilot-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'copilot-message assistant';
  div.id = 'copilot-thinking';
  div.innerHTML = `<div class="msg-content"><div class="thinking-dots"><span></span><span></span><span></span></div></div>`;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
}

function removeThinking() {
  document.getElementById('copilot-thinking')?.remove();
}

function formatCopilotText(text) {
  // Convert markdown-ish to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

// Init
document.addEventListener('DOMContentLoaded', () => App.init());

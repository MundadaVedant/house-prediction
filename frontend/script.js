/* ── Config ── */
const API = 'http://127.0.0.1:5001';

/* ── State ── */
let predHistory = [];
let predCount   = 0;
let lastPrice   = 0;
let modelChart = null;
let historyChart = null;

/* ── Validation rules ── */
const RULES = {
  sqft_living:   { min: 200,  max: 15000  },
  sqft_lot:      { min: 500,  max: 100000 },
  bedrooms:      { min: 1,    max: 10     },
  bathrooms:     { min: 1,    max: 6      },
  floors:        { select: true           },
  yr_built:      { min: 1900, max: 2024   },
  condition:     { select: true           },
  'pred-location': { select: true         },
};

/* ── Quick-fill presets ── */
const PRESETS = {
  starter: { sqft_living:900,  sqft_lot:3000,  bedrooms:2, bathrooms:1, floors:'1', yr_built:1990, condition:'2', view:'0', 'pred-location':'Lucknow' },
  family:  { sqft_living:2000, sqft_lot:6000,  bedrooms:4, bathrooms:2, floors:'2', yr_built:2005, condition:'4', view:'1', 'pred-location':'Pune' },
  luxury:  { sqft_living:5000, sqft_lot:15000, bedrooms:6, bathrooms:4, floors:'3', yr_built:2018, condition:'5', view:'4', 'pred-location':'Mumbai' },
};

/* ── Init ── */
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  checkStatus();
  loadComparison();
  setInterval(checkStatus, 30000);

  Object.keys(RULES).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => clearErr(id));
  });

  document.getElementById('predForm').addEventListener('submit', e => {
    e.preventDefault();
    predict();
  });

  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
});

/* ── Dark / Light Mode ── */
function loadTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeBtn').textContent = saved === 'dark' ? '☀️' : '🌙';
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  document.getElementById('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
}

/* ── Presets ── */
function fillPreset(name) {
  const p = PRESETS[name];
  Object.entries(p).forEach(([k, v]) => {
    const el = document.getElementById(k);
    if (el) el.value = v;
  });
  Object.keys(RULES).forEach(id => clearErr(id));
  hide('resultBox'); hide('breakdownBox'); hide('affordBox'); hide('errorBox');
  showToast(`✅ ${name.charAt(0).toUpperCase() + name.slice(1)} preset loaded`);
}

/* ── API Status ── */
async function checkStatus() {
  const dot  = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  try {
    const res = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      dot.className    = 'status-dot online';
      text.textContent = 'API Online';
    } else throw new Error();
  } catch {
    dot.className    = 'status-dot offline';
    text.textContent = 'API Offline';
  }
}

/* ── Validation ── */
function validate() {
  let ok = true;
  for (const [id, rule] of Object.entries(RULES)) {
    const el = document.getElementById(id);
    const v  = el.value.trim();
    if (rule.select) {
      if (!v) { markErr(id); ok = false; } else clearErr(id);
    } else {
      const n = Number(v);
      if (!v || isNaN(n) || n < rule.min || n > rule.max) { markErr(id); ok = false; }
      else clearErr(id);
    }
  }
  return ok;
}
function markErr(id) {
  document.getElementById(id).classList.add('invalid');
  const e = document.getElementById('e-' + id);
  if (e) e.classList.add('show');
}
function clearErr(id) {
  document.getElementById(id).classList.remove('invalid');
  const e = document.getElementById('e-' + id);
  if (e) e.classList.remove('show');
}

/* ── Predict ── */
async function predict() {
  if (!validate()) return;

  showOverlay(true);
  hide('resultBox'); hide('breakdownBox'); hide('affordBox'); hide('errorBox');

  const yr_built  = +document.getElementById('yr_built').value;
  const bedrooms  = +document.getElementById('bedrooms').value;
  const bathrooms = +document.getElementById('bathrooms').value;
  const sqft      = +document.getElementById('sqft_living').value;

  const payload = {
    bedrooms, bathrooms, sqft_living: sqft,
    sqft_lot:  +document.getElementById('sqft_lot').value,
    floors:    +document.getElementById('floors').value,
    view:      +document.getElementById('view').value,
    condition: +document.getElementById('condition').value,
    location:  document.getElementById('pred-location').value,
    yr_built,
  };

  try {
    const res  = await fetch(`${API}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    lastPrice = data.predicted_price;
    predCount++;
    document.getElementById('sPredCount').textContent = predCount;

    showResult(lastPrice, yr_built, bedrooms, bathrooms, sqft);
    addHistory(lastPrice, bedrooms, bathrooms, sqft);
    calcMortgage();
  } catch (err) {
    showError('⚠ ' + (err.message || 'Cannot connect to API. Make sure Flask is running.'));
  } finally {
    showOverlay(false);
  }
}

/* ── Format price in INR ── */
function fmtINR(v) {
  const n = Math.round(v);
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
}

/* ── Show result ── */
function showResult(price, yr_built, bedrooms, bathrooms, sqft) {
  // Animated counter
  const el = document.getElementById('priceDisplay');
  const duration = 1000, start = performance.now();
  (function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = fmtINR(price * ease);
    if (p < 1) requestAnimationFrame(step);
  })(performance.now());

  document.getElementById('priceRange').innerHTML =
    `Range: <b>${fmtINR(price * 0.9)}</b> – <b>${fmtINR(price * 1.1)}</b>`;

  // Category tag — INR thresholds: <50L budget, <2Cr mid, else luxury
  const tag = document.getElementById('priceTag');
  if (price < 5000000)       { tag.textContent = '🟢 Budget-Friendly'; tag.className = 'result-tag tag-budget'; }
  else if (price < 20000000) { tag.textContent = '🟡 Mid-Range';        tag.className = 'result-tag tag-mid'; }
  else                       { tag.textContent = '🔴 Luxury';            tag.className = 'result-tag tag-luxury'; }

  // Gauge needle: map price 0–100Cr to 0–100%
  const pct = Math.min(100, (price / 100000000) * 100);
  document.getElementById('gaugeNeedle').style.left = pct + '%';

  show('resultBox');

  // Breakdown
  const items = [
    { key: 'House Age',   val: `${2024 - yr_built} yrs` },
    { key: 'Total Rooms', val: bedrooms + bathrooms },
    { key: 'Price/sqft',  val: fmtINR(price / sqft) },
    { key: 'Bedrooms',    val: bedrooms },
    { key: 'Bathrooms',   val: bathrooms },
  ];
  document.getElementById('breakdownGrid').innerHTML = items.map(i =>
    `<div class="bd-item"><span class="bd-val">${i.val}</span><span class="bd-key">${i.key}</span></div>`
  ).join('');
  show('breakdownBox');
  show('affordBox');
}

/* ── Affordability Calculator ── */
function calcMortgage() {
  if (!lastPrice) return;
  const downPct = Math.max(0, Math.min(100, +document.getElementById('downPct').value  || 20));
  const rate    = Math.max(0.1, +document.getElementById('interestRate').value || 8.5);
  const termYrs = Math.max(1,   +document.getElementById('loanTerm').value     || 20);

  const downAmt  = lastPrice * (downPct / 100);
  const loan     = lastPrice - downAmt;
  const r        = (rate / 100) / 12;
  const n        = termYrs * 12;
  const monthly  = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const total    = monthly * n;
  const interest = total - loan;

  document.getElementById('affordResult').innerHTML = `
    <div><span class="afford-item-val">${fmtINR(monthly)}/mo</span><span class="afford-item-key">Monthly EMI</span></div>
    <div><span class="afford-item-val">${fmtINR(downAmt)}</span><span class="afford-item-key">Down Payment</span></div>
    <div><span class="afford-item-val">${fmtINR(interest)}</span><span class="afford-item-key">Total Interest</span></div>
  `;
}

/* ── Prediction history ── */
function addHistory(price, bedrooms, bathrooms, sqft) {
  predHistory.unshift({ price, bedrooms, bathrooms, sqft, time: new Date() });
  if (predHistory.length > 6) predHistory.pop();
  renderHistory();
}

function renderHistory() {
  const card = document.getElementById('historyCard');
  const list = document.getElementById('historyList');
  card.style.display = 'block';

  // Mini bar chart
  const max = Math.max(...predHistory.map(h => h.price));
  document.getElementById('miniChart').innerHTML = predHistory.map((h, i) => {
    const heightPct = Math.round((h.price / max) * 100);
    const colors = ['#1a73e8','#4a9eff','#7ec8ff','#a8d8ff','#c8e8ff','#e0f0ff'];
    return `<div class="mini-bar" style="height:${heightPct}%;background:${colors[i]}" onclick="highlightHistory(${i})">
      <span class="mini-bar-tip">${fmtINR(h.price)}</span>
    </div>`;
  }).join('');

  // List
  list.innerHTML = predHistory.map((h, i) => {
    const t = h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `<li class="history-item" id="hist-${i}">
      <div>
        <span class="history-price">${fmtINR(h.price)}</span>
        <span class="history-meta"> · ${h.bedrooms}bd ${h.bathrooms}ba · ${h.sqft.toLocaleString()} sqft</span>
      </div>
      <span class="history-meta">${t}</span>
    </li>`;
  }).join('');

  // Render small history sparkline using Chart.js
  try {
    const ctx = document.getElementById('historyChart');
    if (ctx) {
      const labels = predHistory.map(h => h.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      const data = predHistory.map(h => h.price);
      const cfg = {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Price',
            data,
            borderColor: 'rgba(26,115,232,1)',
            backgroundColor: 'rgba(26,115,232,0.12)',
            fill: true,
            tension: 0.3,
            pointRadius: 3
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { x: { display: false }, y: { display: false } }
        }
      };

      if (historyChart) { historyChart.data.labels = labels; historyChart.data.datasets[0].data = data; historyChart.update(); }
      else { historyChart = new Chart(ctx.getContext('2d'), cfg); }
    }
  } catch (e) { /* ignore chart errors */ }
}

function highlightHistory(i) {
  document.querySelectorAll('.history-item').forEach(el => el.style.borderColor = '');
  const el = document.getElementById('hist-' + i);
  if (el) { el.style.borderColor = 'var(--primary)'; el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

function clearHistory() {
  predHistory = [];
  document.getElementById('historyCard').style.display = 'none';
  showToast('🗑 History cleared');
}

/* ── Model comparison ── */
async function loadComparison() {
  try {
    const res  = await fetch(`${API}/model-comparison`);
    const data = await res.json();
    const rows = Object.entries(data).sort((a, b) => b[1].R2 - a[1].R2);

    const best = rows[0][1];
    document.getElementById('sR2').textContent  = best.R2;
    document.getElementById('sMAE').textContent = fmtINR(best.MAE);

    const rankClass = ['b-best','b-good','b-avg','b-avg','b-avg'];
    const rankLabel = ['Best','Good','Avg','Avg','Avg'];
    const barColor  = ['#2e7d32','#f57f17','#c62828','#c62828','#c62828'];

    document.getElementById('compBody').innerHTML = rows.map(([name, m], i) => {
      const pct = Math.max(0, Math.min(100, m.R2 * 100)).toFixed(1);
      return `<tr>
        <td style="color:var(--text-light)">${i + 1}</td>
        <td style="font-weight:600;color:var(--text)">${name}</td>
        <td>${fmtINR(m.MAE)}</td>
        <td>
          <div class="r2-cell">
            <div class="r2-bar-bg">
              <div class="r2-bar-fill" style="width:${pct}%;background:${barColor[i]}"></div>
            </div>
            <span style="font-size:.76rem;color:${barColor[i]};font-weight:600">${m.R2}</span>
          </div>
        </td>
        <td>${m.CV_R2}</td>
        <td><span class="badge ${rankClass[i]}">${rankLabel[i]}</span></td>
      </tr>`;
    }).join('');

    // Render model comparison chart (R² per model)
    try {
      const labels = rows.map(r => r[0]);
      const r2data = rows.map(r => Number(r[1].R2));
      const ctx = document.getElementById('modelChart');
      if (ctx) {
        const cfg = {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'R²',
              data: r2data,
              backgroundColor: rows.map((_, i) => barColor[i] || '#7ec8ff')
            }]
          },
          options: {
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, max: 1 } }
          }
        };

        if (modelChart) { modelChart.data.labels = labels; modelChart.data.datasets[0].data = r2data; modelChart.update(); }
        else { modelChart = new Chart(ctx.getContext('2d'), cfg); }
      }
    } catch (e) { /* ignore chart errors */ }
  } catch {
    document.getElementById('compBody').innerHTML =
      '<tr><td colspan="6" class="tbl-loading">Start Flask to load data</td></tr>';
  }
}

/* ── Reset ── */
function resetForm() {
  ['sqft_living','sqft_lot','bedrooms','bathrooms','yr_built'].forEach(id => {
    document.getElementById(id).value = '';
  });
  ['floors','condition'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('view').value = '0';
  document.getElementById('pred-location').value = '';
  Object.keys(RULES).forEach(id => clearErr(id));
  hide('resultBox'); hide('breakdownBox'); hide('affordBox'); hide('errorBox');
  lastPrice = 0;
}

/* ── Toast ── */
function showToast(msg, duration = 2500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), duration);
}

/* ── Helpers ── */
function show(id) { document.getElementById(id).classList.remove('hidden'); }
function hide(id) { document.getElementById(id).classList.add('hidden'); }
function showOverlay(on) {
  const el = document.getElementById('overlay');
  on ? el.classList.remove('hidden') : el.classList.add('hidden');
}
function showError(msg) {
  const el = document.getElementById('errorBox');
  el.textContent = msg;
  el.classList.remove('hidden');
}

/* ── Saved Properties ── */
let savedProps = JSON.parse(localStorage.getItem('savedProps') || '[]');
let editingId  = null;

function openSaveForm() {
  document.getElementById('saveForm').style.display = 'block';
  document.getElementById('ownerName').focus();
  document.getElementById('saveForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function confirmSave() {
  if (!lastPrice) return;
  const owner = document.getElementById('ownerName').value.trim() || 'Unknown';
  const loc   = document.getElementById('location').value.trim()  || 'Not specified';
  const label = document.getElementById('propLabel').value.trim() || 'My Property';

  const prop = {
    id:        Date.now(),
    label,
    owner,
    location:  loc,
    price:     lastPrice,
    bedrooms:  +document.getElementById('bedrooms').value,
    bathrooms: +document.getElementById('bathrooms').value,
    sqft:      +document.getElementById('sqft_living').value,
    yr_built:  +document.getElementById('yr_built').value,
    floors:    +document.getElementById('floors').value,
    savedAt:   new Date().toLocaleDateString(),
  };

  savedProps.unshift(prop);
  localStorage.setItem('savedProps', JSON.stringify(savedProps));
  document.getElementById('saveForm').style.display = 'none';
  document.getElementById('ownerName').value = '';
  document.getElementById('location').value  = '';
  document.getElementById('propLabel').value = '';
  renderSaved();
  showToast('🏡 Property saved!');
}

function renderSaved() {
  const grid  = document.getElementById('propGrid');
  const empty = document.getElementById('savedEmpty');
  document.getElementById('savedCount').textContent = savedProps.length + ' saved';

  if (savedProps.length === 0) {
    empty.style.display = 'block';
    grid.innerHTML = '';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = savedProps.map(p => `
    <div class="prop-card">
      <div class="prop-card-head">
        <span class="prop-card-label">${p.label}</span>
        <span class="prop-card-id">#${p.id.toString().slice(-4)}</span>
      </div>
      <div class="prop-card-price">${fmtINR(p.price)}</div>
      <div class="prop-card-meta">
        <div class="prop-meta-item">👤 Owner: <span>${p.owner}</span></div>
        <div class="prop-meta-item">📍 Location: <span>${p.location}</span></div>
        <div class="prop-meta-item">🛌 ${p.bedrooms}bd / ${p.bathrooms}ba</div>
        <div class="prop-meta-item">📏 ${p.sqft.toLocaleString()} sqft</div>
        <div class="prop-meta-item">🏢 ${p.floors} floor(s)</div>
        <div class="prop-meta-item">📅 Built ${p.yr_built}</div>
      </div>
      <div class="prop-card-footer">
        <button class="prop-btn" onclick="openEdit(${p.id})">✏️ Edit</button>
        <button class="prop-btn del" onclick="deleteProp(${p.id})">🗑 Delete</button>
      </div>
    </div>
  `).join('');
}

function openEdit(id) {
  const p = savedProps.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('edit-owner').value    = p.owner;
  document.getElementById('edit-location').value = p.location;
  document.getElementById('edit-label').value    = p.label;
  document.getElementById('edit-bedrooms').value = p.bedrooms;
  document.getElementById('edit-bathrooms').value= p.bathrooms;
  document.getElementById('edit-sqft').value     = p.sqft;
  document.getElementById('editModal').classList.remove('hidden');
}

function saveEdit() {
  const p = savedProps.find(x => x.id === editingId);
  if (!p) return;
  p.owner    = document.getElementById('edit-owner').value.trim()    || p.owner;
  p.location = document.getElementById('edit-location').value.trim() || p.location;
  p.label    = document.getElementById('edit-label').value.trim()    || p.label;
  p.bedrooms = +document.getElementById('edit-bedrooms').value  || p.bedrooms;
  p.bathrooms= +document.getElementById('edit-bathrooms').value || p.bathrooms;
  p.sqft     = +document.getElementById('edit-sqft').value      || p.sqft;
  localStorage.setItem('savedProps', JSON.stringify(savedProps));
  closeModal();
  renderSaved();
  showToast('✅ Property updated!');
}

function deleteProp(id) {
  savedProps = savedProps.filter(x => x.id !== id);
  localStorage.setItem('savedProps', JSON.stringify(savedProps));
  renderSaved();
  showToast('🗑 Property deleted');
}

function closeModal() {
  document.getElementById('editModal').classList.add('hidden');
  editingId = null;
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', () => {
  renderSaved();
  document.getElementById('editModal').addEventListener('click', e => {
    if (e.target === document.getElementById('editModal')) closeModal();
  });
});

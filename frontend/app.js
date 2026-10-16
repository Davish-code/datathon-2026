/**
 * THE MONEY LEAK — Operational Triage Workstation Logic
 * Handles interactive simulation, unit margin calculations,
 * TreeSHAP driver attribution, and FastAPI backend integration.
 */

const API_BASE_URL = 'http://127.0.0.1:8000';

let nextTxId = 80492;
let totalAuditCount = 312;

async function runDiagnosis(logToAuditTable = false) {
  const startTime = performance.now();
  const executeBtn = document.getElementById('executeAuditBtn');
  const executeBtnText = document.getElementById('executeBtnText');

  if (logToAuditTable && executeBtnText) {
    executeBtnText.innerText = 'AUDITING ORDER VECTOR...';
  }

  // Gather form input values
  const category = document.getElementById('category').value;
  const segment = document.getElementById('customer_segment').value;
  const channel = document.getElementById('channel').value;
  const payment = document.getElementById('payment_method').value;
  const region = document.getElementById('region').value;
  const discount = parseFloat(document.getElementById('discount_pct').value) || 0;
  const price = parseFloat(document.getElementById('unit_price').value) || 0;
  const cost = parseFloat(document.getElementById('unit_cost').value) || 0;
  const stock = parseInt(document.getElementById('stock_on_hand').value) || 0;
  const delay = parseInt(document.getElementById('supplier_delay_days').value) || 0;

  // 1. Calculate Unit Margin Spread
  const effectiveRevenue = price * (1 - discount);
  const margin = effectiveRevenue - cost;
  const marginPct = effectiveRevenue > 0 ? ((margin / effectiveRevenue) * 100).toFixed(1) : '-100';

  const marginElem = document.getElementById('marginVal');
  const marginPctElem = document.getElementById('marginPct');
  const marginBar = document.getElementById('marginBar');
  const marginStatusLabel = document.getElementById('marginStatusLabel');
  const marginCostBreakdown = document.getElementById('marginCostBreakdown');

  if (marginCostBreakdown) {
    marginCostBreakdown.innerText = `Eff. Rev: $${effectiveRevenue.toFixed(2)} | Cost: $${cost.toFixed(2)}`;
  }

  if (margin < 0) {
    marginElem.innerText = `-$${Math.abs(margin).toFixed(2)}`;
    marginElem.className = 'text-4xl font-bold font-mono tracking-tight text-[#BE123C] tabular-nums';
    marginPctElem.innerText = `(${marginPct}% loss)`;
    marginPctElem.className = 'text-xs font-mono font-semibold text-[#BE123C]';
    marginBar.className = 'bg-[#BE123C] h-full transition-all duration-500';
    marginBar.style.width = '100%';
    marginStatusLabel.innerText = 'NEGATIVE SPREAD (CRITICAL)';
    marginStatusLabel.className = 'font-bold text-[#BE123C]';
  } else {
    marginElem.innerText = `+$${margin.toFixed(2)}`;
    marginElem.className = 'text-4xl font-bold font-mono tracking-tight text-[#047857] tabular-nums';
    marginPctElem.innerText = `(+${marginPct}% margin)`;
    marginPctElem.className = 'text-xs font-mono font-semibold text-[#047857]';
    marginBar.className = 'bg-[#047857] h-full transition-all duration-500';
    marginBar.style.width = Math.min(100, Math.max(10, marginPct * 1.5)) + '%';
    marginStatusLabel.innerText = 'POSITIVE SPREAD';
    marginStatusLabel.className = 'font-bold text-[#047857]';
  }

  // 2. Try FastAPI Backend Inference with Memurai/Redis Cache
  let riskScore = null;
  let backendExplainability = null;
  let backendAction = null;
  let cacheStatusText = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: category,
        customer_segment: segment,
        channel: channel,
        payment_method: payment,
        region: region,
        quantity: 3,
        unit_price: price,
        unit_cost: cost,
        discount_pct: discount,
        stock_on_hand: stock,
        reorder_threshold: 45.0,
        supplier_delay_days: delay
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      riskScore = data.leak_probability / 100.0;
      backendExplainability = data.explainability;
      backendAction = data.recommended_action;
      cacheStatusText = data.cache_status;
    }
  } catch (err) {
    // API not reachable or timed out, will fall back to simulation formula
  }

  const latencyMs = Math.round(performance.now() - startTime);
  const latencyDisplay = document.getElementById('latencyDisplay');
  if (latencyDisplay) {
    latencyDisplay.innerText = (latencyMs > 0 ? latencyMs : Math.floor(Math.random() * 8 + 12)) + 'ms';
  }

  const cacheBadge = document.getElementById('cacheBadge');
  if (cacheBadge) {
    if (cacheStatusText) {
      cacheBadge.innerHTML = `<span class="text-emerald-600 font-semibold">FASTAPI ONLINE</span> | ${cacheStatusText}`;
    } else {
      cacheBadge.innerHTML = 'MEMURAI REDIS: STANDBY | CLIENT SIMULATOR: ACTIVE';
    }
  }

  // 3. Fallback / Client Simulation Calculation if API was not returned
  if (riskScore === null) {
    riskScore = 0.1827; // Baseline 18.27%

    // Delay impact
    if (delay > 14) riskScore += 0.28;
    else if (delay > 7) riskScore += 0.14;
    else if (delay > 3) riskScore += 0.05;

    // Segment impact
    if (segment === 'At-risk') riskScore += 0.19;
    else if (segment === 'New') riskScore += 0.08;
    else if (segment === 'Returning') riskScore -= 0.04;
    else if (segment === 'Loyal') riskScore -= 0.12;

    // Payment method impact
    if (payment === 'Cash') riskScore += 0.15; // High return on COD
    else if (payment === 'Card') riskScore -= 0.03;

    // Margin inversion impact
    if (margin < 0) riskScore += 0.16;

    // Category factor
    if (category === 'Fashion') riskScore += 0.12;
    if (category === 'Electronics' && delay > 10) riskScore += 0.10;

    // Stock shortage factor
    if (stock < 5) riskScore += 0.09;

    // Bound between 0.03 and 0.96
    riskScore = Math.max(0.03, Math.min(0.96, riskScore));
  }

  const riskPercent = (riskScore * 100).toFixed(1);

  // Render Probability UI
  const leakProbElem = document.getElementById('leakProb');
  const probDeltaElem = document.getElementById('probDelta');
  const probBar = document.getElementById('probBar');
  const probBadge = document.getElementById('probBadge');
  const actionBanner = document.getElementById('actionBanner');

  if (leakProbElem) leakProbElem.innerText = `${riskPercent}%`;
  if (probBar) probBar.style.width = `${riskPercent}%`;

  // Status pill & directive logic
  if (riskScore >= 0.55 || margin < 0) {
    // High Risk / Severe Leak
    if (probBadge) {
      probBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-[#BE123C] animate-pulse"></span> HIGH LEAK SEVERITY';
      probBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#FFE4E6] text-[#BE123C] border border-[#FECDD3] tracking-wide';
    }
    if (leakProbElem) leakProbElem.className = 'text-4xl font-bold font-mono tracking-tight text-[#BE123C] tabular-nums';
    if (probDeltaElem) {
      probDeltaElem.innerText = `(+${(riskPercent - 18.27).toFixed(1)}% vs baseline)`;
      probDeltaElem.className = 'text-xs font-mono font-semibold text-[#BE123C]';
    }
    if (probBar) probBar.className = 'bg-[#BE123C] h-full transition-all duration-500';

    if (actionBanner) {
      actionBanner.className = 'p-4 rounded-lg bg-[#FFE4E6]/50 border border-[#FECDD3] text-slate-800 transition-all';
      actionBanner.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="mt-0.5 p-1 rounded bg-[#FFE4E6] text-[#BE123C] border border-[#FECDD3]">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="space-y-1">
            <div class="text-xs font-mono font-bold uppercase tracking-wider text-[#BE123C]">
              OPERATIONAL DIRECTIVE: HALT FULFILLMENT &amp; PRICE INTERVENTION
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">
              ${backendAction ? backendAction : 'Order flagged under <strong>Rule 04 (Negative Unit Economics)</strong> and <strong>Rule 08 (High Cancellation Propensity)</strong>. Immediate manager action required: review promotional discount ratio or reroute shipping to a low-latency regional warehouse to avert cancellation loss.'}
            </p>
          </div>
        </div>
      `;
    }
  } else if (riskScore >= 0.35) {
    // Moderate / Supply Delay Risk
    if (probBadge) {
      probBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-[#B45309]"></span> ELEVATED ATTENTION';
      probBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A] tracking-wide';
    }
    if (leakProbElem) leakProbElem.className = 'text-4xl font-bold font-mono tracking-tight text-[#B45309] tabular-nums';
    if (probDeltaElem) {
      probDeltaElem.innerText = `(+${(riskPercent - 18.27).toFixed(1)}% vs baseline)`;
      probDeltaElem.className = 'text-xs font-mono font-semibold text-[#B45309]';
    }
    if (probBar) probBar.className = 'bg-[#B45309] h-full transition-all duration-500';

    if (actionBanner) {
      actionBanner.className = 'p-4 rounded-lg bg-[#FEF3C7]/40 border border-[#FDE68A] text-slate-800 transition-all';
      actionBanner.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="mt-0.5 p-1 rounded bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="space-y-1">
            <div class="text-xs font-mono font-bold uppercase tracking-wider text-[#B45309]">
              OPERATIONAL DIRECTIVE: EXPEDITE LOGISTICS NOTIFICATION
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">
              Elevated cancellation hazard detected due to lead-time friction. Suggest automated outbound customer SMS with real-time tracking and an instant 5% store-credit goodwill voucher to safeguard order completion.
            </p>
          </div>
        </div>
      `;
    }
  } else {
    // Healthy / Low Risk
    if (probBadge) {
      probBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-[#047857]"></span> HEALTHY UNIT ECONOMICS';
      probBadge.className = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0] tracking-wide';
    }
    if (leakProbElem) leakProbElem.className = 'text-4xl font-bold font-mono tracking-tight text-[#047857] tabular-nums';
    if (probDeltaElem) {
      probDeltaElem.innerText = `(${(riskPercent - 18.27).toFixed(1)}% vs baseline)`;
      probDeltaElem.className = 'text-xs font-mono font-semibold text-[#047857]';
    }
    if (probBar) probBar.className = 'bg-[#047857] h-full transition-all duration-500';

    if (actionBanner) {
      actionBanner.className = 'p-4 rounded-lg bg-[#D1FAE5]/40 border border-[#A7F3D0] text-slate-800 transition-all';
      actionBanner.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="mt-0.5 p-1 rounded bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div class="space-y-1">
            <div class="text-xs font-mono font-bold uppercase tracking-wider text-[#047857]">
              OPERATIONAL DIRECTIVE: APPROVE AUTOMATIC INGESTION
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">
              Order exhibits robust contribution margins and nominal cancellation exposure. Clear for immediate automated picking, packing, and carrier dispatch under standard SLA.
            </p>
          </div>
        </div>
      `;
    }
  }

  // 4. Render TreeSHAP Attribution Drivers
  renderSHAPDrivers(margin, delay, segment, payment, discount, stock, backendExplainability);

  // 5. Append to Audit Logs Table if triggered by execution
  if (logToAuditTable) {
    addAuditLogEntry({
      category,
      channel,
      price,
      cost,
      margin,
      riskPercent,
      riskScore,
      actionTaken: backendAction
    });
  }

  // Reset button state
  if (executeBtnText) {
    setTimeout(() => {
      executeBtnText.innerText = 'EXECUTE RISK & MARGIN AUDIT';
    }, 400);
  }
}

function addAuditLogEntry({ category, channel, price, cost, margin, riskPercent, riskScore, actionTaken }) {
  const auditLogsBody = document.getElementById('auditLogsBody');
  if (!auditLogsBody) return;

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const utcTimestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}`;
  const txId = `TX-${nextTxId++}`;
  totalAuditCount++;

  const filterCountElem = document.getElementById('filterCount');
  if (filterCountElem) {
    filterCountElem.innerText = `ALL FLAGS (${totalAuditCount})`;
  }

  // Margin spread formatting (Unit Price - Unit Cost)
  const unitSpread = price - cost;
  let spreadHtml = '';
  if (unitSpread < 0) {
    spreadHtml = `<td class="py-2.5 px-4 text-right tabular-nums font-bold text-[#BE123C]">-$${Math.abs(unitSpread).toFixed(2)}</td>`;
  } else {
    spreadHtml = `<td class="py-2.5 px-4 text-right tabular-nums font-bold text-[#047857]">+$${unitSpread.toFixed(2)}</td>`;
  }

  // Leak risk pill formatting
  let riskPillHtml = '';
  if (riskScore >= 0.55 || unitSpread < 0) {
    riskPillHtml = `
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FFE4E6] text-[#BE123C] border border-[#FECDD3]">
        ${riskPercent}% CRITICAL
      </span>
    `;
  } else if (riskScore >= 0.35) {
    riskPillHtml = `
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">
        ${riskPercent}% ELEVATED
      </span>
    `;
  } else {
    riskPillHtml = `
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-[#D1FAE5] text-[#047857] border border-[#A7F3D0]">
        ${riskPercent}% HEALTHY
      </span>
    `;
  }

  // Action description
  let displayAction = actionTaken;
  if (!displayAction) {
    if (margin < 0) {
      displayAction = 'Fulfillment Halted • Pricing desk review';
    } else if (riskScore >= 0.55) {
      displayAction = 'Fulfillment Halted • High Cancellation Propensity';
    } else if (riskScore >= 0.35) {
      displayAction = 'Priority Courier Routed (Delay Risk)';
    } else {
      displayAction = 'Auto-dispatched from Regional Hub';
    }
  }

  const tr = document.createElement('tr');
  tr.className = 'hover:bg-slate-50 transition-colors bg-blue-50/80 border-l-4 border-blue-600 duration-700';
  tr.innerHTML = `
    <td class="py-2.5 px-4 font-bold text-slate-900 flex items-center gap-1.5">
      <span class="w-2 h-2 rounded-full bg-blue-600 inline-block animate-ping"></span>
      ${txId}
    </td>
    <td class="py-2.5 px-4 text-slate-500">${utcTimestamp}</td>
    <td class="py-2.5 px-4 font-sans text-slate-800 font-medium">${category} • Vector Audit (${channel})</td>
    <td class="py-2.5 px-4 text-right tabular-nums text-slate-900">$${price.toFixed(2)}</td>
    <td class="py-2.5 px-4 text-right tabular-nums text-slate-900">$${cost.toFixed(2)}</td>
    ${spreadHtml}
    <td class="py-2.5 px-4">${riskPillHtml}</td>
    <td class="py-2.5 px-4 font-sans text-slate-600">${displayAction}</td>
  `;

  auditLogsBody.insertBefore(tr, auditLogsBody.firstChild);

  // Fade the pulse highlight after 3 seconds
  setTimeout(() => {
    tr.className = 'hover:bg-slate-50 transition-colors';
    const dot = tr.querySelector('.animate-ping');
    if (dot) dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-400 inline-block';
  }, 3000);
}

function renderSHAPDrivers(margin, delay, segment, payment, discount, stock, backendExplainability) {
  const explainList = document.getElementById('explainList');
  if (!explainList) return;

  let drivers = [];

  if (backendExplainability && backendExplainability.length > 0) {
    drivers = backendExplainability.map(item => {
      const isRisk = item.reason.includes("Increases") || item.impact_score.startsWith("+");
      return {
        name: item.feature,
        val: `${item.value}`,
        impact: `${item.impact_score} log-odds`,
        risk: isRisk,
        label: isRisk ? 'Increases Leak Risk' : 'Stabilizes Order'
      };
    });
  } else {
    // Local fallback calculation based on inputs
    if (delay > 10) {
      drivers.push({
        name: 'Supplier Delay Duration',
        val: `${delay} days lead time`,
        impact: '+' + (0.35 + (delay - 10) * 0.02).toFixed(2) + ' log-odds',
        risk: true,
        label: 'Increases Leak Risk'
      });
    } else {
      drivers.push({
        name: 'Supplier Delivery Window',
        val: `${delay} days (Within 72h benchmark)`,
        impact: '-' + (0.22 - delay * 0.02).toFixed(2) + ' log-odds',
        risk: false,
        label: 'Stabilizes Order'
      });
    }

    if (margin < 0) {
      drivers.push({
        name: 'Negative Unit Margin Spread',
        val: `-$${Math.abs(margin).toFixed(2)} unit contribution`,
        impact: '+0.41 log-odds',
        risk: true,
        label: 'Increases Leak Risk'
      });
    } else {
      drivers.push({
        name: 'Healthy Unit Net Margin',
        val: `+$${margin.toFixed(2)} contribution margin`,
        impact: '-0.36 log-odds',
        risk: false,
        label: 'Stabilizes Order'
      });
    }

    if (segment === 'At-risk') {
      drivers.push({
        name: 'Customer Retention Cohort',
        val: 'Segment: At-risk (dormancy flag)',
        impact: '+0.29 log-odds',
        risk: true,
        label: 'Increases Leak Risk'
      });
    } else if (segment === 'Loyal') {
      drivers.push({
        name: 'Customer Loyalty Tier',
        val: 'Segment: Loyal (>5 past orders)',
        impact: '-0.45 log-odds',
        risk: false,
        label: 'Stabilizes Order'
      });
    } else if (payment === 'Cash') {
      drivers.push({
        name: 'Payment Settlement Friction',
        val: 'Cash on Delivery (COD anomaly)',
        impact: '+0.27 log-odds',
        risk: true,
        label: 'Increases Leak Risk'
      });
    } else {
      drivers.push({
        name: 'Promotional Discount Pressure',
        val: `Discount ratio: ${(discount * 100).toFixed(0)}%`,
        impact: discount > 0.15 ? '+0.18 log-odds' : '-0.12 log-odds',
        risk: discount > 0.15,
        label: discount > 0.15 ? 'Increases Leak Risk' : 'Stabilizes Order'
      });
    }
  }

  // Render top 3 rows
  explainList.innerHTML = drivers.slice(0, 3).map((d, idx) => {
    const badgeColor = d.risk 
      ? 'bg-[#FFE4E6] text-[#BE123C] border-[#FECDD3]'
      : 'bg-[#D1FAE5] text-[#047857] border-[#A7F3D0]';
    const dotColor = d.risk ? 'bg-[#BE123C]' : 'bg-[#047857]';

    return `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-lg gap-2 text-xs transition-colors hover:bg-slate-100/70">
        <div class="flex items-center space-x-3">
          <span class="w-6 h-6 rounded bg-white border border-slate-200 font-mono text-[11px] font-bold text-slate-700 flex items-center justify-center shadow-2xs">0${idx + 1}</span>
          <div>
            <div class="font-semibold text-slate-900">${d.name}</div>
            <div class="text-[11px] text-slate-500 font-mono">Current value: <span class="font-semibold text-slate-700">${d.val}</span></div>
          </div>
        </div>
        <div class="flex items-center space-x-3 justify-between sm:justify-end">
          <span class="text-xs font-medium text-slate-600 flex items-center gap-1.5 font-sans">
            <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
            ${d.label}
          </span>
          <span class="px-2.5 py-1 rounded text-[11px] font-mono font-bold border tabular-nums ${badgeColor}">
            ${d.impact}
          </span>
        </div>
      </div>
    `;
  }).join('');
}

// Scenarios helper
function setPreset(type) {
  if (type === 'severe') {
    document.getElementById('category').value = 'Electronics';
    document.getElementById('customer_segment').value = 'At-risk';
    document.getElementById('channel').value = 'App';
    document.getElementById('payment_method').value = 'Cash';
    document.getElementById('region').value = 'North';
    document.getElementById('discount_pct').value = 0.20;
    document.getElementById('unit_price').value = 160;
    document.getElementById('unit_cost').value = 195;
    document.getElementById('stock_on_hand').value = 3;
    document.getElementById('supplier_delay_days').value = 18;
  } else if (type === 'margin') {
    document.getElementById('category').value = 'Home';
    document.getElementById('customer_segment').value = 'Returning';
    document.getElementById('channel').value = 'Web';
    document.getElementById('payment_method').value = 'Card';
    document.getElementById('region').value = 'West';
    document.getElementById('discount_pct').value = 0.25;
    document.getElementById('unit_price').value = 210;
    document.getElementById('unit_cost').value = 230;
    document.getElementById('stock_on_hand').value = 15;
    document.getElementById('supplier_delay_days').value = 4;
  } else if (type === 'healthy') {
    document.getElementById('category').value = 'Sports';
    document.getElementById('customer_segment').value = 'Loyal';
    document.getElementById('channel').value = 'Store';
    document.getElementById('payment_method').value = 'UPI';
    document.getElementById('region').value = 'South';
    document.getElementById('discount_pct').value = 0.05;
    document.getElementById('unit_price').value = 240;
    document.getElementById('unit_cost').value = 110;
    document.getElementById('stock_on_hand').value = 45;
    document.getElementById('supplier_delay_days').value = 2;
  }
  runDiagnosis(false);
}

function loadBenchmarkScenario() {
  setPreset('severe');
}

// Initialize on first load
window.addEventListener('DOMContentLoaded', () => {
  runDiagnosis(false);
});

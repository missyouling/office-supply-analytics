// =============================================
// 应用主逻辑 - 模块管理、事件绑定、数据操作
// =============================================

/* ===== 全局状态 ===== */
let entryItems = [];
let searchTimer = null;
let entrySearchTimer = null;
let charts = {};

/* ===== Toast 提示 ===== */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 3000);
}

function onError(msg) { showToast('❌ ' + msg); }

/* ===== Tab 切换 ===== */
document.getElementById('tabNav').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
});

/* ===== 弹窗工具 ===== */
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
// 点击遮罩关闭
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', (e) => { if (e.target === el) el.style.display = 'none'; });
});

/* =============================================
   模块1：用品字典
   ============================================= */

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadSupplies, 300);
}

async function loadSupplies() {
  const keyword = document.getElementById('dictSearch').value.trim();
  const category = document.getElementById('dictCategory').value;
  const tbody = document.getElementById('supplyTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-text">加载中...</td></tr>';

  try {
    const data = await suppliesApi.list(keyword, category);
    if (!data.items || data.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="loading-text">暂无数据</td></tr>';
      return;
    }
    tbody.innerHTML = data.items.map(item => `
      <tr>
        <td><strong>${esc(item.name)}</strong></td>
        <td>${esc(item.spec)}</td>
        <td>¥${Number(item.unit_price).toFixed(2)}</td>
        <td><span class="tag">${esc(item.category)}</span></td>
        <td>${esc(item.remark)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editSupply(${item.id})">编辑</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSupply(${item.id})">删除</button>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading-text" style="color:var(--danger)">加载失败: ${esc(e.message)}</td></tr>`;
  }
}

function esc(s) { return String(s || '').replace(/[&<>"]/g, function(m) {
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m];
}); }

function showSupplyForm(data) {
  document.getElementById('supplyFormId').value = data ? data.id : '';
  document.getElementById('supplyFormTitle').textContent = data ? '编辑用品' : '新增用品';
  document.getElementById('f_name').value = data ? data.name : '';
  document.getElementById('f_spec').value = data ? (data.spec || '') : '';
  document.getElementById('f_price').value = data ? data.unit_price : '';
  document.getElementById('f_category').value = data ? data.category : '';
  document.getElementById('f_remark').value = data ? (data.remark || '') : '';
  openModal('supplyModal');
}

async function saveSupply(e) {
  e.preventDefault();
  const id = document.getElementById('supplyFormId').value;
  const data = {
    name: document.getElementById('f_name').value.trim(),
    spec: document.getElementById('f_spec').value.trim(),
    unit_price: parseFloat(document.getElementById('f_price').value),
    category: document.getElementById('f_category').value,
    remark: document.getElementById('f_remark').value.trim(),
  };
  if (!data.name) { onError('品名不能为空'); return; }
  if (isNaN(data.unit_price) || data.unit_price < 0) { onError('单价无效'); return; }
  if (!data.category) { onError('请选择分类'); return; }

  try {
    if (id) {
      await suppliesApi.update(parseInt(id), data);
      showToast('✅ 用品已更新');
    } else {
      await suppliesApi.create(data);
      showToast('✅ 用品已新增');
    }
    closeModal('supplyModal');
    loadSupplies();
  } catch (e) { onError(e.message); }
}

async function editSupply(id) {
  try {
    const data = await suppliesApi.get(id);
    showSupplyForm(data);
  } catch (e) { onError(e.message); }
}

async function deleteSupply(id) {
  if (!confirm('确认删除该用品？')) return;
  try {
    await suppliesApi.delete(id);
    showToast('✅ 已删除');
    loadSupplies();
  } catch (e) { onError(e.message); }
}

/* =============================================
   模块2：采购录入
   ============================================= */

// 初始化日期
function initEntryDate() {
  document.getElementById('purchaseDate').value = new Date().toISOString().substring(0, 10);
}

function debounceEntrySearch() {
  clearTimeout(entrySearchTimer);
  entrySearchTimer = setTimeout(searchSuppliesForEntry, 350);
}

async function searchSuppliesForEntry() {
  const kw = document.getElementById('entrySearch').value.trim();
  const box = document.getElementById('entrySuggestions');
  if (!kw) { box.style.display = 'none'; return; }

  try {
    const data = await suppliesApi.list(kw, '');
    const items = data.items || [];
    if (items.length === 0) { box.style.display = 'none'; return; }

    box.innerHTML = items.map(item => `
      <div class="suggestion-item" onclick="addToEntry(${item.id}, '${esc(item.name)}', '${esc(item.spec)}', ${item.unit_price})">
        <div>
          <div class="s-name">${esc(item.name)}</div>
          <div class="s-info">${esc(item.spec)} · ${esc(item.category)}</div>
        </div>
        <div class="s-price">¥${Number(item.unit_price).toFixed(2)}</div>
      </div>
    `).join('');
    box.style.display = 'block';
  } catch (e) {
    document.getElementById('entrySuggestions').style.display = 'none';
  }
}

// 点击页面其他位置关闭建议框
document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.search-input-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('entrySuggestions').style.display = 'none';
  }
});

function addToEntry(id, name, spec, price) {
  // 检查是否已在清单中
  if (entryItems.some(i => i.supply_id === id)) {
    showToast('该用品已在清单中');
    document.getElementById('entrySuggestions').style.display = 'none';
    document.getElementById('entrySearch').value = '';
    return;
  }
  entryItems.push({ supply_id: id, name, spec, unit_price: price, quantity: 1 });
  document.getElementById('entrySearch').value = '';
  document.getElementById('entrySuggestions').style.display = 'none';
  renderEntryTable();
}

function removeEntryItem(index) {
  entryItems.splice(index, 1);
  renderEntryTable();
}

function updateEntryQty(index, qty) {
  qty = parseInt(qty) || 0;
  if (qty < 1) qty = 1;
  entryItems[index].quantity = qty;
  renderEntryTable();
}

function renderEntryTable() {
  const tbody = document.getElementById('entryTableBody');
  if (entryItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="loading-text">请搜索添加用品</td></tr>';
    document.getElementById('entryTotal').textContent = '¥0.00';
    return;
  }

  let total = 0;
  tbody.innerHTML = entryItems.map((item, idx) => {
    const subtotal = item.unit_price * item.quantity;
    total += subtotal;
    return `
      <tr>
        <td><strong>${esc(item.name)}</strong></td>
        <td>${esc(item.spec)}</td>
        <td>¥${item.unit_price.toFixed(2)}</td>
        <td><input type="number" class="input qty-input" value="${item.quantity}" min="1"
          onchange="updateEntryQty(${idx}, this.value)"></td>
        <td>¥${subtotal.toFixed(2)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="removeEntryItem(${idx})">删除</button></td>
      </tr>
    `;
  }).join('');

  document.getElementById('entryTotal').textContent = `¥${total.toFixed(2)}`;
}

async function savePurchase() {
  const date = document.getElementById('purchaseDate').value;
  if (!date) { onError('请选择采购日期'); return; }
  if (entryItems.length === 0) { onError('采购清单不能为空'); return; }

  try {
    const data = await purchasesApi.create({
      purchase_date: date,
      items: entryItems.map(i => ({
        supply_id: i.supply_id,
        quantity: i.quantity,
        unit_price: i.unit_price
      }))
    });
    showToast(`✅ 采购单已保存（PO-${String(data.id).padStart(6, '0')}）`);
    // 保存当前采购单 ID 供 PDF 使用
    window._lastPurchaseId = data.id;
    window._lastPurchaseDate = date;
    window._lastPurchaseAmount = data.total_amount;
    entryItems = [];
    renderEntryTable();
  } catch (e) { onError(e.message); }
}

async function exportPurchasePdf() {
  if (entryItems.length > 0) {
    if (!confirm('当前清单还有未保存的用品，是否先保存再导出？\n点击确定先保存采购单，点击取消使用当前清单数据。')) {
      // 用户选择取消 - 用当前前端数据生成 PDF
      generatePurchasePdfLocal();
      return;
    }
    // 先保存
    await savePurchase();
    if (!window._lastPurchaseId) return;
  }
  // 从服务器获取 PDF
  const id = window._lastPurchaseId;
  if (!id) { onError('没有已保存的采购单'); return; }

  try {
    const resp = await purchasesApi.getPdf(id);
    const blob = await resp.blob();
    downloadBlob(blob, `采购单_${window._lastPurchaseDate || new Date().toISOString().substring(0, 10)}.pdf`);
  } catch (e) { onError(e.message); }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* =============================================
   模块3：数据分析
   ============================================= */

function onAnaTypeChange() {
  const type = document.getElementById('anaType').value;
  const dateInput = document.getElementById('anaDate');
  const now = new Date();
  if (type === 'monthly') {
    dateInput.type = 'month';
    dateInput.value = now.toISOString().substring(0, 7);
  } else if (type === 'half-yearly') {
    dateInput.type = 'month';
    const m = now.getMonth() + 1;
    const half = m <= 6 ? '01' : '07';
    dateInput.value = `${now.getFullYear()}-${half}`;
  } else {
    dateInput.type = 'number';
    dateInput.value = now.getFullYear();
  }
  loadAnalytics();
}

// 初始化分析日期
function initAnaDate() { onAnaTypeChange(); }

async function loadAnalytics() {
  const type = document.getElementById('anaType').value;
  const date = document.getElementById('anaDate').value;
  const category = document.getElementById('anaCategory').value;

  try {
    const data = await analyticsApi.get({ type, date, category });
    renderCharts(data);
    renderSuggestions(data.suggestions);
  } catch (e) {
    onError('加载分析数据失败: ' + e.message);
  }
}

function renderCharts(data) {
  // 柱状图 - 各分类用量/金额
  const barCtx = document.getElementById('barChart').getContext('2d');
  if (charts.bar) charts.bar.destroy();

  const barMode = document.querySelector('.toggle-btn.active')?.dataset.mode || 'amount';
  const barLabels = (data.categoryStats || []).map(c => c.category);
  const barData = (data.categoryStats || []).map(c =>
    barMode === 'amount' ? Number(c.total_amount || 0) : Number(c.total_quantity || 0)
  );
  const barLabel = barMode === 'amount' ? '金额 (¥)' : '数量';

  charts.bar = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: barLabels,
      datasets: [{
        label: barLabel,
        data: barData,
        backgroundColor: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899'],
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { callback: v => barMode === 'amount' ? '¥' + v.toFixed(0) : v } } }
    }
  });

  // 折线图 - 购买频次趋势
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  if (charts.line) charts.line.destroy();

  const freq = data.frequencyData || [];
  charts.line = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: freq.map(f => f.period),
      datasets: [
        {
          label: '采购单数',
          data: freq.map(f => f.purchase_count || 0),
          borderColor: '#2563eb', tension: 0.3, fill: false,
        },
        {
          label: '采购金额(¥)',
          data: freq.map(f => Number(f.total_amount || 0)),
          borderColor: '#16a34a', tension: 0.3, fill: false, yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, y1: { position: 'right', grid: { drawOnChartArea: false } } }
    }
  });

  // 饼图 - 分类成本占比
  const pieCtx = document.getElementById('pieChart').getContext('2d');
  if (charts.pie) charts.pie.destroy();

  const pieData = data.categoryPie || [];
  charts.pie = new Chart(pieCtx, {
    type: 'pie',
    data: {
      labels: pieData.map(p => p.category),
      datasets: [{
        data: pieData.map(p => Number(p.percentage || 0)),
        backgroundColor: ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#8b5cf6'],
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = pieData[ctx.dataIndex];
              return `${ctx.label}: ${ctx.parsed.toFixed(1)}% (¥${Number(raw.total_amount || 0).toFixed(2)})`;
            }
          }
        }
      }
    }
  });

  // 保存图表截图数据（供 PDF 导出使用）
  window._chartImages = {};
  setTimeout(() => {
    ['barChart', 'lineChart', 'pieChart'].forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) {
        const key = id === 'barChart' ? 'barChart'
                  : id === 'lineChart' ? 'lineChart' : 'pieChart';
        window._chartImages[key] = canvas.toDataURL('image/png');
      }
    });
  }, 500);
}

function toggleChartMode(btn) {
  document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // 重新渲染柱状图
  const barCtx = document.getElementById('barChart').getContext('2d');
  if (charts.bar) {
    const mode = btn.dataset.mode;
    const barLabels = charts.bar.data.labels;
    // 从原始数据中重新计算需要重新加载
    loadAnalytics();
  }
}

function renderSuggestions(suggestions) {
  const area = document.getElementById('suggestionsList');
  if (!suggestions || suggestions.length === 0) {
    area.innerHTML = '<p class="loading-text">暂无优化建议</p>';
    return;
  }
  area.innerHTML = suggestions.map(s => `
    <div class="suggestion-card ${s.type || 'info'}">
      <h4>${esc(s.title)}</h4>
      <p>${esc(s.content)}</p>
    </div>
  `).join('');
}

/* ===== 导出分析报告 PDF ===== */
async function exportReportPdf() {
  const type = document.getElementById('anaType').value;
  const date = document.getElementById('anaDate').value;

  // 等待图表渲染完成
  await new Promise(r => setTimeout(r, 800));

  const charts = ['barChart', 'lineChart', 'pieChart'];
  const chartNames = ['各分类用量分析', '购买频次趋势', '分类成本占比'];

  // 截图图表 canvas
  const chartImages = [];
  for (let i = 0; i < charts.length; i++) {
    const canvas = document.getElementById(charts[i]);
    if (canvas) {
      chartImages.push({
        name: chartNames[i],
        imageBase64: canvas.toDataURL('image/png')
      });
    }
  }

  // 收集数据
  const summaryData = {
    total_amount: document.querySelector('.total-label strong')?.textContent?.replace('¥', '') || '0',
    total_purchases: '--',
    total_categories: (window._chartImages ? Object.keys(window._chartImages).length : 0)
  };

  // 收集建议文本
  const suggestions = [];
  document.querySelectorAll('.suggestion-card').forEach(card => {
    const title = card.querySelector('h4')?.textContent || '';
    const content = card.querySelector('p')?.textContent || '';
    const type = card.classList.contains('warning') ? 'warning'
               : card.classList.contains('success') ? 'success'
               : card.classList.contains('suggestion') ? 'suggestion' : 'info';
    suggestions.push({ type, title, content });
  });

  const typeLabel = type === 'monthly' ? '月度' : type === 'half-yearly' ? '半年度' : '年度';
  const dateLabel = type === 'yearly' ? `${date}年` : date;

  try {
    const resp = await analyticsApi.reportPdf({
      title: `办公劳保用品采购分析报告（${typeLabel}）`,
      dateRange: dateLabel,
      charts: chartImages,
      suggestions,
      summaryData
    });
    const blob = await resp.blob();
    downloadBlob(blob, `分析报告_${dateLabel.replace('/', '-')}.pdf`);
    showToast('✅ 分析报告已导出');
  } catch (e) {
    // 如果服务器 PDF 生成失败，尝试客户端生成
    showToast('⚠️ 服务器 PDF 生成失败，尝试本地生成...');
    try {
      await generateReportPdfLocal({ type: typeLabel, date: dateLabel, chartImages, suggestions });
    } catch (e2) {
      onError('PDF 导出失败: ' + e2.message);
    }
  }
}

/* ===== 初始化 ===== */
document.addEventListener('DOMContentLoaded', () => {
  initEntryDate();
  initAnaDate();
  loadSupplies();
});

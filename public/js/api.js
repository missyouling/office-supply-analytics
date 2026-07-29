// =============================================
// API 客户端 - 封装所有后端接口调用
// =============================================

const API_BASE = '';

async function apiFetch(url, options = {}) {
  try {
    const resp = await fetch(API_BASE + url, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
    // 处理 PDF 响应
    if (url.includes('/pdf') && options.method !== 'POST') {
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'PDF 生成失败' }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      return resp;
    }
    const data = await resp.json();
    if (!data.ok) throw new Error(data.error || '请求失败');
    return data;
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new Error(e.message || '网络错误');
  }
}

// ---- 用品字典 API ----
const suppliesApi = {
  list: (keyword = '', category = 'all') => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (category && category !== 'all') params.set('category', category);
    return apiFetch(`/api/supplies?${params}`);
  },
  get: (id) => apiFetch(`/api/supplies/${id}`),
  create: (data) => apiFetch('/api/supplies', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => apiFetch(`/api/supplies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/api/supplies/${id}`, { method: 'DELETE' }),
};

// ---- 采购记录 API ----
const purchasesApi = {
  create: (data) => apiFetch('/api/purchases', { method: 'POST', body: JSON.stringify(data) }),
  getPdf: (id) => apiFetch(`/api/purchases/${id}/pdf`),
};

// ---- 分析 API ----
const analyticsApi = {
  get: ({ type, date, category }) => {
    const params = new URLSearchParams({ type, date });
    if (category && category !== 'all') params.set('category', category);
    return apiFetch(`/api/analytics?${params}`);
  },
  reportPdf: (data) => apiFetch('/api/analytics/report-pdf', {
    method: 'POST', body: JSON.stringify(data)
  }),
};

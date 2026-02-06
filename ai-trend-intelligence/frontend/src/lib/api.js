const API_BASE = (import.meta.env.VITE_SUPABASE_URL || '') + '/functions/v1/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // 트렌드 조회
  getTrends(category = null, impact = null) {
    const params = new URLSearchParams();
    if (category && category !== '전체') params.set('category', category);
    if (impact) params.set('impact', impact);
    const qs = params.toString();
    return request(`/trends${qs ? '?' + qs : ''}`);
  },

  // 액션 목록
  getActions(status = null) {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const qs = params.toString();
    return request(`/actions${qs ? '?' + qs : ''}`);
  },

  // 액션 상태 업데이트
  updateAction(id, updates) {
    return request(`/actions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // 소스 목록
  getSources() {
    return request('/sources');
  },

  // 통계
  getStats() {
    return request('/stats');
  },

  // 수동 크롤링 트리거
  triggerCrawl() {
    return request('/crawl/trigger', { method: 'POST' });
  },
};

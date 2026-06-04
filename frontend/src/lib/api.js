// 같은 출처 API 클라이언트. 세션 쿠키 인증(credentials: 'include').
// 모든 데이터 호출은 Flask 프록시(/api/*) 를 거쳐 heyvoca_back /admin/* 로 전달된다.
// ADMIN_API_KEY 는 서버에서만 주입되므로 브라우저에 노출되지 않는다.

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function parse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.message || `요청 실패 (${res.status})`, res.status, json);
  }
  return json;
}

export function buildQuery(params = {}) {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    sp.append(k, String(v));
  });
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

const opts = (extra = {}) => ({ credentials: 'include', ...extra });

export const apiGet = (path) =>
  fetch(path, opts()).then(parse);

export const apiSend = (path, method, body) =>
  fetch(path, opts({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })).then(parse);

export const apiPost = (path, body) => apiSend(path, 'POST', body);
export const apiPatch = (path, body) => apiSend(path, 'PATCH', body);
export const apiDelete = (path) => apiSend(path, 'DELETE');

// multipart(엑셀 업로드 등) — Content-Type 은 브라우저가 boundary 와 함께 자동 설정
export const apiUpload = (path, formData) =>
  fetch(path, opts({ method: 'POST', body: formData })).then(parse);

// ── 인증 ──
export const checkSession = () => apiGet('/auth/me');
export const login = (username, password) => apiPost('/auth/login', { username, password });
export const logout = () => apiPost('/auth/logout');

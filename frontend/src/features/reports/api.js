// 오류 신고 엔드포인트 — Flask 프록시(/api/*) → heyvoca_back /admin/reports*.
import { apiGet, apiPatch, buildQuery } from '@/lib/api';

const clean = (f = {}) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v != null));

export const listReports = ({ page = 1, perPage = 50, ...filters } = {}) =>
  apiGet(`/api/reports${buildQuery(clean({ ...filters, page, per_page: perPage }))}`);
export const getReportSummary = (filters = {}) =>
  apiGet(`/api/reports/summary${buildQuery(clean(filters))}`);
export const getReport = (id) => apiGet(`/api/reports/${id}`);
export const patchReport = (id, patch) => apiPatch(`/api/reports/${id}`, patch);
export const bulkPatchReports = (payload) => apiPatch('/api/reports/bulk', payload);

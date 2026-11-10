// 유저 관리 — Flask 프록시(/api/*) → heyvoca_back /admin/user-stats/* (app/routes/admin_user_stats.py)
import { apiGet, apiPost, apiDelete, buildQuery } from '@/lib/api';

export const getUserStatsOverview = (days = 30) => apiGet(`/api/user-stats/overview${buildQuery({ days })}`);
export const listStatUsers = (params = {}) => apiGet(`/api/user-stats/users${buildQuery(params)}`);
export const listExcludedEmails = () => apiGet('/api/user-stats/excluded');
export const addExcludedEmail = (email, memo) => apiPost('/api/user-stats/excluded', { email, memo });
export const deleteExcludedEmail = (id) => apiDelete(`/api/user-stats/excluded/${id}`);

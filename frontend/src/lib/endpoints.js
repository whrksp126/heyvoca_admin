// 통합 어드민 전체 엔드포인트 매핑.
// 인벤토리(T#=팀원, M#=내 기존) 기능을 빠짐없이 커버한다.
// 모든 경로는 Flask 프록시(/api/*) → heyvoca_back /admin/* 로 전달.
import { apiGet, apiPost, apiPatch, apiDelete, apiUpload, buildQuery } from './api';

// ──────────────────────────────────────────────────────────
// AdminVocaBook — 내 하이픈 API (M7~M16 베이스 UX)
// ──────────────────────────────────────────────────────────
export const listAdminBooks = ({ page = 1, pageSize = 50, source = 'all', q = '', sortBy = 'updated_at', sortDir = 'desc' } = {}) =>
  apiGet(`/api/voca-books${buildQuery({ page, page_size: pageSize, source, q, sort_by: sortBy, sort_dir: sortDir })}`);
export const getAdminBook = (id) => apiGet(`/api/voca-books/${id}`);
export const patchAdminBook = (id, patch) => apiPatch(`/api/voca-books/${id}`, patch);              // M9 ⊇ T16
export const patchAdminWord = (bookId, mapId, patch) => apiPatch(`/api/voca-books/${bookId}/words/${mapId}`, patch); // M10/T27
export const addAdminWord = (bookId, payload, { force = false } = {}) =>
  apiPost(`/api/voca-books/${bookId}/words${force ? '?force=true' : ''}`, payload);                 // M12 ⊇ T18
export const deleteAdminWord = (bookId, mapId) => apiDelete(`/api/voca-books/${bookId}/words/${mapId}`); // M14/T19
export const toggleBookstore = (bookId, payload = {}) => apiPost(`/api/voca-books/${bookId}/bookstore/toggle`, payload); // M15
export const patchBookstoreInline = (bookId, patch) => apiPatch(`/api/voca-books/${bookId}/bookstore`, patch);          // M15
export const searchVoca = (q, limit = 20) => apiGet(`/api/voca-books/_search-voca${buildQuery({ q, limit })}`);          // M13 ⊇ T8
export const getVocaDictionary = (vocaId) => apiGet(`/api/voca-books/_voca/${vocaId}/dictionary`);                       // M11

// ──────────────────────────────────────────────────────────
// 통합 목록 (legacy VocaBook + AdminVocaBook) — 팀원 T9
// ──────────────────────────────────────────────────────────
export const listAllBooks = ({ search = '', category = '' } = {}) =>
  apiGet(`/api/voca_books${buildQuery({ search, category })}`); // → data: { legacy: [...], admin: [...] } (구버전, 전체 반환)

// 서버 페이지네이션 통합 목록 (무한 스크롤용). type=all|admin|legacy
// → data: { items:[{id,book_nm,language,source,category,username,word_count,updated_at,book_type,is_registered,bookstore_id,bookstore_name}], total, page, page_size, type_counts:{all,admin,legacy} }
export const listBooksUnified = ({ page = 1, pageSize = 50, type = 'all', q = '', sortBy = 'updated_at', sortDir = 'desc' } = {}) =>
  apiGet(`/api/voca-books/unified${buildQuery({ page, page_size: pageSize, type, q, sort_by: sortBy, sort_dir: sortDir })}`);

// ── legacy VocaBook (언더스코어) : T10~T14 ──
export const createVocaBookExcel = (formData) => apiUpload('/api/voca_book', formData);             // T10
export const patchVocaBook = (id, patch) => apiPatch(`/api/voca_book/${id}`, patch);                // T11
export const getVocaBookWords = (id, { page = 1, perPage = 50 } = {}) =>
  apiGet(`/api/voca_book/${id}/words${buildQuery({ page, per_page: perPage })}`);                   // T12
export const addVocaBookWord = (id, payload) => apiPost(`/api/voca_book/${id}/word`, payload);      // T13
export const removeVocaBookWord = (id, vocaId) => apiDelete(`/api/voca_book/${id}/word/${vocaId}`); // T14

// ── AdminVocaBook (언더스코어) : T15~T24 (엑셀/AI/예문강조) ──
export const createAdminVocaBookExcel = (formData) => apiUpload('/api/admin_voca_book', formData);  // T15
export const getAdminVocaBookWords = (id, { page = 1, perPage = 50 } = {}) =>
  apiGet(`/api/admin_voca_book/${id}/words${buildQuery({ page, per_page: perPage })}`);             // T17
export const addAdminVocaBookWord = (id, payload) => apiPost(`/api/admin_voca_book/${id}/word`, payload);      // T18
export const removeAdminVocaBookWord = (id, vocaId) => apiDelete(`/api/admin_voca_book/${id}/word/${vocaId}`); // T19
export const createAdminVocaBookFromAI = (payload) => apiPost('/api/admin_voca_book/from_ai', payload);        // T21
export const tagExamples = (id) => apiPost(`/api/admin_voca_book/${id}/tag_examples`, {});                     // T22
export const saveTaggedExamples = (id, payload) => apiPatch(`/api/admin_voca_book/${id}/save_tagged_examples`, payload); // T23

// ──────────────────────────────────────────────────────────
// 북스토어 (팀원 standalone CRUD) : T3~T7
// ──────────────────────────────────────────────────────────
export const listBookstores = () => apiGet('/api/bookstore');             // T3
export const createBookstore = (payload) => apiPost('/api/bookstore', payload);   // T4
export const updateBookstore = (id, patch) => apiPatch(`/api/bookstore/${id}`, patch); // T5
export const deleteBookstore = (id) => apiDelete(`/api/bookstore/${id}`);  // T6
export const getLevels = () => apiGet('/api/level');
export const getCategories = () => apiGet('/api/category');

// ──────────────────────────────────────────────────────────
// 단어 관리 (팀원) : T25~T29
// ──────────────────────────────────────────────────────────
export const listVoca = ({ page = 1, q = '' } = {}) => apiGet(`/api/voca${buildQuery({ page, q })}`); // T25
export const getVoca = (id) => apiGet(`/api/voca/${id}`);          // T26
export const patchVoca = (id, patch) => apiPatch(`/api/voca/${id}`, patch); // T27
export const hideVoca = (id) => apiPatch(`/api/voca/${id}/hide`, {});  // T28
export const showVoca = (id) => apiPatch(`/api/voca/${id}/show`, {});  // T29
export const autocompleteVoca = (q) => apiGet(`/api/voca/autocomplete${buildQuery({ q })}`); // T8(보조)

// ──────────────────────────────────────────────────────────
// AI 단어 생성 (heyvoca_admin 내부 OpenAI) : T20
// ──────────────────────────────────────────────────────────
export const generateWords = (payload) => apiPost('/api/ai/generate_words', payload); // T20

// ──────────────────────────────────────────────────────────
// Overview (백엔드 신규) : M2~M6
// ──────────────────────────────────────────────────────────
export const getProgress = () => apiGet('/api/progress');                       // M3
export const getMetrics = (days = 7) => apiGet(`/api/study/metrics${buildQuery({ days })}`); // M4
export const getHealth = () => apiGet('/api/fsrs/health');                      // M5
export const getRecentSessions = (limit = 20) => apiGet(`/api/study/recent-sessions${buildQuery({ limit })}`);

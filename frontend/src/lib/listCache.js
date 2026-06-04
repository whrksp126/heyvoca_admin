// 목록 화면 상태 캐시 (모듈 레벨, 라우트 전환에도 유지).
// 탭을 떠났다 돌아와도 재호출 없이 직전 items/page/필터/스크롤 위치를 복원한다.
const cache = new Map();

export function getList(key) {
  return cache.get(key);
}

export function setList(key, patch) {
  cache.set(key, { ...(cache.get(key) || {}), ...patch });
}

export function clearList(key) {
  cache.delete(key);
}

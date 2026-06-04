// 메인 스크롤 컨테이너 ref 를 페이지에 전달.
// - 무한 스크롤 IntersectionObserver 의 root 로 사용
// - 스크롤 위치 저장/복원에 사용
import { createContext, useContext } from 'react';

export const ScrollContext = createContext({ current: null });
export const useScrollEl = () => useContext(ScrollContext);

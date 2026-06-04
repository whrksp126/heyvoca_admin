import { useEffect, useState } from 'react';

// 입력값을 지정한 지연(ms) 후에만 반영하는 디바운스 훅.
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

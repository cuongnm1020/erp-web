import { useEffect, useState } from 'react';

/** Giá trị trễ `ms` sau lần đổi cuối — ô tìm sản phẩm, gợi ý khách theo SĐT. */
export function useDebounced<T>(v: T, ms: number): T {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = setTimeout(() => setD(v), ms);
    return () => clearTimeout(t);
  }, [v, ms]);
  return d;
}

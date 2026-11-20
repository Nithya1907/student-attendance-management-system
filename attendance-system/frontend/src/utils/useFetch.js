import { useCallback, useEffect, useState } from 'react';
import api, { errorMessage } from '../api/client';

// Small data-loading hook: { data, loading, error, reload }
export default function useFetch(url, params, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState('');
  const key = JSON.stringify([url, params]);

  const load = useCallback(async () => {
    if (skip || !url) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(url, { params });
      setData(res.data);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, skip]);

  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

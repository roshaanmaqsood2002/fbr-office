import { useEffect, useState } from 'react';
import { api } from './api';

export interface FbrReference {
  scenarios: { id: string; description: string; saleType: string }[];
  saleTypes: string[];
  provinces: string[];
}

let cache: Promise<FbrReference> | null = null;

export function useFbrReference() {
  const [ref, setRef] = useState<FbrReference | null>(null);
  useEffect(() => {
    cache ??= api.get('/reference/fbr').then((r) => r.data as FbrReference);
    cache.then(setRef).catch(() => { cache = null; });
  }, []);
  return ref;
}
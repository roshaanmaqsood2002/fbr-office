import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';

interface Ev { _id: string; summary: string; actorName: string; actorRole: string; action: string; createdAt: string }

export default function ActivityTab({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<Ev[]>([]);
  useEffect(() => {
    api.get(`/businesses/${businessId}/audit`, { params: { limit: 50 } })
      .then((r) => setItems(r.data.items)).catch((e) => toast.error(getErrorMessage(e)));
  }, [businessId]);

  return (
    <ul className="divide-y divide-fbr-border rounded-xl border border-fbr-border bg-white text-sm">
      {items.map((e) => (
        <li key={e._id} className="p-3">
          <div>{e.summary}</div>
          <div className="text-xs text-fbr-text-light">{e.actorName} ({e.actorRole}) · {new Date(e.createdAt).toLocaleString()}</div>
        </li>
      ))}
      {items.length === 0 && <li className="p-6 text-center text-fbr-text-light">No activity yet.</li>}
    </ul>
  );
}
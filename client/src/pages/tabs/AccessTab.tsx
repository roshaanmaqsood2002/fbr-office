import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../../lib/api';
import Modal from '../../components/Modal';

interface Member { _id: string; name: string; email: string; role: string; isActive: boolean }

export default function AccessTab({ businessId, assigned, onChange }: { businessId: string; assigned: string[]; onChange: () => void }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(assigned));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setSelected(new Set(assigned));
  }, [assigned]);

  useEffect(() => {
    api.get('/team/members').then((r) => setMembers(r.data.members)).catch((e) => toast.error(getErrorMessage(e)));
  }, []);

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const closeEditor = () => {
    setSelected(new Set(assigned));
    setEditing(false);
  };

  const save = async () => {
    try {
      await api.put(`/businesses/${businessId}/assignments`, { userIds: [...selected] });
      toast.success('Access updated');
      setEditing(false);
      onChange();
    } catch (err) { toast.error(getErrorMessage(err)); }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-fbr-text-light">Owners and admins always see every client. Staff and viewers only see clients assigned to them.</p>
      <button className="fbr-btn sm:w-auto" onClick={() => setEditing(true)}>Manage client access</button>
      <Modal
        open={editing}
        title="Manage client access"
        description="Owners and admins always see every client. Assign staff and viewers who need access."
        onClose={closeEditor}
      >
        <ul className="divide-y divide-fbr-border overflow-hidden rounded-xl border border-fbr-border bg-white text-sm">
          {members.filter((m) => m.isActive).map((m) => (
            <li key={m._id} className="flex items-center gap-3 p-3.5">
              <input type="checkbox" className="accent-fbr-green" checked={selected.has(m._id)} onChange={() => toggle(m._id)} />
              <span className="font-medium">{m.name}</span>
              <span className="ml-auto text-right text-xs text-fbr-text-light">{m.email}<span className="ml-1 capitalize">· {m.role}</span></span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="fbr-btn-secondary" onClick={closeEditor}>Cancel</button>
          <button className="fbr-btn sm:w-auto" onClick={save}>Save access</button>
        </div>
      </Modal>
    </div>
  );
}
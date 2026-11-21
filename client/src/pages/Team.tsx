import { type FormEvent, useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

type Role = 'owner' | 'admin' | 'staff' | 'viewer';
interface Member { _id: string; name: string; email: string; role: Role; isActive: boolean }
interface Invite { _id: string; email: string; role: Role; expiresAt: string }

const RANK: Record<Role, number> = { owner: 4, admin: 3, staff: 2, viewer: 1 };
const ASSIGNABLE: Record<Role, Role[]> = {
  owner: ['admin', 'staff', 'viewer'],
  admin: ['staff', 'viewer'],
  staff: [],
  viewer: [],
};

export default function Team() {
  const { user } = useAuth();
  const me = user!;
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [memberForm, setMemberForm] = useState<{ role: Role; isActive: boolean } | null>(null);
  const [revokingInvite, setRevokingInvite] = useState<Invite | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, i] = await Promise.all([api.get('/team/members'), api.get('/team/invitations')]);
      setMembers(m.data.members);
      setInvites(i.data.invitations);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/team/invitations', { email, role });
      await navigator.clipboard.writeText(data.inviteLink).catch(() => {});
      toast.success('Invitation created. Link copied to clipboard');
      setEmail('');
      setInviteOpen(false);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const update = async (id: string, patch: { role?: Role; isActive?: boolean }, okMsg: string) => {
    try {
      await api.patch(`/team/members/${id}`, patch);
      toast.success(okMsg);
      await load();
      return true;
    } catch (err) {
      toast.error(getErrorMessage(err));
      return false;
    }
  };

  const saveMember = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingMember || !memberForm) return;
    const updated = await update(
      editingMember._id,
      memberForm,
      'Member updated',
    );
    if (updated) {
      setEditingMember(null);
      setMemberForm(null);
    }
  };

  const revoke = async () => {
    if (!revokingInvite) return;
    try {
      await api.delete(`/team/invitations/${revokingInvite._id}`);
      toast.success('Invitation revoked');
      setRevokingInvite(null);
      await load();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const startEditMember = (member: Member) => {
    setEditingMember(member);
    setMemberForm({ role: member.role, isActive: member.isActive });
  };

  const assignable = ASSIGNABLE[me.role];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-fbr-green-lighter">Firm administration</div>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">Team</h1>
          <p className="mt-2 text-sm text-fbr-text-light">Invite colleagues and manage what they can do.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-fbr-border bg-white px-4 py-3 text-sm shadow-sm">
            <span className="font-semibold">{members.length}</span>
            <span className="ml-1 text-fbr-text-light">{members.length === 1 ? 'member' : 'members'}</span>
          </div>
          <button className="fbr-btn sm:w-auto" onClick={() => setInviteOpen(true)}>
            Invite teammate
          </button>
        </div>
      </div>

      <Modal
        open={inviteOpen}
        title="Invite a teammate"
        description="They will receive an invitation to join this firm workspace."
        onClose={() => setInviteOpen(false)}
      >
        <form onSubmit={invite} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Email address</span>
            <input className="fbr-input" type="email" placeholder="colleague@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Role</span>
            <select className="fbr-input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {assignable.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="fbr-btn-secondary" onClick={() => setInviteOpen(false)}>Cancel</button>
            <button className="fbr-btn sm:w-auto" disabled={busy}>{busy ? 'Creating…' : 'Send invite'}</button>
          </div>
        </form>
      </Modal>

      <section>
        <div className="mb-3">
          <h2 className="font-semibold">Members</h2>
          <p className="mt-1 text-sm text-fbr-text-light">People with access to your firm's data.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-fbr-border bg-white shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fbr-bg text-xs uppercase tracking-wide text-fbr-text-light">
              <tr><th className="px-5 py-3.5">Name</th><th className="px-5 py-3.5">Email</th><th className="px-5 py-3.5">Role</th><th className="px-5 py-3.5">Status</th><th className="px-5 py-3.5" /></tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const manageable = m._id !== me.id && RANK[me.role] > RANK[m.role];
                return (
                  <tr key={m._id} className="border-t border-fbr-border/80 transition hover:bg-fbr-bg/60">
                    <td className="px-5 py-4 font-medium">{m.name}</td>
                    <td className="px-5 py-4 text-fbr-text-light">{m.email}</td>
                    <td className="px-5 py-4">
                      <span className="rounded-full bg-fbr-bg-dark px-2.5 py-1 text-xs font-medium capitalize text-fbr-text-light">{m.role}</span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${m.isActive ? 'bg-fbr-success/10 text-fbr-success' : 'bg-fbr-bg-dark text-fbr-text-light'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${m.isActive ? 'bg-fbr-success' : 'bg-fbr-text-light/60'}`} />
                        {m.isActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {manageable && (
                        <button
                          className="rounded-lg px-3 py-2 text-xs font-semibold text-fbr-green-light hover:bg-fbr-bg"
                          onClick={() => startEditMember(m)}
                        >
                          Manage
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {invites.length > 0 && (
        <section>
          <div className="mb-3">
            <h2 className="font-semibold">Pending invitations</h2>
            <p className="mt-1 text-sm text-fbr-text-light">Invitations that have not yet been accepted.</p>
          </div>
          <ul className="divide-y divide-fbr-border overflow-hidden rounded-2xl border border-fbr-border bg-white text-sm shadow-sm">
            {invites.map((i) => (
              <li key={i._id} className="flex flex-wrap items-center justify-between gap-3 p-4 sm:px-5">
                <span>
                  <span className="font-medium">{i.email}</span>
                  <span className="ml-2 rounded-full bg-fbr-bg-dark px-2 py-1 text-xs capitalize text-fbr-text-light">{i.role}</span>
                  <span className="mt-1 block text-xs text-fbr-text-light">Expires {new Date(i.expiresAt).toLocaleDateString()}</span>
                </span>
                <button className="rounded-lg px-3 py-2 text-xs font-semibold text-fbr-error hover:bg-red-50" onClick={() => setRevokingInvite(i)}>Revoke invite</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Modal
        open={!!editingMember && !!memberForm}
        title="Manage team member"
        description={editingMember?.email}
        onClose={() => { setEditingMember(null); setMemberForm(null); }}
      >
        {memberForm && (
          <form onSubmit={saveMember} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fbr-text-light">Role</span>
              <select
                className="fbr-input"
                value={memberForm.role}
                onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value as Role })}
              >
                {assignable.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-fbr-border p-4">
              <input
                type="checkbox"
                className="mt-1 accent-fbr-green"
                checked={memberForm.isActive}
                onChange={(e) => setMemberForm({ ...memberForm, isActive: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium">Account active</span>
                <span className="mt-1 block text-xs leading-relaxed text-fbr-text-light">
                  Deactivating immediately ends this teammate's active sessions.
                </span>
              </span>
            </label>
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <button type="button" className="fbr-btn-secondary" onClick={() => { setEditingMember(null); setMemberForm(null); }}>Cancel</button>
              <button className="fbr-btn sm:w-auto">Save changes</button>
            </div>
          </form>
        )}
      </Modal>
      <Modal
        open={!!revokingInvite}
        title="Revoke invitation?"
        description={revokingInvite?.email}
        onClose={() => setRevokingInvite(null)}
      >
        <p className="text-sm leading-relaxed text-fbr-text-light">
          This pending invitation will no longer be valid. The teammate can be invited again later.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="fbr-btn-secondary" onClick={() => setRevokingInvite(null)}>Keep invitation</button>
          <button type="button" className="fbr-btn bg-fbr-error hover:bg-red-700 sm:w-auto" onClick={revoke}>Revoke invitation</button>
        </div>
      </Modal>
    </div>
  );
}
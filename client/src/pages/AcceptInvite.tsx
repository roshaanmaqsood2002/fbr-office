import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/AuthLayout';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [info, setInfo] = useState<{ email: string; role: string; firmName: string } | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/auth/invitations/${token}`).then((r) => setInfo(r.data)).catch(() => setInvalid(true));
  }, [token]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await acceptInvite({ token, name, password });
      toast.success('Welcome to the team!');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (invalid) {
    return (
      <AuthLayout title="Invitation unavailable" subtitle="This link is invalid, already used, or has expired.">
        <Link to="/login" className="font-medium text-fbr-green-light hover:text-fbr-gold-dark">Go to sign in</Link>
      </AuthLayout>
    );
  }
  if (!info) return <div className="flex-center h-screen animate-pulse-soft text-fbr-text-light">Loading…</div>;

  return (
    <AuthLayout title={`Join ${info.firmName}`} subtitle={`You've been invited as ${info.role}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <input className="fbr-input bg-fbr-bg-dark" value={info.email} disabled />
        <input className="fbr-input" placeholder="Your full name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="fbr-input" type="password" placeholder="Password (8+ chars, letter and number)" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="fbr-btn w-full" disabled={busy}>{busy ? 'Joining…' : 'Accept invitation'}</button>
      </form>
    </AuthLayout>
  );
}
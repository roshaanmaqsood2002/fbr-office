import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../lib/api';
import AuthLayout from '../components/AuthLayout';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Sign in" subtitle="Access your firm's dashboard">
      <form onSubmit={onSubmit} className="space-y-4">
        <input className="fbr-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="fbr-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="fbr-btn w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-fbr-text-light">
        New law firm?{' '}
        <Link to="/signup" className="font-medium text-fbr-green-light hover:text-fbr-gold-dark">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
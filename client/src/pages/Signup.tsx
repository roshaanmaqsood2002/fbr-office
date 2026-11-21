    import { useState, type FormEvent } from 'react';
    import { Link, Navigate, useNavigate } from 'react-router-dom';
    import toast from 'react-hot-toast';
    import { useAuth } from '../context/AuthContext';
    import { getErrorMessage } from '../lib/api';
    import AuthLayout from '../components/AuthLayout';

    export default function Signup() {
    const { user, signup } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ firmName: '', name: '', email: '', password: '' });
    const [busy, setBusy] = useState(false);

    if (user) return <Navigate to="/" replace />;

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
        await signup(form);
        toast.success('Account created successfully');
        navigate('/');
        } catch (err) {
        toast.error(getErrorMessage(err));
        } finally {
        setBusy(false);
        }
    };

    return (
        <AuthLayout title="Create your firm account" subtitle="You'll be the firm owner and can invite your team later">
        <form onSubmit={onSubmit} className="space-y-4">
            <input className="fbr-input" placeholder="Law firm name" value={form.firmName} onChange={set('firmName')} required />
            <input className="fbr-input" placeholder="Your full name" value={form.name} onChange={set('name')} required />
            <input className="fbr-input" type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
            <input className="fbr-input" type="password" placeholder="Password (8+ chars, letter and number)" value={form.password} onChange={set('password')} required />
            <button className="fbr-btn w-full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-fbr-text-light">
            Already registered?{' '}
            <Link to="/login" className="font-medium text-fbr-green-light hover:text-fbr-gold-dark">Sign in</Link>
        </p>
        </AuthLayout>
    );
    }
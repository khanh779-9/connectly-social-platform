import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordField } from '@/components/ui/password-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import ConnectlyMark from '@/components/layout/ConnectlyMark';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearError, register } from '@/store/authSlice';

export default function RegisterPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, error } = useAppSelector((state) => state.auth);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Start from a clean slate: a failed sign-in must not leak onto this form.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm || password.length < 8) return;

    try {
      await dispatch(register({ email, password, displayName, rememberMe })).unwrap();
      navigate('/');
    } catch {
      // The rejected thunk exposes the user-facing error through auth state.
    }
  }

  let message: string | null = null;
  if (password !== confirm && password.length > 0) message = 'Passwords do not match.';
  else if (password.length > 0 && password.length < 8) message = 'Password must be at least 8 characters.';
  else message = error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <ConnectlyMark size={34} />
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Create your account</h1>
          <p className="text-[13px] text-muted-foreground">Join Connectly and start connecting.</p>
        </div>


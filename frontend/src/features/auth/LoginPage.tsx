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
import { clearError, login } from '@/store/authSlice';

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { status, error } = useAppSelector((state) => state.auth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // An error from an earlier login attempt (or from the register page) must not
  // greet the visitor as soon as this form opens.
  useEffect(() => {
    dispatch(clearError());
  }, [dispatch]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !password) return;

    try {
      await dispatch(login({ email, password, rememberMe })).unwrap();
      navigate('/');
    } catch {
      // The rejected thunk exposes the user-facing error through auth state.
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <ConnectlyMark size={34} />
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">
            Sign in to Connectly
          </h1>
          <p className="text-[13px] text-muted-foreground">Your feed, your people, your messages.</p>
        </div>

        <form className="space-y-4 rounded border border-border bg-card p-5" onSubmit={handleSubmit}>
          <label className="block text-sm">
            <span className="mb-1.5 block text-[13px] font-medium text-foreground">Email</span>
            <Input id="email" type="email" placeholder="you@example.com" value={email}
              onChange={(event) => setEmail(event.target.value)} required autoComplete="email"
              aria-describedby={error ? 'login-error' : undefined} />
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block text-[13px] font-medium text-foreground">Password</span>
            <PasswordField id="password" value={password}
              onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password"
              aria-describedby={error ? 'login-error' : undefined} />
          </label>

          <label className="flex items-center gap-2 text-[13px]">
            <Checkbox id="rememberMe" checked={rememberMe}
              onChange={(event) => setRememberMe(event.currentTarget.checked)} />
            <span className="text-muted-foreground">Remember me</span>
          </label>

          {error && (
            <Card id="login-error" className="rounded bg-destructive-soft px-3 py-2 text-[13px] text-destructive" role="alert">
              {error}
            </Card>
          )}

          <Button type="submit" variant="primary" className="w-full" disabled={status === 'loading'}>
            {status === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
          </Button>
        </form>

        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to="/register" className="font-medium text-accent hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}

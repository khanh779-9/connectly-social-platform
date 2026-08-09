import { useEffect, useState } from 'react';
import { Loader2, LogOut, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage, timeAgo } from '@/lib/social';
import { fetchSessions, revokeSessions } from '@/lib/security';
import { cn } from '@/lib/utils';
import type { UserSessionDto } from '@/types/api';

function signedInAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Devices signed in to the account, with bulk sign-out for the ones selected.
export default function SecuritySection() {
  const [sessions, setSessions] = useState<UserSessionDto[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      setSessions(await fetchSessions());
      setSelected([]);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: string) {
    setNotice(null);
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function signOutSelected() {
    if (selected.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      const revoked = await revokeSessions(selected);
      setNotice(
        revoked === 1 ? 'Signed out 1 device.' : `Signed out ${revoked} devices.`,
      );
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Devices and sessions</CardTitle>
          <CardDescription>
            Every browser that is signed in to your account. Signing one out ends its session
            immediately; that device has to sign in again.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Card className="mb-4 rounded border border-border bg-secondary/60 px-3 py-2.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              You get a notification whenever your account signs in on a device it has not used
              before. If you do not recognise one of the sessions below, sign it out and change
              your password.
            </p>
          </Card>

          {error && (
            <Card className="mb-3 rounded border border-destructive/40 bg-destructive-soft px-3 py-2 text-[12px] text-destructive">
              {error}
            </Card>
          )}
          {notice && (
            <Card className="mb-3 rounded border border-border bg-secondary px-3 py-2 text-[12px] text-foreground">
              {notice}
            </Card>
          )}

          {status === 'loading' && (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {status === 'error' && (
            <div className="py-6 text-center text-[13px] text-muted-foreground">
              <p className="font-medium text-foreground">Could not load your sessions</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={load}>
                Try again
              </Button>
            </div>
          )}

          {status === 'ready' && sessions.length === 0 && (
            <p className="py-6 text-center text-[13px] text-muted-foreground">
              No other devices are signed in.
            </p>
          )}

          {status === 'ready' && sessions.length > 0 && (
            <ul className="divide-y divide-border rounded border border-border">
              {sessions.map((session) => {
                const checked = selected.includes(session.id);
                // "Last active" only adds information once the session has been reused.
                const lastUsed =
                  session.lastUsedAt &&
                  new Date(session.lastUsedAt).getTime() - new Date(session.createdAt).getTime() > 60_000
                    ? session.lastUsedAt
                    : null;
                return (
                  <li
                    key={session.id}
                    className={cn(
                      'flex items-start gap-3 px-3 py-3',
                      checked && 'bg-accent-soft/40',
                    )}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${session.deviceLabel ?? 'device'}`}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                      checked={checked}
                      disabled={session.current || working}
                      onChange={() => toggle(session.id)}
                    />

                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      <MonitorSmartphone className="h-[18px] w-[18px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                        {session.deviceLabel ?? 'Unknown device'}
                        {session.current && (
                          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">
                            This device
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {[session.ipAddress, session.location].filter(Boolean).join(' · ') ||
                          'Address unavailable'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        Signed in {signedInAt(session.createdAt)}
                        {lastUsed ? ` · last active ${timeAgo(lastUsed)}` : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {status === 'ready' && sessions.length > 0 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-[12px] text-muted-foreground">
                {selected.length === 0
                  ? 'Select the devices you want to sign out.'
                  : `${selected.length} selected.`}
              </p>
              <Button
                variant="danger"
                size="sm"
                disabled={selected.length === 0 || working}
                onClick={signOutSelected}
              >
                {working ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
                Sign out selected
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

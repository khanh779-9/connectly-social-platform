import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Lock, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { avatarTone } from '@/lib/avatar';
import {
  createGroup,
  fetchGroups,
  fetchMyGroups,
  getErrorMessage,
  joinGroup,
} from '@/lib/social';
import type { GroupDto } from '@/types/api';

type Tab = 'mine' | 'discover';

export default function GroupsPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<GroupDto[]>([]);
  const [discover, setDiscover] = useState<GroupDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // create form
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const [myGroups, page] = await Promise.all([fetchMyGroups(), fetchGroups(undefined, 30)]);
      setMine(myGroups);
      setDiscover(page.items);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitGroup(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const created = await createGroup({ name: name.trim(), description: description.trim(), visibility });
      setMine((prev) => [created, ...prev]);
      setDiscover((prev) => [created, ...prev]);
      setName('');
      setDescription('');
      setVisibility('Public');
      setCreating(false);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function join(group: GroupDto) {
    try {
      const updated = await joinGroup(group.id);
      setMine((prev) =>
        updated.viewerStatus === 'active'
          ? [updated, ...prev.filter((item) => item.id !== updated.id)]
          : prev,
      );
      setDiscover((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const list = tab === 'mine' ? mine : discover;

  return (
    <div className="mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Groups
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Find communities, share posts with members, and organize events.
          </p>
        </div>
        <Button
          variant={creating ? 'ghost' : 'primary'}
          className="shrink-0"
          onClick={() => setCreating((prev) => !prev)}
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Cancel' : 'Create group'}
        </Button>
      </header>

      {creating && (
        <Card onSubmit={submitGroup} className="space-y-3 rounded border border-border bg-card p-4">
          <div>
            <label htmlFor="group-name" className="text-[13px] font-medium text-foreground">
              Group name
            </label>
            <input
              id="group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="e.g. ASP.NET Study Group"
              className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'group-create-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="group-description" className="text-[13px] font-medium text-foreground">
              Description
            </label>
            <textarea
              id="group-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What is this group about?"
              className="mt-1 w-full resize-none rounded border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'group-create-error' : undefined}
            />
          </div>
          <div>
            <span className="text-[13px] font-medium text-foreground">Privacy</span>
            <div className="mt-1 flex gap-2">
              <PrivacyOption
                value="Public"
                current={visibility}
                onSelect={setVisibility}
                label="Public"
                hint="Anyone can see and join"
              />
              <PrivacyOption
                value="Private"
                current={visibility}
                onSelect={setVisibility}
                label="Private"
                hint="Members only, join by approval"
              />
            </div>
          </div>
          {formError && <p id="group-create-error" className="text-[12px] text-destructive" role="alert">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || saving}>
              {saving ? 'Creating…' : 'Create group'}
            </Button>
          </div>
        </Card>
      )}

      <nav className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'mine'} label="Your groups" count={mine.length} onClick={() => setTab('mine')} />
        <TabButton
          active={tab === 'discover'}
          label="Discover"
          count={discover.length}
          onClick={() => setTab('discover')}
        />
      </nav>

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      {status === 'loading' && (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {status === 'error' && (
        <Card className="rounded border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Could not load groups</p>
          <p className="mt-1">{error}</p>
          <Button variant="ghost" className="mt-4" onClick={load}>
            Try again
          </Button>
        </Card>
      )}

      {status === 'ready' && (
        <Card className="rounded border border-border bg-card">
          {list.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              {tab === 'mine'
                ? 'You are not in any group yet. Create one or join from Discover.'
                : 'No public groups available yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((group) => (
                <li key={group.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
                    style={avatarTone(group.id)}
                  >
                    {group.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/groups/${group.id}`}
                      className="block truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {group.name}
                    </Link>
                    <p className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <span className="tnum">{group.memberCount} members</span>
                      {group.visibility === 'Private' && (
                        <span className="inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Private
                        </span>
                      )}
                    </p>
                  </div>

                  {group.viewerStatus === 'active' ? (
                    <span className="inline-flex items-center gap-1 text-[12px] text-accent">
                      <Users className="h-3.5 w-3.5" /> Member
                    </span>
                  ) : group.viewerStatus === 'pending' ? (
                    <span className="text-[12px] text-muted-foreground">Request pending</span>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => join(group)}>
                      Join
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'border-b-2 border-accent px-3 py-2 text-sm font-medium text-foreground'
          : 'border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground'
      }
    >
      {label}
      <span className="ml-1.5 text-[12px] text-muted-foreground tnum">{count}</span>
    </button>
  );
}

function PrivacyOption({
  value,
  current,
  onSelect,
  label,
  hint,
}: {
  value: 'Public' | 'Private';
  current: 'Public' | 'Private';
  onSelect: (value: 'Public' | 'Private') => void;
  label: string;
  hint: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={
        active
          ? 'flex-1 rounded border border-accent bg-secondary px-3 py-2 text-left'
          : 'flex-1 rounded border border-input px-3 py-2 text-left transition-colors hover:bg-secondary'
      }
    >
      <span className="block text-[13px] font-medium text-foreground">{label}</span>
      <span className="block text-[12px] text-muted-foreground">{hint}</span>
    </button>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { avatarTone } from '@/lib/avatar';
import { createPage, fetchMyPages, fetchPages, getErrorMessage } from '@/lib/social';
import type { PageDto } from '@/types/api';

type Tab = 'mine' | 'discover';

export default function PagesPage() {
  const [tab, setTab] = useState<Tab>('mine');
  const [mine, setMine] = useState<PageDto[]>([]);
  const [discover, setDiscover] = useState<PageDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const [myPages, page] = await Promise.all([fetchMyPages(), fetchPages(undefined, 30)]);
      setMine(myPages);
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const created = await createPage({
        name: name.trim(),
        description: description.trim() || null,
        category: category.trim() || null,
      });
      setMine((prev) => [created, ...prev]);
      setDiscover((prev) => [created, ...prev]);
      setName('');
      setDescription('');
      setCategory('');
      setCreating(false);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const list = tab === 'mine' ? mine : discover;

  return (
    <div className="mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Pages
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            A public presence for your company, project or community.
          </p>
        </div>
        <Button
          variant={creating ? 'ghost' : 'primary'}
          className="shrink-0"
          onClick={() => setCreating((prev) => !prev)}
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Cancel' : 'Create page'}
        </Button>
      </header>

      {creating && (
        <Card onSubmit={submit} className="space-y-3 rounded border border-border bg-card p-4">
          <div>
            <label htmlFor="page-name" className="text-[13px] font-medium text-foreground">
              Page name
            </label>
            <input
              id="page-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              placeholder="e.g. Connectly Studio"
              className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'page-create-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="page-category" className="text-[13px] font-medium text-foreground">
              Category
            </label>
            <input
              id="page-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              maxLength={80}
              placeholder="Software, Community, Local business…"
              className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'page-create-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="page-description" className="text-[13px] font-medium text-foreground">
              About
            </label>
            <textarea
              id="page-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={3}
              className="mt-1 w-full resize-none rounded border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'page-create-error' : undefined}
            />
          </div>
          {formError && <p id="page-create-error" className="text-[12px] text-destructive" role="alert">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!name.trim() || saving}>
              {saving ? 'Creating…' : 'Create page'}
            </Button>
          </div>
        </Card>
      )}

      <nav className="flex gap-1 border-b border-border">
        <TabButton active={tab === 'mine'} label="Your pages" count={mine.length} onClick={() => setTab('mine')} />
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
          <p className="font-medium text-foreground">Could not load pages</p>
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
              {tab === 'mine' ? 'You do not manage any page yet.' : 'No pages available yet.'}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {list.map((page) => (
                <li key={page.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-sm font-semibold text-white"
                    style={avatarTone(page.id)}
                  >
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/pages/${page.id}`}
                      className="block truncate text-sm font-medium text-foreground hover:underline"
                    >
                      {page.name}
                    </Link>
                    <p className="truncate text-[12px] text-muted-foreground">
                      {page.category ? `${page.category} · ` : ''}
                      <span className="tnum">{page.postCount}</span> posts ·{' '}
                      <span className="tnum">{page.adminCount}</span> admins
                    </p>
                  </div>
                  {page.viewerRole && (
                    <span className="text-[12px] capitalize text-accent">{page.viewerRole}</span>
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

import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, MapPin, Plus, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  createEvent,
  fetchEvents,
  fetchMyGroups,
  getErrorMessage,
  setEventRsvp,
} from '@/lib/social';
import type { EventDto, GroupDto } from '@/types/api';

/** Keeps the "going" / "interested" counters in sync with the new RSVP. */
function nextRsvpCount(
  count: number,
  previous: string | null,
  next: string,
  kind: 'going' | 'interested',
): number {
  if (next === kind && previous !== kind) return count + 1;
  if (previous === kind && next !== kind) return Math.max(0, count - 1);
  return count;
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventDto[]>([]);
  const [groups, setGroups] = useState<GroupDto[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  // create form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [onlineUrl, setOnlineUrl] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [groupId, setGroupId] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    setStatus('loading');
    setError(null);
    try {
      const [page, myGroups] = await Promise.all([fetchEvents(undefined, 30), fetchMyGroups()]);
      setEvents(page.items);
      setGroups(myGroups);
      setStatus('ready');
    } catch (err) {
      setError(getErrorMessage(err));
      setStatus('error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim() || !startsAt || saving) return;
    setSaving(true);
    setFormError(null);
    try {
      const created = await createEvent({
        title: title.trim(),
        description: description.trim() || null,
        locationText: location.trim() || null,
        onlineUrl: onlineUrl.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        groupId: groupId || null,
      });
      setEvents((prev) => [created, ...prev]);
      setTitle('');
      setDescription('');
      setLocation('');
      setOnlineUrl('');
      setStartsAt('');
      setEndsAt('');
      setGroupId('');
      setCreating(false);
    } catch (err) {
      setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function rsvp(event: EventDto, rsvpStatus: 'going' | 'interested' | 'notgoing') {
    if (workingId) return;
    setWorkingId(event.id);
    const previous = event.viewerRsvp ?? null;
    setEvents((prev) =>
      prev.map((item) => {
        if (item.id !== event.id) return item;
        return {
          ...item,
          viewerRsvp: rsvpStatus === 'notgoing' ? null : rsvpStatus,
          goingCount: nextRsvpCount(item.goingCount, previous, rsvpStatus, 'going'),
          interestedCount: nextRsvpCount(item.interestedCount, previous, rsvpStatus, 'interested'),
        };
      }),
    );
    try {
      await setEventRsvp(event.id, rsvpStatus);
    } catch (err) {
      setError(getErrorMessage(err));
      setEvents((prev) => prev.map((item) => (item.id === event.id ? event : item)));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="mx-auto space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Events
          </h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Gather your network — online meetups or events hosted by your groups.
          </p>
        </div>
        <Button
          variant={creating ? 'ghost' : 'primary'}
          className="shrink-0"
          onClick={() => setCreating((prev) => !prev)}
        >
          <Plus className="h-4 w-4" />
          {creating ? 'Cancel' : 'Create event'}
        </Button>
      </header>

      {creating && (
        <Card onSubmit={submitEvent} className="space-y-3 rounded border border-border bg-card p-4">
          <div>
            <label htmlFor="event-title" className="text-[13px] font-medium text-foreground">
              Title
            </label>
            <input
              id="event-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              placeholder="e.g. Weekly .NET meetup"
              className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'event-create-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="event-description" className="text-[13px] font-medium text-foreground">
              Description
            </label>
            <textarea
              id="event-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={5000}
              className="mt-1 w-full resize-none rounded border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
              aria-describedby={formError ? 'event-create-error' : undefined}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="event-start" className="text-[13px] font-medium text-foreground">
                Starts
              </label>
              <input
                id="event-start"
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                aria-describedby={formError ? 'event-create-error' : undefined}
              />
            </div>
            <div>
              <label htmlFor="event-end" className="text-[13px] font-medium text-foreground">
                Ends (optional)
              </label>
              <input
                id="event-end"
                type="datetime-local"
                value={endsAt}
                onChange={(event) => setEndsAt(event.target.value)}
                className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                aria-describedby={formError ? 'event-create-error' : undefined}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="event-location" className="text-[13px] font-medium text-foreground">
                Location
              </label>
              <input
                id="event-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={240}
                placeholder="Cafe, hall, city…"
                className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                aria-describedby={formError ? 'event-create-error' : undefined}
              />
            </div>
            <div>
              <label htmlFor="event-online" className="text-[13px] font-medium text-foreground">
                Online link
              </label>
              <input
                id="event-online"
                value={onlineUrl}
                onChange={(event) => setOnlineUrl(event.target.value)}
                maxLength={500}
                placeholder="https://…"
                className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring"
                aria-describedby={formError ? 'event-create-error' : undefined}
              />
            </div>
          </div>
          {groups.length > 0 && (
            <div>
              <label htmlFor="event-group" className="text-[13px] font-medium text-foreground">
                Hosted by a group (optional)
              </label>
              <select
                id="event-group"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                className="mt-1 h-9 w-full rounded border border-input bg-card px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                aria-describedby={formError ? 'event-create-error' : undefined}
              >
                <option value="">Personal event</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {formError && <p id="event-create-error" className="text-[12px] text-destructive" role="alert">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!title.trim() || !startsAt || saving}>
              {saving ? 'Creating…' : 'Create event'}
            </Button>
          </div>
        </Card>
      )}


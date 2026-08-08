import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Check,
  Loader2,
  Lock,
  MessageSquare,
  Monitor,
  Moon,
  Palette,
  Send,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SecuritySection from '@/features/settings/SecuritySection';
import { useAppSelector } from '@/store/hooks';
import { readTheme, setTheme, subscribeTheme, type ThemeMode } from '@/lib/theme';
import { cn } from '@/lib/utils';
import {
  fetchChatSettings,
  fetchMe,
  fetchPrivacySettings,
  getErrorMessage,
  saveChatSettings,
  savePrivacySettings,
} from '@/lib/social';
import type {
  ChatSettingsDto,
  MeDto,
  MessagePrivacy,
  PostVisibilitySetting,
  PrivacySettingsDto,
  ProfileAudience,
} from '@/types/api';

const OPTIONS: { mode: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  { mode: 'light', label: 'Light', description: 'Bright surfaces, dark ink.', icon: Sun },
  { mode: 'dark', label: 'Dark', description: 'Dark surfaces, light ink.', icon: Moon },
  {
    mode: 'system',
    label: 'Auto',
    description: 'Follow your operating system setting.',
    icon: Monitor,
  },
];

const AUDIENCES: { value: ProfileAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'friends_of_friends', label: 'Friends and friends of friends' },
  { value: 'only_me', label: 'Only me' },
];

const POST_VISIBILITIES: { value: PostVisibilitySetting; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'friends', label: 'Friends' },
  { value: 'only_me', label: 'Only me' },
];

const FRIEND_REQUEST_POLICIES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends_of_friends', label: 'Friends of friends' },
] as const;

const SEARCH_VISIBILITIES: { value: ProfileAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'only_me', label: 'No one' },
];

const COMMENT_POLICIES: { value: ProfileAudience; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
];

const MESSAGE_POLICIES: { value: MessagePrivacy; label: string }[] = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends only' },
  { value: 'nobody', label: 'No one' },
];

const selectClass =
  'shrink-0 rounded border border-input bg-card px-2 py-1.5 text-[13px] text-foreground outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-60';

type SectionKey = 'appearance' | 'account' | 'posting' | 'privacy' | 'messages' | 'security';

const SECTIONS: { key: SectionKey; label: string; icon: typeof Sun }[] = [
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'account', label: 'Account', icon: User },
  { key: 'posting', label: 'Posting', icon: Send },
  { key: 'privacy', label: 'Privacy', icon: Lock },
  { key: 'messages', label: 'Messages', icon: MessageSquare },
  { key: 'security', label: 'Security', icon: ShieldCheck },
];

interface RowProps<T extends string> {
  label: string;
  description?: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** One label + audience picker; the picker saves on change. */
function SettingRow<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: RowProps<T>) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description}</p>
        )}
      </div>
      <select
        aria-label={label}
        className={selectClass}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function isSection(value: string | null): value is SectionKey {
  return SECTIONS.some((section) => section.key === value);
}

export default function SettingsPage() {
  const { userId, displayName } = useAppSelector((state) => state.auth);
  const [params, setParams] = useSearchParams();
  const [section, setSection] = useState<SectionKey>(() => {
    const requested = params.get('section');
    return isSection(requested) ? requested : 'appearance';
  });
  const [mode, setMode] = useState<ThemeMode>(readTheme);
  const [me, setMe] = useState<MeDto | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettingsDto | null>(null);
  const [chat, setChat] = useState<ChatSettingsDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => subscribeTheme(setMode), []);

  // Deep links (e.g. a "new sign-in" notification) can change the section while
  // this page is already mounted, so follow the query string instead of only
  // reading it once on mount.
  useEffect(() => {
    const requested = params.get('section');
    if (isSection(requested)) setSection(requested);
  }, [params]);

  useEffect(() => {
    fetchMe()
      .then(setMe)
      .catch(() => undefined);
    fetchPrivacySettings()
      .then(setPrivacy)
      .catch((err) => setError(getErrorMessage(err)));
    fetchChatSettings()
      .then(setChat)
      .catch(() => undefined);
  }, [userId]);

  function openSection(next: SectionKey) {
    setSection(next);
    setParams(next === 'appearance' ? {} : { section: next }, { replace: true });
    setSavedAt(null);
  }

  /** Applies the change locally first, then persists it; a failed save is reported. */
  async function updatePrivacy(patch: Partial<PrivacySettingsDto>) {
    if (!privacy) return;
    const previous = privacy;
    setPrivacy({ ...privacy, ...patch });
    setSaving(true);
    setError(null);
    try {
      setPrivacy(await savePrivacySettings(patch));
      setSavedAt(Date.now());
    } catch (err) {
      setPrivacy(previous);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateMessages(messagePrivacy: MessagePrivacy) {
    if (!chat) return;
    const previous = chat;
    setChat({ messagePrivacy });
    setSaving(true);
    setError(null);
    try {
      setChat(await saveChatSettings({ messagePrivacy }));
      setSavedAt(Date.now());
    } catch (err) {
      setChat(previous);
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3 pb-1">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Appearance, privacy, who is allowed to reach you, and the devices signed in.
          </p>
        </div>
        <span className="flex items-center gap-1.5 pt-1 text-[12px] text-muted-foreground">
          {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {!saving && savedAt !== null && (
            <>
              <Check className="h-3.5 w-3.5 text-accent" />
              Saved
            </>
          )}
        </span>
      </header>

      {error && (
        <p className="rounded border border-destructive/40 bg-destructive-soft px-3 py-2 text-[12px] text-destructive">
          {error}
        </p>
      )}

      <div className="grid items-start gap-5 md:grid-cols-[224px_minmax(0,1fr)]">
        {/* Group navigation — one group of settings is shown at a time */}
        <nav
          aria-label="Settings groups"
          className="flex gap-1 overflow-x-auto border-b border-border pb-1 md:sticky md:top-16 md:flex-col md:overflow-visible md:border-b-0 md:pb-0"
        >
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => openSection(item.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded px-3 py-2 text-left text-[13px] font-medium transition-colors',
                  active
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-4">
          {section === 'appearance' && (
            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>
                  Applied instantly and remembered on your account. Auto follows your system and
                  switches with it.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div role="radiogroup" aria-label="Theme" className="grid gap-2 sm:grid-cols-3">
                  {OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = option.mode === mode;
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTheme(option.mode)}
                        className={cn(
                          'flex items-start gap-2.5 rounded border p-3 text-left transition-colors',
                          active
                            ? 'border-accent bg-accent-soft/60'
                            : 'border-border bg-card hover:bg-secondary',
                        )}
                      >
                        <Icon
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            active ? 'text-accent' : 'text-muted-foreground',
                          )}
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1 text-[13px] font-medium text-foreground">
                            {option.label}
                            {active && <Check className="h-3.5 w-3.5 text-accent" />}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {section === 'account' && (
            <Card>
              <CardHeader>
                <CardTitle>Account</CardTitle>
                <CardDescription>How you appear across Connectly.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-[12px] font-medium text-muted-foreground">Display name</dt>
                    <dd className="mt-0.5 text-foreground">
                      {me?.displayName ?? displayName ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-medium text-muted-foreground">Email</dt>
                    <dd className="mt-0.5 truncate text-foreground">{me?.email ?? '—'}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[12px] text-muted-foreground">
                  Your password and sign-in email are managed separately from your profile details.
                </p>
                <Link
                  to="/profile"
                  className="mt-4 inline-flex text-[13px] font-medium text-accent hover:underline"
                >
                  Edit your profile
                </Link>
              </CardContent>
            </Card>
          )}

          {section === 'posting' && (
            <Card>
              <CardHeader>
                <CardTitle>Posting</CardTitle>
                <CardDescription>
                  The audience preselected in the composer, so you do not have to change it on every
                  post.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {privacy ? (
                  <SettingRow
                    label="Default audience for new posts"
                    description="You can still change it per post before publishing."
                    value={privacy.defaultPostVisibility}
                    options={POST_VISIBILITIES}
                    onChange={(value) => updatePrivacy({ defaultPostVisibility: value })}
                    disabled={saving}
                  />
                ) : (
                  <p className="text-[13px] text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'privacy' && (
            <Card>
              <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>
                  Decide who can find you, see each part of your profile, and open your lists. If you
                  pick a smaller group, everyone else just won't see that item.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {!privacy ? (
                  <p className="text-[13px] text-muted-foreground">Loading…</p>
                ) : (
                  <>
                    <section>
                      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Friend requests
                      </h3>
                      <div className="mt-2">
                        <SettingRow
                          label="Who can find you in search"
                          description="Used when someone searches your name or @username. With “No one”, your profile still opens for people who already have the link."
                          value={privacy.searchableAudience}
                          options={SEARCH_VISIBILITIES}
                          onChange={(value) => updatePrivacy({ searchableAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Who can comment on your posts"
                          description="Applies to all your posts. People outside this group can still see them, they just can't comment."
                          value={privacy.commentAudience}
                          options={COMMENT_POLICIES}
                          onChange={(value) => updatePrivacy({ commentAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Who can send you friend requests"
                          description="“Friends of friends” means the person has to share a friend with you first."
                          value={privacy.friendRequestPolicy}
                          options={FRIEND_REQUEST_POLICIES}
                          onChange={(value) => updatePrivacy({ friendRequestPolicy: value })}
                          disabled={saving}
                        />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Profile details
                      </h3>
                      <div className="mt-2">
                        <SettingRow
                          label="Profile photo"
                          description="The small picture next to your name on posts, comments, and in search."
                          value={privacy.avatarAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ avatarAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Cover photo"
                          description="The big banner at the top of your profile."
                          value={privacy.coverAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ coverAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Bio"
                          description="The short text you write about yourself."
                          value={privacy.bioAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ bioAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Email"
                          description="The email shown on your profile. This isn't the email you log in with."
                          value={privacy.emailAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ emailAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Date of birth"
                          description="Shown as a full date, like 12 April 1995."
                          value={privacy.birthdayAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ birthdayAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Phone number"
                          description="Shown as a number people can tap to call."
                          value={privacy.phoneAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ phoneAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="City"
                          description="Shown as “Lives in …”."
                          value={privacy.cityAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ cityAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Hometown"
                          description="Shown as “From …”."
                          value={privacy.hometownAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ hometownAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Website"
                          description="A link on your profile, like your blog or portfolio."
                          value={privacy.websiteAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ websiteAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Current location"
                          description="Free text on your profile, like “Da Nang”. This is not the same as City."
                          value={privacy.locationAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ locationAudience: value })}
                          disabled={saving}
                        />
                      </div>
                    </section>

                    <section>
                      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Lists
                      </h3>
                      <div className="mt-2">
                        <SettingRow
                          label="Friends list"
                          description="Who can open your Friends tab."
                          value={privacy.friendListAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ friendListAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="People and pages you follow"
                          description="Who can open your Following tab."
                          value={privacy.followingAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ followingAudience: value })}
                          disabled={saving}
                        />
                        <SettingRow
                          label="Your followers"
                          description="Who can open your Followers tab."
                          value={privacy.followersAudience}
                          options={AUDIENCES}
                          onChange={(value) => updatePrivacy({ followersAudience: value })}
                          disabled={saving}
                        />
                      </div>
                    </section>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'messages' && (
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
                <CardDescription>
                  This decides who can start a new conversation with you; replies in an existing
                  conversation are always delivered.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chat ? (
                  <SettingRow
                    label="Who can message you"
                    value={chat.messagePrivacy}
                    options={MESSAGE_POLICIES}
                    onChange={updateMessages}
                    disabled={saving}
                  />
                ) : (
                  <p className="text-[13px] text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
          )}

          {section === 'security' && <SecuritySection />}
        </div>
      </div>
    </div>
  );
}

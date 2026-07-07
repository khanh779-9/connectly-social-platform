import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './button';
import { Card, CardContent, CardHeader, CardTitle } from './card';
import { Input } from './input';
import { Avatar, AvatarFallback } from './avatar';
import { avatarTone } from '@/lib/avatar';
import { initials } from '@/lib/social';

const meta: Meta = {
  title: 'Design System/Overview',
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const ColorPalette: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-8">
      <section>
        <h3 className="mb-4 text-h3">Neutral Scale</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { name: 'neutral-0', value: 'var(--neutral-0)' },
            { name: 'neutral-50', value: 'var(--neutral-50)' },
            { name: 'neutral-100', value: 'var(--neutral-100)' },
            { name: 'neutral-200', value: 'var(--neutral-200)' },
            { name: 'neutral-300', value: 'var(--neutral-300)' },
            { name: 'neutral-400', value: 'var(--neutral-400)' },
            { name: 'neutral-500', value: 'var(--neutral-500)' },
            { name: 'neutral-600', value: 'var(--neutral-600)' },
            { name: 'neutral-700', value: 'var(--neutral-700)' },
            { name: 'neutral-800', value: 'var(--neutral-800)' },
            { name: 'neutral-900', value: 'var(--neutral-900)' },
            { name: 'neutral-950', value: 'var(--neutral-950)' },
          ].map(({ name, value }) => (
            <div key={name} className="rounded border p-4 text-center">
              <div
                className="h-16 w-full rounded mb-2"
                style={{ backgroundColor: value }}
              />
              <code className="text-xs font-mono">{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-h3">Primary (Teal) Scale</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { name: 'primary-50', value: 'var(--primary-50)' },
            { name: 'primary-100', value: 'var(--primary-100)' },
            { name: 'primary-200', value: 'var(--primary-200)' },
            { name: 'primary-300', value: 'var(--primary-300)' },
            { name: 'primary-400', value: 'var(--primary-400)' },
            { name: 'primary-500', value: 'var(--primary-500)' },
            { name: 'primary-600', value: 'var(--primary-600)' },
            { name: 'primary-700', value: 'var(--primary-700)' },
            { name: 'primary-800', value: 'var(--primary-800)' },
            { name: 'primary-900', value: 'var(--primary-900)' },
            { name: 'primary-950', value: 'var(--primary-950)' },
          ].map(({ name, value }) => (
            <div key={name} className="rounded border p-4 text-center">
              <div
                className="h-16 w-full rounded mb-2"
                style={{ backgroundColor: value }}
              />
              <code className="text-xs font-mono">{name}</code>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-h3">Semantic Colors</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { name: 'success', value: 'var(--color-success)' },
            { name: 'success-soft', value: 'var(--color-success-soft)' },
            { name: 'warning', value: 'var(--color-warning)' },
            { name: 'warning-soft', value: 'var(--color-warning-soft)' },
            { name: 'danger', value: 'var(--color-danger)' },
            { name: 'danger-soft', value: 'var(--color-danger-soft)' },
            { name: 'info', value: 'var(--color-info)' },
            { name: 'info-soft', value: 'var(--color-info-soft)' },
            { name: 'action-primary', value: 'var(--color-action-primary)' },
            { name: 'action-soft', value: 'var(--color-action-primary-soft)' },
          ].map(({ name, value }) => (
            <div key={name} className="rounded border p-4 text-center">
              <div
                className="h-16 w-full rounded mb-2"
                style={{ backgroundColor: value }}
              />
              <code className="text-xs font-mono">{name}</code>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
};

export const TypographyScale: Story = {
  render: () => (
    <div className="w-full max-w-3xl space-y-6">
      {[
        { label: 'display-xl', className: 'text-display-xl', text: 'Display XL (48-64px)' },
        { label: 'display', className: 'text-display', text: 'Display (36-48px)' },
        { label: 'h1', className: 'text-h1', text: 'H1 (28-36px)' },
        { label: 'h2', className: 'text-h2', text: 'H2 (22-28px)' },
        { label: 'h3', className: 'text-h3', text: 'H3 (18-22px)' },
        { label: 'h4', className: 'text-h4', text: 'H4 (16-18px)' },
        { label: 'body-lg', className: 'text-body-lg', text: 'Body Large (16px)' },
        { label: 'body', className: 'text-body', text: 'Body (14px)' },
        { label: 'body-sm', className: 'text-body-sm', text: 'Body Small (13px)' },
        { label: 'label', className: 'text-label', text: 'Label (12px)' },
        { label: 'caption', className: 'text-caption', text: 'Caption (11px)' },
      ].map(({ label, className, text }) => (
        <div key={label} className="space-y-1">
          <code className="text-xs font-mono text-muted-foreground">{label}</code>
          <p className={className}>{text}</p>
        </div>
      ))}
    </div>
  ),
};

export const FontWeights: Story = {
  render: () => (
    <div className="w-full max-w-md space-y-4">
      {[
        { label: 'normal (400)', className: 'font-normal' },
        { label: 'medium (500)', className: 'font-medium' },
        { label: 'semibold (600)', className: 'font-semibold' },
        { label: 'bold (700)', className: 'font-bold' },
      ].map(({ label, className }) => (
        <div key={label} className="space-y-1">
          <code className="text-xs font-mono text-muted-foreground">{label}</code>
          <p className={className}>The quick brown fox jumps over the lazy dog.</p>
        </div>
      ))}
    </div>
  ),
};

export const SpacingScale: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-6">
      <h3 className="text-h3">Primitive Spacing (4px base)</h3>
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { name: 'space-0', value: '0' },
          { name: 'space-1', value: '4px' },
          { name: 'space-2', value: '8px' },
          { name: 'space-3', value: '12px' },
          { name: 'space-4', value: '16px' },
          { name: 'space-5', value: '20px' },
          { name: 'space-6', value: '24px' },
          { name: 'space-8', value: '32px' },
          { name: 'space-10', value: '40px' },
          { name: 'space-12', value: '48px' },
          { name: 'space-16', value: '64px' },
        ].map(({ name, value }) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <div className="h-8 bg-primary/10 rounded" style={{ width: value }} />
            <code className="text-xs font-mono">{name}</code>
            <span className="text-xs text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>

      <h3 className="text-h3">Semantic Spacing Aliases</h3>
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { name: 'xs', value: '4px' },
          { name: 'sm', value: '8px' },
          { name: 'md', value: '12px' },
          { name: 'lg', value: '16px' },
          { name: 'xl', value: '20px' },
          { name: '2xl', value: '24px' },
          { name: '3xl', value: '32px' },
          { name: '4xl', value: '40px' },
          { name: '5xl', value: '48px' },
          { name: '6xl', value: '64px' },
        ].map(({ name, value }) => (
          <div key={name} className="flex flex-col items-center gap-2">
            <div className="h-8 bg-primary/10 rounded" style={{ width: value }} />
            <code className="text-xs font-mono">{name}</code>
            <span className="text-xs text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  ),
};

export const BorderRadius: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-6">
      {[
        { name: 'none', value: '0' },
        { name: 'xs', value: '4px' },
        { name: 'sm', value: '6px' },
        { name: 'md (DEFAULT)', value: '10px' },
        { name: 'lg', value: '14px' },
        { name: 'xl', value: '20px' },
        { name: '2xl', value: '28px' },
        { name: 'full', value: '9999px' },
      ].map(({ name, value }) => (
        <div key={name} className="flex items-center gap-4">
          <div
            className="h-12 w-24 bg-primary/10 border border-primary/20"
            style={{ borderRadius: value }}
          />
          <code className="text-sm font-mono w-24">{name}</code>
          <span className="text-sm text-muted-foreground">{value}</span>
        </div>
      ))}
    </div>
  ),
};

export const Shadows: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-6">
      {[
        { name: 'xs', value: 'var(--shadow-xs)' },
        { name: 'sm', value: 'var(--shadow-sm)' },
        { name: 'md (DEFAULT)', value: 'var(--shadow-md)' },
        { name: 'lg', value: 'var(--shadow-lg)' },
        { name: 'xl', value: 'var(--shadow-xl)' },
        { name: '2xl', value: 'var(--shadow-2xl)' },
      ].map(({ name, value }) => (
        <div key={name} className="flex items-center gap-4">
          <Card className="h-16 w-24 flex items-center justify-center" style={{ boxShadow: value }}>
            <span className="text-sm text-muted-foreground">Content</span>
          </Card>
          <code className="text-sm font-mono w-24">{name}</code>
        </div>
      ))}
    </div>
  ),
};

export const SemanticShadows: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-6">
      {[
        { name: 'card', value: 'var(--shadow-card)' },
        { name: 'card-hover', value: 'var(--shadow-card-hover)' },
        { name: 'dropdown', value: 'var(--shadow-dropdown)' },
        { name: 'modal', value: 'var(--shadow-modal)' },
        { name: 'toast', value: 'var(--shadow-toast)' },
      ].map(({ name, value }) => (
        <div key={name} className="flex items-center gap-4">
          <Card className="h-16 w-24 flex items-center justify-center" style={{ boxShadow: value }}>
            <span className="text-sm text-muted-foreground">Content</span>
          </Card>
          <code className="text-sm font-mono w-24">{name}</code>
        </div>
      ))}
    </div>
  ),
};

export const ComponentTokens: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-8">
      <section>
        <h3 className="mb-4 text-h3">Button Heights</h3>
        <div className="flex items-center gap-4 flex-wrap">
          {['xs', 'sm', 'md', 'lg', 'xl'].map((size) => (
            <Button key={size} size={size as any}>
              {size}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-h3">Input Heights</h3>
        <div className="flex flex-col gap-4 w-72">
          <Input placeholder="Small (36px)" className="h-9" />
          <Input placeholder="Medium (40px)" className="h-10" />
          <Input placeholder="Large (48px)" className="h-12" />
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-h3">Avatar Sizes</h3>
        <div className="flex items-center gap-4">
          {['xs', 'sm', 'md', 'lg', 'xl', '2xl'].map((size) => (
            <Avatar key={size} className={`h-${{xs:6, sm:8, md:10, lg:12, xl:16, '2xl':20}[size]} w-${{xs:6, sm:8, md:10, lg:12, xl:16, '2xl':20}[size]}`}>
              <AvatarFallback style={avatarTone(size)}>
                {initials(size)}
              </AvatarFallback>
            </Avatar>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-h3">Badge Heights</h3>
        <div className="flex items-center gap-4">
          <span className="h-5 px-2 text-xs font-medium rounded-full bg-primary/10 text-primary">
            Small
          </span>
          <span className="h-5 px-3 text-sm font-medium rounded-full bg-primary/10 text-primary">
            Default
          </span>
        </div>
      </section>
    </div>
  ),
};

export const Animations: Story = {
  render: () => (
    <div className="w-full max-w-4xl space-y-8">
      <section>
        <h3 className="mb-4 text-h3">Durations</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'instant (0ms)', className: 'duration-instant' },
            { name: 'fast (100ms)', className: 'duration-fast' },
            { name: 'normal (150ms)', className: 'duration-normal' },
            { name: 'slow (250ms)', className: 'duration-slow' },
            { name: 'slower (350ms)', className: 'duration-slower' },
          ].map(({ name, className }) => (
            <div key={name} className="p-4 bg-muted/50 rounded">
              <code className="text-xs font-mono block mb-2">{name}</code>
              <Button className={`transition-all ${className} hover:scale-105`} variant="ghost">
                Hover me
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-h3">Easing Curves</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'linear', className: 'ease-linear' },
            { name: 'ease-in', className: 'ease-in' },
            { name: 'ease-out', className: 'ease-out' },
            { name: 'ease-in-out', className: 'ease-in-out' },
            { name: 'spring', className: 'ease-spring' },
            { name: 'bounce', className: 'ease-bounce' },
          ].map(({ name, className }) => (
            <div key={name} className="p-4 bg-muted/50 rounded">
              <code className="text-xs font-mono block mb-2">{name}</code>
              <Button className={`transition-all duration-500 ${className} hover:translate-x-4`} variant="ghost">
                Hover me
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  ),
};
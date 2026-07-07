import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './input';
import { Button } from './button';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'tel', 'url', 'search'],
      description: 'Input type',
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the input',
    },
    placeholder: {
      control: 'text',
      description: 'Placeholder text',
    },
    toggleIcon: {
      control: 'boolean',
      description: 'Show password toggle (only for password type)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithValue: Story = {
  args: {
    defaultValue: 'Prefilled value',
    placeholder: 'Enter text...',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'you@example.com',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password',
    toggleIcon: true,
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const WithError: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <Input
        placeholder="Email"
        defaultValue="invalid-email"
        className="border-destructive focus-visible:ring-destructive"
        aria-invalid="true"
        aria-describedby="email-error"
      />
      <p id="email-error" className="text-[12px] text-destructive" role="alert">
        Please enter a valid email address
      </p>
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="w-72 space-y-2">
      <label className="block text-sm font-medium text-foreground">
        Email address
        <Input
          type="email"
          placeholder="you@example.com"
          className="mt-1"
        />
      </label>
      <p className="text-[12px] text-muted-foreground">We'll never share your email.</p>
    </div>
  ),
};

export const InputSizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-72">
      <Input placeholder="Small (default)" />
      <Input placeholder="Medium" className="h-10 text-base" />
      <Input placeholder="Large" className="h-12 text-lg" />
    </div>
  ),
};

export const FormExample: Story = {
  render: () => (
    <form className="w-80 space-y-4" onSubmit={(e) => e.preventDefault()}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Display name
        </label>
        <Input placeholder="Jane Doe" required />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Email
        </label>
        <Input type="email" placeholder="you@example.com" required />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">
          Password
        </label>
        <Input type="password" placeholder="••••••••" toggleIcon required />
      </div>
      <Button type="submit" className="w-full">Create account</Button>
    </form>
  ),
};

export const SearchInput: Story = {
  args: {
    type: 'search',
    placeholder: 'Search...',
    className: 'h-10 pl-10 pr-4 bg-muted',
  },
  render: (args) => (
    <div className="relative w-72">
      <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <Input {...args} />
    </div>
  ),
};
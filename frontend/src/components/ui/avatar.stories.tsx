import type { Meta, StoryObj } from '@storybook/react-vite';
import { Avatar, AvatarImage, AvatarFallback } from './avatar';
import { avatarTone } from '@/lib/avatar';
import { initials } from '@/lib/social';

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Avatar>;

export const Default: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar>
        <AvatarFallback style={avatarTone('user-1')}>
          {initials('Jane Doe')}
        </AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=John" alt="John Smith" />
        <AvatarFallback style={avatarTone('user-2')}>
          {initials('John Smith')}
        </AvatarFallback>
      </Avatar>
      <Avatar>
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alice" alt="Alice Johnson" />
        <AvatarFallback style={avatarTone('user-3')}>
          {initials('Alice Johnson')}
        </AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-6 w-6">
        <AvatarFallback style={avatarTone('1')}>{initials('A')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-8 w-8">
        <AvatarFallback style={avatarTone('2')}>{initials('AB')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10">
        <AvatarFallback style={avatarTone('3')}>{initials('ABC')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-12 w-12">
        <AvatarFallback style={avatarTone('4')}>{initials('ABCD')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-16 w-16">
        <AvatarFallback style={avatarTone('5')}>{initials('ABCDE')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-20 w-20">
        <AvatarFallback style={avatarTone('6')}>{initials('ABCDEF')}</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithImages: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=1" alt="User 1" />
        <AvatarFallback style={avatarTone('1')}>{initials('User One')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=2" alt="User 2" />
        <AvatarFallback style={avatarTone('2')}>{initials('User Two')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10">
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=3" alt="User 3" />
        <AvatarFallback style={avatarTone('3')}>{initials('User Three')}</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const Grouped: Story = {
  render: () => (
    <div className="flex -space-x-2">
      <Avatar className="h-10 w-10 ring-2 ring-background">
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=1" alt="User 1" />
        <AvatarFallback style={avatarTone('1')}>{initials('User One')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10 ring-2 ring-background">
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=2" alt="User 2" />
        <AvatarFallback style={avatarTone('2')}>{initials('User Two')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10 ring-2 ring-background">
        <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=3" alt="User 3" />
        <AvatarFallback style={avatarTone('3')}>{initials('User Three')}</AvatarFallback>
      </Avatar>
      <Avatar className="h-10 w-10 ring-2 ring-background">
        <AvatarFallback style={avatarTone('4')}>{initials('+3')}</AvatarFallback>
      </Avatar>
    </div>
  ),
};

export const WithStatus: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=online" alt="Online user" />
          <AvatarFallback style={avatarTone('online')}>{initials('Online User')}</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-background" />
      </div>
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=busy" alt="Busy user" />
          <AvatarFallback style={avatarTone('busy')}>{initials('Busy User')}</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-warning ring-2 ring-background" />
      </div>
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=offline" alt="Offline user" />
          <AvatarFallback style={avatarTone('offline')}>{initials('Offline User')}</AvatarFallback>
        </Avatar>
        <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-muted ring-2 ring-background" />
      </div>
    </div>
  ),
};

export const FallbackOnly: Story = {
  render: () => (
    <div className="flex items-center gap-4 flex-wrap">
      {['Jane Doe', 'John Smith', 'Alice Johnson', 'Bob Wilson', 'Charlie Brown'].map((name, i) => (
        <Avatar key={name} className="h-10 w-10">
          <AvatarFallback style={avatarTone(`user-${i}`)}>
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  ),
};
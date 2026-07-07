import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card, CardInteractive, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
import { Button } from './button';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Card description goes here</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-[14px] text-foreground">This is the card content area.</p>
      </CardContent>
      <CardFooter>
        <Button variant="primary" size="sm">Action</Button>
        <Button variant="ghost" size="sm">Cancel</Button>
      </CardFooter>
    </Card>
  ),
};

export const Interactive: Story = {
  render: () => (
    <CardInteractive className="w-80 cursor-pointer">
      <CardHeader>
        <CardTitle>Interactive Card</CardTitle>
        <CardDescription>Hover to see the lift effect</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-[14px] text-foreground">This card lifts on hover.</p>
      </CardContent>
    </CardInteractive>
  ),
};

export const Simple: Story = {
  render: () => (
    <Card className="w-80 p-5">
      <p className="text-[14px] text-foreground">A simple card with just padding.</p>
    </Card>
  ),
};

export const WithImage: Story = {
  render: () => (
    <Card className="w-80 overflow-hidden">
      <div className="aspect-video bg-muted relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Image placeholder
        </div>
      </div>
      <CardContent>
        <CardTitle>Card with Image</CardTitle>
        <CardDescription>This card has an image at the top</CardDescription>
      </CardContent>
    </Card>
  ),
};

export const CardGrid: Story = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i} className="h-full">
          <CardHeader>
            <CardTitle>Card {i}</CardTitle>
            <CardDescription>Description for card {i}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-[14px] text-foreground">Content goes here</p>
          </CardContent>
        </Card>
      ))}
    </div>
  ),
};

export const Elevated: Story = {
  render: () => (
    <Card className="w-80 shadow-lg">
      <CardHeader>
        <CardTitle>Elevated Card</CardTitle>
        <CardDescription>With a stronger shadow for emphasis</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-[14px] text-foreground">Use shadow-lg or shadow-xl for elevated cards.</p>
      </CardContent>
    </Card>
  ),
};
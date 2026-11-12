'use client';

import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

const badgeVariants = {
  default: 'bg-purple-600 text-white hover:bg-purple-700',
  secondary: 'bg-white/10 text-gray-300 hover:bg-white/20',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
  outline: 'border border-white/15 text-gray-300 hover:bg-white/5',
};

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <span
      ref={ref}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${badgeVariants[variant]} ${className ?? ''}`}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
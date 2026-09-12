import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

const variants: Record<string, string> = {
  primary: 'bg-accent-500 text-white hover:bg-accent-600 shadow-soft',
  secondary: 'bg-surface-300 text-ink-100 border border-surface-500 hover:bg-surface-400',
  ghost: 'text-ink-300 hover:text-ink-100 hover:bg-surface-300',
  danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/25 hover:bg-rose-500/25',
}

const sizes: Record<string, string> = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
}

export function Button({ variant = 'primary', size = 'md', icon, className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}

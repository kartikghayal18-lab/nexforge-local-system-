import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  wrapperClassName?: string
}

export function Input({ label, className = '', wrapperClassName = '', id, ...props }: InputProps) {
  return (
    <label className={`block ${wrapperClassName}`}>
      {label && <span className="block text-xs font-medium text-ink-400 mb-1">{label}</span>}
      <input
        id={id}
        className={`w-full rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40 ${className}`}
        {...props}
      />
    </label>
  )
}

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  wrapperClassName?: string
}

export function TextArea({ label, className = '', wrapperClassName = '', ...props }: TextAreaProps) {
  return (
    <label className={`block ${wrapperClassName}`}>
      {label && <span className="block text-xs font-medium text-ink-400 mb-1">{label}</span>}
      <textarea
        className={`w-full rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40 ${className}`}
        {...props}
      />
    </label>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  wrapperClassName?: string
}

export function Select({ label, className = '', wrapperClassName = '', children, ...props }: SelectProps) {
  return (
    <label className={`block ${wrapperClassName}`}>
      {label && <span className="block text-xs font-medium text-ink-400 mb-1">{label}</span>}
      <select
        className={`w-full rounded-lg border border-surface-500 bg-surface-300 px-3 py-2 text-sm text-ink-100 outline-none transition-colors focus:border-accent-500 focus:ring-1 focus:ring-accent-500/40 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

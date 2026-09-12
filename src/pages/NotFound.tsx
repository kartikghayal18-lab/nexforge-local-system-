import React from 'react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink-100">404</h1>
      <p className="text-sm text-ink-500 mt-1">This page doesn't exist.</p>
      <Link to="/" className="mt-4 text-sm text-accent-400 hover:text-accent-300">
        Back to dashboard
      </Link>
    </div>
  )
}

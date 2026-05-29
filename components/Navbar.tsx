'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { href: '/palpites', label: 'Palpites', icon: '🎯' },
  { href: '/jogos', label: 'Jogos', icon: '⚽' },
  { href: '/ranking', label: 'Ranking', icon: '🏆' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
]

interface NavbarProps {
  isAdmin?: boolean
  userName?: string
}

export default function Navbar({ isAdmin, userName }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        {/* Brand */}
        <Link href="/dashboard" className="navbar-brand">
          <div className="brand-icon">⚽</div>
          <span>Copa 2026</span>
        </Link>

        {/* Nav Links */}
        <ul className="navbar-nav">
          {navItems.map(item => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={pathname === item.href || pathname.startsWith(item.href + '/') ? 'active' : ''}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link
                href="/admin"
                className={pathname.startsWith('/admin') ? 'active' : ''}
                style={{ color: 'var(--color-gold)' }}
              >
                <span>⚙️</span> Admin
              </Link>
            </li>
          )}
        </ul>

        {/* User actions */}
        <div className="navbar-actions">
          <div className="user-badge">
            <div className="user-avatar">{initials}</div>
            <span style={{ color: 'var(--color-text-subtle)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userName || 'Usuário'}
            </span>
          </div>
          <button
            id="logout-btn"
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            title="Sair"
          >
            🚪
          </button>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <style>{`
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
        }
      `}</style>
      <div className="mobile-bottom-nav" style={{
        display: 'none',
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(6,10,20,0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 200,
        padding: '0.5rem 0',
      }}>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.5rem',
              fontSize: '0.625rem',
              fontWeight: 600,
              color: pathname === item.href ? 'var(--color-primary)' : 'var(--color-text-muted)',
              transition: 'var(--transition)',
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}

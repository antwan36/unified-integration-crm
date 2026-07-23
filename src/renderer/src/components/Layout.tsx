import { NavLink } from 'react-router-dom'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../state/auth'
import logoMark from '../assets/logo-mark.png'
import SearchPalette from './SearchPalette'
import UpdateBanner from './UpdateBanner'

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/email', label: 'Email', end: false },
  { to: '/contacts', label: 'Contacts', end: false },
  { to: '/estimates', label: 'Estimates', end: false },
  { to: '/invoices', label: 'Invoices', end: false },
  { to: '/tasks', label: 'Tasks', end: false },
  { to: '/calendar', label: 'Calendar', end: false },
  { to: '/catalog', label: 'Catalog', end: false },
  { to: '/settings', label: 'Settings', end: false }
]

const actionItems = [
  { to: '/invoices/new', label: '+ New Invoice' },
  { to: '/estimates/new', label: '+ New Estimate' }
]

export default function Layout({ children }: { children: ReactNode }): React.JSX.Element {
  const { user, logout } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const refresh = (): void => {
      window.api.email.unreadCount().then(setUnreadCount)
    }
    refresh()
    const interval = setInterval(refresh, 60_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex h-screen flex-col bg-neutral-950">
      <UpdateBanner />
      <div className="flex min-h-0 flex-1">
      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-neutral-800 bg-neutral-900 pt-10">
        <div className="flex items-center gap-2.5 px-5 pb-6">
          <img src={logoMark} alt="" className="h-7 w-7" />
          <div>
            <div className="text-sm font-semibold text-white">Unified Integration</div>
            <div className="text-xs text-neutral-500">Client CRM</div>
          </div>
        </div>
        <div className="px-3 pb-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center justify-between rounded border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-600 hover:text-white"
          >
            <span>Search…</span>
            <span className="text-xs text-neutral-600">⌘K</span>
          </button>
        </div>
        <div className="space-y-1 px-3 pb-4">
          {actionItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="block rounded bg-primary px-3 py-2 text-sm font-semibold text-black hover:bg-primary/90"
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between rounded px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-primary/15 text-primary'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
                }`
              }
            >
              <span>{item.label}</span>
              {item.to === '/email' && unreadCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-black">
                  {unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-neutral-800 p-3">
          <div className="truncate px-2 text-xs text-neutral-500">{user?.email}</div>
          <button
            onClick={logout}
            className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}

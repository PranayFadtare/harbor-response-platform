import { useCallback, useEffect, useMemo, useState } from 'react'
import ResponseMap from './ResponseMap'
import './App.css'

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/$/, '')

async function geocodeLocation(query, signal) {
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`, { signal })
  if (!response.ok) return null
  const results = await response.json()
  if (!results.length) return null
  return { latitude: Number(results[0].lat), longitude: Number(results[0].lon), displayName: results[0].display_name }
}

const glyphs = {
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  alert: <><path d="m10.3 3.9-8 13.8A1.5 1.5 0 0 0 3.6 20h16.8a1.5 1.5 0 0 0 1.3-2.3l-8-13.8a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4m0 4h.01" /></>,
  arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  close: <path d="m18 6-12 12M6 6l12 12" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z" /><path d="M9 3v15m6-12v15" /></>,
  pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  printer: <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.5-2.6L20 12M4 12l2.9 5.6A7 7 0 0 0 18.4 15" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
  siren: <><path d="M18 8a6 6 0 0 0-12 0v7h12V8Z" /><path d="M4 19h16M9 22h6M12 2V1M4.9 4.9l-.7-.7m15.6.7.7-.7" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
}

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">{glyphs[name] || glyphs.activity}</svg>
}

async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const csrfCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))
  const csrfToken = csrfCookie ? decodeURIComponent(csrfCookie.split('=').slice(1).join('=')) : ''
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(method !== 'GET' && method !== 'HEAD' && csrfToken ? { 'X-XSRF-TOKEN': csrfToken } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    let message = body
    try {
      const parsed = JSON.parse(body)
      message = parsed.detail || parsed.message || parsed.title || body
    } catch {
      // Keep plain-text error messages as-is.
    }
    throw new Error(message || `Request failed (${response.status})`)
  }
  if (response.status === 204) return null
  return response.json()
}

function formatDate(value, includeTime = false) {
  if (!value) return 'Just now'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently'
  return new Intl.DateTimeFormat('en', includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric' }).format(date)
}

function initials(name = 'Response team') {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function calculatePriority(needTags = '') {
  const tags = (needTags || '').toLowerCase()
  if (tags.includes('trapped') || tags.includes('rescue')) return 'P1'
  if (tags.includes('medical')) return tags.includes('infant') || tags.includes('elderly') ? 'P1' : 'P2'
  if (tags.includes('infant') || tags.includes('elderly')) return 'P2'
  if (tags.includes('shelter') || tags.includes('food') || tags.includes('water')) return 'P3'
  return 'P4'
}

function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isRegistering = mode === 'register'

  const submitAuth = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    const form = new FormData(event.currentTarget)
    const username = form.get(isRegistering ? 'email' : 'username').trim().toLowerCase()
    const password = form.get('password')
    try {
      const csrf = await apiRequest('/auth/csrf')
      if (isRegistering) {
        await apiRequest('/auth/register', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': csrf.token },
          body: JSON.stringify({ fullName: form.get('fullName').trim(), email: username, password }),
        })
        const refreshedCsrf = await apiRequest('/auth/csrf')
        const account = await apiRequest('/auth/login', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': refreshedCsrf.token },
          body: JSON.stringify({ username, password }),
        })
        onAuthenticated(account)
      } else {
        const account = await apiRequest('/auth/login', {
          method: 'POST',
          headers: { 'X-XSRF-TOKEN': csrf.token },
          body: JSON.stringify({ username, password }),
        })
        onAuthenticated(account)
      }
    } catch (authError) {
      setError(authError.message || 'Unable to authenticate. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-screen">
      <div className="auth-decoration auth-decoration-one" /><div className="auth-decoration auth-decoration-two" />
      <div className="auth-brand"><span className="brand-mark"><Icon name="shield" size={22} strokeWidth={2.1} /></span><span><strong>harbor</strong><small>RESPONSE PLATFORM</small></span></div>
      <section className="auth-card">
        <div className="auth-card-kicker"><span className="auth-lock"><Icon name="shield" size={14} /></span> PRIVATE OPERATIONS SPACE</div>
        <h1>{isRegistering ? 'Join your response network' : 'Welcome back'}</h1>
        <p className="auth-subtitle">{isRegistering ? 'Create a community account to submit and track your requests for help.' : 'Sign in to your Harbor account to continue.'}</p>
        <div className="auth-role-info"><span className="role-info-icon"><Icon name={isRegistering ? 'users' : 'shield'} size={16} /></span><span><strong>{isRegistering ? 'Community user account' : 'Admin or community sign-in'}</strong><small>{isRegistering ? 'New self-serve accounts have request-only access.' : 'Your secure role determines what you can access.'}</small></span></div>
        {error && <div className="auth-error" role="alert">{error}</div>}
        <form className="auth-form" onSubmit={submitAuth}>
          {isRegistering && <label>Full name<input name="fullName" placeholder="Your name" autoComplete="name" required maxLength="120" /></label>}
          <label>{isRegistering ? 'Email address' : 'Username or email'}<input name={isRegistering ? 'email' : 'username'} type={isRegistering ? 'email' : 'text'} placeholder={isRegistering ? 'you@example.com' : 'Username or email'} autoComplete="username" required maxLength="254" /></label>
          <label>Password<input name="password" type="password" placeholder={isRegistering ? 'At least 10 characters' : 'Enter your password'} autoComplete={isRegistering ? 'new-password' : 'current-password'} required minLength={isRegistering ? 10 : undefined} maxLength="72" /></label>
          {isRegistering && <p className="auth-password-note">Use at least 10 characters. Admin privileges can only be provisioned by your system administrator.</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegistering ? 'Create user account' : 'Sign in securely'}<Icon name="arrow" size={16} /></button>
        </form>
        <div className="auth-switch">{isRegistering ? 'Already have an account?' : 'Need a community account?'} <button onClick={() => { setMode(isRegistering ? 'login' : 'register'); setError('') }}>{isRegistering ? 'Sign in' : 'Create one'}</button></div>
        <div className="auth-security"><Icon name="shield" size={14} /><span>Encrypted session <i /> Role-based access</span></div>
      </section>
      <footer className="auth-footer"><span>Harbor response platform</span><span>Secure access for response teams</span></footer>
    </main>
  )
}

function App() {
  const [disasters, setDisasters] = useState([])
  const [requests, setRequests] = useState([])
  const [summary, setSummary] = useState({ totalDisasters: 0, totalEmergencyRequests: 0 })
  const [connection, setConnection] = useState('connecting')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [page, setPage] = useState('overview') // 'overview', 'incidents', 'requests', 'map'
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('ALL') // 'ALL', 'P1', 'P2', 'P3'
  const [modal, setModal] = useState('') // '', 'disaster', 'request'
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('harbor_offline_queue') || '[]')
    } catch {
      return []
    }
  })

  // Monitor network online/offline events for low-bandwidth resilience
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      setConnection('online')
      syncOfflineQueue()
    }
    const handleOffline = () => {
      setIsOnline(false)
      setConnection('offline')
      setNotice('⚠️ Low-Bandwidth Mode: Internet lost. Submissions will be safely saved offline on your device.')
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Sync queued requests when network restores
  const syncOfflineQueue = async () => {
    const stored = JSON.parse(localStorage.getItem('harbor_offline_queue') || '[]')
    if (!stored.length) return

    setNotice(`Syncing ${stored.length} offline emergency request(s) to server...`)
    let successful = 0
    const remaining = []

    for (const item of stored) {
      try {
        await apiRequest('/emergency-requests', {
          method: 'POST',
          body: JSON.stringify(item),
        })
        successful++
      } catch {
        remaining.push(item)
      }
    }

    localStorage.setItem('harbor_offline_queue', JSON.stringify(remaining))
    setOfflineQueue(remaining)
    if (successful > 0) {
      setNotice(`✓ Successfully transmitted ${successful} offline emergency request(s)!`)
      loadWorkspace(true)
    }
  }

  // Session bootstrap
  useEffect(() => {
    let active = true
    const restoreSession = async () => {
      try {
        await apiRequest('/auth/csrf')
        const account = await apiRequest('/auth/me')
        if (active) {
          setUser(account)
          setPage(account.role === 'ADMIN' ? 'overview' : 'requests')
        }
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setAuthReady(true)
      }
    }
    restoreSession()
    return () => { active = false }
  }, [])

  // Data loader
  const loadWorkspace = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const adminMode = user?.role === 'ADMIN'
      const [disasterData, requestData, dashboardData] = await Promise.all([
        apiRequest('/disasters'),
        apiRequest('/emergency-requests'),
        adminMode ? apiRequest('/dashboard') : Promise.resolve(null),
      ])
      setDisasters(Array.isArray(disasterData) ? disasterData : [])
      setRequests(Array.isArray(requestData) ? requestData : [])
      setSummary(dashboardData || {
        totalDisasters: 0,
        totalEmergencyRequests: requestData.length,
      })
      setConnection('online')
      setError('')
    } catch (requestError) {
      setConnection('offline')
      setError(requestError.message || 'Could not connect to the backend.')
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    const initialLoad = window.setTimeout(() => loadWorkspace(), 0)
    const refreshTimer = window.setInterval(() => loadWorkspace(true), 30000)
    return () => {
      window.clearTimeout(initialLoad)
      window.clearInterval(refreshTimer)
    }
  }, [loadWorkspace, user])

  const handleAuthenticated = (account) => {
    setUser(account)
    setPage(account.role === 'ADMIN' ? 'overview' : 'requests')
    setSearch('')
  }

  const handleLogout = async () => {
    try {
      const csrf = await apiRequest('/auth/csrf')
      await apiRequest('/auth/logout', { method: 'POST', headers: { 'X-XSRF-TOKEN': csrf.token } })
    } catch {
      // Clear local state
    }
    setUser(null)
    setDisasters([])
    setRequests([])
    setSummary({ totalDisasters: 0, totalEmergencyRequests: 0 })
    setPage('requests')
  }

  // Filter lists
  const filteredDisasters = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...disasters]
      .filter((item) => !query || [item.title, item.type, item.location, item.severity].some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => new Date(b.reportedAt || 0) - new Date(a.reportedAt || 0))
  }, [disasters, search])

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...requests]
      .filter((item) => {
        const matchesQuery = !query || [item.name, item.phone, item.location, item.details, item.status, item.needTags, item.priority].some((value) => value?.toLowerCase().includes(query))
        const matchesPriority = priorityFilter === 'ALL' || item.priority === priorityFilter
        return matchesQuery && matchesPriority
      })
      .sort((a, b) => {
        // Triage priority sorting: P1 > P2 > P3 > P4
        const prioOrder = { P1: 1, P2: 2, P3: 3, P4: 4 }
        const prioDiff = (prioOrder[a.priority] || 5) - (prioOrder[b.priority] || 5)
        if (prioDiff !== 0) return prioDiff
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      })
  }, [requests, search, priorityFilter])

  const severeCount = disasters.filter((item) => ['critical', 'high', 'severe'].includes((item.severity || '').toLowerCase())).length
  const p1Count = requests.filter((item) => item.priority === 'P1').length
  const openRequests = requests.filter((item) => !['resolved', 'closed', 'complete', 'completed'].includes((item.status || '').toLowerCase())).length
  const latestIncidents = filteredDisasters.slice(0, 5)
  const latestRequests = filteredRequests.slice(0, 5)

  if (!authReady) {
    return <div className="auth-loading"><span className="brand-mark"><Icon name="shield" size={22} /></span><span>Restoring your secure session…</span></div>
  }
  if (!user) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />
  }

  // Feature 4 & Feature 2: Submit Record with Smart Needs Tagging + Offline Queue
  const submitRecord = async (payload, isIncident) => {
    setSaving(true)

    // Check if offline: queue locally in localStorage
    if (!navigator.onLine) {
      if (isIncident) {
        setError('Declaring incidents requires an active administrative connection.')
        setSaving(false)
        return
      }
      const queuedItem = {
        ...payload,
        createdAt: new Date().toISOString(),
        id: 'offline-' + Date.now(),
        isOfflineQueued: true,
      }
      const newQueue = [...offlineQueue, queuedItem]
      localStorage.setItem('harbor_offline_queue', JSON.stringify(newQueue))
      setOfflineQueue(newQueue)
      setRequests((prev) => [queuedItem, ...prev])
      setModal('')
      setNotice('✓ Request saved offline on device. It will automatically transmit when cellular/Wi-Fi signal restores.')
      setSaving(false)
      return
    }

    try {
      await apiRequest(isIncident ? '/disasters' : '/emergency-requests', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setModal('')
      setPage(isIncident ? 'incidents' : 'requests')
      await loadWorkspace()
      setNotice(`✓ Successfully created ${isIncident ? 'incident report' : 'emergency request'}!`)
    } catch (requestError) {
      // If network fails during submission, offer offline fallback
      if (!isIncident) {
        const queuedItem = { ...payload, createdAt: new Date().toISOString(), id: 'offline-' + Date.now(), isOfflineQueued: true }
        const newQueue = [...offlineQueue, queuedItem]
        localStorage.setItem('harbor_offline_queue', JSON.stringify(newQueue))
        setOfflineQueue(newQueue)
        setRequests((prev) => [queuedItem, ...prev])
        setModal('')
        setNotice('⚠️ Network error: Request saved locally in offline queue for auto-sync.')
      } else {
        setError(requestError.message || 'Could not save this record.')
      }
    } finally {
      setSaving(false)
    }
  }

  const updateRequestStatus = async (request, status) => {
    setUpdatingId(request.id)
    try {
      await apiRequest(`/emergency-requests/${request.id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...request, status }),
      })
      await loadWorkspace(true)
    } catch (requestError) {
      setError(requestError.message || 'Could not update request status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const currentTitle = page === 'overview'
    ? 'Overview'
    : page === 'incidents'
    ? 'Incident reports'
    : page === 'requests'
    ? 'Emergency requests'
    : 'Live Response Map'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setPage('overview')} aria-label="Harbor home">
          <span className="brand-mark"><Icon name="shield" size={22} strokeWidth={2.1} /></span>
          <span className="brand-copy"><strong>harbor</strong><small>RESPONSE PLATFORM</small></span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">{initials(user.fullName).slice(0, 1)}</span>
          <span className="workspace-copy">
            <strong>{user.role === 'ADMIN' ? 'Northstar Relief' : user.fullName}</strong>
            <small>{user.role === 'ADMIN' ? 'Operations workspace' : 'Personal response account'}</small>
          </span>
          <span className="switch-chevron"><Icon name="chevron" size={15} /></span>
        </div>

        <div className="nav-label">{user.role === 'ADMIN' ? 'WORKSPACE' : 'YOUR ACCOUNT'}</div>
        <nav className="main-nav" aria-label="Main navigation">
          {user.role === 'ADMIN' && (
            <button className={`nav-link ${page === 'overview' ? 'active' : ''}`} onClick={() => setPage('overview')}>
              <Icon name="grid" /><span>Overview</span>
            </button>
          )}

          <button className={`nav-link ${page === 'incidents' ? 'active' : ''}`} onClick={() => setPage('incidents')}>
            <Icon name="alert" /><span>{user.role === 'ADMIN' ? 'Incidents' : 'Active alerts'}</span>
            <span className="nav-count">{disasters.length || 0}</span>
          </button>

          <button className={`nav-link ${page === 'requests' ? 'active' : ''}`} onClick={() => setPage('requests')}>
            <Icon name="siren" /><span>{user.role === 'ADMIN' ? 'Emergency requests' : 'My requests'}</span>
            <span className="nav-count">{summary.totalEmergencyRequests || 0}</span>
          </button>

          {/* Feature 1: Interactive Response Map Tab */}
          <button className={`nav-link ${page === 'map' ? 'active' : ''}`} onClick={() => setPage('map')}>
            <Icon name="map" /><span>Response map</span><span className="nav-count nav-pulse-badge">LIVE</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="support-card">
            <span className="support-icon"><Icon name="activity" size={16} /></span>
            <strong>{user.role === 'ADMIN' ? 'Need a hand?' : 'Need help?'}</strong>
            <p>{user.role === 'ADMIN' ? 'Your response team is one click away.' : 'Send a request to your response team.'}</p>
            <button onClick={() => setModal('request')}>Create a request <Icon name="arrow" size={14} /></button>
          </div>
          <button className="profile-button" onClick={handleLogout}>
            <span className="profile-avatar">{initials(user.fullName)}</span>
            <span className="profile-copy">
              <strong>{user.fullName}</strong>
              <small>{user.role === 'ADMIN' ? 'Admin · Sign out' : 'User · Sign out'}</small>
            </span>
            <span className="profile-dots">↗</span>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark"><Icon name="shield" size={20} /></span><strong>harbor</strong></div>
          <div className="breadcrumbs">
            <span>{user.role === 'ADMIN' ? 'Northstar Relief' : user.fullName}</span>
            <Icon name="chevron" size={14} />
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-actions">
            <label className="search-box">
              <Icon name="search" size={17} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents, requests..." aria-label="Search incidents and requests" />
              <kbd>⌘ K</kbd>
            </label>

            {/* Offline queue sync status */}
            {offlineQueue.length > 0 && (
              <button className="offline-queue-pill" onClick={syncOfflineQueue} title="Click to sync offline items">
                ⚡ {offlineQueue.length} Queued Offline
              </button>
            )}

            <span className={`connection-pill ${isOnline ? connection : 'offline'}`}>
              <span className="connection-dot" />
              {!isOnline ? 'Low-Bandwidth (Offline)' : connection === 'online' ? 'Live connection' : 'Connecting'}
            </span>

            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => setNotice('All telemetry feeds active.')}>
              <Icon name="bell" />
            </button>
            <button className="top-avatar top-avatar-button" aria-label="Sign out" title="Sign out" onClick={handleLogout}>
              {initials(user.fullName)}
            </button>
          </div>
        </header>

        <div className="page-content">
          {/* Feature 2: Offline Emergency Banner */}
          {!isOnline && (
            <div className="offline-banner" role="alert">
              <div className="offline-banner-left">
                <strong>⚠️ LOW-BANDWIDTH / OFFLINE MODE ACTIVE</strong>
                <p>Internet connectivity is disconnected. You can still submit emergency requests; they will be stored locally on your device and transmitted as soon as a cell signal or Wi-Fi is detected.</p>
              </div>
            </div>
          )}

          {notice && (
            <div className="notice notice-info" role="status">
              <span>Notice</span>
              <p>{notice}</p>
              <div className="notice-actions"><button onClick={() => setNotice('')}><Icon name="close" size={14} /></button></div>
            </div>
          )}

          {error && (
            <div className={`notice ${connection === 'offline' ? 'notice-error' : 'notice-info'}`} role="status">
              <span>{connection === 'offline' ? 'Backend connection issue' : 'Heads up'}</span>
              <p>{connection === 'offline' ? 'Start the backend and check that it is available at localhost:8080.' : error}</p>
              <div className="notice-actions"><button onClick={() => loadWorkspace()}>Try again</button><button aria-label="Dismiss notice" onClick={() => setError('')}><Icon name="close" size={15} /></button></div>
            </div>
          )}

          {/* Heading */}
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> SECURE {user.role === 'ADMIN' ? 'OPERATIONS WORKSPACE' : 'RESPONSE ACCOUNT'}</div>
              <h1>{page === 'overview' ? `Good morning, ${user.fullName.split(' ')[0]}` : currentTitle}<span className="heading-wave">{page === 'overview' ? '✳' : ''}</span></h1>
              <p className="heading-subtitle">
                {user.role !== 'ADMIN'
                  ? 'Track the help you have requested and check in safe with your response team.'
                  : page === 'overview'
                  ? 'Real-time situational intelligence and rapid tactical triage.'
                  : page === 'map'
                  ? 'Interactive geospatial crisis mapping and danger perimeters.'
                  : page === 'incidents'
                  ? 'Track, triage, and coordinate active incident reports.'
                  : 'Manage requests and coordinate support across your response network.'}
              </p>
            </div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={() => loadWorkspace()} disabled={loading}>
                <Icon name="refresh" size={16} />{loading ? 'Syncing' : 'Refresh'}
              </button>
              <button className="button button-primary" onClick={() => setModal(user.role === 'USER' || page === 'requests' ? 'request' : 'disaster')}>
                <Icon name="plus" size={17} />{user.role === 'USER' || page === 'requests' ? 'New request' : 'New incident'}
              </button>
            </div>
          </section>

          {user.role !== 'ADMIN' && (
            <>
              {disasters.length > 0 && (
                <section className="active-disaster-user-banner" onClick={() => setPage('incidents')}>
                  <div className="disaster-banner-copy">
                    <span className="disaster-alert-icon">⚠️</span>
                    <div>
                      <strong>{disasters.length} Active Disaster Warning{disasters.length > 1 ? 's' : ''} in Effect</strong>
                      <p>View reported hazard zones, evacuation advisories, and severity levels.</p>
                    </div>
                  </div>
                  <button className="button button-secondary button-small">View Alerts ({disasters.length}) →</button>
                </section>
              )}
            </>
          )}

          {/* Metrics Grid */}
          {user.role === 'ADMIN' ? (
            <section className="metrics-grid" aria-label="Workspace metrics">
              <MetricCard icon="alert" tone="violet" label="Total incidents" value={summary.totalDisasters ?? disasters.length} note="Across your workspace" />
              <MetricCard icon="siren" tone="orange" label="Open requests" value={openRequests} note="Waiting for dispatch" />
              {/* Feature 4: P1 Critical Triage metric */}
              <MetricCard icon="activity" tone="red" label="P1 Life-Threatening" value={p1Count} note="Immediate rescue required" />
            </section>
          ) : (
            <section className="metrics-grid user-metrics" aria-label="Your request metrics">
              <MetricCard icon="alert" tone="red" label="Active Alerts" value={disasters.length} note="Declared danger zones" onClick={() => setPage('incidents')} clickable />
              <MetricCard icon="siren" tone="orange" label="Your Requests" value={requests.length} note="Submitted by your account" />
              <MetricCard icon="activity" tone="green" label="Awaiting Support" value={openRequests} note="Your team can see these" />
            </section>
          )}

          {/* Tab 1: Overview */}
          {user.role === 'ADMIN' && page === 'overview' && (
            <OverviewContent
              incidents={latestIncidents}
              requests={latestRequests}
              disasters={disasters}
              loading={loading}
              onViewIncidents={() => setPage('incidents')}
              onViewRequests={() => setPage('requests')}
              onViewMap={() => setPage('map')}
              onCreateIncident={() => setModal('disaster')}
              onCreateRequest={() => setModal('request')}
              onUpdateStatus={updateRequestStatus}
              updatingId={updatingId}
            />
          )}

          {/* Tab 2: Incidents List */}
          {page === 'incidents' && (
            <IncidentList
              incidents={filteredDisasters}
              loading={loading}
              onCreate={() => setModal('disaster')}
              canCreate={user.role === 'ADMIN'}
            />
          )}

          {/* Tab 3: Emergency Requests List with Triage Filters */}
          {page === 'requests' && (
            <RequestList
              requests={filteredRequests}
              loading={loading}
              priorityFilter={priorityFilter}
              onPriorityFilterChange={setPriorityFilter}
              onCreate={() => setModal('request')}
              onUpdateStatus={updateRequestStatus}
              updatingId={updatingId}
              canManage={user.role === 'ADMIN'}
            />
          )}

          {/* Tab 4: Feature 1 Interactive Response Map */}
          {page === 'map' && (
            <ResponseMap
              disasters={disasters}
              requests={requests}
              onSelectIncident={() => {}}
              onSelectRequest={() => {}}
            />
          )}

          <footer className="page-footer">
            <span><span className="footer-status" />All telemetry feeds active</span>
            <span>Harbor response platform <span className="footer-dot">·</span> Live crisis coordination</span>
          </footer>
        </div>
      </main>

      {/* Feature 4: Modal with Smart Needs Tagging */}
      {modal && (
        <RecordModal
          type={user.role === 'USER' ? 'request' : modal}
          saving={saving}
          onClose={() => setModal('')}
          onSubmit={submitRecord}
        />
      )}

    </div>
  )
}

function MetricCard({ icon, tone, label, value, note, onClick, clickable = false }) {
  return (
    <article className={`metric-card ${clickable ? 'metric-clickable' : ''}`} onClick={onClick}>
      <div className="metric-top">
        <span className={`metric-icon ${tone}`}><Icon name={icon} size={17} /></span>
        <span className="metric-period">{clickable ? 'Click to view →' : 'Workspace'}</span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-note"><span className="note-dot" />{note}</div>
    </article>
  )
}

function ActivityChart({ disasters }) {
  const bars = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setHours(0, 0, 0, 0)
    day.setDate(day.getDate() - (6 - index))
    const count = disasters.filter((item) => item.reportedAt && new Date(item.reportedAt).toDateString() === day.toDateString()).length
    return { label: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(day), count }
  })
  const max = Math.max(...bars.map((bar) => bar.count), 1)
  return (
    <div className="chart-wrap">
      <div className="chart-y-labels"><span>{max}</span><span>{Math.ceil(max / 2)}</span><span>0</span></div>
      <div className="chart-area">
        <div className="chart-gridline gridline-one" /><div className="chart-gridline gridline-two" /><div className="chart-gridline gridline-three" />
        <div className="bar-group">
          {bars.map((bar, index) => (
            <div className="bar-column" key={bar.label}>
              <div className={`bar-track ${bar.count ? '' : 'bar-empty'}`}>
                <div className={`bar-fill ${index === bars.length - 1 ? 'bar-today' : ''}`} style={{ height: `${bar.count ? Math.max((bar.count / max) * 100, 16) : 3}%` }} title={`${bar.count} incident${bar.count === 1 ? '' : 's'}`} />
              </div>
              <span className={index === bars.length - 1 ? 'today-label' : ''}>{bar.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SeverityPanel({ disasters }) {
  const levels = [
    { label: 'Critical', color: 'critical', match: ['critical'] },
    { label: 'High', color: 'high', match: ['high', 'severe'] },
    { label: 'Moderate', color: 'moderate', match: ['moderate', 'medium'] },
    { label: 'Low', color: 'low', match: ['low', 'minor'] },
  ]
  return (
    <div className="severity-content">
      <div className="severity-ring" style={{ '--ring-fill': `${disasters.length ? 66 : 0}%` }}>
        <div><strong>{disasters.length}</strong><span>Total</span></div>
      </div>
      <div className="severity-legend">
        {levels.map((level) => {
          const count = disasters.filter((item) => level.match.includes((item.severity || '').toLowerCase())).length
          return (
            <div className="severity-row" key={level.label}>
              <span className={`severity-dot ${level.color}`} />
              <span>{level.label}</span>
              <strong>{count}</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function OverviewContent({ incidents, requests, disasters, loading, onViewIncidents, onViewRequests, onViewMap, onCreateIncident, onCreateRequest, onUpdateStatus, updatingId }) {
  return (
    <>
      <section className="insights-grid">
        <article className="panel activity-panel">
          <div className="panel-heading">
            <div><div className="panel-kicker">RESPONSE OVERVIEW</div><h2>Incident activity</h2></div>
            <span className="period-select">Last 7 days <Icon name="chevron" size={14} /></span>
          </div>
          <ActivityChart disasters={disasters} />
          <div className="chart-footnote"><span className="chart-key" />Reports received <span className="chart-footnote-divider">·</span> Updated in real time</div>
        </article>

        <article className="panel severity-panel">
          <div className="panel-heading">
            <div><div className="panel-kicker">TRIAGE</div><h2>By severity</h2></div>
            <span className="round-icon"><Icon name="alert" size={16} /></span>
          </div>
          <SeverityPanel disasters={disasters} />
          <div className="severity-footnote"><span className="severity-footnote-dot" />Severity based on active incidents</div>
        </article>
      </section>

      {/* Quick Map Teaser Banner */}
      <section className="map-teaser-card" onClick={onViewMap}>
        <div className="teaser-copy">
          <span className="teaser-icon">🗺</span>
          <div>
            <strong>Interactive Crisis & Rescue Map Ready</strong>
            <p>Spatial tracking active with {disasters.length} incident zones and {requests.length} rescue pins plotted.</p>
          </div>
        </div>
        <button className="button button-primary button-small">Open Live Map →</button>
      </section>

      <section className="panel records-panel">
        <div className="panel-heading records-heading">
          <div><div className="panel-kicker">LIVE OPERATIONS</div><h2>Latest incident reports</h2></div>
          <div className="record-tabs">
            <button className="record-tab active">Incidents <span>{disasters.length}</span></button>
            <button className="record-tab" onClick={onViewRequests}>Requests <span>{requests.length}</span></button>
          </div>
          <button className="text-button" onClick={onViewIncidents}>View all <Icon name="chevron" size={15} /></button>
        </div>
        {loading && incidents.length === 0 ? <LoadingRows /> : incidents.length ? <IncidentTable incidents={incidents} /> : <EmptyState icon="alert" title="No incidents reported yet" detail="Reports created by your team will appear here." action="Create first incident" onClick={onCreateIncident} />}
      </section>

      <section className="panel requests-panel">
        <div className="panel-heading records-heading">
          <div><div className="panel-kicker">COMMUNITY SUPPORT</div><h2>Emergency requests (Triage order)</h2></div>
          <button className="text-button" onClick={onViewRequests}>View all <Icon name="chevron" size={15} /></button>
        </div>
        {loading && requests.length === 0 ? <LoadingRows /> : requests.length ? <RequestTable requests={requests} onUpdateStatus={onUpdateStatus} updatingId={updatingId} canManage /> : <EmptyState icon="siren" title="No requests in the queue" detail="New calls for help will show up here as they come in." action="Create a request" onClick={onCreateRequest} compact />}
      </section>
    </>
  )
}

function IncidentTable({ incidents }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>INCIDENT</th>
            <th>LOCATION</th>
            <th>SEVERITY</th>
            <th>COORDINATES</th>
            <th>REPORTED</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id}>
              <td>
                <div className="primary-cell">
                  <span className={`incident-type-icon ${severityTone(incident.severity)}`}><Icon name="alert" size={15} /></span>
                  <span>
                    <strong>{incident.title || incident.type || 'Untitled report'}</strong>
                    <small>{incident.type || 'Incident'} <span className="cell-dot">·</span> #{incident.id}</small>
                  </span>
                </div>
              </td>
              <td><span className="location-cell"><Icon name="pin" size={14} />{incident.location || 'Location not provided'}</span></td>
              <td><SeverityBadge severity={incident.severity} /></td>
              <td className="muted-cell">{incident.latitude ? `${incident.latitude.toFixed(2)}, ${incident.longitude.toFixed(2)}` : 'GPS unverified'}</td>
              <td className="muted-cell">{formatDate(incident.reportedAt, true)}</td>
              <td><button className="row-action" aria-label={`Incident ${incident.id}`}><Icon name="chevron" size={16} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RequestTable({ requests, onUpdateStatus, updatingId, canManage = false }) {
  return (
    <div className="table-scroll">
      <table className="data-table request-table">
        <thead>
          <tr>
            <th>PRIO</th>
            <th>{canManage ? 'REQUESTER' : 'REQUEST'}</th>
            <th>NEEDS / TAGS</th>
            {canManage && <th>LOCATION</th>}
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {requests.map((request) => (
            <tr key={request.id} className={request.priority === 'P1' ? 'row-p1' : ''}>
              <td>
                {/* Feature 4: Priority Badge */}
                <span className={`priority-pill prio-${(request.priority || 'P4').toLowerCase()}`}>
                  {request.priority || 'P4'}
                </span>
              </td>
              <td>
                <div className="person-cell">
                  <span className="person-avatar">{initials(canManage ? request.name : request.details || 'Help request')}</span>
                  <span>
                    <strong>{canManage ? request.name || 'Anonymous' : request.details || 'Help requested'}</strong>
                    <small>{canManage ? (request.phone ? `📞 ${request.phone}` : 'No phone') : `Submitted ${formatDate(request.createdAt)}`}</small>
                  </span>
                </div>
              </td>
              <td>
                {/* Feature 4: Smart Needs Tags */}
                {request.needTags ? (
                  <div className="table-tag-chips">
                    {request.needTags.split(',').map((tag) => (
                      <span key={tag} className="table-tag">{tag.trim()}</span>
                    ))}
                  </div>
                ) : (
                  <span className="muted-cell">{request.details || 'General Aid'}</span>
                )}
              </td>
              {canManage && <td><span className="location-cell"><Icon name="pin" size={14} />{request.location || 'Not provided'}</span></td>}
              <td>
                {canManage ? (
                  <select
                    className={`status-select status-${(request.status || 'open').toLowerCase().replaceAll(' ', '-')}`}
                    value={request.status || 'OPEN'}
                    disabled={updatingId === request.id}
                    onChange={(event) => onUpdateStatus(request, event.target.value)}
                    aria-label={`Update status for ${request.name || 'request'}`}
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="RESOLVED">Resolved</option>
                  </select>
                ) : (
                  <span className={`status-select status-${(request.status || 'open').toLowerCase().replaceAll(' ', '-')}`}>
                    {(request.status || 'OPEN').replaceAll('_', ' ')}
                  </span>
                )}
              </td>
              <td className="muted-cell request-date">
                {request.isOfflineQueued ? <span className="offline-tag">QUEUED</span> : canManage ? formatDate(request.createdAt) : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IncidentList({ incidents, loading, onCreate, canCreate = true }) {
  return (
    <section className="panel full-list-panel">
      <div className="panel-heading records-heading">
        <div>
          <div className="panel-kicker">{canCreate ? 'INCIDENT MANAGEMENT' : 'PUBLIC DISASTER ALERTS'}</div>
          <h2>{canCreate ? 'All incidents' : 'Active disaster alerts'} <span className="heading-count">{incidents.length}</span></h2>
        </div>
        {canCreate && (
          <button className="button button-primary button-small" onClick={onCreate}>
            <Icon name="plus" size={16} />New incident
          </button>
        )}
      </div>
      {loading && !incidents.length ? (
        <LoadingRows />
      ) : incidents.length ? (
        <IncidentTable incidents={incidents} />
      ) : (
        <EmptyState
          icon="alert"
          title="No active disaster reports"
          detail={canCreate ? 'Try a different search or create a new incident report.' : 'There are currently no declared disaster perimeters in your area.'}
          action={canCreate ? 'Create incident' : undefined}
          onClick={canCreate ? onCreate : undefined}
        />
      )}
    </section>
  )
}

function RequestList({ requests, loading, priorityFilter, onPriorityFilterChange, onCreate, onUpdateStatus, updatingId, canManage = false }) {
  return (
    <section className="panel full-list-panel">
      <div className="panel-heading records-heading">
        <div>
          <div className="panel-kicker">COMMUNITY SUPPORT</div>
          <h2>{canManage ? 'All emergency requests' : 'Your requests'} <span className="heading-count">{requests.length}</span></h2>
        </div>

        {/* Feature 4: Rapid Triage Priority Filter Tabs */}
        <div className="triage-filter-tabs">
          <button className={`triage-tab ${priorityFilter === 'ALL' ? 'active' : ''}`} onClick={() => onPriorityFilterChange('ALL')}>All</button>
          <button className={`triage-tab p1-tab ${priorityFilter === 'P1' ? 'active' : ''}`} onClick={() => onPriorityFilterChange('P1')}>🚨 P1 Critical</button>
          <button className={`triage-tab p2-tab ${priorityFilter === 'P2' ? 'active' : ''}`} onClick={() => onPriorityFilterChange('P2')}>P2 Urgent</button>
          <button className={`triage-tab ${priorityFilter === 'P3' ? 'active' : ''}`} onClick={() => onPriorityFilterChange('P3')}>P3 Supplies</button>
        </div>

        <button className="button button-primary button-small" onClick={onCreate}>
          <Icon name="plus" size={16} />New request
        </button>
      </div>
      {loading && !requests.length ? <LoadingRows /> : requests.length ? <RequestTable requests={requests} onUpdateStatus={onUpdateStatus} updatingId={updatingId} canManage={canManage} /> : <EmptyState icon="siren" title={canManage ? 'No requests found' : 'You have not sent a request yet'} detail={canManage ? 'Requests submitted to your team will appear here.' : 'Create a request and your authorized response team will be able to help.'} action="Create a request" onClick={onCreate} />}
    </section>
  )
}

function SeverityBadge({ severity }) {
  const value = severity || 'Unspecified'
  return <span className={`severity-badge ${severityTone(severity)}`}><span />{value}</span>
}

function severityTone(severity = '') {
  const value = severity.toLowerCase()
  if (value.includes('critical')) return 'tone-critical'
  if (value.includes('high') || value.includes('severe')) return 'tone-high'
  if (value.includes('moderate') || value.includes('medium')) return 'tone-moderate'
  if (value.includes('low') || value.includes('minor')) return 'tone-low'
  return 'tone-neutral'
}

function EmptyState({ icon, title, detail, action, onClick, compact = false }) {
  return (
    <div className={`empty-state ${compact ? 'empty-compact' : ''}`}>
      <span className="empty-icon"><Icon name={icon} size={19} /></span>
      <strong>{title}</strong>
      <p>{detail}</p>
      {action && <button className="text-button" onClick={onClick}>{action}<Icon name="arrow" size={14} /></button>}
    </div>
  )
}

function LoadingRows() {
  return <div className="loading-rows" aria-label="Loading records"><span /><span /><span /></div>
}

// Feature 4: Modal with Smart Needs Tagging Chips
function RecordModal({ type, saving, onClose, onSubmit }) {
  const isIncident = type === 'disaster'
  const [selectedTags, setSelectedTags] = useState([])
  const [location, setLocation] = useState('')
  const [locationSuggestions, setLocationSuggestions] = useState([])
  const [selectedCoordinates, setSelectedCoordinates] = useState(null)
  const [locationLookupBusy, setLocationLookupBusy] = useState(false)

  const TAG_OPTIONS = [
    { label: '🚨 Trapped / Rescue', tag: 'Trapped' },
    { label: '🚑 Medical Emergency', tag: 'Medical' },
    { label: '🍞 Food & Clean Water', tag: 'Food & Water' },
    { label: '⛺ Temporary Shelter', tag: 'Shelter' },
    { label: '👶 Infant / Elderly', tag: 'Infant/Elderly' },
    { label: '⚡ Power / Oxygen', tag: 'Power/Utilities' },
  ]

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const computedPriority = calculatePriority(selectedTags.join(', '))

  useEffect(() => {
    if (selectedCoordinates || location.trim().length < 3) {
      setLocationSuggestions([])
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setLocationLookupBusy(true)
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=in&q=${encodeURIComponent(location.trim())}`, { signal: controller.signal })
        if (response.ok) setLocationSuggestions(await response.json())
      } catch (error) {
        if (error.name !== 'AbortError') setLocationSuggestions([])
      } finally {
        if (!controller.signal.aborted) setLocationLookupBusy(false)
      }
    }, 350)

    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [isIncident, location, selectedCoordinates])

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    let coordinates = selectedCoordinates
    if (location.trim() && !coordinates) coordinates = await geocodeLocation(location.trim())
    if (isIncident) {
      onSubmit({
        title: form.get('title').trim(),
        type: form.get('type'),
        severity: form.get('severity'),
        location: location.trim(),
        description: form.get('description').trim(),
        latitude: coordinates?.latitude ?? (form.get('latitude') ? Number(form.get('latitude')) : null),
        longitude: coordinates?.longitude ?? (form.get('longitude') ? Number(form.get('longitude')) : null),
      }, true)
    } else {
      onSubmit({
        name: form.get('name').trim(),
        phone: form.get('phone').trim(),
        location: form.get('location').trim(),
        details: form.get('details').trim(),
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        needTags: selectedTags.join(', '),
        priority: computedPriority,
        status: 'OPEN',
      }, false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="record-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-top">
          <span className={`modal-icon ${isIncident ? 'modal-violet' : 'modal-orange'}`}>
            <Icon name={isIncident ? 'alert' : 'siren'} size={20} />
          </span>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button>
        </div>

        <div className="modal-heading">
          <h2 id="modal-title">{isIncident ? 'Report a disaster incident' : 'Submit emergency assistance request'}</h2>
          <p>{isIncident ? 'Add key geographical details so rescue squads can coordinate.' : 'Log your emergency needs. Triage algorithms will route urgent cases to first responders.'}</p>
        </div>

        <form onSubmit={handleFormSubmit} className="record-form">
          {isIncident ? (
            <>
              <label>Incident title<input name="title" placeholder="e.g. Flooding near Riverside" required maxLength="120" /></label>
              <div className="form-row">
                <label>Type
                  <select name="type" defaultValue="Flood">
                    <option>Flood</option>
                    <option>Wildfire</option>
                    <option>Storm</option>
                    <option>Earthquake</option>
                    <option>Medical</option>
                    <option>Other</option>
                  </select>
                </label>
                <label>Severity
                  <select name="severity" defaultValue="Moderate">
                    <option>Low</option>
                    <option>Moderate</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </label>
              </div>
              <label className="location-autocomplete-label">Location
                <input
                  name="location"
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value)
                    setSelectedCoordinates(null)
                  }}
                  placeholder="Start typing a city, neighborhood, or address"
                  required
                  maxLength="160"
                  autoComplete="off"
                />
                {(locationLookupBusy || locationSuggestions.length > 0) && (
                  <div className="location-suggestions" role="listbox">
                    {locationLookupBusy && <div className="location-suggestion-status">Searching places...</div>}
                    {locationSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        className="location-suggestion"
                        key={suggestion.place_id}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          setLocation(suggestion.display_name)
                          setSelectedCoordinates({ latitude: Number(suggestion.lat), longitude: Number(suggestion.lon) })
                          setLocationSuggestions([])
                        }}
                      >
                        <strong>{suggestion.display_name}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label>Description<textarea name="description" placeholder="What happened? Share hazards first responders should know." rows="3" /></label>
              <div className="form-row">
                <label>Latitude <span className="optional-label">optional for map</span><input name="latitude" type="number" step="any" placeholder="37.7749" /></label>
                <label>Longitude <span className="optional-label">optional for map</span><input name="longitude" type="number" step="any" placeholder="-122.4194" /></label>
              </div>
            </>
          ) : (
            <>
              {/* Feature 4: Smart Needs Selector & Live Priority Indicator */}
              <div className="needs-selector-wrap">
                <label>Select Emergency Needs (Select all that apply)</label>
                <div className="needs-chips-grid">
                  {TAG_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.tag}
                      className={`need-chip ${selectedTags.includes(opt.tag) ? 'selected' : ''}`}
                      onClick={() => toggleTag(opt.tag)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className="computed-priority-banner">
                  <span>Computed Triage Priority:</span>
                  <strong className={`computed-badge prio-${computedPriority.toLowerCase()}`}>
                    {computedPriority === 'P1' ? '🔴 P1 — LIFE THREATENING' : computedPriority === 'P2' ? '🟠 P2 — URGENT MEDICAL / VULNERABLE' : computedPriority === 'P3' ? '🟡 P3 — RELIEF SUPPLIES' : '🔵 P4 — STANDARD AID'}
                  </strong>
                </div>
              </div>

              <div className="form-row">
                <label>Requester name<input name="name" placeholder="Full name" required maxLength="120" /></label>
                <label>Phone number<input name="phone" type="tel" placeholder="+1 (555) 000-0000" required maxLength="40" /></label>
              </div>
              <label className="location-autocomplete-label">Location / Nearest Landmark
                <input
                  name="location"
                  value={location}
                  onChange={(event) => {
                    setLocation(event.target.value)
                    setSelectedCoordinates(null)
                  }}
                  placeholder="Start typing an area, street, or landmark"
                  required
                  maxLength="160"
                  autoComplete="off"
                />
                {(locationLookupBusy || locationSuggestions.length > 0) && (
                  <div className="location-suggestions" role="listbox">
                    {locationLookupBusy && <div className="location-suggestion-status">Searching places...</div>}
                    {locationSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        className="location-suggestion"
                        key={suggestion.place_id}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          setLocation(suggestion.display_name)
                          setSelectedCoordinates({ latitude: Number(suggestion.lat), longitude: Number(suggestion.lon) })
                          setLocationSuggestions([])
                        }}
                      >
                        <strong>{suggestion.display_name}</strong>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label>What help is needed?<textarea name="details" placeholder="Describe current situation, number of people affected, or special instructions." rows="3" required maxLength="1000" /></label>
            </>
          )}

          <div className="modal-actions">
            <button type="button" className="button button-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving}>
              {saving ? 'Transmitting…' : isIncident ? 'Create incident' : 'Transmit Emergency Request'}
              <Icon name="arrow" size={15} />
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default App

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Toolbar,
  Tooltip,
  Typography,
  createTheme,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material/Select'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import DoneAllIcon from '@mui/icons-material/DoneAll'
import RefreshIcon from '@mui/icons-material/Refresh'
import PriorityHighIcon from '@mui/icons-material/PriorityHigh'
import InboxIcon from '@mui/icons-material/Inbox'
import './App.css'

type NotificationType = 'Event' | 'Result' | 'Placement'
type TypeFilter = 'All' | NotificationType
type ViewMode = 'all' | 'priority'

type NotificationItem = {
  ID: string
  Type: NotificationType
  Message: string
  Timestamp: string
}

type NotificationResponse = {
  notifications: NotificationItem[]
}

const API_URL = '/api/notifications'
const VIEWED_STORAGE_KEY = 'campus-notification-viewed-ids'
const TYPE_FILTERS: TypeFilter[] = ['All', 'Placement', 'Result', 'Event']
const PAGE_SIZES = [10]
const PRIORITY_LIMITS = [10, 15, 20]
const TYPE_WEIGHTS: Record<NotificationType, number> = {
  Placement: 3,
  Result: 2,
  Event: 1,
}

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d97706', // Amber/Orange 600
    },
    secondary: {
      main: '#f59e0b', // Amber 500
    },
    background: {
      default: '#fffaf5', // Very light warm background
      paper: '#ffffff',
    },
    text: {
      primary: '#451a03', // Deep brown/orange text
      secondary: '#78350f',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: {
      fontSize: '1.25rem', // Reduced from 1.75rem
      fontWeight: 800,
      letterSpacing: '-0.025em',
    },
    h2: {
      fontSize: '1.1rem', // Reduced from 1.25rem
      fontWeight: 700,
      letterSpacing: 0,
    },
    button: {
      textTransform: 'none',
      fontWeight: 700,
    },
  },
})


async function logFrontend(level: 'debug' | 'info' | 'warn' | 'error', packageName: string, message: string) {
  try {
    await fetch('/api/logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stack: 'frontend',
        level,
        package: packageName,
        message,
      }),
    })
  } catch {
    // Logging should never block the notification UI.
  }
}

function loadViewedIds() {
  try {
    const rawValue = localStorage.getItem(VIEWED_STORAGE_KEY)
    const parsed = rawValue ? JSON.parse(rawValue) : []

    return new Set<string>(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set<string>()
  }
}

function persistViewedIds(ids: Set<string>) {
  localStorage.setItem(VIEWED_STORAGE_KEY, JSON.stringify([...ids]))
}

function parseTimestamp(timestamp: string) {
  return new Date(`${timestamp.replace(' ', 'T')}Z`).getTime()
}

function getPriorityScore(notification: NotificationItem) {
  return TYPE_WEIGHTS[notification.Type] * 1_000_000_000_000_000 + parseTimestamp(notification.Timestamp)
}

function getTypeColor(type: NotificationType): 'primary' | 'secondary' | 'success' {
  if (type === 'Placement') {
    return 'primary'
  }

  if (type === 'Result') {
    return 'secondary'
  }

  return 'success'
}

function formatTimestamp(timestamp: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(`${timestamp.replace(' ', 'T')}Z`))
}

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All')
  const [priorityTypeFilter, setPriorityTypeFilter] = useState<TypeFilter>('All')
  const [priorityLimit, setPriorityLimit] = useState(10)
  const [viewedIds, setViewedIds] = useState<Set<string>>(() => loadViewedIds())

  const newCount = useMemo(
    () => notifications.filter((notification) => !viewedIds.has(notification.ID)).length,
    [notifications, viewedIds],
  )

  const priorityNotifications = useMemo(() => {
    return notifications
      .filter((notification) => priorityTypeFilter === 'All' || notification.Type === priorityTypeFilter)
      .sort((left, right) => getPriorityScore(right) - getPriorityScore(left))
      .slice(0, priorityLimit)
  }, [notifications, priorityLimit, priorityTypeFilter])

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      await logFrontend('info', 'api', 'fetching notifications')

      const params = new URLSearchParams({
        limit: String(pageSize),
        page: String(page),
      })

      if (typeFilter !== 'All') {
        params.set('notification_type', typeFilter)
      }

      // If we are in priority mode, tell the backend to sort for us
      if (viewMode === 'priority') {
        params.set('priority', 'true')
      }

      const response = await fetch(`${API_URL}?${params.toString()}`)

      if (!response.ok) {
        throw new Error(`Notification API returned ${response.status}`)
      }

      const payload = (await response.json()) as NotificationResponse

      if (!Array.isArray(payload.notifications)) {
        throw new Error('Notification API returned an invalid payload')
      }

      setNotifications(payload.notifications)
      await logFrontend('info', 'state', 'notifications stored in frontend state')
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Unable to load notifications'
      setError(message)
      await logFrontend('error', 'api', message)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, typeFilter, viewMode])

  useEffect(() => {
    void fetchNotifications()
    // Small delay ensures the DOM has updated before scrolling
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      document.documentElement.scrollTo({ top: 0, behavior: 'smooth' })
    }, 100)
  }, [fetchNotifications])

  const updateViewedIds = useCallback((nextIds: Set<string>) => {
    setViewedIds(nextIds)
    persistViewedIds(nextIds)
  }, [])

  const markViewed = useCallback(
    (notificationId: string) => {
      const nextIds = new Set(viewedIds)
      nextIds.add(notificationId)
      updateViewedIds(nextIds)
      void logFrontend('info', 'component', 'notification marked as viewed')
    },
    [updateViewedIds, viewedIds],
  )

  const markAllViewed = useCallback(() => {
    const nextIds = new Set(viewedIds)
    notifications.forEach((notification) => nextIds.add(notification.ID))
    updateViewedIds(nextIds)
    void logFrontend('info', 'component', 'visible notifications marked as viewed')
  }, [notifications, updateViewedIds, viewedIds])

  const handleTypeFilter = (event: SelectChangeEvent) => {
    setTypeFilter(event.target.value as TypeFilter)
    setPage(1)
  }

  const handlePriorityTypeFilter = (event: SelectChangeEvent) => {
    setPriorityTypeFilter(event.target.value as TypeFilter)
  }

  const displayedNotifications = viewMode === 'all' ? notifications : priorityNotifications

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid #ffedd5' }}>
          <Toolbar sx={{ gap: 2, justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <NotificationsActiveIcon color="primary" />
              <Box>
                <Typography variant="h1">Campus Notifications</Typography>
                <Typography variant="body2" color="text.secondary">
                  Placements, events, and results
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Chip color={newCount > 0 ? 'primary' : 'default'} label={`${newCount} new`} />
              <Tooltip title="Refresh notifications">
                <IconButton aria-label="Refresh notifications" onClick={() => void fetchNotifications()}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Toolbar>
        </AppBar>

        {loading && <LinearProgress />}

        <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
          <Paper elevation={0} sx={{ border: '1px solid #ffedd5', overflow: 'hidden' }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              sx={{ p: 2, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between' }}
            >
              <Tabs value={viewMode} onChange={(_, value: ViewMode) => setViewMode(value)}>
                <Tab icon={<InboxIcon />} iconPosition="start" value="all" label="All" />
                <Tab icon={<PriorityHighIcon />} iconPosition="start" value="priority" label="Priority" />
              </Tabs>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                {viewMode === 'all' ? (
                  <>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="type-filter-label">Type</InputLabel>
                      <Select labelId="type-filter-label" value={typeFilter} label="Type" onChange={handleTypeFilter}>
                        {TYPE_FILTERS.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <InputLabel id="page-size-label">Limit</InputLabel>
                      <Select
                        labelId="page-size-label"
                        value={String(pageSize)}
                        label="Limit"
                        onChange={(event) => {
                          setPageSize(Number(event.target.value))
                          setPage(1)
                        }}
                      >
                        {PAGE_SIZES.map((size) => (
                          <MenuItem key={size} value={size}>
                            {size}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' } }} />
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                      <Button
                        size="small"
                        disabled={page === 1 || loading}
                        onClick={() => setPage((v) => Math.max(1, v - 1))}
                        sx={{ minWidth: 40 }}
                      >
                        Prev
                      </Button>
                      <Typography variant="caption" sx={{ fontWeight: 700, minWidth: 45, textAlign: 'center' }}>
                        {page}
                      </Typography>
                      <Button
                        size="small"
                        disabled={loading || notifications.length < pageSize}
                        onClick={() => setPage((v) => v + 1)}
                        sx={{ minWidth: 40 }}
                      >
                        Next
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="priority-type-filter-label">Type</InputLabel>
                      <Select
                        labelId="priority-type-filter-label"
                        value={priorityTypeFilter}
                        label="Type"
                        onChange={handlePriorityTypeFilter}
                      >
                        {TYPE_FILTERS.map((type) => (
                          <MenuItem key={type} value={type}>
                            {type}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 130 }}>
                      <InputLabel id="priority-limit-label">Top</InputLabel>
                      <Select
                        labelId="priority-limit-label"
                        value={String(priorityLimit)}
                        label="Top"
                        onChange={(event) => setPriorityLimit(Number(event.target.value))}
                      >
                        {PRIORITY_LIMITS.map((limit) => (
                          <MenuItem key={limit} value={limit}>
                            {limit}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </>
                )}
                <Button startIcon={<DoneAllIcon />} variant="outlined" onClick={markAllViewed}>
                  Mark viewed
                </Button>
              </Stack>
            </Stack>

            <Divider />

            {error && (
              <Alert severity="error" sx={{ m: 2 }}>
                {error}
              </Alert>
            )}

            {!error && loading && notifications.length === 0 ? (
              <Stack sx={{ minHeight: 320, alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress />
              </Stack>
            ) : (
              <NotificationList items={displayedNotifications} viewedIds={viewedIds} onMarkViewed={markViewed} />
            )}

            {viewMode === 'all' && (
              <>
                <Divider />
                <Stack direction="row" sx={{ p: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button disabled={page === 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                    Previous
                  </Button>
                  <Typography variant="body2" color="text.secondary">
                    Page {page}
                  </Typography>
                  <Button disabled={loading || notifications.length < pageSize} onClick={() => setPage((value) => value + 1)}>
                    Next
                  </Button>
                </Stack>
              </>
            )}
          </Paper>
        </Container>
      </Box>
    </ThemeProvider>
  )
}

function NotificationList({
  items,
  viewedIds,
  onMarkViewed,
}: {
  items: NotificationItem[]
  viewedIds: Set<string>
  onMarkViewed: (notificationId: string) => void
}) {
  if (items.length === 0) {
    return (
      <Stack spacing={1} sx={{ minHeight: 320, p: 3, alignItems: 'center', justifyContent: 'center' }}>
        <InboxIcon color="disabled" />
        <Typography variant="h2">No notifications</Typography>
        <Typography color="text.secondary">Try changing the filter or refreshing the page.</Typography>
      </Stack>
    )
  }

  return (
    <List disablePadding>
      {items.map((notification, index) => {
        const viewed = viewedIds.has(notification.ID)

        return (
          <Box key={notification.ID}>
            <ListItem
              disablePadding
              secondaryAction={
                <Button size="small" disabled={viewed} onClick={() => onMarkViewed(notification.ID)}>
                  {viewed ? 'Viewed' : 'Mark viewed'}
                </Button>
              }
              sx={{
                bgcolor: viewed ? 'background.paper' : '#fff7ed',
                borderLeft: viewed ? '4px solid transparent' : '4px solid #d97706',
              }}
            >
              <ListItemButton onClick={() => onMarkViewed(notification.ID)} sx={{ pr: { xs: 14, sm: 18 }, py: 1.5 }}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                      <Chip size="small" color={getTypeColor(notification.Type)} label={notification.Type} />
                      {!viewed && <Chip size="small" color="primary" variant="outlined" label="New" />}
                      <Typography component="span" sx={{ fontWeight: viewed ? 600 : 800 }}>
                        {notification.Message}
                      </Typography>
                    </Stack>
                  }
                  secondary={
                    <Typography component="span" variant="body2" color="text.secondary">
                      {formatTimestamp(notification.Timestamp)}
                    </Typography>
                  }
                />
              </ListItemButton>
            </ListItem>
            {index < items.length - 1 && <Divider />}
          </Box>
        )
      })}
    </List>
  )
}

export default App

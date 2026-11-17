import { Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useRevokeOtherSessions, useSessions } from '../../api/account'
import { useMe } from '../../api/auth'
import { useOrders, type Order, type OrderStatus } from '../../api/orders'
import { ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { AccountPage, Card } from './AccountLayout'
import styles from './Account.module.css'

/** Short order number in Eneba's "o-xxxxxxx" style (the full UUID stays in the URL). */
const orderNo = (id: string) => `o-${id.slice(0, 8)}`

const STATUS: Record<OrderStatus, { label: string; cls: string | undefined }> = {
  paid: { label: 'Order fulfilled', cls: styles.statusOk },
  pending_payment: { label: 'Awaiting payment', cls: styles.statusWait },
  cancelled: { label: 'Cancelled', cls: styles.statusBad },
  expired: { label: 'Payment incomplete', cls: styles.statusBad },
}

const METHOD: Record<string, string> = {
  card: 'Credit or debit card',
  wallet: 'keyshop Wallet',
  bank: 'Bank link',
}

function Loading() {
  return <div aria-busy="true" style={{ minHeight: 200 }} />
}

// ---------------------------------------------------------------- overview

export function OverviewPage() {
  const { t, money } = useI18n()
  const me = useMe()
  const orders = useOrders()
  const latest = (orders.data?.orders ?? [])
    .filter((o) => o.status === 'paid')
    .flatMap((o) => o.items)
    .slice(0, 3)
  const user = me.data
  return (
    <AccountPage title={t('Overview')}>
      <div className={styles.grid}>
        <div className={styles.stack}>
          <Card
            title={t('Profile')}
            action={
              <Link to="/account/settings" className={styles.link} aria-label={t('Edit profile')}>
                <Pencil size={16} />
              </Link>
            }
          >
            {user && (
              <div className={styles.profile}>
                <span className={styles.avatar} aria-hidden="true">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <span className={styles.name}>{user.displayName}</span>
                  <span>{user.email}</span>
                </div>
              </div>
            )}
          </Card>
          <Card>
            <div className={styles.balanceTop}>
              <div>
                <span className={styles.label}>{t('Total balance')}</span>
                <span className={styles.total}>{money(0)}</span>
                <p className={styles.hint}>{t('Total amount from all balances.')}</p>
              </div>
              <Link to="/account/wallet" className={styles.outline}>
                {t('Wallet overview')}
              </Link>
            </div>
            <BalanceRow label={t('Gift card balance')} hint={t('Available to spend on keyshop only.')} to="/account/add-funds" />
            <BalanceRow label={t('Bonus')} hint={t('Available to spend if it’s transferred to Gift Card Balance.')} to="/account/bonus" />
            <BalanceRow label={t('Cashback')} hint={t('Sub-balance of Gift Card Balance. Available to spend on keyshop only.')} to="/account/cashback" />
          </Card>
        </div>
        <Card title={t('Latest purchases')}>
          {orders.isPending ? (
            <Loading />
          ) : latest.length === 0 ? (
            <p className={styles.hint}>{t('No purchases yet.')}</p>
          ) : (
            <div className={styles.covers}>
              {latest.map((it, i) => (
                <Link key={`${it.offerId}-${i}`} to={`/p/${it.productSlug}`} title={it.title}>
                  <img referrerPolicy="no-referrer" src={it.coverUrl} alt={it.title} />
                </Link>
              ))}
            </div>
          )}
          <Link to="/account/library" className={styles.outline}>
            {t('View keys library')}
          </Link>
        </Card>
      </div>
    </AccountPage>
  )
}

function BalanceRow({ label, hint, to }: { label: string; hint: string; to: string }) {
  const { money, t } = useI18n()
  return (
    <div className={styles.balanceRow}>
      <div>
        <span className={styles.label}>{label}</span>
        <p className={styles.hint}>{hint}</p>
      </div>
      <span className={styles.amount}>{money(0)}</span>
      <Link to={to} className={styles.plus} aria-label={t('Open {name}', { name: label })}>
        <Plus size={16} />
      </Link>
    </div>
  )
}

// ---------------------------------------------------------------- login history

function deviceName(ua: string) {
  if (!ua) return '—'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : ''
  return [browser, os].filter(Boolean).join(' on ') || ua
}

export function LoginHistoryPage() {
  const { t, intl } = useI18n()
  const { data, isPending, isError, error, refetch } = useSessions()
  const revoke = useRevokeOtherSessions()
  const others = (data?.sessions ?? []).filter((s) => !s.current).length
  const region = useMemo(() => {
    try {
      return new Intl.DisplayNames([intl], { type: 'region' })
    } catch {
      return null
    }
  }, [intl])
  return (
    <AccountPage
      title={t('Login history')}
      actions={
        <button type="button" className={styles.outline} disabled={others === 0 || revoke.isPending} onClick={() => revoke.mutate()}>
          {t('Log out of all sessions')}
        </button>
      }
    >
      {revoke.isSuccess && (
        <p className={styles.success} role="status">
          {t('Signed out of {n} other sessions.', { n: revoke.data.revoked })}
        </p>
      )}
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Loading />
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('Time')}</th>
                <th scope="col">{t('Last active')}</th>
                <th scope="col">{t('Country')}</th>
                <th scope="col">{t('Device name')}</th>
              </tr>
            </thead>
            <tbody>
              {data.sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {new Date(s.createdAt).toLocaleString(intl, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    {s.current ? (
                      <span className={styles.statusOk}>{t('This device')}</span>
                    ) : (
                      new Date(s.lastSeenAt).toLocaleString(intl, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    )}
                  </td>
                  <td>{s.country ? (region?.of(s.country) ?? s.country) : '—'}</td>
                  <td>
                    <span className={styles.agent} title={s.userAgent}>
                      {deviceName(s.userAgent)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className={styles.demo}>{t('IP addresses are not stored by this demo; the country comes from Cloudflare when you sign in.')}</p>
    </AccountPage>
  )
}

// ---------------------------------------------------------------- orders

function orderTitle(o: Order, t: (s: string, v?: Record<string, string | number>) => string) {
  const first = o.items[0]?.title ?? ''
  return o.items.length > 1 ? t('{title} and {n} more', { title: first, n: o.items.length - 1 }) : first
}

export function OrdersPage() {
  const { t, money, intl } = useI18n()
  const { data, isPending, isError, error, refetch } = useOrders()
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase().replace(/^o-/, '')
  const rows = (data?.orders ?? []).filter((o) => !needle || o.id.toLowerCase().startsWith(needle))
  return (
    <AccountPage title={t('Orders')}>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          placeholder={t('Search by order ID')}
          aria-label={t('Search by order ID')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {q && (
          <button type="button" className={styles.reset} onClick={() => setQ('')}>
            {t('Reset filters')}
          </button>
        )}
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Loading />
      ) : (data?.orders.length ?? 0) === 0 ? (
        <div className={styles.tableWrap}>
          <p className={styles.empty}>
            {t('No orders yet.')}{' '}
            <Link to="/store" className={styles.link}>
              {t('Browse the store')}
            </Link>
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('Date')}</th>
                <th scope="col">{t('Status')}</th>
                <th scope="col">{t('Order title')}</th>
                <th scope="col">{t('Order ID')}</th>
                <th scope="col">{t('Payment method')}</th>
                <th scope="col">{t('Total amount')}</th>
                <th scope="col">
                  <span className="visuallyHidden">{t('Details')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} data-testid="order-row">
                  <td>
                    {new Date(o.createdAt).toLocaleString(intl, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>
                    <span className={STATUS[o.status].cls}>{t(STATUS[o.status].label)}</span>
                  </td>
                  <td>{orderTitle(o, t)}</td>
                  <td className={styles.mono}>{orderNo(o.id)}</td>
                  <td>{o.paymentMethod ? t(METHOD[o.paymentMethod] ?? o.paymentMethod) : '—'}</td>
                  <td>
                    <span className={styles.price}>{money(o.totalCents)}</span>
                  </td>
                  <td>
                    <Link
                      className={styles.link}
                      to={o.status === 'pending_payment' ? `/checkout/${o.id}/pay` : `/orders/${o.id}`}
                      aria-label={t('Details for order {id}', {
                        id: orderNo(o.id),
                      })}
                    >
                      {o.status === 'pending_payment' ? t('Pay') : t('Details')}
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.empty}>
                    {t('No orders match this ID.')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </AccountPage>
  )
}

// ---------------------------------------------------------------- keys library

export function LibraryPage() {
  const { t, money, intl } = useI18n()
  const { data, isPending, isError, error, refetch } = useOrders()
  const [q, setQ] = useState('')
  const items = (data?.orders ?? []).filter((o) => o.status === 'paid').flatMap((o) => o.items.map((it) => ({ ...it, order: o })))
  const needle = q.trim().toLowerCase()
  const rows = items.filter(
    (it) => !needle || it.title.toLowerCase().includes(needle) || orderNo(it.order.id).includes(needle) || it.order.id.startsWith(needle),
  )
  return (
    <AccountPage title={t('My library')}>
      <div className={styles.toolbar}>
        <input
          className={styles.input}
          type="search"
          placeholder={t('Search by product name / order id')}
          aria-label={t('Search by product name / order id')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {isError ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Loading />
      ) : items.length === 0 ? (
        <div className={styles.tableWrap}>
          <p className={styles.empty}>{t('Keys you buy will be listed here.')}</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t('Date')}</th>
                <th scope="col">{t('Order ID')}</th>
                <th scope="col">{t('Product name')}</th>
                <th scope="col">{t('Seller')}</th>
                <th scope="col">{t('Price')}</th>
                <th scope="col">
                  <span className="visuallyHidden">{t('Keys')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it, i) => (
                <tr key={`${it.order.id}-${it.offerId}-${i}`}>
                  <td>{new Date(it.order.paidAt ?? it.order.createdAt).toLocaleDateString(intl, { dateStyle: 'short' })}</td>
                  <td className={styles.mono}>{orderNo(it.order.id)}</td>
                  <td>
                    <Link to={`/p/${it.productSlug}`} className={styles.link}>
                      {it.title}
                    </Link>
                    {it.quantity > 1 && <> × {it.quantity}</>}
                  </td>
                  <td>{it.seller}</td>
                  <td>
                    <span className={styles.price}>{money(it.unitPriceCents * it.quantity)}</span>
                  </td>
                  <td>
                    <Link to={`/orders/${it.order.id}`} className={styles.link}>
                      {t('View keys')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AccountPage>
  )
}

// ---------------------------------------------------------------- tickets

export function TicketsPage() {
  const { t } = useI18n()
  return (
    <AccountPage title={t('Tickets')}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('Ticket ID')}</th>
              <th scope="col">{t('Subject')}</th>
              <th scope="col">{t('Status')}</th>
              <th scope="col">{t('Last update')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className={styles.empty}>
                {t('You have no support tickets.')}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.demo}>{t('Support tickets are not part of this demo. On Eneba this is where conversations with support and sellers are kept.')}</p>
    </AccountPage>
  )
}

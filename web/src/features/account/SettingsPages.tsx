import { useState, type FormEvent } from 'react'
import { useChangePassword, useUpdateProfile } from '../../api/account'
import { useMe } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useI18n } from '../../i18n/useI18n'
import { AccountPage, Card } from './AccountLayout'
import styles from './Account.module.css'

function message(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback
}

export function PersonalInfoPage() {
  const { t, intl } = useI18n()
  const me = useMe()
  const update = useUpdateProfile()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const user = me.data
  if (!user) return null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    update.mutate(name, { onSuccess: () => setEditing(false) })
  }
  return (
    <AccountPage title={t('My personal info')}>
      <Card>
        <div className={styles.section}>
          <h2 className={styles.label}>{t('Username')}</h2>
          {editing ? (
            <form className={styles.form} onSubmit={submit} style={{ marginTop: 12 }}>
              <label className={styles.field}>
                {t('Display name')}
                <input className={styles.input} value={name} maxLength={50} onChange={(e) => setName(e.target.value)} autoFocus />
              </label>
              {update.isError && (
                <p className={styles.error} role="alert">
                  {message(update.error, t('Could not save.'))}
                </p>
              )}
              <div className={styles.toolbar}>
                <button type="submit" className={styles.primary} disabled={update.isPending}>
                  {t('Save')}
                </button>
                <button type="button" className={styles.reset} onClick={() => setEditing(false)}>
                  {t('Cancel')}
                </button>
              </div>
            </form>
          ) : (
            <p>
              <span className={styles.name}>{user.displayName}</span>{' '}
              <button
                type="button"
                className={styles.reset}
                onClick={() => {
                  setName(user.displayName)
                  setEditing(true)
                }}
              >
                {t('Edit')}
              </button>
            </p>
          )}
          {update.isSuccess && !editing && (
            <p className={styles.success} role="status">
              {t('Saved.')}
            </p>
          )}
        </div>
        <div className={styles.section}>
          <h2 className={styles.label}>{t('Personal details')}</h2>
          <p>{user.email}</p>
          <p className={styles.hint}>{t('The e-mail address is your login and can’t be changed in this demo.')}</p>
        </div>
        <div className={styles.section}>
          <h2 className={styles.label}>{t('Invoice details for your purchase')}</h2>
          <p className={styles.hint}>—</p>
        </div>
        <div className={styles.section}>
          <h2 className={styles.label}>{t('Account verification')}</h2>
          <p>
            <strong>{t('Active')}</strong>
            {user.createdAt && (
              <>
                {' · '}
                {t('since {date}', {
                  date: new Date(user.createdAt).toLocaleString(intl, {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  }),
                })}
              </>
            )}
          </p>
        </div>
      </Card>
    </AccountPage>
  )
}

export function PasswordPage() {
  const { t } = useI18n()
  const change = useChangePassword()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (next !== repeat) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent('')
          setNext('')
          setRepeat('')
        },
      },
    )
  }
  return (
    <AccountPage title={t('Change password')}>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          {t('Enter your old password')}
          <input
            className={styles.input}
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          {t('Enter your new password')}
          <input
            className={styles.input}
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          {t('Repeat your new password')}
          <input className={styles.input} type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </label>
        {mismatch && (
          <p className={styles.error} role="alert">
            {t('The new passwords don’t match.')}
          </p>
        )}
        {change.isError && (
          <p className={styles.error} role="alert">
            {message(change.error, t('Could not change the password.'))}
          </p>
        )}
        {change.isSuccess && (
          <p className={styles.success} role="status">
            {t('Password changed. Your other sessions were signed out.')}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={change.isPending}>
          {t('Save')}
        </button>
      </form>
    </AccountPage>
  )
}

export function ConnectedAppsPage() {
  const { t } = useI18n()
  return (
    <AccountPage title={t('Connected apps')}>
      <Card>
        <p className={styles.empty}>{t('No apps are connected to your account.')}</p>
      </Card>
      <p className={styles.demo}>
        {t('On Eneba, sign-in providers such as Google, Facebook or Steam appear here. keyshop signs in with e-mail and password only.')}
      </p>
    </AccountPage>
  )
}

export function MfaPage() {
  const { t } = useI18n()
  return (
    <AccountPage title={t('Multi factor authentication')}>
      <Card title={t('Authenticator app')}>
        <p className={styles.hint}>{t('Protect your account with a one-time code from an authenticator app in addition to your password.')}</p>
        <button type="button" className={styles.primary} style={{ marginTop: 16 }} disabled>
          {t('Enable')}
        </button>
      </Card>
      <p className={styles.demo}>{t('Multi-factor authentication is outside the scope of this demo.')}</p>
    </AccountPage>
  )
}

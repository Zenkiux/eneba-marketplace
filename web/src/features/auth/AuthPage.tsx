import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { useLogin, useMe, useRegister } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useI18n } from '../../i18n/useI18n'
import styles from './AuthPage.module.css'
import { safeNext } from './safeNext'

const DEMO = { email: 'demo@example.test', password: 'demo-password-2027' }

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const me = useMe()
  const login = useLogin()
  const register = useRegister()
  const mutation = mode === 'login' ? login : register
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useI18n()
  const ids = { email: useId(), password: useId(), name: useId(), error: useId() }

  useEffect(() => {
    document.title = mode === 'login' ? t('Log in — keyshop') : t('Create account — keyshop')
  }, [mode, t])

  if (me.data && !mutation.isPending && !mutation.isSuccess) return <Navigate to={next} replace />

  const error = mutation.error instanceof ApiError ? mutation.error : null
  const fieldError = (field: string) => (error?.details?.field === field ? error.message : null)
  const formError = error && !error.details?.field ? error.message : mutation.isError && !error ? t('Something went wrong. Please try again.') : null

  function submit(e: FormEvent) {
    e.preventDefault()
    mutation.mutate(mode === 'login' ? { email, password } : { email, password, displayName }, {
      onSuccess: () => navigate(next, { replace: true }),
    })
  }

  const otherLink = `${mode === 'login' ? '/register' : '/login'}${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <p className={styles.greeting} aria-hidden="true">
          {mode === 'login' ? (
            <>
              {t('Hi!')}
              <br />
              {t('It’s nice to')}
              <br />
              {t('see you!')}
            </>
          ) : (
            <>
              {t('Join and')}
              <br />
              {t('start playing!')}
            </>
          )}
        </p>
        <section className={styles.panel} aria-labelledby="auth-title">
          <h1 id="auth-title" className={styles.title}>
            {mode === 'login' ? t('Log in') : t('Create account')}
          </h1>
          <p className={styles.switch}>
            {mode === 'login' ? t('New here?') : t('Already have an account?')}{' '}
            <Link to={otherLink}>{mode === 'login' ? t('Create account') : t('Log in')}</Link>
          </p>
          {next.startsWith('/checkout') && <p className={styles.notice}>{t('Sign in to continue to checkout. Your cart is kept.')}</p>}

          <form className={styles.form} onSubmit={submit} noValidate aria-describedby={formError ? ids.error : undefined}>
            {mode === 'register' && (
              <div className={styles.field}>
                <label htmlFor={ids.name}>{t('Name (optional)')}</label>
                <input id={ids.name} autoComplete="nickname" maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
            )}
            <div className={styles.field}>
              <label htmlFor={ids.email}>{t('E-mail')}</label>
              <input
                id={ids.email}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!fieldError('email')}
              />
              {fieldError('email') && <p className={styles.fieldError}>{fieldError('email')}</p>}
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.password}>{t('Password')}</label>
              <div className={styles.passwordWrap}>
                <input
                  id={ids.password}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!fieldError('password')}
                />
                <button type="button" className={styles.reveal} aria-label={showPassword ? t('Hide password') : t('Show password')} onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldError('password') ? (
                <p className={styles.fieldError}>{fieldError('password')}</p>
              ) : (
                mode === 'register' && <p className={styles.hint}>{t('At least 8 characters.')}</p>
              )}
            </div>
            {formError && (
              <p id={ids.error} className={styles.formError} role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className={styles.submit} disabled={mutation.isPending}>
              {mutation.isPending ? t('Please wait…') : mode === 'login' ? t('Log in') : t('Create account')}
            </button>
          </form>

          {mode === 'login' && (
            <div className={styles.demo}>
              <p>
                {t('Demo account:')} <code>{DEMO.email}</code> / <code>{DEMO.password}</code>
              </p>
              <button
                type="button"
                onClick={() => {
                  setEmail(DEMO.email)
                  setPassword(DEMO.password)
                }}
              >
                {t('Fill in demo account')}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

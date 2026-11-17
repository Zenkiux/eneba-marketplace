import { useState } from 'react'
import { Link } from 'react-router'
import { useI18n } from '../../i18n/useI18n'
import { AccountPage, Card } from './AccountLayout'
import styles from './Account.module.css'

// Balance section. The demo has no stored-value wallet (payments use the simulated methods at
// checkout), so balances are zero and the top-up forms explain that instead of pretending.

function DemoNote() {
  const { t } = useI18n()
  return (
    <p className={styles.demo}>
      {t('keyshop has no wallet: every purchase is paid with a simulated method at checkout, so balances stay at zero and nothing can be topped up.')}
    </p>
  )
}

export function WalletPage() {
  const { t, money } = useI18n()
  const rows = [
    {
      label: t('Gift card balance'),
      hint: t('Available to spend on keyshop only.'),
    },
    {
      label: t('Bonus'),
      hint: t('Available to spend if it’s transferred to Gift Card Balance.'),
    },
    {
      label: t('Cashback'),
      hint: t('Sub-balance of Gift Card Balance. Available to spend on keyshop only.'),
    },
  ]
  return (
    <AccountPage title={t('Wallet overview')}>
      <div className={styles.grid}>
        <Card title={t('Total balance')}>
          <span className={styles.total}>{money(0)}</span>
          <p className={styles.hint}>{t('Total amount from all balances.')}</p>
          {rows.map((r) => (
            <div key={r.label} className={styles.balanceRow}>
              <div>
                <span className={styles.label}>{r.label}</span>
                <p className={styles.hint}>{r.hint}</p>
              </div>
              <span className={styles.amount}>{money(0)}</span>
            </div>
          ))}
        </Card>
        <Card title={t('Top up')}>
          <p className={styles.hint}>{t('Add funds or redeem a gift card to pay for keys from your balance.')}</p>
          <div className={styles.toolbar} style={{ marginTop: 16 }}>
            <Link to="/account/add-funds" className={styles.outline}>
              {t('Add funds')}
            </Link>
            <Link to="/account/redeem-gift-card" className={styles.outline}>
              {t('Redeem gift card')}
            </Link>
          </div>
        </Card>
      </div>
      <DemoNote />
    </AccountPage>
  )
}

export function TransactionsPage() {
  const { t } = useI18n()
  return (
    <AccountPage title={t('Transactions')}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{t('Date')}</th>
              <th scope="col">{t('Type')}</th>
              <th scope="col">{t('Description')}</th>
              <th scope="col">{t('Amount')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={4} className={styles.empty}>
                {t('No balance transactions yet.')}{' '}
                <Link to="/account/orders" className={styles.link}>
                  {t('See your orders')}
                </Link>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <DemoNote />
    </AccountPage>
  )
}

export function CashbackPage() {
  const { t, money } = useI18n()
  return (
    <AccountPage title={t('Cashback')}>
      <Card title={t('Cashback balance')}>
        <span className={styles.total}>{money(0)}</span>
        <p className={styles.hint}>{t('On Eneba, some offers return part of the price as cashback to your Gift Card Balance.')}</p>
      </Card>
      <DemoNote />
    </AccountPage>
  )
}

export function BonusPage() {
  const { t, money } = useI18n()
  return (
    <AccountPage title={t('Bonus')}>
      <Card title={t('Bonus balance')}>
        <span className={styles.total}>{money(0)}</span>
        <p className={styles.hint}>{t('Bonus comes from affiliate and promotion rewards and can be moved to your Gift Card Balance.')}</p>
      </Card>
      <DemoNote />
    </AccountPage>
  )
}

export function RedeemPage() {
  const { t } = useI18n()
  const [code, setCode] = useState('')
  return (
    <AccountPage title={t('Redeem gift card')}>
      <Card>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <label className={styles.field}>
            {t('Enter your gift card code')}
            <input className={styles.input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoComplete="off" />
          </label>
          <button type="submit" className={styles.primary} disabled>
            {t('Redeem')}
          </button>
        </form>
      </Card>
      <DemoNote />
    </AccountPage>
  )
}

export function AddFundsPage() {
  const { t, money } = useI18n()
  const [amount, setAmount] = useState(1000)
  return (
    <AccountPage title={t('Add funds')}>
      <Card title={t('Choose an amount')}>
        <div className={styles.toolbar} role="radiogroup" aria-label={t('Amount')}>
          {[500, 1000, 2500, 5000].map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={amount === c}
              className={styles.outline}
              style={amount === c ? { borderWidth: 2 } : undefined}
              onClick={() => setAmount(c)}
            >
              {money(c)}
            </button>
          ))}
        </div>
        <button type="button" className={styles.primary} disabled>
          {t('Continue')}
        </button>
      </Card>
      <DemoNote />
    </AccountPage>
  )
}

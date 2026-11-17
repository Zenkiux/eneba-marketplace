import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { AccountLayout } from './features/account/AccountLayout'
import { LibraryPage, LoginHistoryPage, OrdersPage, OverviewPage, TicketsPage } from './features/account/AccountPages'
import { AddFundsPage, BonusPage, CashbackPage, RedeemPage, TransactionsPage, WalletPage } from './features/account/BalancePages'
import { ConnectedAppsPage, MfaPage, PasswordPage, PersonalInfoPage } from './features/account/SettingsPages'
import { WishlistPage } from './features/wishlist/WishlistPage'
import { HelpPage } from './features/help/HelpPage'
import { SellerPage } from './features/seller/SellerPage'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { RequireAuth } from './features/auth/RequireAuth'
import { WillItWorkPage } from './features/compat/WillItWorkPage'
import { ProposalPage } from './features/proposal/ProposalPage'
import { CartPage } from './features/cart/CartPage'
import { CheckoutPage } from './features/checkout/CheckoutPage'
import { PaymentPage } from './features/checkout/PaymentPage'
import { HomePage } from './features/home/HomePage'
import { NotFoundPage } from './features/not-found/NotFoundPage'
import { OrderPage } from './features/orders/OrderPage'
import { ProductPage } from './features/product/ProductPage'
import { StorePage } from './features/store/StorePage'

export const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'store', element: <StorePage /> },
      { path: 'p/:slug', element: <ProductPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'will-it-work', element: <WillItWorkPage /> },
      { path: 'proposal', element: <ProposalPage /> },
      { path: 'checkout', element: <RequireAuth><CheckoutPage /></RequireAuth> },
      { path: 'checkout/:id/pay', element: <RequireAuth><PaymentPage /></RequireAuth> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'help', element: <HelpPage /> },
      { path: 'seller/:slug', element: <SellerPage /> },
      { path: 'wishlist', element: <RequireAuth><WishlistPage /></RequireAuth> },
      { path: 'orders/:id', element: <RequireAuth><OrderPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    // my.eneba.com-style account area with its own shell (sign-in enforced inside the layout).
    path: 'account',
    element: <AccountLayout />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'login-history', element: <LoginHistoryPage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'transactions', element: <TransactionsPage /> },
      { path: 'cashback', element: <CashbackPage /> },
      { path: 'bonus', element: <BonusPage /> },
      { path: 'redeem-gift-card', element: <RedeemPage /> },
      { path: 'add-funds', element: <AddFundsPage /> },
      { path: 'orders', element: <OrdersPage /> },
      { path: 'library', element: <LibraryPage /> },
      { path: 'tickets', element: <TicketsPage /> },
      { path: 'settings', element: <PersonalInfoPage /> },
      { path: 'password', element: <PasswordPage /> },
      { path: 'connected-apps', element: <ConnectedAppsPage /> },
      { path: 'mfa', element: <MfaPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

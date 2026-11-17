import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { OrdersPage } from './features/account/OrdersPage'
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
      { path: 'account/orders', element: <RequireAuth><OrdersPage /></RequireAuth> },
      { path: 'orders/:id', element: <RequireAuth><OrderPage /></RequireAuth> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

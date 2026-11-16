import type { RouteObject } from 'react-router'
import { Layout } from './components/Layout'
import { OrdersPage } from './features/account/OrdersPage'
import { LoginPage } from './features/auth/LoginPage'
import { RegisterPage } from './features/auth/RegisterPage'
import { CartPage } from './features/cart/CartPage'
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
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'account/orders', element: <OrdersPage /> },
      { path: 'orders/:id', element: <OrderPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

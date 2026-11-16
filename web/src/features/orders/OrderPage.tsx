import { useParams } from 'react-router'

export function OrderPage() {
  const { id } = useParams()
  return <h1>Order {id}</h1>
}

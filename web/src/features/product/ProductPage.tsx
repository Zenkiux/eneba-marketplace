import { useParams } from 'react-router'

export function ProductPage() {
  const { slug } = useParams()
  return <h1>Product: {slug}</h1>
}

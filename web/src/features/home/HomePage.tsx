import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'

interface Health {
  status: string
}

export function HomePage() {
  const health = useQuery({
    queryKey: ['healthz'],
    queryFn: ({ signal }) => api.get<Health>('/healthz', { signal }),
    retry: false,
  })

  let apiStatus: string
  if (health.isPending) apiStatus = 'checking…'
  else if (health.isError) apiStatus = `unreachable (${health.error.message})`
  else apiStatus = health.data.status

  return (
    <>
      <h1>Home</h1>
      <p>API status: {apiStatus}</p>
    </>
  )
}

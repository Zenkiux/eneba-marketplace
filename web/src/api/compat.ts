import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export interface DetectResult {
  device: { os: string; gpuScore: number; cpuScore: number; ramGb: number }
  gpuName: string
  gpuMatched: boolean
  cpuEstimated: boolean
  ramIsMinimum: boolean
  country: string
}

export interface GPU {
  name: string
  score: number
}

export function detectDevice(body: { renderer: string; cores: number; memoryGb: number; platform: string }) {
  return api.post<DetectResult>('/compat/detect', body)
}

export function useGPUs() {
  return useQuery({
    queryKey: ['compat-gpus'],
    queryFn: ({ signal }) => api.get<{ gpus: GPU[] }>('/compat/gpus', { signal }),
    staleTime: Infinity,
  })
}

export function scoreCPU(name: string) {
  return api.get<{ score: number; matched: boolean }>(`/compat/cpu?name=${encodeURIComponent(name)}`)
}

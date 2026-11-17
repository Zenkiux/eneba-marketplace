import { useSyncExternalStore } from 'react'
import { getDevice, subscribeDevice } from './device'

export function useDevice() {
  return useSyncExternalStore(subscribeDevice, getDevice)
}

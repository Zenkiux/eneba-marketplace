// "Proposal notes" switch: when on, 💡 markers explain the proposed feature to the Eneba team.
import { useSyncExternalStore } from 'react'

const KEY = 'keyshop.proposalNotes'
const listeners = new Set<() => void>()

function get(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on'
  } catch {
    return false
  }
}

export function setProposalNotes(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    // storage blocked
  }
  listeners.forEach((l) => l())
}

export function useProposalNotes(): boolean {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    get,
  )
}

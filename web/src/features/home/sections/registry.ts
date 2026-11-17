import type { ComponentType } from 'react'

export interface SectionProps {
  sectionKey: string
  title: string
}

// Filled in by registry-components.tsx. Kept separate so components can import SectionProps.
export const sectionComponents: Record<string, ComponentType<SectionProps>> = {}

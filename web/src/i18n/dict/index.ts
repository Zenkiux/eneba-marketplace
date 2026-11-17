import type { Lang } from '../locale'
import de from './de'
import lt from './lt'
import pl from './pl'

// English text is the key; missing entries fall back to English.
export const DICTS: Record<Lang, Record<string, string>> = { en: {}, lt, de, pl }

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'
import type { FacetValue } from '../../api/types'
import styles from './StorePage.module.css'

interface Props {
  title: string
  values: FacetValue[] | undefined
  selected: string[]
  onToggle: (slug: string) => void
}

/** Collapsible checkbox list with result counts (counts come from the API's facets). */
export function FilterGroup({ title, values, selected, onToggle }: Props) {
  const [open, setOpen] = useState(true)
  const id = useId()
  return (
    <fieldset className={styles.group}>
      <legend className={styles.groupLegend}>
        <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {title}
          {selected.length > 0 && <span className={styles.badge}>{selected.length}</span>}
          {open ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
        </button>
      </legend>
      {open && (
        <div id={id} className={styles.options}>
          {(values ?? []).map((v) => {
            const checked = selected.includes(v.slug)
            return (
              <label key={v.slug} className={v.count === 0 && !checked ? `${styles.option} ${styles.optionEmpty}` : styles.option}>
                <input type="checkbox" checked={checked} onChange={() => onToggle(v.slug)} />
                <span className={styles.optionName}>{v.name}</span>
                <span className={styles.optionCount}>{v.count}</span>
              </label>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}

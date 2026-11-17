import { Fragment, type ReactNode } from 'react'

/**
 * Fills `{name}` placeholders of an already translated sentence with React nodes (e.g. links),
 * so the whole sentence stays one translation key and word order can change per language.
 */
export function rich(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/).map((chunk, i) => {
    const name = /^\{(\w+)\}$/.exec(chunk)?.[1]
    return <Fragment key={i}>{name !== undefined && name in parts ? parts[name] : chunk}</Fragment>
  })
}

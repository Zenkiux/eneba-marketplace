import { useHomeLayout } from '../../api/catalog'
import { Container } from '../../components/Container'
import { ErrorState } from '../../components/States'
import { useI18n } from '../../i18n/useI18n'
import { sectionComponents } from './sections/registry-components'

/**
 * The homepage has no content of its own: it asks the API which blocks to show (and in which
 * order), then each block fetches its own content from its own endpoint.
 */
export function HomePage() {
  const { data, isPending, isError, error, refetch } = useHomeLayout()
  const { t } = useI18n()
  if (isError) {
    return (
      <Container>
        <ErrorState error={error} onRetry={() => void refetch()} />
      </Container>
    )
  }
  if (isPending) return <div style={{ minHeight: '80vh' }} aria-busy="true" />
  return (
    <>
      <h1 className="visuallyHidden">{t('keyshop — digital game keys')}</h1>
      {data.sections.map((s) => {
        const Section = sectionComponents[s.type]
        return Section ? <Section key={s.key} sectionKey={s.key} title={s.title} /> : null
      })}
    </>
  )
}

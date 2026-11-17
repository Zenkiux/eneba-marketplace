import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { Link } from 'react-router'
import type { ProductDetail } from '../../api/types'
import { rich } from '../../i18n/rich'
import { useI18n } from '../../i18n/useI18n'
import { ProposalNote } from '../proposal/ProposalNote'
import { hardwareShort, PART_LABEL, verdictFor, type Part } from './verdict'
import { regionWorksIn } from './regions'
import { useDevice } from './useDevice'
import styles from './ProductCompat.module.css'

const CONSOLE_NAME: Record<string, string> = { psn: 'PlayStation', xbox: 'Xbox', nintendo: 'Nintendo Switch' }

function Row({ ok, unknown, title, detail }: { ok: boolean; unknown?: boolean; title: string; detail: string }) {
  const Icon = unknown ? CircleHelp : ok ? CircleCheck : CircleX
  return (
    <li className={unknown ? styles.unknown : ok ? styles.ok : styles.no}>
      <Icon size={20} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
    </li>
  )
}

function partsText(parts: Part[], t: (text: string) => string) {
  return parts.map((p) => t(PART_LABEL[p])).join(', ')
}

/** "Will it work for me?" check for one product: region, platform and PC requirements. */
export function ProductCompat({ p }: { p: ProductDetail }) {
  const device = useDevice()
  const { t } = useI18n()
  const req = p.requirements
  const console = CONSOLE_NAME[p.platform.slug]
  return (
    <section className={styles.box} aria-labelledby="compat-h">
      <div className={styles.head}>
        <h2 id="compat-h" className={styles.h2}>
          {t('Will it work for me?')}
        </h2>
        <ProposalNote id="product" inline />
      </div>
      {!device ? (
        <p className={styles.setup}>
          {rich(t('{link} to check this product before buying.'), {
            link: <Link to="/will-it-work">{t('Set up your country, PC and consoles')}</Link>,
          })}
        </p>
      ) : (
        <ul className={styles.rows}>
          <Row
            ok={regionWorksIn(p.region.slug, device.country)}
            unknown={!device.country}
            title={t('Region: {region}', { region: p.region.name })}
            detail={
              !device.country
                ? t('Choose your country to check.')
                : regionWorksIn(p.region.slug, device.country)
                  ? t('Activates in {country}.', { country: device.country })
                  : t('This key does not activate in {country}.', { country: device.country })
            }
          />
          {console ? (
            <Row
              ok={verdictFor(device, p).failing.indexOf('platform') < 0}
              title={t('Platform: {platform}', { platform: console })}
              detail={
                verdictFor(device, p).failing.includes('platform')
                  ? t('Needs a {console}, which isn’t in your setup.', { console })
                  : t('You have a {console}.', { console })
              }
            />
          ) : (
            req?.minimum && (
              <>
                <Row
                  ok={hardwareShort(device, req.minimum).length === 0}
                  unknown={!device.gpuScore || !device.cpuScore || !device.ramGb}
                  title={t('Minimum requirements')}
                  detail={
                    hardwareShort(device, req.minimum).length
                      ? t('Below minimum: {parts}.', { parts: partsText(hardwareShort(device, req.minimum), t) })
                      : !device.gpuScore || !device.cpuScore || !device.ramGb
                        ? t('Some of your PC details are missing.')
                        : t('Your PC meets the minimum requirements.')
                  }
                />
                {req.recommended && (
                  <Row
                    ok={hardwareShort(device, req.recommended).length === 0}
                    unknown={!device.gpuScore || !device.cpuScore || !device.ramGb}
                    title={t('Recommended requirements')}
                    detail={
                      hardwareShort(device, req.recommended).length
                        ? t('Expect lower settings: {parts}.', { parts: partsText(hardwareShort(device, req.recommended), t) })
                        : t('Should run well at recommended settings.')
                    }
                  />
                )}
              </>
            )
          )}
          {!console && !req?.minimum && <Row ok unknown title={t('PC requirements')} detail={t('No official requirements listed for this product.')} />}
        </ul>
      )}
      {device && (
        <p className={styles.small}>
          {t('Based on your saved setup ({setup}).', {
            setup: [device.gpuName, device.ramGb ? t('{n} GB RAM', { n: device.ramGb }) : '', device.country].filter(Boolean).join(' · '),
          })}{' '}
          <Link to="/will-it-work">{t('Change')}</Link>
        </p>
      )}

      {req && (req.rawMinimum || req.rawRecommended) && (
        <div className={styles.tables}>
          {(['rawMinimum', 'rawRecommended'] as const).map((k) =>
            req[k] && Object.keys(req[k]!).length ? (
              <table key={k} className={styles.table}>
                <caption>{k === 'rawMinimum' ? t('Minimum system requirements') : t('Recommended system requirements')}</caption>
                <tbody>
                  {Object.entries(req[k]!).map(([name, value]) => (
                    <tr key={name}>
                      <th scope="row">{name}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null,
          )}
        </div>
      )}
    </section>
  )
}

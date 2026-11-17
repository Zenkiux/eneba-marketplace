import { CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import { Link } from 'react-router'
import type { ProductDetail } from '../../api/types'
import { rich } from '../../i18n/rich'
import { useI18n } from '../../i18n/useI18n'
import { ProposalNote } from '../proposal/ProposalNote'
import { verdictFor, type ReqLevel } from './verdict'
import type { DeviceProfile } from './device'
import type { Requirements } from '../../api/types'
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
            <PCCheck device={device} req={req} />
          )}

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

type Cell = 'ok' | 'no' | 'unknown' | 'none'
type HwPart = 'os' | 'cpu' | 'gpu' | 'ram'

const RAW_KEYS: Record<HwPart, string[]> = {
  os: ['system requirements', 'os', 'operating'],
  cpu: ['processor', 'cpu'],
  gpu: ['graphics', 'video', 'gpu'],
  ram: ['memory', 'ram'],
}

function rawField(raw: Record<string, string> | undefined, part: HwPart) {
  if (!raw) return ''
  const hit = Object.entries(raw).find(([k]) => RAW_KEYS[part].some((n) => k.toLowerCase().includes(n)))
  return hit?.[1] ?? ''
}

/** One part against one requirement level: pass, fail, can't tell, or not required. */
function cell(device: DeviceProfile, level: ReqLevel | undefined, raw: string, part: HwPart): Cell {
  if (!level && !raw) return 'none'
  if (level?.unchecked?.includes(part as 'gpu')) return 'unknown'
  const need = part === 'os' ? level?.os : part === 'cpu' ? level?.cpuScore : part === 'gpu' ? level?.gpuScore : level?.ramGb
  if (!need) return raw ? 'unknown' : 'none'
  if (part === 'os') return device.os ? (device.os === need ? 'ok' : 'no') : 'unknown'
  const have = part === 'cpu' ? device.cpuScore : part === 'gpu' ? device.gpuScore : device.ramGb
  if (!have) return 'unknown'
  return have + (part === 'ram' ? 0.01 : 0) >= (need as number) ? 'ok' : 'no'
}

/** CYRI-style comparison: each part of the visitor's PC against the minimum and recommended specs. */
function PCCheck({ device, req }: { device: DeviceProfile; req: Requirements | null }) {
  const { t } = useI18n()
  if (!req || (!req.minimum && !req.rawMinimum)) {
    return <Row ok unknown title={t('PC requirements')} detail={t('No official requirements listed for this product, so we can’t check your PC.')} />
  }
  const parts: { key: HwPart; label: string; yours: string }[] = [
    { key: 'os', label: t('Operating system'), yours: device.os ? { windows: 'Windows', mac: 'macOS', linux: 'Linux' }[device.os] : '' },
    { key: 'cpu', label: t('Processor'), yours: device.cpuLabel ? t(device.cpuLabel) : '' },
    { key: 'gpu', label: t('Graphics card'), yours: device.gpuScore ? device.gpuName : '' },
    { key: 'ram', label: t('Memory (RAM)'), yours: device.ramGb ? t('{n} GB', { n: device.ramGb }) : '' },
  ]
  const rows = parts.map((p) => ({
    ...p,
    min: cell(device, req.minimum, rawField(req.rawMinimum, p.key), p.key),
    rec: cell(device, req.recommended, rawField(req.rawRecommended, p.key), p.key),
    minText: rawField(req.rawMinimum, p.key),
    recText: rawField(req.rawRecommended, p.key),
  }))
  const minFail = rows.filter((r) => r.min === 'no')
  const minUnknown = rows.filter((r) => r.min === 'unknown')
  const recFail = rows.filter((r) => r.rec === 'no' || r.rec === 'unknown')
  const hasRec = Boolean(req.recommended || req.rawRecommended)
  const verdict = minFail.length
    ? { ok: false, unknown: false, title: t('Your PC can’t run it'), detail: t('Below minimum: {parts}.', { parts: minFail.map((r) => r.label).join(', ') }) }
    : minUnknown.length
      ? {
          ok: false,
          unknown: true,
          title: t('Can’t fully check'),
          detail: t('Not checked: {parts}. Add your details or compare the requirements below.', { parts: minUnknown.map((r) => r.label).join(', ') }),
        }
      : hasRec && recFail.length
        ? { ok: true, unknown: false, title: t('Runs at minimum settings'), detail: t('Below recommended: {parts}.', { parts: recFail.map((r) => r.label).join(', ') }) }
        : { ok: true, unknown: false, title: t('Your PC can run it'), detail: hasRec ? t('Meets the recommended requirements.') : t('Meets the minimum requirements.') }
  const mark = (c: Cell) =>
    c === 'ok' ? <CircleCheck size={16} aria-label={t('meets')} /> : c === 'no' ? <CircleX size={16} aria-label={t('below')} /> : c === 'unknown' ? <CircleHelp size={16} aria-label={t('not checked')} /> : null
  return (
    <>
      <Row ok={verdict.ok} unknown={verdict.unknown} title={verdict.title} detail={verdict.detail} />
      <li className={styles.compare}>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('Part')}</th>
              <th scope="col">{t('Your PC')}</th>
              <th scope="col">{t('Minimum')}</th>
              {hasRec && <th scope="col">{t('Recommended')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td>{r.yours || <em>{t('Unknown')}</em>}</td>
                <td className={styles[r.min]}>
                  {mark(r.min)} <span>{r.minText || '—'}</span>
                </td>
                {hasRec && (
                  <td className={styles[r.rec]}>
                    {mark(r.rec)} <span>{r.recText || '—'}</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </li>
    </>
  )
}

import { Cpu, Gamepad2, Globe2, MonitorSmartphone, ScanSearch } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { scoreCPU, useGPUs } from '../../api/compat'
import { useProducts } from '../../api/catalog'
import { Container } from '../../components/Container'
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard'
import { useI18n } from '../../i18n/useI18n'
import { ProposalNote } from '../proposal/ProposalNote'
import { CPU_CHOICES, RAM_CHOICES, saveDevice, worksParams, type Console, type DeviceProfile, type OS } from './device'
import { detect } from './detect'
import { COUNTRIES } from './regions'
import { useDevice } from './useDevice'
import { CompatBadge } from './CompatBadge'
import styles from './WillItWork.module.css'

const EMPTY: DeviceProfile = { country: '', os: '', gpuName: '', gpuScore: 0, cpuLabel: '', cpuScore: 0, ramGb: 0, consoles: [], detected: false }
const CONSOLES: { key: Console; label: string }[] = [
  { key: 'psn', label: 'PlayStation' },
  { key: 'xbox', label: 'Xbox' },
  { key: 'nintendo', label: 'Nintendo Switch' },
]

export function WillItWorkPage() {
  const saved = useDevice()
  const [draft, setDraft] = useState<DeviceProfile>(saved ?? EMPTY)
  const [detecting, setDetecting] = useState(false)
  const [detectNote, setDetectNote] = useState<string | null>(null)
  const [cpuModel, setCpuModel] = useState('')
  const [cpuNote, setCpuNote] = useState<string | null>(null)
  const gpus = useGPUs()
  const { t } = useI18n()

  useEffect(() => {
    document.title = t('Will it work for me? — keyshop')
  }, [t])

  async function runDetection() {
    setDetecting(true)
    setDetectNote(null)
    try {
      const r = await detect()
      const notes: string[] = []
      if (!r.gpuMatched) 
        notes.push(
          r.raw.renderer
            ? t('Your browser reports the GPU as “{gpu}”, which we couldn’t match — please pick it below.', { gpu: r.raw.renderer })
            : t('Your browser hides the graphics card — please pick it below.'),
        )
      if (r.cpuEstimated && r.raw.cores) 
        notes.push(t('Browsers don’t reveal the processor model; we estimated it from {n} threads — adjust if you know it.', { n: r.raw.cores }))
      if (r.ramIsMinimum) notes.push(t('Browsers report at most 8 GB of memory; choose your real amount if you have more.'))
      if (!r.raw.memoryGb) notes.push(t('Your browser doesn’t report memory — please choose it.'))
      setDetectNote(notes.join(' '))
      const cpu = [...CPU_CHOICES].reverse().find((c) => c.score <= r.device.cpuScore) ?? CPU_CHOICES[0]
      setDraft((d) => ({
        ...d,
        detected: true,
        country: d.country || r.country,
        os: (r.device.os as OS) || d.os,
        gpuName: r.gpuMatched ? r.gpuName : d.gpuName,
        gpuScore: r.gpuMatched ? r.device.gpuScore : d.gpuScore,
        cpuLabel: r.raw.cores ? cpu.label : d.cpuLabel,
        cpuScore: r.raw.cores ? cpu.score : d.cpuScore,
        ramGb: r.device.ramGb ? Math.max(d.ramGb, r.device.ramGb) : d.ramGb,
      }))
    } catch {
      setDetectNote(t('Detection failed — you can still fill in the form by hand.'))
    } finally {
      setDetecting(false)
    }
  }

  async function applyCpuModel() {
    const name = cpuModel.trim()
    if (!name) return
    try {
      const r = await scoreCPU(name)
      if (r.matched) {
        setDraft((d) => ({ ...d, cpuScore: r.score, cpuLabel: name }))
        setCpuNote(null)
      } else setCpuNote(t('We don’t recognise “{name}”. Pick the closest group above.', { name }))
    } catch {
      setCpuNote(t('Couldn’t check the processor right now.'))
    }
  }

  const gpuList = gpus.data?.gpus ?? []
  const customCpu = draft.cpuScore > 0 && !CPU_CHOICES.some((c) => c.score === draft.cpuScore && c.label === draft.cpuLabel)
  const set = <K extends keyof DeviceProfile>(k: K, v: DeviceProfile[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved ?? EMPTY)

  return (
    <Container className={styles.page}>
      <Link to="/proposal" className={styles.kicker}>
        💡 {t('Proposal #1 — read why and how')}
      </Link>
      <div className={styles.head}>
        <h1 className={styles.h1}>{t('Will it work for me?')}</h1>
        <ProposalNote id="overview" inline />
      </div>
      <p className={styles.lead}>
        {t(
          'Check before you buy: does the key activate in your country, is it for a platform you own, and can your PC run the game according to its official requirements? Detection runs in your browser — nothing to install, and your profile stays on this device.',
        )}
      </p>

      <div className={styles.layout}>
        <section className={styles.panel} aria-labelledby="profile-h">
          <h2 id="profile-h" className={styles.h2}>
            {t('Your setup')}
          </h2>

          <button type="button" className={styles.detect} onClick={() => void runDetection()} disabled={detecting}>
            <ScanSearch size={20} aria-hidden="true" /> {detecting ? t('Detecting…') : t('Detect my PC')}
          </button>
          <ProposalNote id="detect" />
          {detectNote && <p className={styles.note}>{detectNote}</p>}

          <label className={styles.field}>
            <span>
              <Globe2 size={16} aria-hidden="true" /> {t('Country')}
            </span>
            <select value={draft.country} onChange={(e) => set('country', e.target.value)}>
              <option value="">{t('Choose…')}</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {t(c.name)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>
              <MonitorSmartphone size={16} aria-hidden="true" /> {t('Operating system')}
            </span>
            <select value={draft.os} onChange={(e) => set('os', e.target.value as OS)}>
              <option value="">{t('Unknown')}</option>
              <option value="windows">Windows</option>
              <option value="mac">macOS</option>
              <option value="linux">Linux / SteamOS</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>{t('Graphics card')}</span>
            <input
              list="gpu-list"
              placeholder={t('Start typing, e.g. RTX 3060')}
              value={draft.gpuName}
              onChange={(e) => {
                const g = gpuList.find((x) => x.name.toLowerCase() === e.target.value.toLowerCase())
                setDraft((d) => ({ ...d, gpuName: e.target.value, gpuScore: g ? g.score : 0 }))
              }}
            />
            <datalist id="gpu-list">
              {gpuList.map((g) => (
                <option key={g.name} value={g.name} />
              ))}
            </datalist>
            {draft.gpuName && !draft.gpuScore && <small className={styles.warn}>{t('Pick a card from the list so we can compare it.')}</small>}
          </label>

          <label className={styles.field}>
            <span>
              <Cpu size={16} aria-hidden="true" /> {t('Processor')}
            </span>
            <select
              value={draft.cpuScore || ''}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (customCpu && v === draft.cpuScore) return
                const c = CPU_CHOICES.find((x) => x.score === v)
                setDraft((d) => ({ ...d, cpuScore: c?.score ?? 0, cpuLabel: c?.label ?? '' }))
              }}
            >
              <option value="">{t('Unknown')}</option>
              {customCpu && <option value={draft.cpuScore}>{draft.cpuLabel}</option>}
              {CPU_CHOICES.map((c) => (
                <option key={c.score} value={c.score}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>{t('…or type your processor model')}</span>
            <input
              placeholder={t('e.g. i5-4590, Ryzen 5 3600, Core 2 Duo E8400')}
              value={cpuModel}
              onChange={(e) => setCpuModel(e.target.value)}
              onBlur={() => void applyCpuModel()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void applyCpuModel()
                }
              }}
            />
            {cpuNote && <small className={styles.warn}>{cpuNote}</small>}
          </label>

          <label className={styles.field}>
            <span>{t('Memory (RAM)')}</span>
            <select value={draft.ramGb || ''} onChange={(e) => set('ramGb', Number(e.target.value))}>
              <option value="">{t('Unknown')}</option>
              {RAM_CHOICES.map((r) => (
                <option key={r} value={r}>
                  {t('{n} GB', { n: r })}
                </option>
              ))}
            </select>
          </label>

          <fieldset className={styles.consoles}>
            <legend>
              <Gamepad2 size={16} aria-hidden="true" /> {t('Consoles you own')}
            </legend>
            {CONSOLES.map((c) => (
              <label key={c.key}>
                <input
                  type="checkbox"
                  checked={draft.consoles.includes(c.key)}
                  onChange={(e) =>
                    set('consoles', e.target.checked ? [...draft.consoles, c.key] : draft.consoles.filter((x) => x !== c.key))
                  }
                />
                {c.label}
              </label>
            ))}
          </fieldset>

          <div className={styles.actions}>
            <button type="button" className={styles.save} disabled={!dirty} onClick={() => saveDevice(draft)}>
              {saved ? t('Update my setup') : t('Save my setup')}
            </button>
            {saved && (
              <button
                type="button"
                className={styles.clear}
                onClick={() => {
                  saveDevice(null)
                  setDraft(EMPTY)
                }}
              >
                {t('Forget my setup')}
              </button>
            )}
          </div>
          <p className={styles.privacy}>
            {t('Stored only in this browser. Results are estimates based on official requirements and approximate hardware scores.')}
          </p>
        </section>

        <div className={styles.results}>
          {saved ? <Matches profile={saved} /> : <p className={styles.empty}>{t('Save your setup to see the games that work for you.')}</p>}
          <GameCheck />
        </div>
      </div>
    </Container>
  )
}

function Matches({ profile }: { profile: DeviceProfile }) {
  const params = worksParams(profile)
  params.set('page_size', '8')
  params.set('sort', 'popular')
  const { data, isPending } = useProducts(params.toString())
  const { t } = useI18n()
  return (
    <section aria-labelledby="matches-h">
      <div className={styles.resultsHead}>
        <h2 id="matches-h" className={styles.h2}>
          {data ? t('Works for you · {n} products', { n: data.total }) : t('Works for you')}
        </h2>
        <Link to="/store?works=1" className={styles.more}>
          {t('See all in the store')}
        </Link>
      </div>
      <div className={styles.grid}>
        {isPending ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />) : data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  )
}

/** Search any game and see the verdict right away (independent of the "works for me" list). */
function GameCheck() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const { t } = useI18n()
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q.trim()), 250)
    return () => clearTimeout(timer)
  }, [q])
  const query = useMemo(() => new URLSearchParams({ q: debounced, page_size: '8' }).toString(), [debounced])
  const { data, isFetching } = useProducts(query, debounced.length >= 2)
  return (
    <section aria-labelledby="check-h" className={styles.check}>
      <h2 id="check-h" className={styles.h2}>
        {t('Check any game')}
      </h2>
      <input className={styles.search} type="search" placeholder={t('Type a game, e.g. elden ring or gta 6')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Game to check')} />
      {debounced.length >= 2 && (
        <ul className={styles.checkList} aria-busy={isFetching}>
          {(data?.items ?? []).map((p) => (
            <li key={p.id}>
              <Link to={`/p/${p.slug}`}>{p.title}</Link>
              <CompatBadge product={p} compact />
            </li>
          ))}
          {data && data.items.length === 0 && <li>{t('No games found.')}</li>}
        </ul>
      )}
    </section>
  )
}

import { Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router'
import { useMe } from '../../api/auth'
import { ApiError } from '../../api/client'
import { useReviews, useSaveReview } from '../../api/reviews'
import { useI18n } from '../../i18n/useI18n'
import styles from './ProductPage.module.css'

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className={styles.stars} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= Math.round(value) ? 'currentColor' : 'none'} />
      ))}
    </span>
  )
}

/** Eneba's "Reviews: N" block. Buyers of the product can write (and edit) one review. */
export function Reviews({ slug }: { slug: string }) {
  const [page, setPage] = useState(1)
  const [writing, setWriting] = useState(false)
  const { data, isPending } = useReviews(slug, page)
  const me = useMe()
  const location = useLocation()
  const { t, intl } = useI18n()
  const total = data?.total ?? 0
  return (
    <section className={styles.section} aria-labelledby="reviews-h">
      <div className={styles.reviewsHead}>
        <h2 id="reviews-h" className={styles.h2}>
          {t('Reviews: {n}', { n: total })}
        </h2>
        {!me.data ? (
          <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className={styles.reviewNow}>
            {t('Log in to review')}
          </Link>
        ) : data?.canReview ? (
          <button type="button" className={styles.reviewNow} onClick={() => setWriting((w) => !w)} aria-expanded={writing}>
            {data.mine ? t('Edit your review') : t('Review now')}
          </button>
        ) : (
          <span className={styles.sectionNote}>{t('Only buyers of this product can review it.')}</span>
        )}
      </div>
      {writing && data && <ReviewForm slug={slug} initial={data.mine} onDone={() => setWriting(false)} />}
      {isPending ? (
        <div aria-busy="true" style={{ minHeight: 80 }} />
      ) : total === 0 ? (
        <p className={styles.sectionNote}>{t('No reviews yet. Bought this product? Be the first to review it.')}</p>
      ) : (
        <ul className={styles.reviews}>
          {data!.reviews.map((r) => (
            <li key={r.id} className={styles.review}>
              <div className={styles.reviewMeta}>
                <span className={styles.avatar} aria-hidden="true">
                  {r.author.slice(0, 1).toUpperCase()}
                </span>
                <strong>{r.author}</strong>
                <span>{new Date(r.createdAt).toLocaleDateString(intl)}</span>
                <span className={styles.reviewStars} aria-label={t('{n} out of 5 stars', { n: r.rating })}>
                  <Stars value={r.rating} />
                </span>
                {r.mine && <span className={styles.reviewMine}>{t('Your review')}</span>}
              </div>
              <p className={styles.reviewBody}>{r.body}</p>
              <span className={styles.verifiedBuyer}>{t('Verified purchase')}</span>
            </li>
          ))}
        </ul>
      )}
      {data && data.page * data.pageSize < total && (
        <button type="button" className={styles.loadMore} onClick={() => setPage((p) => p + 1)}>
          {t('Load more reviews')}
        </button>
      )}
      {page > 1 && (
        <button type="button" className={styles.loadMore} onClick={() => setPage(1)}>
          {t('Back to the newest reviews')}
        </button>
      )}
    </section>
  )
}

function ReviewForm({ slug, initial, onDone }: { slug: string; initial: { rating: number; body: string } | null; onDone: () => void }) {
  const save = useSaveReview(slug)
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [body, setBody] = useState(initial?.body ?? '')
  const { t } = useI18n()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate({ rating, body }, { onSuccess: onDone })
  }
  return (
    <form className={styles.reviewForm} onSubmit={submit}>
      <fieldset className={styles.starPicker}>
        <legend>{t('Your rating')}</legend>
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i}>
            <input type="radio" name="rating" value={i} checked={rating === i} onChange={() => setRating(i)} />
            <Star size={26} fill={i <= rating ? 'currentColor' : 'none'} aria-hidden="true" />
            <span className="visuallyHidden">{t('{n} stars', { n: i })}</span>
          </label>
        ))}
      </fieldset>
      <label className={styles.reviewField}>
        {t('Your review')}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={2000} placeholder={t('How was the key and the game? (10–2000 characters)')} />
      </label>
      {save.isError && (
        <p className={styles.formError} role="alert">
          {save.error instanceof ApiError ? save.error.message : t('Could not save.')}
        </p>
      )}
      <div className={styles.reviewActions}>
        <button type="submit" className={styles.buy} disabled={save.isPending || rating === 0}>
          {t('Publish review')}
        </button>
        {initial && (
          <button type="button" className={styles.linkButton} onClick={() => save.mutate(null, { onSuccess: onDone })}>
            {t('Delete review')}
          </button>
        )}
      </div>
    </form>
  )
}

export { Stars }

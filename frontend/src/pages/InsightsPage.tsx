import { api } from '../api/client'
import type { EntryCategory, Insights, RatingAverage } from '../api/types'
import AsyncView from '../components/AsyncView'
import { categoryTint } from '../components/categoryColors'
import RatingTrend from '../components/RatingTrend'
import { useAsync } from '../hooks/useAsync'
import { formatMediumDate } from '../utils/dates'

/** Summary stats of the user's journal and a chart of their ratings over time. */
export default function InsightsPage() {
  const insights = useAsync(() => api.getInsights(), [])

  return (
    <>
      <h1>Insights</h1>
      <AsyncView state={insights}>
        {(loaded) =>
          loaded.streaks.longest === null ? (
            <p>No entries yet. Insights appear once you&apos;ve journaled.</p>
          ) : (
            <InsightsSections insights={loaded} />
          )
        }
      </AsyncView>
    </>
  )
}

function InsightsSections({ insights }: { insights: Insights }) {
  const { ratings, streaks, categories } = insights
  const totalEntries = categories.good + categories.bad + categories.neutral

  return (
    <>
      <section>
        <h2>Ratings</h2>
        <div className="grid">
          <AverageCard label="All time" average={ratings.allTime} />
          <AverageCard label="Last 7 days" average={ratings.last7Days} />
          <AverageCard label="Last 30 days" average={ratings.last30Days} />
        </div>
      </section>

      <section>
        <h2>Streaks</h2>
        <div className="grid">
          <StatCard label="Current streak" value={pluralDays(streaks.current)} />
          {streaks.longest && (
            <StatCard
              label="Longest streak"
              value={pluralDays(streaks.longest.days)}
              detail={`${formatMediumDate(streaks.longest.from)} – ${formatMediumDate(streaks.longest.to)}`}
            />
          )}
        </div>
      </section>

      <section>
        <h2>Entries</h2>
        <div className="grid">
          <CategoryCard category="Good" count={categories.good} total={totalEntries} />
          <CategoryCard category="Bad" count={categories.bad} total={totalEntries} />
          <CategoryCard category="Neutral" count={categories.neutral} total={totalEntries} />
        </div>
      </section>

      <section>
        <h2>Rating trend</h2>
        <RatingTrend />
      </section>
    </>
  )
}

function AverageCard({ label, average }: { label: string; average: RatingAverage }) {
  const ratedDays = average.ratedDays === 1 ? '1 rated day' : `${average.ratedDays} rated days`
  return <StatCard label={label} value={average.average === null ? '—' : average.average.toFixed(1)} detail={ratedDays} />
}

function CategoryCard({ category, count, total }: { category: EntryCategory; count: number; total: number }) {
  return (
    <StatCard label={category} value={String(count)} detail={shareOf(count, total)} tint={categoryTint(category)} />
  )
}

interface StatCardProps {
  label: string
  value: string
  detail?: string
  /** A background color for the whole card, e.g. a category tint. */
  tint?: string
}

function StatCard({ label, value, detail, tint }: StatCardProps) {
  // Inline styles (CLAUDE.md exception): the category tints, as on entries. The header drops Pico's own
  // background so the tint covers the whole card.
  return (
    <article aria-label={label} style={tint ? { backgroundColor: tint } : undefined}>
      <header style={tint ? { backgroundColor: 'transparent' } : undefined}>{label}</header>
      <p>
        <strong>{value}</strong>
      </p>
      {detail && <small>{detail}</small>}
    </article>
  )
}

function pluralDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`
}

function shareOf(count: number, total: number): string {
  return `${total === 0 ? 0 : Math.round((count * 100) / total)}% of entries`
}

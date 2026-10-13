import type { CSSProperties } from 'react'
import { NO_ENTRY_COLOR, ratingColor, ratingTextColor, UNRATED_OUTLINE } from './heatmapColors'

const RATINGS = Array.from({ length: 11 }, (_, rating) => rating)

// Inline styles (CLAUDE.md exception): a row of colour swatches, which Pico has no primitive for.
const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '3px',
  padding: 0,
  fontSize: '0.75rem',
}

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  margin: 0,
  listStyle: 'none',
}

const swatchStyle: CSSProperties = {
  display: 'inline-block',
  minWidth: '1.5rem',
  height: '1.25rem',
  lineHeight: '1.25rem',
  borderRadius: '3px',
  textAlign: 'center',
}

/** What each heatmap colour means, so the ratings can be read without telling the colours apart. */
export default function RatingLegend() {
  return (
    <ul aria-label="Rating colours" style={listStyle}>
      {RATINGS.map((rating) => (
        <li key={rating} style={itemStyle}>
          <span style={{ ...swatchStyle, backgroundColor: ratingColor(rating), color: ratingTextColor(rating) }}>
            {rating}
          </span>
        </li>
      ))}
      <li style={{ ...itemStyle, marginLeft: '0.5rem' }}>
        <span style={{ ...swatchStyle, backgroundColor: NO_ENTRY_COLOR, ...UNRATED_OUTLINE }} />
        Unrated
      </li>
      <li style={itemStyle}>
        <span style={{ ...swatchStyle, backgroundColor: NO_ENTRY_COLOR }} />
        No entry
      </li>
    </ul>
  )
}

import { describe, expect, it } from 'vitest'
import { ENTRY_CATEGORIES } from '../api/types'
import { categorySectionTint, categoryTint } from './categoryColors'

describe('categoryTint', () => {
  it('gives each category its own tint', () => {
    const tints = ENTRY_CATEGORIES.map(categoryTint)

    expect(new Set(tints).size).toBe(ENTRY_CATEGORIES.length)
  })
})

describe('categorySectionTint', () => {
  it('is a fainter wash of the same colour as the card tint', () => {
    expect(categorySectionTint('Good')).toBe('rgba(34, 197, 94, 0.075)')
    expect(categorySectionTint('Neutral')).toBe('rgba(210, 180, 140, 0.125)')
  })
})

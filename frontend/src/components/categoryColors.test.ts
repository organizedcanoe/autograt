import { describe, expect, it } from 'vitest'
import { ENTRY_CATEGORIES } from '../api/types'
import { categoryTint } from './categoryColors'

describe('categoryTint', () => {
  it('gives each category its own tint', () => {
    const tints = ENTRY_CATEGORIES.map(categoryTint)

    expect(new Set(tints).size).toBe(ENTRY_CATEGORIES.length)
  })
})

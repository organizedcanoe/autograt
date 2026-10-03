import { describe, expect, it } from 'vitest'
import { rollingAverage } from './rollingAverage'

describe('rollingAverage', () => {
  it('averages the rated values in each window ending on that position', () => {
    expect(rollingAverage([2, 4, 6, 8], 2)).toEqual([2, 3, 5, 7])
  })

  it('ignores unrated values instead of counting them as 0', () => {
    expect(rollingAverage([4, null, 8], 3)).toEqual([4, 4, 6])
  })

  it('is null where the window has no rated values', () => {
    expect(rollingAverage([5, null, null, null], 2)).toEqual([5, 5, null, null])
  })

  it('uses a 7-day window by default', () => {
    const ratings = [7, null, null, null, null, null, null, 1]
    expect(rollingAverage(ratings)).toEqual([7, 7, 7, 7, 7, 7, 7, 1])
  })
})

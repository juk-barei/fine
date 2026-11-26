import { describe, expect, it } from 'vitest'
import type { SupportedLanguage } from '@/i18n'
import {
  bandBadge,
  bandBar,
  bandLabel,
  confidenceLabel,
  decisionLabel,
  directionLabel,
  formatListedDate,
  formatUtcTimestamp,
  formatUsdt,
  intermediaryLabel,
  NEUTRAL_BAND,
  notAvailableLabel,
  tierLabel,
} from '@/components/organisms/wallets/vocabulary'
import {
  decisionStatusSchema,
  intermediaryClassSchema,
  labelTierSchema,
  traceEdgeDirectionSchema,
  walletBandSchema,
  walletConfidenceSchema,
} from '@repo/contracts'

const languages: SupportedLanguage[] = ['en', 'km']

describe('wallet vocabulary', () => {
  it('gives every band a word in every supported language', () => {
    for (const band of walletBandSchema.options) {
      for (const language of languages) {
        expect(bandLabel(band, language)).not.toBe('')
      }
    }
    expect(bandLabel('high', 'en')).toBe('High')
    expect(bandLabel('moderate', 'en')).toBe('Moderate')
    expect(bandLabel('low', 'en')).toBe('Low')
  })

  it('gives every label tier a word in every supported language', () => {
    for (const tier of labelTierSchema.options) {
      for (const language of languages) {
        expect(tierLabel(tier, language)).not.toBe('')
      }
    }
    expect(tierLabel('tier_1', 'en')).toBe('Tier 1')
    expect(tierLabel('tier_2', 'en')).toBe('Tier 2')
    expect(tierLabel('tier_3', 'en')).toBe('Tier 3')
  })

  it('gives every confidence a word in every supported language', () => {
    for (const confidence of walletConfidenceSchema.options) {
      for (const language of languages) {
        expect(confidenceLabel(confidence, language)).not.toBe('')
      }
    }
    expect(confidenceLabel('high', 'en')).toBe('High')
    expect(confidenceLabel('medium', 'en')).toBe('Medium')
    expect(confidenceLabel('low', 'en')).toBe('Low')
  })

  it('gives every decision a word in every supported language', () => {
    for (const status of decisionStatusSchema.options) {
      for (const language of languages) {
        expect(decisionLabel(status, language)).not.toBe('')
      }
    }
    expect(decisionLabel('open', 'en')).toBe('Open')
    expect(decisionLabel('flagged', 'en')).toBe('Flagged')
    expect(decisionLabel('cleared', 'en')).toBe('Cleared')
  })

  it('gives every intermediary class a word in every supported language', () => {
    for (const intermediary of intermediaryClassSchema.options) {
      for (const language of languages) {
        expect(intermediaryLabel(intermediary, language)).not.toBe('')
      }
    }
    expect(intermediaryLabel('pass_through', 'en')).toBe('Pass-through')
    expect(intermediaryLabel('peel_chain', 'en')).toBe('Peel chain')
    expect(intermediaryLabel('consolidation', 'en')).toBe('Consolidation')
  })

  it('gives every direction a word in every supported language', () => {
    for (const direction of traceEdgeDirectionSchema.options) {
      for (const language of languages) {
        expect(directionLabel(direction, language)).not.toBe('')
      }
    }
    expect(directionLabel('inbound', 'en')).toBe('Inbound')
    expect(directionLabel('outbound', 'en')).toBe('Outbound')
  })

  it('marks missing values with the dictionary marker, never a band', () => {
    for (const language of languages) {
      expect(notAvailableLabel(language)).toBe('—')
    }
  })

  it('formats USDT amounts with grouping', () => {
    expect(formatUsdt(0)).toBe('0 USDT')
    expect(formatUsdt(10250)).toBe('10,250 USDT')
  })

  it('formats an ISO timestamp as its own UTC text', () => {
    expect(formatUtcTimestamp('2026-09-09T12:34:56.000Z')).toBe(
      '2026-09-09 12:34:56 UTC',
    )
  })

  it('formats a listed date as its ISO day', () => {
    expect(formatListedDate('2026-09-09T12:34:56.000Z')).toBe('2026-09-09')
  })

  it('styles every band chip and bar', () => {
    for (const band of walletBandSchema.options) {
      expect(bandBadge[band]).not.toBe('')
      expect(bandBar[band]).not.toBe('')
    }
    expect(bandBadge.high).toContain('text-destructive')
    expect(NEUTRAL_BAND).not.toBe('')
  })
})

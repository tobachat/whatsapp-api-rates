export const CATEGORIES = ['marketing', 'utility', 'authentication', 'authentication_international', 'service'] as const
export type Category = (typeof CATEGORIES)[number]

export interface MarketRates {
  market: string
  type: 'country' | 'region' | 'other'
  marketing: number | null
  utility: number | null
  authentication: number | null
  authentication_international: number | null
  service: number | null
}

export interface Country {
  iso2: string
  country: string
  market: string
  calling_code: string
}

export interface RateChange {
  currency: string
  market: string
  category: string
  old: number | null
  new: number | null
}

export interface Version {
  effective_date: string
  previous: string | null
  notes: string[]
  /** null for the first card in the dataset (nothing to compare with). */
  changes: RateChange[] | null
}

export interface Dataset {
  effective_date: string
  checked_on: string
  source: string
  license: string
  attribution: string
  free_service: { per_number_per_month: number; since: string }
  currencies: Record<string, MarketRates[]>
  countries: Country[]
  versions: Version[]
  earlier_quarters: { effective_date: string; updated_rates_stated_by_meta: number }[]
}

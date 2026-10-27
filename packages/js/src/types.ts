export type Category = 'marketing' | 'utility' | 'authentication' | 'service'

export interface Market {
  market: string
  type: 'country' | 'region' | 'other'
  iso_codes: string[]
  calling_code: string | null
  marketing: number
  utility: number
  authentication: number
  authentication_international: number | null
  service: number
}

export interface RateData {
  currency: string
  effective_date: string
  checked_on: string
  source: string
  free_service_per_number: number
  license: string
  markets: Market[]
}

export interface Rate {
  market: string
  matched_by: 'country' | 'region' | 'other'
  category: Category
  rate: number
  currency: string
  effective_date: string
  source: string
}

export interface CostInput {
  country: string
  marketing?: number
  utility?: number
  authentication?: number
  service?: number
  /** Business phone numbers; each gets its own free service allowance. Default 1. */
  phoneNumbers?: number
}

export interface CostEstimate {
  market: string
  currency: string
  lines: Record<Category, { messages: number; billable: number; rate: number; cost: number }>
  total: number
  free_service_messages: number
  effective_date: string
  source: string
}

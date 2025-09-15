export const FREE_TIER_LIMITS = {
  MAX_MESSAGES: 25,
  MAX_ICPS: 1,
  MAX_KNOWLEDGE_ENTRIES: 1,
  MAX_PROSPECTS: 50,
} as const

export const UPGRADE_URL = import.meta.env.VITE_UPGRADE_URL || 'https://app.coldai.uk'

export const MESSAGE_TYPES = [
  { value: 'linkedin', label: 'LinkedIn Message' },
  { value: 'email', label: 'Email' },
  { value: 'call_script', label: 'Call Script' },
] as const

export const PROSPECT_STATUSES = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'responded', label: 'Responded', color: 'bg-green-100 text-green-800' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-100 text-purple-800' },
  { value: 'closed', label: 'Closed', color: 'bg-gray-100 text-gray-800' },
] as const

export const COMPANY_SIZES = [
  { value: '1-10', label: '1-10 employees' },
  { value: '11-50', label: '11-50 employees' },
  { value: '51-200', label: '51-200 employees' },
  { value: '201-500', label: '201-500 employees' },
  { value: '500+', label: '500+ employees' },
] as const

export const COMMUNICATION_TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'direct', label: 'Direct' },
] as const

export const COMMUNICATION_STYLES = [
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'storytelling', label: 'Storytelling' },
] as const
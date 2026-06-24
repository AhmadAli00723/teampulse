export const ENGAGEMENT_METRICS = [
  { id: 'recognition',       label: 'Recognition',                color: '#6366f1' },
  { id: 'feedback',          label: 'Feedback',                   color: '#8b5cf6' },
  { id: 'happiness',         label: 'Happiness',                  color: '#ec4899' },
  { id: 'wellness',          label: 'Wellness',                   color: '#14b8a6' },
  { id: 'personal_growth',   label: 'Personal Growth',            color: '#f59e0b' },
  { id: 'mgr_relationship',  label: 'Relationship with Manager',  color: '#3b82f6' },
  { id: 'peer_relationship', label: 'Relationship with Peers',    color: '#10b981' },
  { id: 'alignment',         label: 'Alignment',                  color: '#f97316' },
  { id: 'satisfaction',      label: 'Job Satisfaction',           color: '#84cc16' },
  { id: 'ambassadorship',    label: 'Ambassadorship',             color: '#06b6d4' },
]

export const CADENCE_OPTIONS = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly',  label: 'Every two weeks' },
  { value: 'monthly',   label: 'Monthly' },
]

export const ROLES = [
  { value: 'admin',   label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member',  label: 'Member' },
]

export const VALUE_TAGS = [
  'Teamwork', 'Innovation', 'Customer Focus', 'Integrity',
  'Excellence', 'Leadership', 'Positivity', 'Growth Mindset',
]

// Minimum responses before aggregate data is shown to managers
export const RESPONSE_THRESHOLD = 4

export interface RewardTier {
  tier: 'none' | 'bronze' | 'silver' | 'gold'
  rolls: number
  label: string
  color: string
  minScore: number
}

const TIERS: RewardTier[] = [
  { tier: 'gold',   rolls: 3, label: 'Gold',   color: 'text-amber-500',   minScore: 3000 },
  { tier: 'silver', rolls: 2, label: 'Silver', color: 'text-surface-400', minScore: 1500 },
  { tier: 'bronze', rolls: 1, label: 'Bronze', color: 'text-orange-700',  minScore: 500 },
]

const NO_REWARD: RewardTier = { tier: 'none', rolls: 0, label: 'No Reward', color: 'text-surface-400', minScore: 0 }

export function resolveReward(score: number): RewardTier {
  for (const t of TIERS) {
    if (score >= t.minScore) return t
  }
  return NO_REWARD
}

export const TIER_THRESHOLDS = TIERS.map(t => ({ ...t }))

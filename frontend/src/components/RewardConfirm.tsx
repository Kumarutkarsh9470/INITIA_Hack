import { resolveReward, TIER_THRESHOLDS, type RewardTier } from '../lib/ScoreResolver'
import { formatEther } from 'viem'

interface Props {
  score: number
  entryFee: bigint
  dngnBalance: bigint
  usePaymaster: boolean
  gasCost: bigint
  onConfirm: (tier: RewardTier) => void
  onCancel: () => void
  isPending: boolean
}

const TIER_ICONS: Record<string, string> = {
  gold: '🏆',
  silver: '🥈',
  bronze: '🥉',
  none: '💀',
}

const TIER_BG: Record<string, string> = {
  gold: 'bg-amber-50 border-amber-200',
  silver: 'bg-surface-50 border-surface-200',
  bronze: 'bg-orange-50 border-orange-200',
  none: 'bg-red-50 border-red-200',
}

export default function RewardConfirm({ score, entryFee, dngnBalance, usePaymaster, gasCost, onConfirm, onCancel, isPending }: Props) {
  const tier = resolveReward(score)
  const totalCostPerRoll = usePaymaster ? entryFee + gasCost : entryFee
  const totalCost = totalCostPerRoll * BigInt(tier.rolls)
  const canAfford = dngnBalance >= totalCost
  const icon = TIER_ICONS[tier.tier]
  const bg = TIER_BG[tier.tier]

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Result card */}
      <div className={`rounded-xl border p-6 text-center ${bg}`}>
        <p className="text-4xl mb-2">{icon}</p>
        <p className={`text-3xl font-bold ${tier.color}`}>{tier.label}</p>
        <p className="text-surface-500 text-sm mt-1">Score: {score.toLocaleString()}</p>
      </div>

      {/* Reward breakdown */}
      {tier.rolls > 0 ? (
        <div className="card p-5 space-y-3">
          <h3 className="section-title">Dungeon Reward</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-surface-500">Dungeon rolls earned</span>
              <span className="font-bold text-surface-900">{tier.rolls}×</span>
            </div>
            <div className="flex justify-between">
              <span className="text-surface-500">Cost per roll</span>
              <span className="font-medium text-surface-700">
                {parseFloat(formatEther(entryFee)).toFixed(0)} DNGN
                {usePaymaster && <span className="text-brand-500"> + {parseFloat(formatEther(gasCost)).toFixed(0)} gas</span>}
              </span>
            </div>
            <div className="border-t border-surface-100 pt-2 flex justify-between">
              <span className="text-surface-500 font-medium">Total cost</span>
              <span className="font-bold text-surface-900">
                {parseFloat(formatEther(totalCost)).toFixed(0)} DNGN
              </span>
            </div>
            {!canAfford && (
              <p className="text-xs text-red-500 mt-1">
                Insufficient DNGN (you have {parseFloat(formatEther(dngnBalance)).toFixed(1)})
              </p>
            )}
          </div>

          {/* Tier progress */}
          <div className="mt-3 pt-3 border-t border-surface-100">
            <p className="text-xs text-surface-400 mb-2">Tier thresholds</p>
            <div className="space-y-1">
              {TIER_THRESHOLDS.map(t => (
                <div key={t.tier} className="flex items-center gap-2 text-xs">
                  <span className={`w-2 h-2 rounded-full ${score >= t.minScore ? 'bg-green-500' : 'bg-surface-200'}`} />
                  <span className={score >= t.minScore ? 'text-surface-700 font-medium' : 'text-surface-400'}>
                    {t.label} — {t.minScore}+ pts — {t.rolls} roll{t.rolls > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-5 text-center">
          <p className="text-surface-500 text-sm">
            Score at least <span className="font-bold">500</span> to earn dungeon rolls.
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          disabled={isPending}
          className="flex-1 btn-secondary py-3 text-sm font-semibold disabled:opacity-50"
        >
          {tier.rolls > 0 ? 'Skip Reward' : 'Back'}
        </button>
        {tier.rolls > 0 && (
          <button
            onClick={() => onConfirm(tier)}
            disabled={isPending || !canAfford}
            className="flex-1 btn-primary py-3 text-sm font-semibold disabled:opacity-50"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Claiming…
              </span>
            ) : (
              `Claim ${tier.rolls} Roll${tier.rolls > 1 ? 's' : ''}`
            )}
          </button>
        )}
      </div>
    </div>
  )
}

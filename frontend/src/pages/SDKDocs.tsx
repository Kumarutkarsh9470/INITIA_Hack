import { Link } from 'react-router-dom'

const INTEGRATION_STEPS = [
  {
    step: '1',
    title: 'Register Your Game',
    description: 'Call GameRegistry to register your game. You receive a unique gameId, a deployed ERC-20 token, and an ERC-1155 item collection — all managed by the protocol.',
    code: `// Permissionless game registration (costs 100 PXL)
await pxlToken.approve(gameRegistry, 100e18);
const tx = await gameRegistry.registerGameWithFee(
  "MyRPG",                    // game name
  "RPG Gold",                 // token name
  "RPGG",                     // token symbol
  1_000_000e18                // initial token supply
);
// Returns: gameId, gameToken address, assetCollection address
// Caller automatically gets GAME_ROLE on both contracts`,
  },
  {
    step: '2',
    title: 'Player Onboarding',
    description: 'Players mint a profile NFT once. This creates an ERC-6551 Token Bound Account (TBA) that holds all their cross-game assets. Your game reads from it — no user database needed.',
    code: `// In your game client (Unity C# / Unreal / JS)
const profile = await playerProfile.ownerToTokenId(playerWallet);
const tba = await erc6551Registry.account(
  accountImpl, salt, chainId, playerProfile, tokenId
);

// Read player inventory
const swordCount = await assetCollection.balanceOf(tba, SWORD_ID);
const goldBalance = await gameToken.balanceOf(tba);`,
  },
  {
    step: '3',
    title: 'In-Game Actions → On-Chain State',
    description: 'When a player kills a boss, completes a quest, or harvests a crop, your game server mints items directly into their TBA. The smart contract is the inventory database.',
    code: `// Game server (authorized with GAME_ROLE)
// Player defeated the boss → mint legendary drop
await assetCollection.mintItem(
  playerTBA,      // recipient TBA
  ITEM_LEGENDARY, // itemId (ERC-1155)
  1               // amount
);

// Issue achievement badge
await achievementBadge.issueBadge(
  playerTBA,
  BADGE_BOSS_SLAYER
);`,
  },
  {
    step: '4',
    title: 'Real-Time Sync via Events',
    description: 'Your game engine subscribes to Transfer events. When tokens move (trade, gas payment, marketplace sale), your game UI updates instantly — no polling required.',
    code: `// Unity (Nethereum) / JS (viem) event listener
assetCollection.on("TransferSingle", (operator, from, to, id, amount) => {
  if (from === playerTBA) {
    // Item left player inventory
    gameUI.removeItem(id, amount);
  }
  if (to === playerTBA) {
    // Item arrived in player inventory
    gameUI.addItem(id, amount);
  }
});

// Works for: marketplace trades, gas payments,
// cross-game item transfers, dungeon drops`,
  },
  {
    step: '5',
    title: 'Cross-Game Economy',
    description: 'Players can trade items from your game on the shared marketplace, swap your game token for other game tokens on the DEX, and use items across any registered game.',
    code: `// Player lists your game's item on the shared marketplace
await marketplace.listItem(
  assetCollection, // your game's ERC-1155
  ITEM_RARE_SWORD, // itemId
  1,               // amount
  50e18,           // price in PXL
  gameId           // your registered gameId
);

// Another player from a different game buys it
// → PXL transfers, item moves to buyer's TBA
// → Both games see the state change via events`,
  },
]

const ARCHITECTURE_LAYERS = [
  { name: 'Game Engine', desc: 'Unity / Unreal / Web', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { name: 'PixelVault SDK', desc: 'Read state, write actions, listen events', color: 'bg-brand-50 border-brand-200 text-brand-700' },
  { name: 'Smart Contracts', desc: 'Source of truth + IBC bridge + ERC20Registry', color: 'bg-surface-100 border-surface-300 text-surface-700' },
  { name: 'Initia MiniEVM', desc: 'Cosmos precompiles + IBC channels to L1', color: 'bg-amber-50 border-amber-200 text-amber-700' },
]



export default function HowItWorks() {
  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="badge bg-brand-50 text-brand-700 border border-brand-200">Platform Architecture</span>
        </div>
        <h1 className="page-title text-3xl">How It Works</h1>
        <p className="text-surface-500 mt-2 leading-relaxed max-w-2xl">
          PixelVault is <strong className="text-surface-700">on-chain game economy infrastructure</strong>. 
          Any game engine — Unity, Unreal, web-based — plugs into the shared protocol. 
          The demo games you see in this app are simulation interfaces; in production, 
          these same smart contract calls run beneath real 3D games.
        </p>
      </div>

      {/* Architecture */}
      <div className="card p-6">
        <h2 className="section-title mb-4">Architecture Stack</h2>
        <div className="space-y-2">
          {ARCHITECTURE_LAYERS.map((layer, i) => (
            <div key={layer.name} className="flex items-center gap-3">
              <div className={`flex-1 rounded-xl border px-5 py-3.5 ${layer.color}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{layer.name}</p>
                    <p className="text-xs opacity-75 mt-0.5">{layer.desc}</p>
                  </div>
                </div>
              </div>
              {i < ARCHITECTURE_LAYERS.length - 1 && (
                <svg className="w-4 h-4 text-surface-300 rotate-90 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Integration Guide */}
      <div>
        <h2 className="page-title text-xl mb-4">Integration Guide</h2>
        <div className="space-y-4">
          {INTEGRATION_STEPS.map((step) => (
            <div key={step.step} className="card p-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-surface-900 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
                  {step.step}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-900 text-lg">{step.title}</h3>
                  <p className="text-surface-500 text-sm mt-1 leading-relaxed">{step.description}</p>
                  <pre className="mt-3 bg-surface-900 text-surface-100 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">
                    <code>{step.code}</code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Data Flow */}
      <div className="card p-6 border-l-4 border-l-amber-400 bg-amber-50/30">
        <p className="text-sm font-semibold text-surface-900 mb-1">Why not just a DEX with renamed tokens?</p>
        <p className="text-sm text-surface-600 leading-relaxed">
          The DEX and tokens are <em>components</em> of the infrastructure, not the product itself. 
          The product is the full pipeline: <strong>player identity → game registration → item ownership → cross-game trading → gas abstraction → achievement tracking</strong>. 
          No single game needs to build any of this — they call the SDK and get a complete economy out of the box. 
          The demo games (Dungeon Drops, Harvest Field, Cosmic Racer) prove that every primitive works end-to-end. 
          In production, the &quot;Enter Dungeon&quot; button becomes a Unity combat scene, but the on-chain operation is identical.
        </p>
      </div>

      {/* CTA */}
      <div className="card p-6 text-center">
        <p className="text-surface-500 text-sm mb-3">Try the live demo games that use these exact contract calls</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/dungeon" className="btn-primary text-sm py-2.5 px-6">Dungeon Drops</Link>
          <Link to="/harvest" className="btn-primary text-sm py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700">Harvest Field</Link>
          <Link to="/games" className="btn-primary text-sm py-2.5 px-6 bg-orange-600 hover:bg-orange-700">All Games →</Link>
        </div>
      </div>
    </div>
  )
}

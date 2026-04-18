import { useState, useEffect, useCallback, useRef } from 'react'

const LANES = 3
const GAME_DURATION = 45 // seconds — shorter, more intense
const LANE_WIDTH = 80
const GAME_WIDTH = LANES * LANE_WIDTH + (LANES - 1) * 8 // 3 lanes + gaps
const GAME_HEIGHT = 400
const PLAYER_SIZE = 36
const OBS_WIDTH = 50
const OBS_HEIGHT = 24
const BASE_SPEED = 2.5
const SPEED_INCREMENT = 0.15 // increases every 5 seconds
const SPAWN_INTERVAL_BASE = 900 // ms
const SPAWN_INTERVAL_MIN = 350 // ms

interface Obstacle {
  id: number
  lane: number
  y: number
  color: string
}

const OBSTACLE_COLORS = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4']
const LANE_COLORS = ['#f0f9ff', '#f0fdf4', '#fefce8']

interface Props {
  onComplete: (score: number) => void
  onCancel: () => void
}

export default function RacerGame({ onComplete, onCancel }: Props) {
  const [lane, setLane] = useState(1) // 0,1,2 — start in middle
  const [obstacles, setObstacles] = useState<Obstacle[]>([])
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [gameOver, setGameOver] = useState(false)
  const [hits, setHits] = useState(0)
  const [dodged, setDodged] = useState(0)
  const [speed, setSpeed] = useState(BASE_SPEED)
  const [flash, setFlash] = useState<number | null>(null) // lane that got hit

  const frameRef = useRef<number>()
  const obstacleIdRef = useRef(0)
  const lastSpawnRef = useRef(0)
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({ lane: 1, obstacles: [] as Obstacle[], gameOver: false, score: 0, speed: BASE_SPEED, hits: 0, dodged: 0 })

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current.lane = lane
  }, [lane])
  useEffect(() => {
    stateRef.current.gameOver = gameOver
  }, [gameOver])
  useEffect(() => {
    stateRef.current.speed = speed
  }, [speed])

  // Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          setGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Speed up over time
  useEffect(() => {
    const interval = setInterval(() => {
      if (!gameOver) {
        setSpeed(prev => prev + SPEED_INCREMENT)
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [gameOver])

  // Game loop
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (stateRef.current.gameOver) return

      const st = stateRef.current
      const spd = st.speed

      // Spawn obstacles
      const spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - (spd - BASE_SPEED) * 80)
      if (timestamp - lastSpawnRef.current > spawnInterval) {
        lastSpawnRef.current = timestamp
        const obsLane = Math.floor(Math.random() * LANES)
        const newObs: Obstacle = {
          id: obstacleIdRef.current++,
          lane: obsLane,
          y: -OBS_HEIGHT,
          color: OBSTACLE_COLORS[Math.floor(Math.random() * OBSTACLE_COLORS.length)],
        }
        st.obstacles = [...st.obstacles, newObs]
      }

      // Move obstacles down
      const playerY = GAME_HEIGHT - PLAYER_SIZE - 20
      const alive: Obstacle[] = []
      let newDodged = 0
      let newHits = 0
      let hitLane: number | null = null

      for (const obs of st.obstacles) {
        const newY = obs.y + spd
        if (newY > GAME_HEIGHT) {
          // Passed the bottom
          if (obs.lane !== st.lane) {
            newDodged++
          }
          continue // remove
        }

        // Collision detection
        const obsTop = newY
        const obsBottom = newY + OBS_HEIGHT
        const playerTop = playerY
        const playerBottom = playerY + PLAYER_SIZE

        if (
          obs.lane === st.lane &&
          obsBottom >= playerTop &&
          obsTop <= playerBottom
        ) {
          // Hit!
          newHits++
          hitLane = obs.lane
          continue // remove obstacle
        }

        alive.push({ ...obs, y: newY })
      }

      st.obstacles = alive

      // Score: distance-based + dodge bonus
      st.score += Math.round(spd * 0.5)
      st.dodged += newDodged
      st.hits += newHits
      st.score += newDodged * 50 // bonus per dodge
      st.score = Math.max(0, st.score - newHits * 100) // penalty per hit

      setObstacles([...st.obstacles])
      setScore(st.score)
      setDodged(st.dodged)
      setHits(st.hits)

      if (hitLane !== null) {
        setFlash(hitLane)
        setTimeout(() => setFlash(null), 200)
      }

      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameOver) return
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        setLane(prev => Math.max(0, prev - 1))
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        setLane(prev => Math.min(LANES - 1, prev + 1))
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [gameOver])

  // Touch controls
  const touchStartX = useRef(0)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (gameOver) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 30) {
      if (dx < 0) setLane(prev => Math.max(0, prev - 1))
      else setLane(prev => Math.min(LANES - 1, prev + 1))
    }
  }, [gameOver])

  // Lane tap controls (mobile)
  const handleLaneTap = useCallback((laneIdx: number) => {
    if (!gameOver) setLane(laneIdx)
  }, [gameOver])

  // Game over
  useEffect(() => {
    if (gameOver) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      onComplete(score)
    }
  }, [gameOver, score, onComplete])

  const pctTime = (timeLeft / GAME_DURATION) * 100
  const tierLabel = score >= 3000 ? 'Gold' : score >= 1500 ? 'Silver' : score >= 500 ? 'Bronze' : '—'
  const tierColor = score >= 3000 ? 'text-amber-500' : score >= 1500 ? 'text-surface-400' : score >= 500 ? 'text-orange-700' : 'text-surface-300'

  const laneX = (laneIdx: number) => laneIdx * (LANE_WIDTH + 8)
  const playerX = laneX(lane) + (LANE_WIDTH - PLAYER_SIZE) / 2

  return (
    <div className="space-y-4">
      {/* Score bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-surface-400 uppercase tracking-wider">Distance</p>
            <p className="text-2xl font-bold text-surface-900">{score}</p>
          </div>
          {dodged > 0 && (
            <span className="text-xs font-bold text-green-500">
              {dodged} dodged
            </span>
          )}
          {hits > 0 && (
            <span className="text-xs font-bold text-red-500">
              {hits} hits
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-400 uppercase tracking-wider">Tier</p>
          <p className={`text-lg font-bold ${tierColor}`}>{tierLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-surface-400 uppercase tracking-wider">Time</p>
          <p className={`text-2xl font-bold font-mono ${timeLeft <= 10 ? 'text-red-500' : 'text-surface-900'}`}>
            {timeLeft}s
          </p>
        </div>
      </div>

      {/* Timer bar */}
      <div className="w-full bg-surface-100 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-1000 ease-linear"
          style={{
            width: `${pctTime}%`,
            backgroundColor: timeLeft <= 10 ? '#ef4444' : timeLeft <= 20 ? '#f59e0b' : '#22c55e',
          }}
        />
      </div>

      {/* Game area */}
      <div
        ref={gameAreaRef}
        className="relative mx-auto rounded-xl overflow-hidden border-2 border-surface-200 select-none"
        style={{ width: GAME_WIDTH, height: GAME_HEIGHT, background: '#1a1a2e' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Road markings / lanes */}
        {Array.from({ length: LANES }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 cursor-pointer"
            style={{
              left: laneX(i),
              width: LANE_WIDTH,
              background: flash === i
                ? 'rgba(239,68,68,0.3)'
                : `rgba(255,255,255,0.03)`,
              borderLeft: i > 0 ? '2px dashed rgba(255,255,255,0.1)' : undefined,
              transition: 'background 0.15s',
            }}
            onClick={() => handleLaneTap(i)}
          />
        ))}

        {/* Scrolling road dashes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`dash-${i}`}
            className="absolute"
            style={{
              left: LANE_WIDTH + 2,
              width: 2,
              height: 20,
              background: 'rgba(255,255,255,0.15)',
              top: ((i * 55 + (Date.now() * speed * 0.05)) % GAME_HEIGHT) - 20,
            }}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`dash2-${i}`}
            className="absolute"
            style={{
              left: LANE_WIDTH * 2 + 10,
              width: 2,
              height: 20,
              background: 'rgba(255,255,255,0.15)',
              top: ((i * 55 + (Date.now() * speed * 0.05)) % GAME_HEIGHT) - 20,
            }}
          />
        ))}

        {/* Obstacles */}
        {obstacles.map(obs => (
          <div
            key={obs.id}
            className="absolute rounded-md shadow-lg"
            style={{
              left: laneX(obs.lane) + (LANE_WIDTH - OBS_WIDTH) / 2,
              top: obs.y,
              width: OBS_WIDTH,
              height: OBS_HEIGHT,
              background: obs.color,
              boxShadow: `0 0 10px ${obs.color}60`,
            }}
          >
            <div className="w-full h-full rounded-md border border-white/20" />
          </div>
        ))}

        {/* Player ship */}
        <div
          className="absolute transition-[left] duration-100 ease-out"
          style={{
            left: playerX,
            top: GAME_HEIGHT - PLAYER_SIZE - 20,
            width: PLAYER_SIZE,
            height: PLAYER_SIZE,
          }}
        >
          {/* Ship shape */}
          <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 2L6 30H12L18 24L24 30H30L18 2Z" fill="#60a5fa" stroke="#93c5fd" strokeWidth="1" />
            <path d="M18 8L12 26H24L18 8Z" fill="#3b82f6" />
            <circle cx="18" cy="18" r="3" fill="#bfdbfe" />
            {/* Engine glow */}
            <ellipse cx="14" cy="31" rx="2" ry="3" fill="#f97316" opacity="0.8" />
            <ellipse cx="22" cy="31" rx="2" ry="3" fill="#f97316" opacity="0.8" />
          </svg>
        </div>

        {/* Speed indicator */}
        <div className="absolute top-2 right-2 text-xs font-mono text-white/40">
          SPD {speed.toFixed(1)}x
        </div>
      </div>

      {/* Controls hint */}
      <div className="text-center text-xs text-surface-400 space-y-1">
        <p>⬅️ ➡️ Arrow keys or A/D to dodge  •  Tap lanes on mobile</p>
        <button
          onClick={onCancel}
          className="text-surface-400 hover:text-surface-600 underline text-xs"
        >
          Quit Race
        </button>
      </div>
    </div>
  )
}

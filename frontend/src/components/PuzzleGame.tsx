import { useState, useEffect, useCallback, useRef } from 'react'

const GRID = 6
const CELL = 48
const GAP = 4
const BOARD_PX = GRID * (CELL + GAP) - GAP
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'] as const
const GAME_DURATION = 60 // seconds
const MATCH_SCORE = 30
const COMBO_BONUS = 20

type Gem = { color: number; id: number; popping?: boolean }

function createBoard(): Gem[][] {
  let id = 0
  const board: Gem[][] = []
  for (let r = 0; r < GRID; r++) {
    const row: Gem[] = []
    for (let c = 0; c < GRID; c++) {
      let color: number
      do {
        color = Math.floor(Math.random() * COLORS.length)
      } while (
        (c >= 2 && row[c - 1].color === color && row[c - 2].color === color) ||
        (r >= 2 && board[r - 1][c].color === color && board[r - 2][c].color === color)
      )
      row.push({ color, id: id++ })
    }
    board.push(row)
  }
  return board
}

function deepCopy(board: Gem[][]): Gem[][] {
  return board.map(row => row.map(g => ({ ...g })))
}

function findMatches(board: Gem[][]): Set<string> {
  const matched = new Set<string>()
  // horizontal
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c <= GRID - 3; c++) {
      const col = board[r][c].color
      if (col === board[r][c + 1].color && col === board[r][c + 2].color) {
        let end = c + 2
        while (end + 1 < GRID && board[r][end + 1].color === col) end++
        for (let i = c; i <= end; i++) matched.add(`${r},${i}`)
      }
    }
  }
  // vertical
  for (let c = 0; c < GRID; c++) {
    for (let r = 0; r <= GRID - 3; r++) {
      const col = board[r][c].color
      if (col === board[r + 1][c].color && col === board[r + 2][c].color) {
        let end = r + 2
        while (end + 1 < GRID && board[end + 1][c].color === col) end++
        for (let i = r; i <= end; i++) matched.add(`${i},${c}`)
      }
    }
  }
  return matched
}

let nextId = 10000

function removeAndFill(board: Gem[][]): Gem[][] {
  const b = deepCopy(board)
  const matches = findMatches(b)
  if (matches.size === 0) return b
  // Remove matched
  for (const key of matches) {
    const [r, c] = key.split(',').map(Number)
    b[r][c] = null as any
  }
  // Gravity: shift down
  for (let c = 0; c < GRID; c++) {
    let writeRow = GRID - 1
    for (let r = GRID - 1; r >= 0; r--) {
      if (b[r][c] !== null) {
        b[writeRow][c] = b[r][c]
        if (writeRow !== r) b[r][c] = null as any
        writeRow--
      }
    }
    // Fill top with new gems
    for (let r = writeRow; r >= 0; r--) {
      b[r][c] = { color: Math.floor(Math.random() * COLORS.length), id: nextId++ }
    }
  }
  return b
}

function hasValidMove(board: Gem[][]): boolean {
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      // Try swap right
      if (c + 1 < GRID) {
        const b = deepCopy(board)
        ;[b[r][c], b[r][c + 1]] = [b[r][c + 1], b[r][c]]
        if (findMatches(b).size > 0) return true
      }
      // Try swap down
      if (r + 1 < GRID) {
        const b = deepCopy(board)
        ;[b[r][c], b[r + 1][c]] = [b[r + 1][c], b[r][c]]
        if (findMatches(b).size > 0) return true
      }
    }
  }
  return false
}

interface Props {
  onComplete: (score: number) => void
  onCancel: () => void
}

export default function PuzzleGame({ onComplete, onCancel }: Props) {
  const [board, setBoard] = useState<Gem[][]>(createBoard)
  const [selected, setSelected] = useState<[number, number] | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION)
  const [combo, setCombo] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const [popping, setPopping] = useState<Set<string>>(new Set())
  const processing = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval>>()

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setGameOver(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  // Ensure board always has valid moves
  useEffect(() => {
    if (!gameOver && !processing.current && !hasValidMove(board)) {
      setBoard(createBoard())
    }
  }, [board, gameOver])

  const processBoard = useCallback(async (b: Gem[][]) => {
    processing.current = true
    let currentBoard = b
    let chainCombo = 0

    while (true) {
      const matches = findMatches(currentBoard)
      if (matches.size === 0) break
      chainCombo++

      // Show popping animation
      setPopping(matches)
      await new Promise(res => setTimeout(res, 200))

      const earned = matches.size * MATCH_SCORE + (chainCombo > 1 ? COMBO_BONUS * chainCombo : 0)
      setScore(prev => prev + earned)
      setCombo(chainCombo)

      currentBoard = removeAndFill(currentBoard)
      setBoard(currentBoard)
      setPopping(new Set())
      await new Promise(res => setTimeout(res, 150))
    }

    if (chainCombo === 0) setCombo(0)
    processing.current = false
  }, [])

  const handleCellClick = useCallback((r: number, c: number) => {
    if (gameOver || processing.current) return

    if (!selected) {
      setSelected([r, c])
      return
    }

    const [sr, sc] = selected
    const isAdjacent = (Math.abs(sr - r) + Math.abs(sc - c)) === 1

    if (!isAdjacent) {
      setSelected([r, c])
      return
    }

    // Swap
    const newBoard = deepCopy(board)
    ;[newBoard[sr][sc], newBoard[r][c]] = [newBoard[r][c], newBoard[sr][sc]]

    if (findMatches(newBoard).size === 0) {
      // Invalid swap — revert, keep selection cleared
      setSelected(null)
      return
    }

    setBoard(newBoard)
    setSelected(null)
    processBoard(newBoard)
  }, [board, selected, gameOver, processBoard])

  // Game over
  useEffect(() => {
    if (gameOver) {
      onComplete(score)
    }
  }, [gameOver, score, onComplete])

  const pctTime = (timeLeft / GAME_DURATION) * 100
  const tierLabel = score >= 3000 ? 'Gold' : score >= 1500 ? 'Silver' : score >= 500 ? 'Bronze' : '—'
  const tierColor = score >= 3000 ? 'text-amber-500' : score >= 1500 ? 'text-surface-400' : score >= 500 ? 'text-orange-700' : 'text-surface-300'

  return (
    <div className="space-y-4">
      {/* Score bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-xs text-surface-400 uppercase tracking-wider">Score</p>
            <p className="text-2xl font-bold text-surface-900">{score}</p>
          </div>
          {combo > 1 && (
            <span className="text-sm font-bold text-amber-500 animate-bounce">
              {combo}x combo!
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
          className={`h-2 rounded-full transition-all duration-1000 ${timeLeft <= 10 ? 'bg-red-500' : 'bg-brand-500'}`}
          style={{ width: `${pctTime}%` }}
        />
      </div>

      {/* Tier thresholds */}
      <div className="flex justify-between text-xs text-surface-400">
        <span>500 Bronze</span>
        <span>1500 Silver</span>
        <span>3000 Gold</span>
      </div>

      {/* Board */}
      <div className="flex justify-center">
        <div
          className="relative bg-surface-100 rounded-xl p-2"
          style={{ width: BOARD_PX + 16, height: BOARD_PX + 16 }}
        >
          {board.map((row, r) =>
            row.map((gem, c) => {
              const isSelected = selected?.[0] === r && selected?.[1] === c
              const isPopping = popping.has(`${r},${c}`)
              return (
                <button
                  key={gem.id}
                  onClick={() => handleCellClick(r, c)}
                  disabled={gameOver}
                  className="absolute rounded-lg transition-all duration-150 focus:outline-none"
                  style={{
                    width: CELL,
                    height: CELL,
                    left: c * (CELL + GAP) + 8,
                    top: r * (CELL + GAP) + 8,
                    backgroundColor: COLORS[gem.color],
                    transform: isPopping ? 'scale(0)' : isSelected ? 'scale(1.15)' : 'scale(1)',
                    opacity: isPopping ? 0 : 1,
                    boxShadow: isSelected
                      ? '0 0 0 3px #fff, 0 0 0 5px #212529'
                      : '0 2px 4px rgba(0,0,0,0.15)',
                    cursor: gameOver ? 'default' : 'pointer',
                  }}
                >
                  <span className="text-white/90 text-lg font-bold select-none">
                    {gem.color === 0 ? '♦' : gem.color === 1 ? '●' : gem.color === 2 ? '▲' : gem.color === 3 ? '★' : '◆'}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Instructions or cancel */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-surface-400">
          Swap adjacent gems to match 3+ in a row or column
        </p>
        <button
          onClick={onCancel}
          className="text-xs text-surface-400 hover:text-surface-600 underline"
        >
          Quit game
        </button>
      </div>
    </div>
  )
}

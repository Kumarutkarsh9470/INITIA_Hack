import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ProfileGate } from './components/ProfileGate'
import Layout from './components/Layout'

// Eager-load the landing + create-profile (first screens users see)
import Landing from './pages/Landing'
import CreateProfile from './pages/CreateProfile'

// Lazy-load everything else — splits into separate chunks
const ProfileDashboard = lazy(() => import('./pages/ProfileDashboard'))
const DungeonDrops = lazy(() => import('./pages/DungeonDrops'))
const HarvestField = lazy(() => import('./pages/HarvestField'))
const DEX = lazy(() => import('./pages/DEX'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const GasSettings = lazy(() => import('./pages/GasSettings'))
const GameHub = lazy(() => import('./pages/GameHub'))
const HowItWorks = lazy(() => import('./pages/SDKDocs'))
const Bridge = lazy(() => import('./pages/Bridge'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-surface-300 border-t-surface-900 rounded-full animate-spin" />
        <p className="text-sm text-surface-500">Loading...</p>
      </div>
    </div>
  )
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <Layout>{children}</Layout>
    </ProfileGate>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create-profile" element={<CreateProfile />} />
        <Route path="/profile" element={<ProtectedPage><ProfileDashboard /></ProtectedPage>} />
        <Route path="/dungeon" element={<ProtectedPage><DungeonDrops /></ProtectedPage>} />
        <Route path="/harvest" element={<ProtectedPage><HarvestField /></ProtectedPage>} />
        <Route path="/dex" element={<ProtectedPage><DEX /></ProtectedPage>} />
        <Route path="/bridge" element={<ProtectedPage><Bridge /></ProtectedPage>} />
        <Route path="/marketplace" element={<ProtectedPage><Marketplace /></ProtectedPage>} />
        <Route path="/gas" element={<ProtectedPage><GasSettings /></ProtectedPage>} />
        <Route path="/games" element={<ProtectedPage><GameHub /></ProtectedPage>} />
        <Route path="/how-it-works" element={<ProtectedPage><HowItWorks /></ProtectedPage>} />
        <Route path="/sdk" element={<Navigate to="/how-it-works" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

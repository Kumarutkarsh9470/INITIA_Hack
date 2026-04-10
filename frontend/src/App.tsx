import { Routes, Route, Navigate } from 'react-router-dom'
import { ProfileGate } from './components/ProfileGate'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import CreateProfile from './pages/CreateProfile'
import ProfileDashboard from './pages/ProfileDashboard'
import DungeonDrops from './pages/DungeonDrops'
import HarvestField from './pages/HarvestField'
import DEX from './pages/DEX'
import Marketplace from './pages/Marketplace'
import GasSettings from './pages/GasSettings'
import GameHub from './pages/GameHub'

function ProtectedPage({ children }: { children: React.ReactNode }) {
  return (
    <ProfileGate>
      <Layout>{children}</Layout>
    </ProfileGate>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/create-profile" element={<CreateProfile />} />
      <Route path="/profile" element={<ProtectedPage><ProfileDashboard /></ProtectedPage>} />
      <Route path="/dungeon" element={<ProtectedPage><DungeonDrops /></ProtectedPage>} />
      <Route path="/harvest" element={<ProtectedPage><HarvestField /></ProtectedPage>} />
      <Route path="/dex" element={<ProtectedPage><DEX /></ProtectedPage>} />
      <Route path="/marketplace" element={<ProtectedPage><Marketplace /></ProtectedPage>} />
      <Route path="/gas" element={<ProtectedPage><GasSettings /></ProtectedPage>} />
      <Route path="/games" element={<ProtectedPage><GameHub /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

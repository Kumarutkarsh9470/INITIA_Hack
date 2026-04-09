import { Routes, Route } from 'react-router-dom'
import { ProfileGate } from './components/ProfileGate'
import Landing from './pages/Landing'
import CreateProfile from './pages/CreateProfile'
import ProfileDashboard from './pages/ProfileDashboard'
import DungeonDrops from './pages/DungeonDrops'
import HarvestField from './pages/HarvestField'
import DEX from './pages/DEX'
import Marketplace from './pages/Marketplace'
import GasSettings from './pages/GasSettings'
import GameHub from './pages/GameHub'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/create-profile" element={<CreateProfile />} />
      <Route
        path="/profile"
        element={
          <ProfileGate>
            <ProfileDashboard />
          </ProfileGate>
        }
      />
      <Route
        path="/dungeon"
        element={
          <ProfileGate>
            <DungeonDrops />
          </ProfileGate>
        }
      />
      <Route
        path="/harvest"
        element={
          <ProfileGate>
            <HarvestField />
          </ProfileGate>
        }
      />
      <Route
        path="/dex"
        element={
          <ProfileGate>
            <DEX />
          </ProfileGate>
        }
      />
      <Route
        path="/marketplace"
        element={
          <ProfileGate>
            <Marketplace />
          </ProfileGate>
        }
      />
      <Route
        path="/gas"
        element={
          <ProfileGate>
            <GasSettings />
          </ProfileGate>
        }
      />
      <Route
        path="/games"
        element={
          <ProfileGate>
            <GameHub />
          </ProfileGate>
        }
      />
    </Routes>
  )
}

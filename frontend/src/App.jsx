import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth.js';
import { useSocket } from './hooks/useSocket.js';
import { useCampaign } from './hooks/useCampaign.js';
import AuthScreen from './components/AuthScreen.jsx';
import DeployScreen from './components/DeployScreen.jsx';
import GameMap from './components/GameMap.jsx';
import Hud from './components/Hud.jsx';
import Leaderboard from './components/Leaderboard.jsx';
import PowerBar from './components/PowerBar.jsx';
import FitnessPanel from './components/FitnessPanel.jsx';
import CommandCenter from './components/CommandCenter.jsx';

export default function App() {
  const { token, user, checkingSession, loading, error, signup, login, logout } = useAuth();
  const {
    connected,
    self,
    gridSize,
    zones,
    players,
    sectors,
    siege,
    leaderboard,
    flag,
    joinError,
    powerupError,
    radarReveal,
    workoutMinMs,
    deploy,
    move,
    activateShield,
    activateRadar,
    activateSecondWind,
    startWorkout,
    completeWorkout,
  } = useSocket(token);
  const campaign = useCampaign(token);

  const [deployed, setDeployed] = useState(false);
  const [role, setRole] = useState(null);
  const [commandOpen, setCommandOpen] = useState(false);

  const effectiveRole = role ?? user?.role ?? null;

  const handleSelectRole = useCallback(
    async (r) => {
      setRole(r);
      try {
        await campaign.setRole(r);
      } catch {
        // surfaced via campaign.error if the caller wants it; deploy still works locally
      }
    },
    [campaign]
  );

  const handleDeploy = useCallback(() => {
    setDeployed(true);
    deploy();
  }, [deploy]);

  const handleLogout = useCallback(() => {
    setDeployed(false);
    logout();
  }, [logout]);

  if (checkingSession) {
    return <div className="loading-screen">Loading…</div>;
  }

  if (!token || !user) {
    return <AuthScreen onLogin={login} onSignup={signup} loading={loading} error={error} />;
  }

  if (!deployed || !self) {
    return (
      <DeployScreen
        username={user.username}
        role={effectiveRole}
        onSelectRole={handleSelectRole}
        onDeploy={handleDeploy}
        onLogout={handleLogout}
        error={joinError}
      />
    );
  }

  // Keep XP/power-ups for "self" live by reading it back out of the players feed.
  const liveSelf = players.find((p) => p.id === self.id) || self;

  return (
    <div className="app-shell">
      <Hud
        self={liveSelf}
        connected={connected}
        flag={flag}
        onLogout={handleLogout}
        onOpenCommand={() => setCommandOpen(true)}
      />
      <div className="map-wrap">
        <GameMap
          gridSize={gridSize}
          zones={zones}
          players={players}
          self={self}
          onMove={move}
          radarReveal={radarReveal}
        />
      </div>
      <div className="side-panel">
        <PowerBar
          self={liveSelf}
          onActivateShield={activateShield}
          onActivateRadar={activateRadar}
          onActivateSecondWind={activateSecondWind}
          powerupError={powerupError}
        />
        <FitnessPanel workoutMinMs={workoutMinMs} onStart={startWorkout} onComplete={completeWorkout} />
        <Leaderboard leaderboard={leaderboard} self={liveSelf} />
      </div>

      {commandOpen && (
        <CommandCenter
          campaign={campaign}
          sectors={sectors}
          siege={siege}
          onClose={() => setCommandOpen(false)}
        />
      )}
    </div>
  );
}

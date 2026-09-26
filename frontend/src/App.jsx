import { useState, useCallback } from 'react';
import { useSocket } from './hooks/useSocket.js';
import JoinScreen from './components/JoinScreen.jsx';
import GameMap from './components/GameMap.jsx';
import Hud from './components/Hud.jsx';
import Leaderboard from './components/Leaderboard.jsx';

export default function App() {
  const { connected, self, gridSize, zones, players, leaderboard, flag, join, move } = useSocket();
  const [joined, setJoined] = useState(false);

  const handleJoin = useCallback(
    (name) => {
      join(name);
      setJoined(true);
    },
    [join]
  );

  if (!joined || !self) {
    return <JoinScreen onJoin={handleJoin} />;
  }

  // Keep XP/position for "self" live by reading it back out of the players feed.
  const liveSelf = players.find((p) => p.id === self.id) || self;

  return (
    <div className="app-shell">
      <Hud self={liveSelf} connected={connected} flag={flag} />
      <div className="map-wrap">
        <GameMap gridSize={gridSize} zones={zones} players={players} self={self} onMove={move} />
      </div>
      <Leaderboard leaderboard={leaderboard} self={liveSelf} />
    </div>
  );
}

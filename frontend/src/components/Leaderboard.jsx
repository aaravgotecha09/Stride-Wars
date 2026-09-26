const TEAM_COLORS = { red: '#E4572E', blue: '#2E86AB', gold: '#F2C14E' };

export default function Leaderboard({ leaderboard, self }) {
  const { byPlayer, byTeam } = leaderboard;

  return (
    <div className="leaderboard">
      <h2>Territory</h2>
      {Object.entries(byTeam).map(([team, count]) => (
        <div className="team-row" key={team}>
          <span className="team-swatch" style={{ background: TEAM_COLORS[team] }} />
          {team.toUpperCase()} — {count} zones
        </div>
      ))}

      <h2 style={{ marginTop: 20 }}>Leaderboard</h2>
      {byPlayer.length === 0 && <p className="join-note">No runners yet.</p>}
      {byPlayer.slice(0, 10).map((p, i) => (
        <div className={`player-row ${p.name === self.name ? 'me' : ''}`} key={i}>
          <span>
            {i + 1}. {p.name}
          </span>
          <span>{p.xp} XP</span>
        </div>
      ))}
    </div>
  );
}

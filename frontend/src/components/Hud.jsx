const TEAM_COLORS = { red: '#E4572E', blue: '#2E86AB', gold: '#F2C14E' };

export default function Hud({ self, connected, flag }) {
  return (
    <div className="hud">
      <div className="hud-title">STRIDEWARS</div>
      <div className="hud-stats">
        <span>
          <span className={`status-dot ${connected ? 'on' : 'off'}`} />
          {connected ? 'LINKED' : 'OFFLINE'}
        </span>
        <span>
          CALLSIGN <b>{self.name}</b>
        </span>
        <span style={{ color: TEAM_COLORS[self.team] }}>SQUAD {self.team.toUpperCase()}</span>
        <span>
          XP <b>{self.xp}</b>
        </span>
      </div>
      {flag && <div className="flag-toast">{flag.reason}</div>}
    </div>
  );
}

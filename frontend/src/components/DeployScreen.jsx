const ROLES = [
  { id: 'scout', label: 'Scout', blurb: 'Radar charges twice as fast, tracks the wider field.' },
  { id: 'defender', label: 'Defender', blurb: 'Shields last longer (8 min instead of 5).' },
  { id: 'sprinter', label: 'Sprinter', blurb: '+20% capture rate, Surge triggers in 2 captures.' },
];

export default function DeployScreen({ username, role, onSelectRole, onDeploy, onLogout, error }) {
  return (
    <div className="join-screen">
      <div className="join-card">
        <p className="eyebrow">Real-world territory, real steps</p>
        <h1>STRIDEWARS</h1>
        <p className="tagline">Welcome back, {username}. Pick a squad role, then hit the field.</p>

        <div className="role-picker">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              className={`role-btn ${role === r.id ? 'active' : ''}`}
              onClick={() => onSelectRole(r.id)}
            >
              <strong>{r.label}</strong>
              <span>{r.blurb}</span>
            </button>
          ))}
        </div>

        <button type="button" className="deploy-button" onClick={onDeploy}>
          Deploy
        </button>

        {error && <p className="auth-error">{error}</p>}

        <p className="join-note">
          Simulated GPS — once you're in, click any cell on the map to walk there.
        </p>

        <button type="button" className="link-button" onClick={onLogout}>
          Sign out
        </button>
      </div>
    </div>
  );
}

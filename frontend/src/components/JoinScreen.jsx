export default function JoinScreen({ onJoin }) {
  function handleSubmit(e) {
    e.preventDefault();
    const name = new FormData(e.target).get('name');
    onJoin(name?.toString().trim() || 'Runner');
  }

  return (
    <div className="join-screen">
      <div className="join-card">
        <p className="eyebrow">Real-world territory, real steps</p>
        <h1>STRIDEWARS</h1>
        <p className="tagline">
          Move to capture zones. Hold your ground. Outlast the other squads.
        </p>
        <form onSubmit={handleSubmit}>
          <input name="name" placeholder="Callsign" maxLength={16} autoFocus />
          <button type="submit">Deploy</button>
        </form>
        <p className="join-note">
          Simulated GPS — once you're in, click any cell on the map to walk there.
        </p>
      </div>
    </div>
  );
}

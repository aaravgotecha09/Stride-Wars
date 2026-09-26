export default function PowerBar({ self, onActivateShield, onActivateRadar, onActivateSecondWind, powerupError }) {
  const surgeActive = self.surgeUntil && self.surgeUntil > Date.now();

  return (
    <div className="power-bar">
      <h2>Power-Ups</h2>
      <div className="power-buttons">
        <button type="button" className="power-btn" onClick={onActivateShield} disabled={!self.shieldCharges}>
          🛡 Shield <span>{self.shieldCharges}</span>
        </button>
        <button type="button" className="power-btn" onClick={onActivateRadar} disabled={!self.radarCharges}>
          📡 Radar <span>{self.radarCharges}</span>
        </button>
        <button
          type="button"
          className="power-btn"
          onClick={onActivateSecondWind}
          disabled={!self.secondWindCharges}
        >
          ⟳ 2nd Wind <span>{self.secondWindCharges}</span>
        </button>
      </div>
      {surgeActive && <p className="surge-indicator">⚡ SURGE ACTIVE — capturing 3×3 around you</p>}
      {powerupError && <p className="powerup-error">{powerupError}</p>}
    </div>
  );
}

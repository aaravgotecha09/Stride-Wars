import { useState } from 'react';

const TEAM_COLORS = { red: '#E4572E', blue: '#2E86AB', gold: '#F2C14E' };
const TABS = ['siege', 'garrison', 'supply', 'scouting', 'orders'];

export default function CommandCenter({ campaign, sectors, siege, onClose }) {
  const [tab, setTab] = useState('siege');

  const [garrisonForm, setGarrisonForm] = useState({ x: '0', y: '0', amount: '10' });
  const [garrisonMsg, setGarrisonMsg] = useState(null);

  const [supplyForm, setSupplyForm] = useState({ toUsername: '', amount: '10' });
  const [supplyMsg, setSupplyMsg] = useState(null);

  const [report, setReport] = useState(null);

  const [orderForm, setOrderForm] = useState({ sectorId: '', priority: 'defend' });
  const [orderMsg, setOrderMsg] = useState(null);

  async function handleGarrison(e) {
    e.preventDefault();
    try {
      const res = await campaign.reinforceZone(
        Number(garrisonForm.x),
        Number(garrisonForm.y),
        Number(garrisonForm.amount)
      );
      setGarrisonMsg(`Reinforced to ${res.zone.meter}% — ${res.reserveSteps} reserve steps left.`);
    } catch (err) {
      setGarrisonMsg(err.message);
    }
  }

  async function handleSupply(e) {
    e.preventDefault();
    try {
      const res = await campaign.sendSupply(supplyForm.toUsername, Number(supplyForm.amount));
      setSupplyMsg(`Sent ${res.sent} XP to ${res.to}.`);
    } catch (err) {
      setSupplyMsg(err.message);
    }
  }

  async function handleReport() {
    try {
      setReport(await campaign.fetchScoutingReport());
    } catch (err) {
      setReport({ error: err.message });
    }
  }

  async function handleOrder(e) {
    e.preventDefault();
    try {
      const res = await campaign.setOrders(orderForm.sectorId || null, orderForm.priority);
      setOrderMsg(
        `Standing order: ${res.standingOrder.priority}${
          res.standingOrder.sectorId ? ` on ${res.standingOrder.sectorId}` : ''
        }.`
      );
    } catch (err) {
      setOrderMsg(err.message);
    }
  }

  const remainingHours = siege ? Math.max(0, Math.floor(siege.remainingMs / (1000 * 60 * 60))) : null;

  return (
    <div className="command-overlay">
      <div className="command-panel">
        <div className="command-header">
          <h2>Command Center</h2>
          <button type="button" className="link-button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="command-tabs">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`command-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'siege' && (
          <div className="command-body">
            <p className="join-note">
              {siege ? `Campus Siege resets in ~${remainingHours}h` : 'Loading siege status…'}
            </p>
            <div className="sector-grid">
              {sectors.map((s) => (
                <div
                  key={s.id}
                  className="sector-cell"
                  style={{
                    background: s.controllingTeam ? TEAM_COLORS[s.controllingTeam] : '#1D2B22',
                    opacity: s.secured ? 0.9 : 0.4,
                  }}
                  title={`${s.id}: ${s.controllingTeam || 'neutral'}${s.secured ? ' (secured)' : ''}`}
                >
                  {s.id}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'garrison' && (
          <form className="command-body" onSubmit={handleGarrison}>
            <p className="join-note">
              Spend banked reserve steps to remotely reinforce a zone your squad already holds.
            </p>
            <div className="command-row">
              <input
                type="number"
                min="0"
                max="11"
                value={garrisonForm.x}
                onChange={(e) => setGarrisonForm({ ...garrisonForm, x: e.target.value })}
                placeholder="X"
              />
              <input
                type="number"
                min="0"
                max="11"
                value={garrisonForm.y}
                onChange={(e) => setGarrisonForm({ ...garrisonForm, y: e.target.value })}
                placeholder="Y"
              />
              <input
                type="number"
                min="1"
                max="25"
                value={garrisonForm.amount}
                onChange={(e) => setGarrisonForm({ ...garrisonForm, amount: e.target.value })}
                placeholder="Amount"
              />
              <button type="submit">Reinforce</button>
            </div>
            {garrisonMsg && <p className="join-note">{garrisonMsg}</p>}
          </form>
        )}

        {tab === 'supply' && (
          <form className="command-body" onSubmit={handleSupply}>
            <p className="join-note">Send XP to a teammate — online or not.</p>
            <div className="command-row">
              <input
                value={supplyForm.toUsername}
                onChange={(e) => setSupplyForm({ ...supplyForm, toUsername: e.target.value })}
                placeholder="Callsign"
              />
              <input
                type="number"
                min="1"
                value={supplyForm.amount}
                onChange={(e) => setSupplyForm({ ...supplyForm, amount: e.target.value })}
                placeholder="XP"
              />
              <button type="submit">Send</button>
            </div>
            {supplyMsg && <p className="join-note">{supplyMsg}</p>}
          </form>
        )}

        {tab === 'scouting' && (
          <div className="command-body">
            <button type="button" onClick={handleReport}>
              Pull Scouting Report
            </button>
            {report && !report.error && (
              <div className="scouting-report">
                <p>Secured sectors: {report.securedSectors.join(', ') || 'none yet'}</p>
                <p>Enemy-held threats: {report.threats.join(', ') || 'none'}</p>
                <p>Recommended objective: {report.recommended || 'hold the line'}</p>
              </div>
            )}
            {report?.error && <p className="join-note">{report.error}</p>}
          </div>
        )}

        {tab === 'orders' && (
          <form className="command-body" onSubmit={handleOrder}>
            <p className="join-note">Set a passive priority for when you're not out running.</p>
            <div className="command-row">
              <input
                value={orderForm.sectorId}
                onChange={(e) => setOrderForm({ ...orderForm, sectorId: e.target.value })}
                placeholder="Sector (e.g. B3)"
              />
              <select
                value={orderForm.priority}
                onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
              >
                <option value="defend">Defend</option>
                <option value="advance">Advance</option>
              </select>
              <button type="submit">Set Order</button>
            </div>
            {orderMsg && <p className="join-note">{orderMsg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

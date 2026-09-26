import { useEffect, useRef, useState } from 'react';

const CELL = 42;
// Must stay under the backend's MAX_SPEED_CELLS_PER_SEC or the server's
// anti-cheat check will reject the position updates.
const WALK_SPEED = 2.2;

const TEAM_COLORS = {
  red: '#E4572E',
  blue: '#2E86AB',
  gold: '#F2C14E',
};

export default function GameMap({ gridSize, zones, players, self, onMove, radarReveal }) {
  const [pos, setPos] = useState({ x: self?.x ?? 0, y: self?.y ?? 0 });
  const targetRef = useRef(null);
  const rafRef = useRef(null);
  const lastTsRef = useRef(null);
  const lastSentRef = useRef(0);

  useEffect(() => {
    if (self) setPos({ x: self.x, y: self.y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [self?.id]);

  useEffect(() => {
    function step(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;

      if (targetRef.current) {
        setPos((prev) => {
          const dx = targetRef.current.x - prev.x;
          const dy = targetRef.current.y - prev.y;
          const dist = Math.hypot(dx, dy);

          if (dist < 0.05) {
            targetRef.current = null;
            return prev;
          }

          const stepDist = WALK_SPEED * dt;
          const ratio = Math.min(1, stepDist / dist);
          const next = { x: prev.x + dx * ratio, y: prev.y + dy * ratio };

          if (ts - lastSentRef.current > 120) {
            onMove(next.x, next.y);
            lastSentRef.current = ts;
          }
          return next;
        });
      }

      rafRef.current = requestAnimationFrame(step);
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onMove]);

  function handleClick(x, y) {
    targetRef.current = { x, y };
  }

  const now = Date.now();

  return (
    <svg
      className="game-map"
      viewBox={`0 0 ${gridSize * CELL} ${gridSize * CELL}`}
      width="100%"
      height="100%"
    >
      {Array.from({ length: gridSize }).map((_, x) =>
        Array.from({ length: gridSize }).map((_, y) => {
          const zone = zones.find((z) => z.x === x && z.y === y);
          const fill = zone?.owner ? TEAM_COLORS[zone.owner] : '#1D2B22';
          const opacity = zone?.owner ? 0.25 + (zone.meter / 100) * 0.55 : 1;
          const shielded = Boolean(zone?.shieldUntil && zone.shieldUntil > now);
          return (
            <g key={`${x}-${y}`}>
              <rect
                x={x * CELL}
                y={y * CELL}
                width={CELL - 2}
                height={CELL - 2}
                fill={fill}
                opacity={opacity}
                stroke="#2E4234"
                className="zone-cell"
                onClick={() => handleClick(x, y)}
              />
              {shielded && (
                <rect
                  x={x * CELL + 2}
                  y={y * CELL + 2}
                  width={CELL - 6}
                  height={CELL - 6}
                  fill="none"
                  stroke="#FF7A33"
                  strokeWidth="2"
                  strokeDasharray="4 2"
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })
      )}

      {players.map((p) => {
        const isSelf = p.id === self?.id;
        const px = (isSelf ? pos.x : p.x) * CELL + CELL / 2;
        const py = (isSelf ? pos.y : p.y) * CELL + CELL / 2;
        const surging = Boolean(p.surgeUntil && p.surgeUntil > now);
        return (
          <g key={p.id} transform={`translate(${px}, ${py})`}>
            {surging && <circle r="18" fill="none" stroke="#FF7A33" strokeWidth="2" opacity="0.7" />}
            <circle r={isSelf ? 10 : 7} fill={TEAM_COLORS[p.team]} stroke="#0C120E" strokeWidth="2" />
            {isSelf && (
              <circle r="14" fill="none" stroke={TEAM_COLORS[p.team]} strokeWidth="1.5" opacity="0.6" />
            )}
          </g>
        );
      })}

      {radarReveal?.map((e) => (
        <g key={`radar-${e.id}`} transform={`translate(${e.x * CELL + CELL / 2}, ${e.y * CELL + CELL / 2})`}>
          <circle r="12" fill="none" stroke={TEAM_COLORS[e.team]} strokeWidth="2" strokeDasharray="3 2" />
        </g>
      ))}
    </svg>
  );
}

import React, { useState } from 'react';
import type { Card as CardType } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';
import { Card } from './Card';

interface ZoneSearchPanelProps {
  zones: Record<string, { zoneType: ZoneEnum; cards: CardType[]; isLocal: boolean }>;
  onDragStart?: (card: CardType, meta?: { fromZoneSearchPanel?: boolean }) => void;
  initialZone?: ZoneEnum;
  onClose?: () => void;
}

const zoneOptions = [
  { value: ZoneEnum.library, label: 'Library' },
  { value: ZoneEnum.command, label: 'Command' },
  { value: ZoneEnum.graveyard, label: 'Graveyard' },
  { value: ZoneEnum.exile, label: 'Exile' },
];

export function ZoneSearchPanel(props: ZoneSearchPanelProps) {
  const { zones, onDragStart, initialZone, onClose } = props;
  const [selectedZone, setSelectedZone] = useState<ZoneEnum>(initialZone ?? ZoneEnum.library);

  // Update selectedZone when initialZone changes or when panel is mounted
  React.useEffect(() => {
    setSelectedZone(initialZone ?? ZoneEnum.library);
  }, [initialZone]);
  const [search, setSearch] = useState('');

  const cards = zones[selectedZone]?.cards || [];
  const filteredCards = search
    ? cards.filter(card =>
        card.cardName?.toLowerCase().includes(search.toLowerCase()) ||
        card.id?.toLowerCase().includes(search.toLowerCase())
      )
    : cards;

  return (
    <aside className="zone-search-panel">
      <div className="zone-search-controls">
        <select value={selectedZone} onChange={e => setSelectedZone(e.target.value as unknown as ZoneEnum)}>
          {zoneOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search cards..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className="zone-search-close"
          style={{ marginLeft: 'auto', background: '#444', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 12px', cursor: 'pointer' }}
          onClick={onClose}
        >✖</button>
      </div>
      <div className="zone-search-results">
        {filteredCards.length === 0 ? (
          <div className="empty-zone">No cards found.</div>
        ) : (
          filteredCards.map(card => (
              <Card card={card} isLocal={zones[selectedZone].isLocal} idPrefix='search-' />
          ))
        )}
      </div>
    </aside>
  );
}

export const zoneSearchPanelStyles = `
.zone-search-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 320px;
  height: 100vh;
  background: #222;
  border-left: 2px solid #444;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  box-shadow: -2px 0 8px rgba(0,0,0,0.2);
}
.zone-search-controls {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #333;
  border-bottom: 1px solid #444;
}
.zone-search-controls select,
.zone-search-controls input {
  padding: 6px;
  border-radius: 4px;
  border: 1px solid #555;
  background: #222;
  color: #eee;
}
.zone-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.draggable-card {
  cursor: grab;
}
`;

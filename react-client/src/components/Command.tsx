import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';

interface CommandProps {
  cards: CardType[];
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
}

export function Command({ cards, activeCardId, onCardClick, onCardDoubleClick }: CommandProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'command',
    data: {
      type: 'command',
      accepts: ['card'],
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`zone command ${isOver ? 'drag-over' : ''}`}
    >
      <div className="zone-header">
        <h4>Command</h4>
        <span className="card-count">{cards.length}</span>
      </div>
      
      <div className="zone-content">
        {cards.map((card) => (
          <div key={card.id} className="command-card">
            <Card
              card={card}
              isDragging={card.id === activeCardId}
              onClick={() => onCardClick?.(card)}
              onDoubleClick={() => onCardDoubleClick?.(card)}
            />
          </div>
        ))}
        
        {cards.length === 0 && (
          <div className="empty-zone">No Commanders</div>
        )}
      </div>
    </div>
  );
}

export const commandStyles = `
  .command .zone-content {
    flex-wrap: wrap;
    gap: 4px;
  }

  .command-card {
    flex-shrink: 0;
  }
`;
import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';

interface GraveyardProps {
  cards: CardType[];
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
}

export function Graveyard({ cards, activeCardId, onCardClick, onCardDoubleClick }: GraveyardProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'graveyard',
    data: {
      type: 'graveyard',
      accepts: ['card'],
    },
  });

  const topCard = cards[cards.length - 1]; // Show the most recently added card

  return (
    <div
      ref={setNodeRef}
      className={`zone graveyard ${isOver ? 'drag-over' : ''}`}
    >
      <div className="zone-header">
        <h4>Graveyard</h4>
        <span className="card-count">{cards.length}</span>
      </div>
      
      <div className="zone-content">
        {topCard ? (
          <div className="graveyard-top-card">
            <Card
              card={topCard}
              isDragging={topCard.id === activeCardId}
              onClick={() => onCardClick?.(topCard)}
              onDoubleClick={() => onCardDoubleClick?.(topCard)}
            />
          </div>
        ) : (
          <div className="empty-zone">Empty</div>
        )}
      </div>
    </div>
  );
}

export const graveyardStyles = `
  .graveyard-top-card {
    position: relative;
  }

  .graveyard .zone-content {
    position: relative;
  }
`;
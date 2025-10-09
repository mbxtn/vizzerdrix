import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';

interface ExileProps {
  cards: CardType[];
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
}

export function Exile({ cards, activeCardId, onCardClick, onCardDoubleClick }: ExileProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'exile',
    data: {
      type: 'exile',
      accepts: ['card'],
    },
  });

  const topCard = cards[cards.length - 1]; // Show the most recently added card

  return (
    <div
      ref={setNodeRef}
      className={`zone exile ${isOver ? 'drag-over' : ''}`}
    >
      <div className="zone-header">
        <h4>Exile</h4>
        <span className="card-count">{cards.length}</span>
      </div>
      
      <div className="zone-content">
        {topCard ? (
          <div className="exile-top-card">
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

export const exileStyles = `
  .exile-top-card {
    position: relative;
  }

  .exile .zone-content {
    position: relative;
  }

  .exile {
    border-color: #8e44ad;
  }

  .exile.drag-over {
    border-color: rgba(142, 68, 173, 0.8);
    background: rgba(142, 68, 173, 0.1);
  }
`;
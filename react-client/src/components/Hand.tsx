import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';

interface HandProps {
  cards: CardType[];
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
}

export function Hand({ cards, activeCardId, onCardClick, onCardDoubleClick }: HandProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'hand',
    data: {
      type: 'hand',
      accepts: ['card'],
    },
  });

  // Debug logging
  console.log('Hand component - cards received:', cards.length, cards);

  return (
    <div
      ref={setNodeRef}
      className={`hand ${isOver ? 'drag-over' : ''}`}
    >
      <div className="hand-header">
        <h3>Hand ({cards.length})</h3>
      </div>
      
      <div className="hand-cards">
        {cards.map((card, index) => (
          <div key={card.id} className="hand-card" style={{ left: index * 15 }}>
            <Card
              card={card}
              isDragging={card.id === activeCardId}
              onClick={() => onCardClick?.(card)}
              onDoubleClick={() => onCardDoubleClick?.(card)}
            />
          </div>
        ))}
        
        {cards.length === 0 && (
          <div className="empty-hand">No cards in hand</div>
        )}
      </div>
    </div>
  );
}

export const handStyles = `
  .hand {
    position: relative;
    height: var(--zone-height, 150px);
    background: rgba(0, 0, 0, 0.8);
    border-top: 2px solid #333;
    transition: background-color 0.2s ease;
    flex-shrink: 0;
  }

  .hand.drag-over {
    background: rgba(79, 195, 247, 0.2);
    border-top-color: rgba(79, 195, 247, 0.8);
  }

  .hand-header {
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .hand-header h3 {
    margin: 0;
    font-size: 14px;
  }

  .hand-cards {
    position: relative;
    height: calc(100% - 40px);
    padding: 10px;
    overflow-x: auto;
    white-space: nowrap;
  }

  .hand-card {
    position: relative;
    display: inline-block;
    margin-right: 5px;
  }

  .hand-card:hover {
    z-index: 20;
    transform: translateY(-8px);
    transition: transform 0.2s ease;
  }

  .empty-hand {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
  }
`;
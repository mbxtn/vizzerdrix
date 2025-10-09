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
        <h4>Hand</h4>
        <span className="card-count">{cards.length}</span>
      </div>
      
      <div className="hand-cards">
        {cards.map((card) => (
          <div key={card.id} className="hand-card">
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
    overflow: visible;
  }

  .hand.drag-over {
    background: rgba(79, 195, 247, 0.2);
    border-top-color: rgba(79, 195, 247, 0.8);
  }

  .hand-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    border-bottom: 1px solid #555;
    padding-bottom: 4px;
  }

  .hand-header h4 {
    margin: 0;
    font-size: 12px;
    color: #ccc;
  }

  .hand-header .card-count {
    font-size: 11px;
    color: #999;
  }

  .hand-cards {
    position: relative;
    height: calc(100% - 40px);
    padding: 10px;
    overflow-x: auto;
    overflow-y: visible;
    display: flex;
    gap: 2px;
    align-items: flex-start;
  }

  .hand-card {
    flex-shrink: 0;
    isolation: isolate;
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
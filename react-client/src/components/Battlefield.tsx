import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';

interface BattlefieldProps {
  cards: CardType[];
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
  onCardMove?: (card: CardType, position: { x: number; y: number }) => void;
}

export function Battlefield({ cards, activeCardId, onCardClick, onCardDoubleClick }: BattlefieldProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'battlefield',
    data: {
      type: 'battlefield',
      accepts: ['card'],
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`battlefield ${isOver ? 'drag-over' : ''}`}
    >
      <div className="battlefield-header">
        <h3>Battlefield</h3>
      </div>
      
      <div className="battlefield-area">
        {cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            position={{ x: card.location.x, y: card.location.y }}
            isDragging={card.id === activeCardId}
            onClick={() => onCardClick?.(card)}
            onDoubleClick={() => onCardDoubleClick?.(card)}
          />
        ))}
        
        {cards.length === 0 && (
          <div className="empty-battlefield">
            Battlefield is empty - drag cards here to play them
          </div>
        )}
      </div>
    </div>
  );
}

export const battlefieldStyles = `
  .battlefield {
    position: relative;
    flex: 1;
    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
    border: 2px solid #333;
    border-radius: 8px;
    transition: border-color 0.2s ease;
    overflow: hidden;
  }

  .battlefield.drag-over {
    border-color: rgba(79, 195, 247, 0.5);
  }

  .battlefield-header {
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 8px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .battlefield-header h3 {
    margin: 0;
    font-size: 14px;
  }

  .battlefield-area {
    position: relative;
    height: calc(100% - 40px);
    min-height: 300px;
  }

  .empty-battlefield {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: rgba(255, 255, 255, 0.6);
    font-style: italic;
    text-align: center;
    font-size: 18px;
  }
`;
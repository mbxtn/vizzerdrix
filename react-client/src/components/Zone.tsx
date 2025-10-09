import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';

interface ZoneProps {
  zoneName: string;
  zoneId: string;
  cards: CardType[];
  activeCardId?: string;
  displayMode?: 'stack' | 'top-card' | 'all-cards';
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
}

export function Zone({ 
  zoneName, 
  zoneId, 
  cards, 
  activeCardId, 
  displayMode = 'stack',
  onCardClick, 
  onCardDoubleClick 
}: ZoneProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
    data: {
      type: zoneId,
      accepts: ['card'],
    },
  });

  const renderContent = () => {
    if (cards.length === 0) {
      return <div className="empty-zone">Empty</div>;
    }

    switch (displayMode) {
      case 'stack':
        // Show a card back with count (for library)
        return (
          <div className="card-stack">
            <div className="card-back">📚</div>
          </div>
        );
      
      case 'top-card':
        // Show the most recent card (for graveyard/exile)
        const topCard = cards[cards.length - 1];
        return (
          <div className="zone-top-card">
            <Card
              card={topCard}
              isDragging={topCard.id === activeCardId}
              onClick={() => onCardClick?.(topCard)}
              onDoubleClick={() => onCardDoubleClick?.(topCard)}
            />
          </div>
        );
      
      case 'all-cards':
        // Show all cards (for command zone)
        return (
          <div className="zone-cards">
            {cards.map((card) => (
              <div key={card.id} className="zone-card">
                <Card
                  card={card}
                  isDragging={card.id === activeCardId}
                  onClick={() => onCardClick?.(card)}
                  onDoubleClick={() => onCardDoubleClick?.(card)}
                />
              </div>
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`zone ${zoneId} ${isOver ? 'drag-over' : ''}`}
    >
      <div className="zone-header">
        <h4>{zoneName}</h4>
        <span className="card-count">{cards.length}</span>
      </div>
      
      <div className="zone-content">
        {renderContent()}
      </div>
    </div>
  );
}

export const zoneStyles = `
  .zone {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #444;
    border-radius: 4px;
    padding: 2px;
    min-height: 60px;
    display: flex;
    flex-direction: column;
  }

  .zone.drag-over {
    border-color: rgba(79, 195, 247, 0.5);
    background: rgba(79, 195, 247, 0.1);
  }

  .zone-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    border-bottom: 1px solid #555;
    padding-bottom: 4px;
  }

  .zone-header h4 {
    margin: 0;
    font-size: 12px;
    color: #ccc;
  }

  .card-count {
    background: #555;
    color: white;
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
  }

  .zone-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-stack {
    position: relative;
    width: var(--stack-card-width, 45px);
    height: var(--stack-card-height, 60px);
    cursor: pointer;
  }

  .card-back {
    width: 100%;
    height: 100%;
    background: #2c3e50;
    border: 1px solid #444;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: #ccc;
  }

  .zone-top-card {
    position: relative;
  }

  .zone-cards {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    justify-content: center;
  }

  .zone-card {
    flex-shrink: 0;
  }

  .empty-zone {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    font-size: 11px;
  }

  /* Zone-specific styling */
  .exile {
    border-color: #8e44ad;
  }

  .exile.drag-over {
    border-color: rgba(142, 68, 173, 0.8);
    background: rgba(142, 68, 173, 0.1);
  }
`;
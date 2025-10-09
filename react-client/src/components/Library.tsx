import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { Card as CardType } from '@vizzerdrix/shared';

interface LibraryProps {
  cards: CardType[];
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
}

export function Library({ cards, activeCardId, onCardClick, onCardDoubleClick }: LibraryProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'library',
    data: {
      type: 'library',
      accepts: ['card'],
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`zone library ${isOver ? 'drag-over' : ''}`}
    >
      <div className="zone-header">
        <h4>Library</h4>
        <span className="card-count">{cards.length}</span>
      </div>
      
      <div className="zone-content">
        {cards.length > 0 && (
          <div className="card-stack">
            <div className="card-back">📚</div>
          </div>
        )}
        
        {cards.length === 0 && (
          <div className="empty-zone">Empty</div>
        )}
      </div>
    </div>
  );
}

export const libraryStyles = `
  .zone {
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #444;
    border-radius: 4px;
    padding: 4px;
    min-height: 60px;
    display: flex;
    flex-direction: column;
    flex: 1;
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
    width: 45px;
    height: 60px;
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
    font-size: 20px;
    color: #ccc;
  }

  .empty-zone {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    font-size: 11px;
  }
`;
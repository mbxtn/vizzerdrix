import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Card as CardType } from '@vizzerdrix/shared';

interface CardProps {
  card: CardType;
  position?: { x: number; y: number };
  isDragging?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
}

export function Card({ card, position, isDragging, onClick, onDoubleClick }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
  } = useDraggable({
    id: card.id,
    data: {
      card,
      type: 'card',
    },
  });

  const style: React.CSSProperties = {
    position: position ? 'absolute' : 'relative',
    left: position?.x || 0,
    top: position?.y || 0,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0 : 1, // Hide original card while dragging
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`card ${card.tapped ? 'tapped' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <div className="card-image">
        <div className="card-name">{card.cardName}</div>
        {card.counters > 0 && (
          <div className="counters">{card.counters}</div>
        )}
      </div>
    </div>
  );
}

// CSS styles as a separate object for now
export const cardStyles = `
  .card {
    width: var(--card-width, 63px);
    height: var(--card-height, 88px);
    border-radius: 6px;
    border: 2px solid #333;
    background: #1a1a1a;
    cursor: pointer;
    transition: transform 0.2s ease;
    user-select: none;
    overflow: hidden;
  }

  .card:hover {
    z-index: 10;
    transform: scale(1.05);
  }

  .card.tapped {
    opacity: 0.7;
    transform: rotate(90deg);
  }

  .card.dragging {
    transform: rotate(5deg);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }

  .card-image {
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    background-color: #333;
    border-radius: 4px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 4px;
    box-sizing: border-box;
  }

  .card-name {
    background: rgba(0, 0, 0, 0.8);
    color: white;
    font-size: 8px;
    padding: 2px;
    border-radius: 2px;
    text-align: center;
    line-height: 1.2;
    word-wrap: break-word;
    max-height: 20px;
    overflow: hidden;
  }

  .counters {
    position: absolute;
    top: 2px;
    right: 2px;
    background: #ff4444;
    color: white;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: bold;
  }
`;
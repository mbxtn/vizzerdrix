import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType, Player } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';


interface BattlefieldProps {
  cards: CardType[];
  player: Player;
  activeCardId?: string;
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
  onCardMove?: (card: CardType, position: { x: number; y: number }) => void;
  isCardSelected?: (cardId: string) => boolean;
  cardsSelected?: (selectedCardIds: string[]) => void;
  onCardCounterClick?: (card: CardType) => void;
  isDragging?: boolean;
  isLocalPlayer?: boolean;
}

export function Battlefield({cards, player, activeCardId, onCardClick, onCardDoubleClick, onCardCounterClick ,isCardSelected, cardsSelected, isDragging, isLocalPlayer}: BattlefieldProps) {
  // Marquee selection state and handlers
  const selectionStartRef = React.useRef<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = React.useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2) return; // Right click, do nothing
    e.stopPropagation();
    selectionStartRef.current = { x: e.clientX, y: e.clientY };
    setSelectionBox(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selectionStartRef.current) {
      const start = selectionStartRef.current;
      const x = Math.min(start.x, e.clientX);
      const y = Math.min(start.y, e.clientY);
      const width = Math.abs(e.clientX - start.x);
      const height = Math.abs(e.clientY - start.y);
      setSelectionBox({ x, y, width, height });
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    if (!selectionStartRef.current) return;
    // Select cards inside selectionBox
    if (selectionBox && cardsSelected) {
      // Get battlefield-area bounding rect for offset
      const area = document.querySelector('.battlefield-area');
      const areaRect = area?.getBoundingClientRect();
      const boxLeft = selectionBox.x;
      const boxTop = selectionBox.y;
      const boxRight = selectionBox.x + selectionBox.width;
      const boxBottom = selectionBox.y + selectionBox.height;

      // Find cards whose bounding box intersects selectionBox
      const selectedIds: string[] = [];
      cards.forEach(card => {
        const cardElem = document.getElementById(`card-${card.id}`);
        if (cardElem) {
          const rect = cardElem.getBoundingClientRect();
          // Check intersection
          if (
            rect.right > boxLeft &&
            rect.left < boxRight &&
            rect.bottom > boxTop &&
            rect.top < boxBottom
          ) {
            selectedIds.push(card.id);
          }
        }
      });
      cardsSelected(selectedIds);
    } else if (cardsSelected) {
      cardsSelected([]);
    }
    selectionStartRef.current = null;
    setSelectionBox(null);
  };
  const { setNodeRef, isOver } = useDroppable({
    id: 'battlefield',
    data: {
      type: ZoneEnum.battlefield,
      accepts: ['card'],
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`battlefield ${isOver ? 'drag-over' : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation()
      }} 
    >
      <div className="battlefield-area" style={{ position: 'relative' }}>
        {[...cards]
          .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
          .map((card) => (
            <Card
              key={card.id}
              card={card}
              position={{ x: card.location.x, y: card.location.y }}
              isDragging={isDragging}
              handleSingleClick={() => onCardClick?.(card)}
              handleDoubleClick={() => onCardDoubleClick?.(card)}
              handleCounterClicked={() => onCardCounterClick?.(card)}
              isSelected={typeof isCardSelected === 'function' ? isCardSelected(card.id) : false}
              isLocal={isLocalPlayer}
              hidden={false}
            />
          ))}
        {selectionBox && (
          <div
            className="selection-box"
            style={{
              position: 'absolute',
              left: selectionBox.x,
              top: selectionBox.y,
              width: selectionBox.width,
              height: selectionBox.height,
              background: 'rgba(33,150,243,0.15)',
              border: '2px dashed #2196f3',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          />
        )}
        {cards.length === 0 && (
          <div className="empty-battlefield">
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

  .battlefield-area {
    position: relative;
    height: calc(100% - 40px);
    min-height: 300px;
  }

  .selection-box {
    box-sizing: border-box;
    transition: none;
    pointer-events: none;
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
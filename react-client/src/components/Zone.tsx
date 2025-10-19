import React from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { Card } from './Card';
import type { Card as CardType } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';


interface ZoneProps {
  zoneName: string;
  zoneId: string;
  zoneType: ZoneEnum;
  cards: CardType[];
  order?: string[];
  activeCardId?: string;
  displayMode?: 'stack' | 'top-card' | 'all-cards';
  onCardClick?: (card: CardType) => void;
  onCardDoubleClick?: (card: CardType) => void;
  onZoneClick?: () => void;
  style?: React.CSSProperties;
  isCardSelected?: (cardId: string) => boolean;
  isDragging?: boolean;
}

export function Zone({ 
  zoneName, 
  zoneId,
  zoneType, 
  cards, 
  order: propOrder,
  activeCardId, 
  displayMode = 'stack',
  onCardClick, 
  onCardDoubleClick,
  onZoneClick, 
  style,
  isCardSelected,
  isDragging = false
}: ZoneProps) {
  // Local order array for this zone
  // Use order from props if provided, else default to cards order
  const order = propOrder ?? cards.map(card => card.id);
  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
    data: {
      type: zoneType,
      accepts: ['card'],
    },
  });

  const handleClick = (e : React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if(onZoneClick) onZoneClick();
  }

  const renderContent = () => {
    switch (displayMode) {
      case 'stack': {
        // Use order array to determine top card
        const orderedCards = order.map(id => cards.find(card => card.id === id)).filter(Boolean) as CardType[];
        const stackTopCard = orderedCards.length > 0 ? orderedCards[orderedCards.length - 1] : undefined;
        const isLibrary = zoneType === ZoneEnum.library;
        const { attributes, listeners, setNodeRef: setDragRef, transform } = useDraggable({
          id: stackTopCard?.id || `${zoneId}-empty`,
          data: { card: stackTopCard },
          disabled: !stackTopCard,
        });
        const stackStyle = transform ? {
          transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        } : {};
        const cardBackStyle = isLibrary
          ? { width: 'var(--card-width)', height: 'var(--card-height)' }
          : { width: 'var(--stack-card-width)', height: 'var(--stack-card-height)' };
        const cardBackImgStyle = isLibrary
          ? { width: 'var(--card-width)', height: 'var(--card-height)', objectFit: 'cover' as const, borderRadius: '3px' }
          : { width: 'var(--stack-card-width)', height: 'var(--stack-card-height)', objectFit: 'cover' as const, borderRadius: '3px' };
        return (
          <div 
            ref={setDragRef}
            className="card-stack"
            style={isLibrary ? { ...stackStyle, width: 'var(--card-width)', height: 'var(--card-height)' } : { ...stackStyle } }
            onClick={() => stackTopCard && onCardClick?.(stackTopCard)}
            onDoubleClick={() => stackTopCard && onCardDoubleClick?.(stackTopCard)}
            {...listeners}
            {...attributes}
          >
            {isLibrary && orderedCards.length === 0 ? (
              <div/>
            ) : (
              <div className="card-back" style={cardBackStyle}>
                <img src="/cardback.png" alt="Card Back" style={cardBackImgStyle} />
              </div>
            )}
          </div>
        );
      }
      
      case 'top-card': {
        // Show the most recent card (for graveyard/exile)
        const topCard = cards.length > 0 ? cards[cards.length - 1] : undefined;
        return topCard ? (
          <div className="zone-top-card" onClick={handleClick}>
            <Card
              card={topCard}
              isDragging={topCard.id === activeCardId}
              handleSingleClick={() => onCardClick?.(topCard)}
              handleDoubleClick={() => onCardDoubleClick?.(topCard)}
            />
          </div>
        ) : (
          <div className="empty-zone">Empty</div>
        );
      }
      
      case 'all-cards': {
        // Show all cards, hide selected if dragging
        const orderedCards = order
          .filter(id => cards.some(card => card.id === id))
          .map(id => cards.find(card => card.id === id))
          .filter(Boolean) as CardType[];
        return (
          <div className="zone-cards" onClick={handleClick}>
            {cards.length === 0
              ? null
              : orderedCards.map((card) => (
                  <div key={card.id} className="zone-card">
                    <Card
                      card={card}
                      isDragging={card.id === activeCardId || (isDragging && typeof isCardSelected === 'function' && isCardSelected(card.id))}
                      handleSingleClick={() => onCardClick?.(card)}
                      handleDoubleClick={() => onCardDoubleClick?.(card)}
                      isSelected={typeof isCardSelected === 'function' ? isCardSelected(card.id) : false}
                    />
                  </div>
                ))
            }
          </div>
        );
      }
      
      default:
        return null;
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`zone ${zoneId} ${isOver ? 'drag-over' : ''}`}
       style={style}
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
    padding: 0.5px;
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
    margin-bottom: 4px;
    border-bottom: 1px solid #555;
    padding-bottom: 2px;
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
    width: var(--stack-card-width, 45px);
    height: var(--stack-card-height, 60px);
    border: 1px solid #444;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .card-back img {
    width: var(--stack-card-width, 45px);
    height: var(--stack-card-height, 60px);
    object-fit: cover;
    border-radius: 3px;
  }

  .zone-top-card {
    position: relative;
  }

  .zone-cards {
  display: flex;
  gap: 2px;
  justify-content: center;
  flex-wrap: wrap;
  width: 100%;
  height: 100%;
  }

  /* Hand zone: horizontal scroll when overflow */
  .zone.hand .zone-cards {
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: visible;
  justify-content: flex-start;
  align-items: center;
  scrollbar-width: thin;
  scrollbar-color: #888 #222;
  }
  .zone.hand .zone-cards::-webkit-scrollbar {
    height: 8px;
    background: #222;
  }
  .zone.hand .zone-cards::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 4px;
  }
  }

  .zone-card {
    flex-shrink: 0;
  }

  .empty-zone {
    color: rgba(255, 255, 255, 0.4);
    font-style: italic;
    font-size: 11px;
  }


  .empty-library-placeholder {
    width: var(--card-width, 63px);
    height: var(--card-height, 88px);
    background: #e0e0e0;
    border: 1px solid #bbb;
    border-radius: 6px;
    margin: 0 auto;
    display: block;
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
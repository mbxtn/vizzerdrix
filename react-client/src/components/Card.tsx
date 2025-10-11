import React, { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Card as CardType } from '@vizzerdrix/shared';
import { ScryfallCache, scryfallCache } from '../lib/scryfallCache';

interface CardProps {
  card: CardType;
  position?: { x: number; y: number };
  isDragging?: boolean;
  handleSingleClick?: () => void;
  handleDoubleClick?: () => void;
  style?: React.CSSProperties;
  imageUrl?: string;
  isSelected?: boolean;
}

export function Card({ card, position, isDragging, handleSingleClick, handleDoubleClick, style, imageUrl }: CardProps) {
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

  // Scryfall image lookup logic
  const defaultImage = "https://cards.scryfall.io/large/front/b/2/b2d9d5ca-7e15-437a-bdfc-5972b42148fe.jpg?1759144812";
  let imgSrc = defaultImage;
  try {
    const scryFallCard = scryfallCache.getById ? scryfallCache.getById(card.scryfallId) : scryfallCache.get(card.scryfallId);
    if (scryFallCard) {
      if (scryFallCard.image_uris && scryFallCard.image_uris.normal) {
        imgSrc = scryFallCard.image_uris.normal;
      } else if (scryFallCard.card_faces && scryFallCard.card_faces[0]?.image_uris?.normal) {
        imgSrc = scryFallCard.card_faces[0].image_uris.normal;
      }
    }
  } catch (e) {
    // fallback to default image
  }
  const isTapped = card.tapped;
  const cardWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-width')) || 63;
  const cardHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-height')) || 88;
  const mergedStyle: React.CSSProperties = {
    position: position ? 'absolute' : 'relative',
    left: position?.x || 0,
    top: position?.y || 0,
    width: isTapped ? cardHeight : cardWidth,
    height: isTapped ? cardWidth : cardHeight,
    display: 'flex',
    flexDirection: isTapped ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: isDragging ? 1000 : 1,
    opacity: isDragging ? 0 : 1,
    ...(typeof (arguments[0] as any)?.style === 'object' ? (arguments[0] as any).style : {}),
  };

  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleClick = () => {
    // Super simple double click
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current)
      clickTimeout.current = null
      if (handleDoubleClick)
        handleDoubleClick()
    } else {
      clickTimeout.current = setTimeout(() => {
        clickTimeout.current = null
        if (handleSingleClick) {
          handleSingleClick()
        }
      }, 200)
    }

  }

  return (
    <div
      ref={setNodeRef}
      style={mergedStyle}
      {...listeners}
      {...attributes}
      className={`card ${isTapped ? 'tapped' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={handleClick}
    >
      <div
        className="card-image"
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imgSrc}
          alt={card.cardName}
          style={{
            width: `${cardWidth}px`,
            height: `${cardHeight}px`,
            objectFit: 'cover',
            borderRadius: '4px',
            transform: isTapped ? 'rotate(90deg)' : undefined,
          }}
        />
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
  }

  .card:hover:not(.dragging) {
    z-index: 9999;
  }

  .card.tapped {
    opacity: 0.7;
  }

  .card.tapped.dragging {
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  }

  .card.dragging:not(.tapped) {
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
import React, { useRef } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Card as CardType } from '@vizzerdrix/shared';
import { ScryfallCache, scryfallCache } from '../lib/scryfallCache';
import { GetCardFace } from '../lib/scryfallUtils';

interface CardProps {
  card: CardType;
  position?: { x: number; y: number };
  isDragging?: boolean;
  handleSingleClick?: () => void;
  handleDoubleClick?: () => void;
  handleCounterClicked?: () => void;
  isSelected?: boolean;
  isLocal?: boolean;
}


export function Card({ card, position, isDragging, handleSingleClick, handleDoubleClick, handleCounterClicked, isSelected, isLocal }: CardProps) {
  let attributes: Record<string, any> = {};
  let listeners: Record<string, any> = {};
  let setNodeRef = (_el: HTMLElement | null) => {};
  if (isLocal) {
    const draggable = useDraggable({
      id: card.id,
      data: {
        card,
        type: 'card',
      },
    });
    attributes = draggable.attributes ?? {};
    listeners = draggable.listeners ?? {};
    setNodeRef = draggable.setNodeRef;
  }
  
  // Card dimensions must be available for fallback SVG
  const cardWidth = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-width')) || 63;
  const cardHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-height')) || 88;
  // Scryfall image lookup logic
  const defaultImage = "https://cards.scryfall.io/large/front/b/2/b2d9d5ca-7e15-437a-bdfc-5972b42148fe.jpg?1759144812";
  let imgSrc = defaultImage;
  try {
    const scryFallCard = scryfallCache.getById(card.scryfallId);
    if (scryFallCard) {
      const face = GetCardFace(scryFallCard, card.flipped)
      if(face) imgSrc = face;
    } else {
      if(card.flipped) {
        imgSrc = "/cardback.png";
      } else {
        // Fallback: SVG off-white image with card name
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${cardWidth}' height='${cardHeight}'><rect width='100%' height='100%' fill='#f8f8f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='14' fill='#333' font-family='sans-serif'>${card.cardName.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</text></svg>`;
        imgSrc = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
      }
    }
  } catch (e) {
    // fallback to default image
  }
  const isTapped = card.tapped;
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
    zIndex: isDragging && isSelected ? 1000 : 1,
    opacity: isDragging && isSelected ? 0 : 1,
    ...(typeof (arguments[0] as any)?.style === 'object' ? (arguments[0] as any).style : {}),
    border: isSelected ? '2px solid #2196f3' : '2px solid #333'
  };

  const clickTimeout = useRef<NodeJS.Timeout | null>(null);
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    // Super simple double click
    if (clickTimeout.current) {
      clearTimeout(clickTimeout.current)
      clickTimeout.current = null
      if (handleDoubleClick) {
        handleDoubleClick();
      }
    } else {
      clickTimeout.current = setTimeout(() => {
        clickTimeout.current = null
        if (handleSingleClick) {
          handleSingleClick();
        }
      }, 200);
    }

  }

  return (
    <div
      ref={setNodeRef}
      id={`card-${card.id}`}
      style={mergedStyle}
      {...listeners}
      {...attributes}
      className={`card ${isTapped ? 'tapped' : ''} ${isDragging && isSelected ? 'dragging' : ''}`}
      onClick={handleClick}
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>)=>{
        e.stopPropagation()
      }}
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
          position: 'relative',
        }}
      >
        {/* Orange dogear triangle for temporary cards */}
        {card.isTemporary && (
          <div className="card-dogear"/>
        )}
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
        {card.counters !== 0 && (
          <div className="counters"
          onClick = {(e : React.MouseEvent<HTMLDivElement>) => {
            e.stopPropagation();
            if(handleCounterClicked) handleCounterClicked();
          }}
          style={{
              bottom: !isTapped ? '2px' : undefined,
              left: '2px',
              top: isTapped ? '2px' : undefined,
              transform: isTapped ? 'rotate(90deg)' : undefined,
          }}>{card.counters}</div>
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

  .card-dogear {
    position: absolute;
    top: 0;
    left: 0;
    width: 0;
    height: 0;
    border-top: 15px solid orange;
    border-right: 15px solid transparent;
    z-index: 2;
    pointer-events: none;
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
    background: black;
    color: white;
    border-radius: 5%;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
  }
`;
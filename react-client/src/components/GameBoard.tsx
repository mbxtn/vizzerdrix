import React, { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverEvent,
} from '@dnd-kit/core';
import { Hand, handStyles } from './Hand';
import { Battlefield, battlefieldStyles } from './Battlefield';
import { Card, cardStyles } from './Card';
import type { Card as CardType, Player } from '@vizzerdrix/shared';
import { Zone } from '@vizzerdrix/shared';

interface GameBoardProps {
  localPlayer: Player;
  onPlayerUpdate: (player: Player) => void;
}

export function GameBoard({ localPlayer, onPlayerUpdate }: GameBoardProps) {
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    })
  );

  // Get cards by zone
  const allCards = Object.values(localPlayer.cards);
  const handCards = allCards.filter(card => card.zone === Zone.hand);
  const battlefieldCards = allCards.filter(card => card.zone === Zone.battlefield);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = active.data.current?.card as CardType;
    setActiveCard(card);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Optional: Add visual feedback during drag
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const card = active.data.current?.card as CardType;
    const targetZone = over.data.current?.type;

    if (!card || !targetZone) return;

    // Update the card directly in the player's cards
    const updatedCard = { ...localPlayer.cards[card.id] };
    if (!updatedCard) return;

    // Handle zone transitions
    if (targetZone === 'battlefield' && card.zone !== Zone.battlefield) {
      updatedCard.zone = Zone.battlefield;
      // Position card where dropped on battlefield
      const delta = event.delta;
      updatedCard.location = {
        x: Math.max(0, (event.activatorEvent as PointerEvent).clientX - 31.5 + delta.x),
        y: Math.max(0, (event.activatorEvent as PointerEvent).clientY - 44 + delta.y),
      };
    } else if (targetZone === 'hand' && card.zone !== Zone.hand) {
      updatedCard.zone = Zone.hand;
      updatedCard.location = { x: 0, y: 0 }; // Reset position for hand
    } else if (targetZone === 'battlefield' && card.zone === Zone.battlefield) {
      // Moving within battlefield - update position
      const delta = event.delta;
      updatedCard.location = {
        x: Math.max(0, updatedCard.location.x + delta.x),
        y: Math.max(0, updatedCard.location.y + delta.y),
      };
    }

    // Update the card in the player's cards dictionary
    localPlayer.cards[card.id] = updatedCard;
    onPlayerUpdate(localPlayer);
  };

  const handleCardClick = (card: CardType) => {
    console.log('Card clicked:', card.cardName);
  };

  const handleCardDoubleClick = (card: CardType) => {
    // Double-click to tap/untap
    const updatedCard = { ...localPlayer.cards[card.id] };
    
    if (updatedCard) {
      updatedCard.tapped = !updatedCard.tapped;
      localPlayer.cards[card.id] = updatedCard;
      onPlayerUpdate(localPlayer);
    }
  };

  return (
    <>
      <style>{cardStyles + handStyles + battlefieldStyles + gameBoardStyles}</style>
      
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="game-board">
          <Battlefield
            cards={battlefieldCards}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
          />
          
          <Hand
            cards={handCards}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
          />
        </div>

        <DragOverlay>
          {activeCard ? (
            <Card card={activeCard} isDragging />
          ) : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}

const gameBoardStyles = `
  .game-board {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1a1a1a;
    color: white;
    font-family: Arial, sans-serif;
  }
`;
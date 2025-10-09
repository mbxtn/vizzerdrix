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
import { defaultUIConfig, generateCSSVariables, UIConfig } from '../config/ui';
import { Battlefield, battlefieldStyles } from './Battlefield';
import { Zone, zoneStyles } from './Zone';
import { Card, cardStyles } from './Card';
import { Settings, settingsStyles } from './Settings';
import type { Card as CardType, Player } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';

interface GameBoardProps {
  localPlayer: Player;
  onPlayerUpdate: (player: Player) => void;
}

export function GameBoard({ localPlayer, onPlayerUpdate }: GameBoardProps) {
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [uiConfig, setUIConfig] = useState<UIConfig>(defaultUIConfig);
  const [showSettings, setShowSettings] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Prevent accidental drags
      },
    })
  );

  // Get cards by zone
  const allCards = Object.values(localPlayer.cards);
  const handCards = allCards.filter(card => card.zone === ZoneEnum.hand);
  const battlefieldCards = allCards.filter(card => card.zone === ZoneEnum.battlefield);
  const commandCards = allCards.filter(card => card.zone === ZoneEnum.command);
  const libraryCards = allCards.filter(card => card.zone === ZoneEnum.library);
  const graveyardCards = allCards.filter(card => card.zone === ZoneEnum.graveyard);
  const exileCards = allCards.filter(card => card.zone === ZoneEnum.exile);

  // Debug logging
  console.log('GameBoard - Total cards:', allCards.length);
  console.log('GameBoard - Hand cards:', handCards.length, handCards);
  console.log('GameBoard - Battlefield cards:', battlefieldCards.length, battlefieldCards);
  console.log('GameBoard - All cards with zones:', allCards.map(c => ({ cardName: c.cardName, zone: c.zone })));

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
    if (targetZone === 'battlefield' && card.zone !== ZoneEnum.battlefield) {
      updatedCard.zone = ZoneEnum.battlefield;
      // Position card where dropped on battlefield
      const delta = event.delta;
      updatedCard.location = {
        x: Math.max(0, (event.activatorEvent as PointerEvent).clientX - 31.5 + delta.x),
        y: Math.max(0, (event.activatorEvent as PointerEvent).clientY - 44 + delta.y),
      };
    } else if (targetZone === 'hand' && card.zone !== ZoneEnum.hand) {
      updatedCard.zone = ZoneEnum.hand;
      updatedCard.location = { x: 0, y: 0 }; // Reset position for hand
    } else if (targetZone === 'command' && card.zone !== ZoneEnum.command) {
      updatedCard.zone = ZoneEnum.command;
      updatedCard.location = { x: 0, y: 0 }; // Reset position for command
    } else if (targetZone === 'library' && card.zone !== ZoneEnum.library) {
      updatedCard.zone = ZoneEnum.library;
      updatedCard.location = { x: 0, y: 0 }; // Reset position for library
    } else if (targetZone === 'graveyard' && card.zone !== ZoneEnum.graveyard) {
      updatedCard.zone = ZoneEnum.graveyard;
      updatedCard.location = { x: 0, y: 0 }; // Reset position for graveyard
    } else if (targetZone === 'exile' && card.zone !== ZoneEnum.exile) {
      updatedCard.zone = ZoneEnum.exile;
      updatedCard.location = { x: 0, y: 0 }; // Reset position for exile
    } else if (targetZone === 'battlefield' && card.zone === ZoneEnum.battlefield) {
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
      <style>{generateCSSVariables(uiConfig) + cardStyles + battlefieldStyles + zoneStyles + settingsStyles + gameBoardStyles}</style>
      
      <button 
        className="settings-button" 
        onClick={() => setShowSettings(true)}
        title="UI Settings"
      >
        ⚙️
      </button>
      
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="game-board">
          <Battlefield
            cards={battlefieldCards}
            activeCardId={activeCard?.id}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
          />
          
          <div className="bottom-zones">
            <Zone
              zoneName="Command"
              zoneId="command"
              cards={commandCards}
              activeCardId={activeCard?.id}
              displayMode="all-cards"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
            />
            
            <Zone
              zoneName="Hand"
              zoneId="hand"
              cards={handCards}
              activeCardId={activeCard?.id}
              displayMode="all-cards"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
            />
            
            <Zone
              zoneName="Library"
              zoneId="library"
              cards={libraryCards}
              activeCardId={activeCard?.id}
              displayMode="stack"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
            />
            
            <Zone
              zoneName="Graveyard"
              zoneId="graveyard"
              cards={graveyardCards}
              activeCardId={activeCard?.id}
              displayMode="top-card"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
            />
            
            <Zone
              zoneName="Exile"
              zoneId="exile"
              cards={exileCards}
              activeCardId={activeCard?.id}
              displayMode="top-card"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
            />
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <Card card={activeCard} />
          ) : null}
        </DragOverlay>
      </DndContext>
      
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={uiConfig}
        onConfigChange={setUIConfig}
      />
    </>
  );
}

const gameBoardStyles = `
  html, body {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }
  
  .settings-button {
    position: fixed;
    top: 10px;
    left: 10px;
    background: rgba(0, 0, 0, 0.8);
    border: 1px solid #444;
    color: white;
    padding: 8px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    z-index: 100;
    transition: background-color 0.2s ease;
  }

  .settings-button:hover {
    background: rgba(0, 0, 0, 0.9);
    border-color: #666;
  }
  
  .game-board {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #1a1a1a;
    color: white;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .bottom-zones {
    display: flex;
    height: var(--zone-height, 150px);
    flex-shrink: 0;
    gap: 4px;
    padding: 4px;
    overflow: visible;
  }

  .bottom-zones > .zone {
    width: calc(var(--card-width, 63px) + 6px);
    flex-shrink: 0;
  }

  .bottom-zones > .zone.hand {
    flex: 1;
    width: auto;
  }
`;
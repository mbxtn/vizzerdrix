import React, { useEffect, useState, useRef } from 'react';
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
import { Card as CardType, Player, Game } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';

interface GameBoardProps {
  game: Game;
  localPlayer: Player;
  onPlayerUpdate: (player: Player) => void;
}


export const KeyNames = {
  Shift: 'Shift',
  Control: 'Control',
  Alt: 'Alt',
  Meta: 'Meta',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  // ...add more as needed
} as const;

export function GameBoard({ game, localPlayer, onPlayerUpdate }: GameBoardProps) {
  // Helper to check if a card is selected
  const isCardSelected = (cardId: string) => localPlayer.selectedCards.includes(cardId);
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

  // Map of what keys are pressed.
  const isKeyDown = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      isKeyDown.current.set(e.key, true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      isKeyDown.current.set(e.key, false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return (() => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    })
  });


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
    const originalCard = localPlayer.cards[card.id];
    if (!originalCard) return;

    // Untap first, then change zone and location
    if (targetZone === 'hand' && card.zone !== ZoneEnum.hand) {
      originalCard.tapped = false;
      originalCard.zone = ZoneEnum.hand;
      originalCard.location = { x: 0, y: 0 };
      delete originalCard.zIndex;
    } else if (targetZone === 'command' && card.zone !== ZoneEnum.command) {
      originalCard.tapped = false;
      originalCard.zone = ZoneEnum.command;
      originalCard.location = { x: 0, y: 0 };
      delete originalCard.zIndex;
    } else if (targetZone === 'library' && card.zone !== ZoneEnum.library) {
      originalCard.tapped = false;
      originalCard.zone = ZoneEnum.library;
      originalCard.location = { x: 0, y: 0 };
      delete originalCard.zIndex;
    } else if (targetZone === 'graveyard' && card.zone !== ZoneEnum.graveyard) {
      originalCard.tapped = false;
      originalCard.zone = ZoneEnum.graveyard;
      originalCard.location = { x: 0, y: 0 };
      delete originalCard.zIndex;
    } else if (targetZone === 'exile' && card.zone !== ZoneEnum.exile) {
      originalCard.tapped = false;
      originalCard.zone = ZoneEnum.exile;
      originalCard.location = { x: 0, y: 0 };
      delete originalCard.zIndex;
    } else if (targetZone === 'battlefield') {
      const delta = event.delta;

      console.log(`original location x:${originalCard.location.x} y:${originalCard.location.y}, new location x:${Math.max(0, originalCard.location.x + delta.x)}, y:${Math.max(0, originalCard.location.y + delta.y)}`)
      if (originalCard.zone != ZoneEnum.battlefield) {
        // If we did a lot of math I could probably get this correctly translated rather than a liiitle off.
        const pointer = event.active.rect.current.translated
        originalCard.location = {
          x: Math.max(0, pointer!!.left),
          y: Math.max(0, pointer!!.top),
        }
      } else {
        originalCard.location = {
          x: Math.max(0, originalCard.location.x + delta.x),
          y: Math.max(0, originalCard.location.y + delta.y),
        }
      }

      originalCard.zone = ZoneEnum.battlefield;
      // Set zIndex to max + 1
      const allBattlefieldCards = Object.values(localPlayer.cards).filter(c => c.zone === ZoneEnum.battlefield && c.id !== card.id);
      const maxZ = allBattlefieldCards.length > 0 ? Math.max(...allBattlefieldCards.map(c => c.zIndex || 0)) : 0;
      originalCard.zIndex = maxZ + 1;
    }

    onPlayerUpdate(localPlayer);
  };

  const handleCardClick = (card: CardType) => {
    // Toggle selection for the clicked card
    const indx = localPlayer.selectedCards.indexOf(card.id)
    if (indx > -1) {
      if(localPlayer.selectedCards.length > 1 && !isKeyDown.current.get(KeyNames.Shift)) {
        localPlayer.selectedCards = [card.id]
      } else {
        localPlayer.selectedCards.splice(indx, 1)
      }
      
    } else {
      if (isKeyDown.current.get(KeyNames.Shift)) {
        // If we have shift pressed, add to the selected cards
        localPlayer.selectedCards.push(card.id)
      } else {
        // If no hotkey is pressed set to only selected cards
        localPlayer.selectedCards = [card.id]
      }
    }
    onPlayerUpdate(localPlayer);
  };

  const handleCardDoubleClick = (card: CardType) => {
    // Double-click to tap/untap
    const updatedCard = { ...localPlayer.cards[card.id] };
    if (updatedCard) {
      updatedCard.tapped = !updatedCard.tapped;
      if(!localPlayer.selectedCards.includes(card.id)){
        if(isKeyDown.current.get(KeyNames.Shift)) {
          localPlayer.selectedCards.push(updatedCard.id);
        } else {
          localPlayer.selectedCards = [updatedCard.id];
        }
      } 
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
            player={localPlayer}
            activeCardId={activeCard?.id}
            onCardClick={handleCardClick}
            onCardDoubleClick={handleCardDoubleClick}
            isCardSelected={isCardSelected}
          />

          <div className="bottom-zones">
            {/* Calculate max width for hand zone based on card width and window width */}
            <Zone
              zoneName="Hand"
              zoneId="hand"
              cards={handCards}
              activeCardId={activeCard?.id}
              displayMode="all-cards"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
              isCardSelected={isCardSelected}
              style={{
                maxWidth: `calc(100vw - 4 * (var(--card-width, 63px) + 6px) - 32px)`,
                minWidth: 0,
                flex: '1 1 0',
                overflow: 'hidden',
              }}
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
            <Zone
              zoneName="Command"
              zoneId="command"
              cards={commandCards}
              activeCardId={activeCard?.id}
              displayMode="top-card"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
            />
          </div>
        </div>

        <DragOverlay>
          {activeCard ? (
            <Card
              card={activeCard}
              isDragging={true}
              position={undefined}
              onClick={undefined}
              onDoubleClick={undefined}
              style={{ zIndex: 10000, opacity: 1 }}
            />
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
  flex: 1 1 0;
  min-width: 0;
  max-width: 50vw;
  overflow: hidden;
  }
`;
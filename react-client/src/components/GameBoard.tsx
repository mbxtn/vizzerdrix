import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ContextMenu } from './ContextMenu';
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
import { GetCardFace } from '../lib/scryfallUtils';
import { Battlefield, battlefieldStyles } from './Battlefield';
import { Zone, zoneStyles } from './Zone';
import { Card, cardStyles } from './Card';
import { Settings, settingsStyles } from './Settings';
import { Card as CardType, Player, Game, CardFactory } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';
import { ScryfallCache } from '../lib/scryfallCache';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PowerOffIcon from '@mui/icons-material/PowerOff';
import StyleIcon from '@mui/icons-material/Style';

interface GameBoardProps {
  game: Game;
  localPlayer: Player;
  onPlayerUpdate: (player: Player) => void;
  cardFactory: CardFactory | null;
}

export const KeyNames = {
  Shift: 'Shift',
  Control: 'Control',
  Alt: 'Alt',
  Meta: 'Meta',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  Escape: 'Escape',
  f: "f",
  F: "F",
  Space: " ",
  x: "x",
  X: "X",
  // ...add more as needed
} as const;

export function GameBoard({ game, localPlayer, onPlayerUpdate, cardFactory }: GameBoardProps) {
  // State for counter input dialog
  const [showCounterInput, setShowCounterInput] = useState(false);
  const [counterInputValue, setCounterInputValue] = useState(0);
  const [counterTargetCardId, setCounterTargetCardId] = useState<string | null>(null);

  // Handler to open counter input dialog
  const openCounterInput = (cardId: string) => {
    setCounterTargetCardId(cardId);
    setCounterInputValue(localPlayer.cards[cardId]?.counters ?? 0);
    setShowCounterInput(true);
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX - 5, y: e.clientY - 5 });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
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
  const pointerPositionRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const [currentTarget, setCurrentTarget] = useState<{ type: string, id: string } | null>(null);


  // Function to get the current target(s)
  const getTarget = (position = pointerPositionRef.current): string[] => {
    // If there are cards selected, just use those
    if (localPlayer.selectedCards.length > 0) return localPlayer.selectedCards;
    let mouseTarget = getPointerTarget(position)
    if (mouseTarget && mouseTarget.type === "card") {
      if (localPlayer.cards[mouseTarget.id]) {
        return [localPlayer.cards[mouseTarget.id].id]
      }
    }
    return [];
  }


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      isKeyDown.current.set(e.key, true)
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      isKeyDown.current.set(e.key, false)
      // Some basic hot key actions.
      switch (e.key) {
        case KeyNames.Escape:
          // Clear card selection if they press escape.
          localPlayer.selectedCards = [];
          onPlayerUpdate(localPlayer);
          break;
        case KeyNames.F:
        case KeyNames.f:
          // try tp flip the current hovered card or 
          let fliptargets = getTarget();
          let toFlip: boolean | null = null;
          fliptargets.forEach((target: string) => {
            if (localPlayer.cards[target]) {
              // We shouldn't flip cards that can't be flipped
              if (localPlayer.cards[target].zone !== ZoneEnum.battlefield) {
                let cardData = ScryfallCache.getInstance().getById(localPlayer.cards[target].scryfallId);
                if (!cardData || !("card_faces" in cardData)) return;
              }
              if (toFlip === null) {
                toFlip = !localPlayer.cards[target].flipped;
              }
              localPlayer.cards[target].flipped = toFlip;
            }
          })
          onPlayerUpdate(localPlayer);
          break;
        case KeyNames.Space:
          let taptargets = getTarget();
          let toTap: boolean | null = null;
          taptargets.forEach((target: string) => {
            if (localPlayer.cards[target]) {
              if (toTap === null) {
                toTap = !localPlayer.cards[target].tapped
              }
              localPlayer.cards[target].tapped = toTap;
            }
          })
          onPlayerUpdate(localPlayer);
          break;
        case KeyNames.X:
        case KeyNames.x:
          let copyTargets = getTarget();
          copyTargets.forEach((target: string) => {
            let playerCard = localPlayer.cards[target];
            if (playerCard) {
              if (!cardFactory) return;
              let newCard = cardFactory.createCardsFromIds([playerCard.scryfallId])[0];
              newCard.isTemporary = true;
              newCard.zone = ZoneEnum.battlefield;
              newCard.location = { x: 50, y: 50 };
              localPlayer.cards[newCard.id] = newCard;
            }
          })
          onPlayerUpdate(localPlayer);
          break;
        default:
          console.log(e.key)
          break;
      }
      if (e.key == KeyNames.Escape) {

      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return (() => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    })
  });

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      pointerPositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handlePointerMove);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
    };
  }, []);

  const [hoveredZone, setHoveredZone] = useState<ZoneEnum | null>(null);

  // Get cards by zone, sorted by location.x for non-battlefield zones
  const allCards = Object.values(localPlayer.cards);
  const handCards = allCards.filter(card => card.zone === ZoneEnum.hand);
  const battlefieldCards = allCards.filter(card => card.zone === ZoneEnum.battlefield);
  const commandCards = allCards.filter(card => card.zone === ZoneEnum.command).sort((a, b) => a.location.x - b.location.x);
  const libraryCards = allCards.filter(card => card.zone === ZoneEnum.library).sort((a, b) => a.location.x - b.location.x);
  const graveyardCards = allCards.filter(card => card.zone === ZoneEnum.graveyard).sort((a, b) => a.location.x - b.location.x);
  const exileCards = allCards.filter(card => card.zone === ZoneEnum.exile).sort((a, b) => a.location.x - b.location.x);

  // Debug logging
  // console.log('GameBoard - Total cards:', allCards.length);
  // console.log('GameBoard - Hand cards:', handCards.length, handCards, localPlayer.handOrder);
  // console.log('GameBoard - Library cards:', libraryCards.length, libraryCards, localPlayer.libraryOrder);
  // console.log('GameBoard - Battlefield cards:', battlefieldCards.length, battlefieldCards);
  // console.log('GameBoard - All cards with zones:', allCards.map(c => ({ cardName: c.cardName, zone: c.zone })));

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const card = active.data.current?.card as CardType;
    setActiveCard(card);
    if (card && !localPlayer.selectedCards.includes(card.id)) {
      localPlayer.selectedCards = [card.id];
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const zone = event.over?.data.current?.type as ZoneEnum | undefined;
    setHoveredZone(zone ?? null);
  };

  const removeFromOrder = (card: CardType) => {
    console.log(`removing from zone ${card.zone}`)
    let zone = card.zone;
    let id = card.id;
    let orderIndex = -1;
    switch (zone) {
      case ZoneEnum.hand:
        orderIndex = localPlayer.handOrder.indexOf(id);
        if (orderIndex > -1) {
          localPlayer.handOrder.splice(orderIndex, 1);
        }
        break;
      case ZoneEnum.command:
        orderIndex = localPlayer.commandOrder.indexOf(id);
        if (orderIndex > -1) {
          localPlayer.commandOrder.splice(orderIndex, 1);
        }
        break;
      case ZoneEnum.exile:
        orderIndex = localPlayer.exileOrder.indexOf(id);
        if (orderIndex > -1) {
          localPlayer.exileOrder.splice(orderIndex, 1);
        }
        break;
      case ZoneEnum.graveyard:
        orderIndex = localPlayer.graveyardOrder.indexOf(id);
        if (orderIndex > -1) {
          localPlayer.graveyardOrder.splice(orderIndex, 1);
        }
        break;
      case ZoneEnum.library:
        orderIndex = localPlayer.libraryOrder.indexOf(id);
        if (orderIndex > -1) {
          localPlayer.libraryOrder.splice(orderIndex, 1);
        }
        break;
      default:
        break;
    }
  }

  const addToOrder = (card: CardType, index = -1) => {
    console.log(`adding to zone ${card.zone}`)
    let zone = card.zone;
    let id = card.id;
    switch (zone) {
      case ZoneEnum.hand:
        if (index > -1) {
          localPlayer.handOrder.splice(index, 0, id);
        } else {
          localPlayer.handOrder.push(id)
        }
        break;
      case ZoneEnum.command:
        if (index > -1) {
          localPlayer.commandOrder.splice(index, 0, id);
        } else {
          localPlayer.commandOrder.push(id);
        }
        break;
      case ZoneEnum.exile:
        if (index > -1) {
          localPlayer.exileOrder.splice(index, 0, id);
        } else {
          localPlayer.exileOrder.push(id);
        }
        break;
      case ZoneEnum.graveyard:
        if (index > -1) {
          localPlayer.graveyardOrder.splice(index, 0, id);
        } else {
          localPlayer.graveyardOrder.push(id);
        }
        break;
      case ZoneEnum.library:
        if (index > -1) {
          localPlayer.libraryOrder.splice(index, 0, id);
        } else {
          localPlayer.libraryOrder.push(id);
        }
        break;
      default:
        break;
    }
  }

  const getPointerTarget = (pointer: { x: number; y: number }): { type: string, id: string } | null => {
    // Check for card under pointer
    const cardElements = document.querySelectorAll<HTMLElement>('.card');
    let found: { type: string, id: string } | null = null;
    cardElements.forEach((cardEl: HTMLElement) => {
      const rect = cardEl.getBoundingClientRect();
      if (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        found = { type: 'card', id: cardEl.id.replace("card-", "") };
      }
    });

    if (found) return found;

    // Check for zone under pointer
    const zoneElements = document.querySelectorAll<HTMLElement>('.zone');
    zoneElements.forEach((zoneEl: HTMLElement) => {
      const rect = zoneEl.getBoundingClientRect();
      if (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        found = { type: 'zone', id: zoneEl.id };
      }
    });

    const battleFieldEl = document.querySelector<HTMLElement>('.battlefield');
    if (battleFieldEl) {
      const rect = battleFieldEl.getBoundingClientRect();
      if (
        pointer.x >= rect.left &&
        pointer.x <= rect.right &&
        pointer.y >= rect.top &&
        pointer.y <= rect.bottom
      ) {
        found = { type: 'battlefield', id: "battlefield" };
      }
    }
    return found; // Not over any card or zone
  }

  useEffect(() => {
    const handlePointerMove = (e: MouseEvent) => {
      pointerPositionRef.current = { x: e.clientX, y: e.clientY };
      setCurrentTarget(getPointerTarget(pointerPositionRef.current));
    };
    window.addEventListener('mousemove', handlePointerMove);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
    };
  }, []);

  const getHandDropIndex = (pointerX: number, handCardIds: string[]) => {
    // Each card in the hand should have an element with a predictable id or class, e.g. `hand-card-${cardId}`
    for (let i = 0; i < handCardIds.length; i++) {
      const cardId = handCardIds[i];
      const el = document.getElementById(`card-${cardId}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        if (pointerX < centerX) {
          return i;
        }
      }
    }
    // If pointer is past all cards, insert at the end
    return handCardIds.length;
  }

  const moveCard = (targetZone: ZoneEnum, ids: string[], event: DragEndEvent) => {
    if (ids.length == 0) return;
    const baseCard = localPlayer.cards[ids[0]];
    // Cascade positions from the dragged card
    const baseDelta = event.delta;
    let baseLocation;
    if (baseCard.zone !== ZoneEnum.battlefield) {
      const pointer = event.active.rect.current.translated;
      baseLocation = {
        x: Math.max(0, pointer!!.left),
        y: Math.max(0, pointer!!.top),
      };
    } else {
      baseLocation = {
        x: Math.max(0, baseCard.location.x + baseDelta.x),
        y: Math.max(0, baseCard.location.y + baseDelta.y),
      };
    }
    ids.forEach((id: string, index: number) => {
      const card = localPlayer.cards[id]
      if (!card) return;
      removeFromOrder(card)
      // Card is changing zones, do stuff
      switch (targetZone) {
        case ZoneEnum.hand: {
          if (card.isTemporary) {
            delete localPlayer.cards[id];
            break;
          }
          card.tapped = false;
          card.flipped = false;
          card.counters = 0;
          card.zone = targetZone;
          // Determine drop index in hand
          let dropIndex = 0;
          dropIndex = getHandDropIndex(pointerPositionRef.current.x, localPlayer.handOrder)
          addToOrder(card, dropIndex);
          card.location = { x: 0, y: 0 };
          delete card.zIndex;
          break;
        }
        case ZoneEnum.command:
        case ZoneEnum.exile:
        case ZoneEnum.graveyard:
        case ZoneEnum.library: {
          localPlayer.selectedCards = [];
          if (card.isTemporary) {
            delete localPlayer.cards[id];
            break;
          }
          card.counters = 0;
          card.tapped = false;
          card.flipped = false;
          card.zone = targetZone;
          // Find next available index for location.x in the target zone
          addToOrder(card)
          card.location = { x: 0, y: 0 };
          delete card.zIndex;
          break;
        }
        case ZoneEnum.battlefield: {
          const delta = event.delta;
          card.zone = ZoneEnum.battlefield;
          card.location = {
            x: baseLocation.x,
            y: baseLocation.y + index * 20,
          };
          // Set zIndex to max + 1
          const allBattlefieldCards = Object.values(localPlayer.cards).filter(c => c.zone === ZoneEnum.battlefield && c.id !== card.id);
          const maxZ = allBattlefieldCards.length > 0 ? Math.max(...allBattlefieldCards.map(c => c.zIndex || 0)) : 0;
          card.zIndex = maxZ + 1;
          break;
        }
        default:
          break;
      }
    });
  }
  const handleZoneClick = () => {
    if (isKeyDown.current.get(KeyNames.Shift)) return;
    localPlayer.selectedCards = [];
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const card = active.data.current?.card as CardType;
    const targetZone = over.data.current?.type as ZoneEnum;
    if (!card || !targetZone) return;

    // If the dragged card is selected, move all selected cards
    let selectedIds = localPlayer.selectedCards.includes(card.id)
      ? localPlayer.selectedCards
      : [card.id];

    // Ensure dragged card is first in the list
    selectedIds = [card.id, ...selectedIds.filter(id => id !== card.id)];
    console.log("moving a card")
    moveCard(targetZone, selectedIds, event);
    onPlayerUpdate(localPlayer)
    setActiveCard(null);

  };

  const handleCardClick = (card: CardType) => {
    switch (card.zone) {
      case ZoneEnum.battlefield:
      case ZoneEnum.hand:
        // Toggle selection for the clicked card
        const indx = localPlayer.selectedCards.indexOf(card.id)
        if (indx > -1) {
          if (localPlayer.selectedCards.length > 1 && !isKeyDown.current.get(KeyNames.Shift)) {
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
        break;
      case ZoneEnum.library:
        card.zone = ZoneEnum.hand;
        addToOrder(card);
        break;  
      default:
        console.log("Clicked in a zone we don't care about for now")
        return;
    }
    onPlayerUpdate(localPlayer);
  };

  const setTapped = (ids: string[], tapped = true) => {
    ids.forEach((id: string) => {
      localPlayer.cards[id].tapped = tapped
    })
  }

  const handleCardDoubleClick = (card: CardType) => {
    // Double-click to tap/unt p
    if (localPlayer.cards[card.id]) {
      if (!localPlayer.selectedCards.includes(card.id)) {
        if (isKeyDown.current.get(KeyNames.Shift)) {
          localPlayer.selectedCards.push(card.id);
        } else {
          localPlayer.selectedCards = [card.id];
        }
      }
      switch (card.zone) {
        case ZoneEnum.battlefield:
          setTapped(localPlayer.selectedCards, !card.tapped);
          break;
        default:
          break;
      }
      onPlayerUpdate(localPlayer);
    }
  };

  const handleCardCounterClick = (card: CardType) => {
    if (isKeyDown.current.get(KeyNames.Shift) || isKeyDown.current.get(KeyNames.Control))
      card.counters--;
    else
      card.counters++;
    onPlayerUpdate(localPlayer);
  }

  const handleCardsSelected = (cards: string[]) => {
    console.log("selecting " + cards.length + " cards")
    if (cards.length == 0 && localPlayer.selectedCards.length == 0) return;
    if (isKeyDown.current.get(KeyNames.Shift)) {
      // Union of current selection and new cards, unique only
      const union = Array.from(new Set([...localPlayer.selectedCards, ...cards]));
      localPlayer.selectedCards = union;
    } else {
      localPlayer.selectedCards = cards;
    }
    onPlayerUpdate(localPlayer);
  }

  const createCard = (name: string) => {
    console.log(`creating card ${name}`);
    if (!cardFactory) {
      console.log("GameBoard - Couldn't create card, no cardfactory");
      return;
    }
    let newCard = cardFactory.createCardsFromNames([name])[0];

    newCard.isTemporary = true;
    newCard.zone = ZoneEnum.battlefield;
    newCard.location = { x: 50, y: 50 };
    localPlayer.cards[newCard.id] = newCard;
    console.log("adding card to game");
    onPlayerUpdate(localPlayer);

  }
  // --- Player Tabs ---
  const allPlayers: Player[] = Object.values(game.players || {});
  // --- Player selection state ---
  const [selectedPlayerId, setSelectedPlayerId] = useState(localPlayer.id);
  const selectedPlayer = allPlayers.find(p => p.id === selectedPlayerId) || localPlayer;
  const isLocalPlayer = selectedPlayer.id === localPlayer.id;

  // Get cards by zone for selected player, but always use localPlayer.cards if viewing self
  const selectedAllCards = isLocalPlayer
    ? Object.values(localPlayer.cards) as CardType[]
    : Object.values(selectedPlayer.cards) as CardType[];
  const selectedBattlefieldCards = selectedAllCards.filter((card: CardType) => card.zone === ZoneEnum.battlefield);

  // --- Render ---
  return (
    <>
      <style>{generateCSSVariables(uiConfig) + cardStyles + battlefieldStyles + zoneStyles + settingsStyles + gameBoardStyles}</style>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="game-board"
          onClick={() => {
            localPlayer.selectedCards = [];
            onPlayerUpdate(localPlayer);
          }}
          onContextMenu={handleContextMenu}
          style={{ position: 'relative' }}
        >
          <Battlefield
            cards={selectedBattlefieldCards}
            player={selectedPlayer}
            activeCardId={activeCard?.id}
            onCardClick={isLocalPlayer ? handleCardClick : undefined}
            onCardDoubleClick={isLocalPlayer ? handleCardDoubleClick : undefined}
            onCardCounterClick={isLocalPlayer ? handleCardCounterClick : undefined}
            isCardSelected={isLocalPlayer ? isCardSelected : undefined}
            isDragging={isLocalPlayer ? !!activeCard : false}
            isLocalPlayer={isLocalPlayer}
            cardsSelected={handleCardsSelected}
          />
          <div className="gameboard-header" style={{ display: 'flex', alignItems: 'center', color: 'white', padding: '0px 4px', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>{game.roomName || 'Game Room'}</h3>
              {/* Player Tabs */}
              <div style={{ display: 'flex', gap: 4, marginLeft: 16 }}>
                {allPlayers.map((player) => (
                  <button
                    key={player.id || player.name}
                    style={{
                      padding: '4px 12px',
                      borderRadius: 4,
                      border: 'none',
                      background: '#333',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: player.id === selectedPlayerId ? 1 : 0.7,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      borderBottom: player.id === selectedPlayerId ? '2px solid #ff9800' : 'none',
                    }}
                    onClick={() => setSelectedPlayerId(player.id)}
                  >
                    {player.name}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
                      <FavoriteIcon style={{ fontSize: 16, color: '#ff1744' }} />
                      <span style={{ fontWeight: 'bold', fontSize: 14 }}>{player.lifeTotal ?? 40}</span>
                      <StyleIcon style={{ fontSize: 16, color: '#00bcd4', marginLeft: 8 }} />
                      <span style={{ fontWeight: 'bold', fontSize: 14 }}>{(Object.values(player.cards) as CardType[]).filter(card => card.zone === ZoneEnum.hand).length}</span>
                    </span>
                    {!player.isActive && (
                      <PowerSettingsNewIcon style={{ fontSize: 18, color: '#ff9800', marginLeft: 4 }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <button
              className="settings-button"
              onClick={() => setShowSettings(true)}
              title="UI Settings"
            >
              ⚙️
            </button>
          </div>
          <div className="bottom-zones">
            {/* Calculate max width for hand zone based on card width and window width */}
            <Zone
              zoneName="Hand"
              zoneId="hand"
              zoneType={ZoneEnum.hand}
              cards={handCards}
              activeCardId={activeCard?.id}
              displayMode="all-cards"
              order={localPlayer.handOrder}
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
              onZoneClick={handleZoneClick}
              isCardSelected={isCardSelected}
              isDragging={!!activeCard}
              style={{
                maxWidth: `calc(100vw - 4 * (var(--card-width, 63px) + 6px) - 32px)`,
                minWidth: 0,
                flex: '1 1 0',
                overflow: 'hidden',
              }}
              isLocal={true}
            />
            <Zone
              zoneName="Library"
              zoneId="library"
              zoneType={ZoneEnum.library}
              cards={libraryCards}
              order={localPlayer.libraryOrder}
              activeCardId={activeCard?.id}
              displayMode="stack"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
              onZoneClick={handleZoneClick}
              isLocal={selectedPlayer.id === localPlayer.id}

            />
            <Zone
              zoneName="Graveyard"
              zoneId="graveyard"
              zoneType={ZoneEnum.graveyard}
              cards={graveyardCards}
              order={localPlayer.graveyardOrder}
              activeCardId={activeCard?.id}
              displayMode="top-card"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
              onZoneClick={handleZoneClick}
              isLocal={selectedPlayer.id === localPlayer.id}
            />
            <Zone
              zoneName="Exile"
              zoneId="exile"
              zoneType={ZoneEnum.exile}
              cards={exileCards}
              order={localPlayer.exileOrder}
              activeCardId={activeCard?.id}
              displayMode="top-card"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
              onZoneClick={handleZoneClick}
              isLocal={selectedPlayer.id === localPlayer.id}

            />
            <Zone
              zoneName="Cmd"
              zoneId="command"
              zoneType={ZoneEnum.command}
              cards={commandCards}
              order={localPlayer.commandOrder}
              activeCardId={activeCard?.id}
              displayMode="top-card"
              onCardClick={handleCardClick}
              onCardDoubleClick={handleCardDoubleClick}
              onZoneClick={handleZoneClick}
              isLocal={selectedPlayer.id === localPlayer.id}

            />
          </div>

          {/* Context Menu Component */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onClose={handleCloseContextMenu}
              localPlayer={localPlayer}
              onPlayerUpdate={onPlayerUpdate}
              cardFactory={cardFactory}
              game={game}
              selectedCardIds={getTarget(contextMenu)}
              contextTarget={getPointerTarget(contextMenu)}
              onCreatePlaceholderCard={createCard}
            />
          )}
        </div>

        <DragOverlay>
          {activeCard ? (
            // Show all selected cards, cascading from the dragged card
            [activeCard.id, ...localPlayer.selectedCards.filter(id => id !== activeCard.id)].map((id, idx) => {
              const card = localPlayer.cards[id];
              if (!card) return null;
              return (
                <Card
                  key={card.id}
                  card={{
                    ...card,
                    tapped: hoveredZone && [ZoneEnum.hand, ZoneEnum.command, ZoneEnum.exile, ZoneEnum.graveyard, ZoneEnum.library].includes(hoveredZone)
                      ? false
                      : card.tapped
                  }}
                  isDragging={true}
                  position={{ x: 0, y: idx * 20 }}
                  isLocal={true}
                />
              );
            })
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Card Magnifier Preview */}
      {uiConfig.card.magnifyOnHover && currentTarget && currentTarget.type == "card" && localPlayer.cards[currentTarget.id] && localPlayer.cards[currentTarget.id].scryfallId != '' && (() => {
        // Don't show magnifier if the hovered card is under the magnifier area
        const hoverCard = localPlayer.cards[currentTarget.id];
        const scryfallCard = ScryfallCache.getInstance().getById(hoverCard.scryfallId);
        const imgSrc = scryfallCard ? GetCardFace(scryfallCard, hoverCard.flipped) : '';
        // Magnifier area
        const magnifierTop = 16;
        const magnifierRight = 16;
        const magnifierWidth = uiConfig.card.magnifyWidth;
        const magnifierHeight = Math.round(uiConfig.card.magnifyWidth / uiConfig.card.aspectRatio);
        // Get card element position
        const cardEl = document.getElementById(`card-${hoverCard.id}`);
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect();
          const windowWidth = window.innerWidth;
          // Magnifier left/top
          const magnifierLeft = windowWidth - magnifierRight - magnifierWidth;
          const magnifierBottom = magnifierTop + magnifierHeight;
          // If card overlaps magnifier area, don't show
          if (
            rect.right > magnifierLeft &&
            rect.left < windowWidth - magnifierRight &&
            rect.bottom > magnifierTop &&
            rect.top < magnifierBottom
          ) {
            return null;
          }
        }
        return (
          <div
            style={{
              position: 'fixed',
              top: magnifierTop,
              right: magnifierRight,
              zIndex: 9999,
              background: 'rgba(30,30,30,0.95)',
              border: '2px solid #444',
              borderRadius: 8,
              padding: 8,
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              minWidth: magnifierWidth,
              maxWidth: magnifierWidth,
            }}
          >
            <img
              src={imgSrc}
              alt={hoverCard.cardName}
              style={{
                width: magnifierWidth,
                height: magnifierHeight,
                objectFit: 'contain',
                borderRadius: 6,
                boxShadow: '0 1px 8px rgba(0,0,0,0.4)',
                background: '#222',
              }}
            />
          </div>
        );
      })()}

      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        config={uiConfig}
        onConfigChange={setUIConfig}
        onCardCreated={createCard}
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
    top: 10px;
    left: 10px;
    background: rgba(35, 43, 54, 0.85);
    border: 1px solid #4f5b66;
    color: white;
    border-radius: 4px;
    cursor: pointer;
    font-size: 16px;
    z-index: 100;
    transition: background-color 0.2s ease;
  }

  .settings-button:hover {
    background: rgba(35, 43, 54, 1);
    border-color: #5c677d;
  }
  
  .game-board {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #232b36;
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
    background: #2e3440;
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(44, 51, 63, 0.12);
  }

  .bottom-zones > .zone.hand {
    flex: 1 1 0;
    min-width: 0;
    max-width: 50vw;
    overflow: hidden;
    background: #263040;
  }

  .gameboard-header {
    background: rgba(24, 26, 28, 0.92);
    color: white;
    padding: 0px 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 8px rgba(44, 51, 63, 0.10);
  }

  .gameboard-header h3 {
    margin: 0;
    font-size: 14px;
  }
`;
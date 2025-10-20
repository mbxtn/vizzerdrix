import React from 'react';

export interface ContextMenuOption {
  name: string;
  action: () => void;
}

import type { Player, Game, CardFactory, Card as CardType } from '@vizzerdrix/shared';
import { Zone as ZoneEnum } from '@vizzerdrix/shared';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  localPlayer: Player;
  onPlayerUpdate: (player: Player) => void;
  cardFactory: CardFactory | null;
  game: Game;
  selectedCardIds: string[];
  contextTarget: { type: string, id: string } | null;
  onCreatePlaceholderCard?: (name: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, localPlayer, onPlayerUpdate, cardFactory, game, selectedCardIds, contextTarget, onCreatePlaceholderCard }) => {
  // Dialog state for placeholder card creation
  const [showPlaceholderDialog, setShowPlaceholderDialog] = React.useState(false);
  const [placeholderNameInput, setPlaceholderNameInput] = React.useState("");

  const handleCreatePlaceholderClick = () => {
    setPlaceholderNameInput("");
    setShowPlaceholderDialog(true);
  };

  const handlePlaceholderDialogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (placeholderNameInput.trim() && onCreatePlaceholderCard) {
      onCreatePlaceholderCard(placeholderNameInput.trim());
      setShowPlaceholderDialog(false);
      onClose();
    }
  };

  const handlePlaceholderDialogCancel = () => {
    setShowPlaceholderDialog(false);
  };
  // State for counter input dialog
  const [showCounterInput, setShowCounterInput] = React.useState(false);
  const [counterInputValue, setCounterInputValue] = React.useState<string | number>(0);
  const [counterTargetCardId, setCounterTargetCardId] = React.useState<string | null>(null);

  // Handler to open counter input dialog
  const openCounterInput = (cardId: string) => {
    setCounterTargetCardId(cardId);
    setCounterInputValue(localPlayer.cards[cardId]?.counters ?? 0);
    setShowCounterInput(true);
  };

  // Handler to set counters
  const setCardCounters = () => {
    let value = counterInputValue;
    if (typeof value === 'string') {
      if (value === '' || value === '-') value = 0;
      else if (/^-?\d+$/.test(value)) value = Number(value);
      else value = 0;
    }
    if (counterTargetCardId && localPlayer.cards[counterTargetCardId]) {
      localPlayer.cards[counterTargetCardId].counters = value;
      onPlayerUpdate(localPlayer);
    }
    setShowCounterInput(false);
    setCounterTargetCardId(null);
    onClose();
  };
  // Add hover state for menu options
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);

  // Menu actions
  const setCardZone = (card: CardType, zone: ZoneEnum, location: { x: number; y: number }) => {
    card.zone = zone;
    card.location = location;
    card.counters = 0;
    card.tapped = false;
    card.flipped = false;
  };

  const moveToHand = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card) {
        setCardZone(card, ZoneEnum.hand, { x: localPlayer.handOrder.length, y: 0 });
        if (!localPlayer.handOrder.includes(id)) localPlayer.handOrder.push(id);
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const moveToGraveyard = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card) {
        setCardZone(card, ZoneEnum.graveyard, { x: 0, y: 0 });
        if (!localPlayer.graveyardOrder.includes(id)) localPlayer.graveyardOrder.push(id);
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const moveToExile = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card) {
        setCardZone(card, ZoneEnum.exile, { x: 0, y: 0 });
        if (!localPlayer.exileOrder.includes(id)) localPlayer.exileOrder.push(id);
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const moveToTopOfLibrary = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card) {
        setCardZone(card, ZoneEnum.library, { x: 0, y: 0 });
        // Add to order logic if needed
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const moveToBottomOfLibrary = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card) {
        setCardZone(card, ZoneEnum.library, { x: localPlayer.libraryOrder.length, y: 0 });
        // Add to order logic if needed
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const addCountersToCards = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card && card.zone === ZoneEnum.battlefield) {
        card.counters++;
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const removeCountersFromCards = () => {
    selectedCardIds.forEach(id => {
      const card = localPlayer.cards[id];
      if (card && card.zone === ZoneEnum.battlefield) {
        card.counters--;
      }
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };
  const createCopyOfCards = () => {
    selectedCardIds.forEach((id: string) => {
      if (!cardFactory) return;
      if (!localPlayer.cards[id]) return;
      let newCard = cardFactory.createCardsFromIds([localPlayer.cards[id].scryfallId])[0];
      newCard.isTemporary = true;
      newCard.zone = ZoneEnum.battlefield;
      newCard.location = { x: 50, y: 50 };
      localPlayer.cards[newCard.id] = newCard;
    });
    onPlayerUpdate(localPlayer);
    onClose();
  };

  // Option generation
  let opts: ContextMenuOption[] = [];
  if (selectedCardIds.length > 1) {
    opts = [
      { name: 'Move to Hand', action: moveToHand },
      { name: 'Move to Graveyard', action: moveToGraveyard },
      { name: 'Move to Exile', action: moveToExile },
      { name: 'Move to Top of Library', action: moveToTopOfLibrary },
      { name: 'Move to Bottom of Library', action: moveToBottomOfLibrary },
      { name: 'Add counter to Cards', action: addCountersToCards },
      { name: 'Remove counter from Cards', action: removeCountersFromCards },
    ];
  } else if (contextTarget) {
    if (contextTarget.type === 'card') {
      opts = [
        { name: 'Add counter to Card', action: addCountersToCards },
        { name: 'Remove counter from Card', action: removeCountersFromCards },
        { name: 'Set counters on Card', action: () => openCounterInput(selectedCardIds[0]) },
        { name: 'Create a copy of Card', action: createCopyOfCards },
        { name: 'Move to Top of Library', action: moveToTopOfLibrary },
        { name: 'Move to Bottom of Library', action: moveToBottomOfLibrary },
      ];
    } else if (contextTarget.type === 'battlefield') {
      opts = [
        { name: 'Create placeholder card', action: () => handleCreatePlaceholderClick() },
        { name: 'Move all non-land cards to hand', action: moveToHand },
        { name: 'Move all non-land cards to graveyard', action: moveToGraveyard },
        { name: 'Move all non-land cards to exile', action: moveToExile },
      ];
    } else if (contextTarget.type === 'zone') {
      opts = [
        { name: `${contextTarget.id}`, action: onClose },
      ];
    }
  }

  // Menu dimensions (should match your style)
  const MENU_WIDTH = 180; // px
  const MENU_HEIGHT = opts.length * 40 + 16; // px, estimate 40px per option + padding
  const PADDING = 8; // px

  // Calculate adjusted position to keep menu in viewport
  let adjustedX = x;
  let adjustedY = y;
  if (typeof window !== 'undefined') {
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    if (x + MENU_WIDTH + PADDING > winW) {
      adjustedX = x - (MENU_WIDTH + PADDING)
    }
    if (y + MENU_HEIGHT + PADDING > winH) {
      adjustedY = y - (MENU_HEIGHT + PADDING);
    }
  }

  return (
    <React.Fragment>
      {/* Placeholder card dialog */}
      {showPlaceholderDialog && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2000
        }}>
          <form
            onSubmit={handlePlaceholderDialogSubmit}
            style={{
              background: "#222",
              padding: 24,
              borderRadius: 8,
              boxShadow: "0 2px 16px rgba(0,0,0,0.4)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minWidth: 280
            }}
          >
            <label htmlFor="placeholder-name-input" style={{ color: "#fff" }}>Card Name:</label>
            <input
              id="placeholder-name-input"
              type="text"
              value={placeholderNameInput}
              onChange={e => setPlaceholderNameInput(e.target.value)}
              autoFocus
              style={{
                padding: "8px 12px",
                borderRadius: 4,
                border: "1px solid #555",
                fontSize: 16
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" onClick={handlePlaceholderDialogCancel} style={{
                background: "#888",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "6px 16px",
                cursor: "pointer"
              }}>Cancel</button>
              <button type="submit" style={{
                background: "#ff9800",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "6px 16px",
                cursor: "pointer"
              }}>Create</button>
            </div>
          </form>
        </div>
      )}
      {/* Counter input dialog */}
      {showCounterInput && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <form
            onSubmit={e => { e.preventDefault(); setCardCounters(); }}
            style={{
              background: '#222',
              padding: 24,
              borderRadius: 8,
              boxShadow: '0 2px 16px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minWidth: 280,
              color: '#fff',
            }}
          >
            <label htmlFor="counter-input">Set counters:</label>
            <input
              id="counter-input"
              type="text"
              value={typeof counterInputValue === 'number' ? String(counterInputValue) : counterInputValue}
              onChange={e => {
                const val = e.target.value;
                // Allow empty, minus sign, or valid integer
                if (val === '' || val === '-') {
                  setCounterInputValue(val);
                } else if (/^-?\d+$/.test(val)) {
                  setCounterInputValue(Number(val));
                }
              }}
              style={{
                padding: '8px 12px',
                borderRadius: 4,
                border: '1px solid #555',
                fontSize: 16,
                color: '#222',
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setShowCounterInput(false)} style={{
                background: '#888',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '6px 16px',
                cursor: 'pointer'
              }}>Cancel</button>
              <button type="submit" style={{
                background: '#ff9800',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '6px 16px',
                cursor: 'pointer'
              }}>Set</button>
            </div>
          </form>
        </div>
      )}
      {/* Overlay div to catch outside clicks */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 999,
          background: 'transparent',
        }}
        onClick={onClose}
      ></div>
      <div
        style={{
          position: 'absolute',
          top: adjustedY,
          left: adjustedX,
          background: '#222',
          color: '#fff',
          borderRadius: 4,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          zIndex: 1000,
          minWidth: 160,
          width: MENU_WIDTH,
          padding: '8px 0',
        }}
      >
        {opts.map((opt, idx) => (
          <div
            key={idx}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              background: hoverIdx === idx ? '#444' : 'none',
              color: hoverIdx === idx ? '#ff9800' : '#fff',
              transition: 'background 0.15s, color 0.15s',
            }}
            onClick={() => {
              if (opt.name === 'Create placeholder card') {
                opt.action();
                // Do NOT close menu, let dialog appear
              } else if (opt.name === 'Set counters on Card') {
                opt.action();
              } else {
                opt.action();
                onClose();
              }
            }}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            {opt.name}
          </div>
        ))}
      </div>
    </React.Fragment>
  );
};

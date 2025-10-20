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
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onClose, localPlayer, onPlayerUpdate, cardFactory, game, selectedCardIds, contextTarget }) => {
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
        { name: 'Create a copy of Card', action: createCopyOfCards },
        { name: 'Move to Top of Library', action: moveToTopOfLibrary },
        { name: 'Move to Bottom of Library', action: moveToBottomOfLibrary },
      ];
    } else if (contextTarget.type === 'battlefield') {
      opts = [
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
            onClick={() => { opt.action(); onClose(); }}
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

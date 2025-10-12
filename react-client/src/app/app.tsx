import { useState, useEffect } from 'react';
import { GameBoard } from '../components/GameBoard';
import { createVdClient, VdClient } from '../lib/socketclient';
import { ScryfallCardFactory } from '../lib/cardFactory';
import type { Game, Player } from '@vizzerdrix/shared';
import scryfallCache from '../lib/scryfallCache';

export function App() {
  const [client, setClient] = useState<VdClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('test-room');
  const [gameState, setGameState] = useState<Game | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [showGame, setShowGame] = useState(false);

  useEffect(() => {
    // Create VdClient connection
    const vdClient = createVdClient();

    vdClient.socket.on('connect', () => {
      setConnected(true);
      setMessage('Connected to server!');
    });

    vdClient.socket.on('disconnect', () => {
      setConnected(false);
      setMessage('Disconnected from server');
    });

    // Add game state update listener
    vdClient.addOnUpdateListener('app', (game: Game) => {
      setGameState(game);
      setMessage(`Game state updated! Players: ${Object.keys(game.players || {}).length}`);

      // Update current player if we're in a game
      const playerId = vdClient.getId();
      if (playerId && game.players[playerId]) {
        setCurrentPlayer(game.players[playerId]);
      }
    });

    setClient(vdClient);

    return () => {
      vdClient.remmoveOnUpdateListener('app');
      vdClient.socket.close();
    };
  }, []);

  const joinGame = async () => {
    if (!client || !playerName.trim()) return;

    setMessage('Joining game...');

    try {
      // Simple test with minimal commanders and library
      const commanders = ['Sol Ring']; // Test commander
      const library = ['Lightning Bolt', 'Forest', 'Island', 'Mountain', 'Plains', 'Swamp', 'Wastes', 'Giant Growth', 'Counterspell', 'Dark Ritual', 'Stump Stomp']; // Test library with more cards

      const game = await client.joinGame(playerName, roomName, commanders, library);
      setMessage(`Successfully joined game! Room: ${game.roomName}`);
      setGameState(game);

      scryfallCache.load([...commanders, ...library], (loaded, total, currentCard) => {
        if (loaded >= total) {
          // Get the current player
          const playerId = client.getId();
          if (playerId && game.players[playerId]) {
            const player = game.players[playerId];

            // Create the deck on the client side
            const cardFactory = new ScryfallCardFactory(playerId);
            player.createDeck(cardFactory);

            setCurrentPlayer(player);
            setShowGame(true);
          }
        }
      })
    } catch (error) {
      setMessage(`Failed to join: ${error}`);
    }
  };

  const handlePlayerUpdate = (player: Player) => {
    if (client) {
      client.updateState(player);
      setCurrentPlayer(player);
    }
  };

  if (showGame && currentPlayer) {
    return (
      <div>
        <div style={{
          position: 'fixed',
          top: 10,
          right: 10,
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '10px',
          borderRadius: '4px',
          zIndex: 1000,
          maxWidth: '300px',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          <div>{currentPlayer.name} - Life: {currentPlayer.lifeTotal}</div>
          <button onClick={() => setShowGame(false)}>Back to Lobby</button>

          <div style={{ marginTop: '10px', fontSize: '11px' }}>
            <strong>Debug - Cards by Zone:</strong>
            <pre style={{ fontSize: '10px', maxHeight: '200px', overflow: 'auto', background: 'rgba(255,255,255,0.1)', padding: '5px', marginTop: '5px' }}>
              {gameState && Object.values(currentPlayer.cards).map(card =>
                `${card.cardName}: Zone ${card.zone}`
              ).join('\n')}
            </pre>
          </div>
        </div>
        <GameBoard
          game={gameState!!}
          localPlayer={currentPlayer}
          onPlayerUpdate={handlePlayerUpdate}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Vizzerdrix React Client</h1>

      <div style={{ marginBottom: '20px' }}>
        <strong>Connection Status:</strong>
        <span style={{ color: connected ? 'green' : 'red' }}>
          {connected ? ' Connected' : ' Disconnected'}
        </span>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>Message:</strong> {message}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label>
            Player Name:
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>
            Room Name:
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Enter room name"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>

        <button
          onClick={joinGame}
          disabled={!connected || !playerName.trim()}
          style={{
            padding: '10px 20px',
            backgroundColor: connected ? '#007bff' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: connected ? 'pointer' : 'not-allowed',
            marginRight: '10px'
          }}
        >
          Join Game
        </button>
      </div>

      {gameState && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3>Game State Preview:</h3>
          <pre style={{ fontSize: '12px', overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(gameState, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;

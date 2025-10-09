import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import type { 
  ServerToClientEvents, 
  ClientToServerEvents, 
  StatusOr,
  Game
} from '@vizzerdrix/shared';

// Type the socket connection
type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function App() {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomName, setRoomName] = useState('test-room');
  const [gameState, setGameState] = useState<Game | null>(null);

  useEffect(() => {
    // Connect to your server (adjust port if needed)
    const newSocket: TypedSocket = io('http://localhost:3000');
    
    newSocket.on('connect', () => {
      setConnected(true);
      setMessage('Connected to server!');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      setMessage('Disconnected from server');
    });

    newSocket.on('StateUpdate', (game) => {
      setGameState(game);
      setMessage(`Game state updated! Players: ${game.players?.length || 0}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const joinGame = () => {
    if (!socket || !playerName.trim()) return;

    setMessage('Joining game...');
    
    // Simple test with minimal commanders and library
    const commanders = ['Sol Ring']; // Test commander
    const library = ['Lightning Bolt', 'Forest', 'Island']; // Test library
    
    socket.emit('joinGame', playerName, roomName, commanders, library, (result: StatusOr<Game>) => {
      if (result.status === 'success') {
        setMessage(`Successfully joined game! Room: ${result.value.roomName}`);
        setGameState(result.value);
      } else {
        setMessage(`Failed to join: ${result.message}`);
      }
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Vizzerdrix React Client - Connection Test</h1>
      
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
            cursor: connected ? 'pointer' : 'not-allowed'
          }}
        >
          Join Game
        </button>
      </div>

      {gameState && (
        <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3>Game State Preview:</h3>
          <pre style={{ fontSize: '12px', overflow: 'auto' }}>
            {JSON.stringify(gameState, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;

// Simple multiplayer backend for card game using Node.js and Socket.IO
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors());
app.use(express.static(__dirname + '/public'));

// Game state for each room
const games = {};
// Track disconnected players for rejoin functionality
const disconnectedPlayers = {};

// Clean up old disconnected players (older than 1 hour)
setInterval(() => {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
    
    for (const [playerId, info] of Object.entries(disconnectedPlayers)) {
        if (now - info.disconnectedAt > oneHour) {
            console.log(`Cleaning up old disconnected player: ${info.displayName} (ID: ${playerId})`);
            delete disconnectedPlayers[playerId];
        }
    }
}, 5 * 60 * 1000); // Check every 5 minutes

function createDeck(cardNames, isCommander = false) {
    // Create card objects with unique IDs
    let counter = 0;
    const timestamp = Date.now();
    return cardNames.map(name => ({
        id: `card-${timestamp}-${counter++}-${Math.floor(Math.random() * 10000)}`,
        name,
        displayName: name,
        ...(isCommander && { isCommander: true }) // Add isCommander flag if this is a commander card
    }));
}

function initializePlayer(game, playerId, displayName) {
    game.players[playerId] = { hand: [], library: createDeck([]), graveyard: [], exile: [], command: [], displayName: displayName };
    game.playZones[playerId] = [];
}

io.on('connection', (socket) => {
    let room = null;
    let playerId = socket.id;

    socket.on('join', (data) => {
        const { roomName, displayName, decklist, commanders } = data;
        if (!games[roomName]) {
            games[roomName] = {
                players: {},
                playZones: {},
                turnOrder: [], // Array of player IDs in turn order
                currentTurn: 0, // Index in turnOrder array
                turnOrderSet: false // Whether turn order has been established
            };
        }
        const deck = Array.isArray(decklist) ? decklist : [];
        const commanderCards = Array.isArray(commanders) ? commanders : [];
        games[roomName].players[socket.id] = {
            hand: [],
            library: createDeck(deck), // Fill library with card objects
            graveyard: [],
            exile: [],
            command: createDeck(commanderCards, true), // Fill command zone with commander cards (marked as commanders)
            displayName: displayName || `Player ${Object.keys(games[roomName].players).length + 1}`,
            decklist: deck,
            commanders: commanderCards, // Store original commander list for reset functionality
            life: 40 // Default starting life total
        };
        games[roomName].playZones[socket.id] = [];
        socket.join(roomName);
        room = roomName;
        
        // Migration: Ensure all existing players have command zones and life totals
        Object.keys(games[roomName].players).forEach(existingPlayerId => {
            if (!games[roomName].players[existingPlayerId].command) {
                games[roomName].players[existingPlayerId].command = [];
            }
            if (games[roomName].players[existingPlayerId].life === undefined) {
                games[roomName].players[existingPlayerId].life = 40; // Default life total
            }
        });
        
        io.to(room).emit('state', games[room]);
        socket.emit('joinSuccess', { roomName, displayName });
    });

    // Handle player rejoin
    socket.on('rejoin', (data) => {
        const { roomName, displayName } = data;
        
        if (!games[roomName]) {
            socket.emit('rejoinError', { message: 'Room not found' });
            return;
        }
        
        // Look for a disconnected player with matching display name
        let foundPlayerId = null;
        let playerData = null;
        let playZoneData = null;
        
        // First, check if there's a disconnected player with this exact name
        for (const [disconnectedId, info] of Object.entries(disconnectedPlayers)) {
            if (info.roomName === roomName && info.displayName === displayName) {
                foundPlayerId = disconnectedId;
                playerData = info.playerData;
                playZoneData = info.playZoneData;
                break;
            }
        }
        
        // If no disconnected player found, check for existing players with same name but different socket ID
        if (!foundPlayerId) {
            const gameKeys = Object.keys(games[roomName].players);
            for (const existingPlayerId of gameKeys) {
                if (games[roomName].players[existingPlayerId].displayName === displayName && existingPlayerId !== socket.id) {
                    foundPlayerId = existingPlayerId;
                    playerData = games[roomName].players[existingPlayerId];
                    playZoneData = games[roomName].playZones[existingPlayerId];
                    break;
                }
            }
        }
        
        if (foundPlayerId && playerData) {
            // Remove old player data
            delete games[roomName].players[foundPlayerId];
            delete games[roomName].playZones[foundPlayerId];
            delete disconnectedPlayers[foundPlayerId];
            
            // Update turn order if it exists
            if (games[roomName].turnOrder) {
                const turnIndex = games[roomName].turnOrder.indexOf(foundPlayerId);
                if (turnIndex !== -1) {
                    games[roomName].turnOrder[turnIndex] = socket.id;
                }
            }
            
            // Add player data with new socket ID
            games[roomName].players[socket.id] = playerData;
            games[roomName].playZones[socket.id] = playZoneData || [];
            
            socket.join(roomName);
            room = roomName;
            playerId = socket.id;
            
            console.log(`Player ${displayName} rejoined room ${roomName} (old ID: ${foundPlayerId}, new ID: ${socket.id})`);
            
            // Send rejoin success first
            socket.emit('rejoinSuccess', { roomName, displayName });
            
            // Small delay to ensure client is ready, then send state
            setTimeout(() => {
                // Send the current state to the entire room (including the rejoined player)
                io.to(room).emit('state', games[room]);
                
                // Also send state directly to the rejoined player to ensure they get it
                socket.emit('state', games[room]);
            }, 100); // 100ms delay
        } else {
            socket.emit('rejoinError', { message: 'No player found with that name in this room' });
        }
    });

    socket.on('move', (data) => {
        // data: { playZone, hand, library, graveyard, exile, command, life }
        if (room && games[room] && games[room].players[playerId]) {
            // Preserve displayName
            const currentDisplayName = games[room].players[playerId].displayName;
            games[room].players[playerId] = {
                hand: data.hand,
                library: data.library,
                graveyard: data.graveyard,
                exile: data.exile,
                command: data.command || [], // Ensure command is always an array
                displayName: currentDisplayName, // Re-add the preserved displayName
                life: data.life !== undefined ? data.life : 40 // Update life total, default to 20 if not provided
            };
            games[room].playZones[playerId] = data.playZone;
            io.to(room).emit('state', games[room]);
        }
    });

    socket.on('reset', () => {
        if (room && games[room]) {
            const playerIds = Object.keys(games[room].players);
            games[room].players = {};
            playerIds.forEach(pid => {
                initializePlayer(games[room], pid, games[room].players[pid].displayName); // Preserve display name on reset
            });
            // Reset play zones
            Object.keys(games[room].playZones).forEach(pid => {
                games[room].playZones[pid] = [];
            });
            io.to(room).emit('state', games[room]);
        }
    });

    socket.on('disconnect', () => {
        if (room && games[room] && games[room].players[playerId]) {
            // Save player data for potential rejoin
            disconnectedPlayers[playerId] = {
                roomName: room,
                displayName: games[room].players[playerId].displayName,
                playerData: games[room].players[playerId],
                playZoneData: games[room].playZones[playerId],
                disconnectedAt: Date.now()
            };

            console.log(`Player ${games[room].players[playerId].displayName} disconnected from room ${room} (ID: ${playerId})`);

            delete games[room].players[playerId];
            delete games[room].playZones[playerId];

            // Update turn order if it was set and player was in it
            if (games[room].turnOrderSet && games[room].turnOrder.includes(playerId)) {
                const playerIndex = games[room].turnOrder.indexOf(playerId);
                games[room].turnOrder.splice(playerIndex, 1);
                
                // Adjust current turn if necessary
                if (games[room].currentTurn >= playerIndex && games[room].currentTurn > 0) {
                    games[room].currentTurn--;
                }
                
                // Reset turn order if no players left
                if (games[room].turnOrder.length === 0) {
                    games[room].turnOrderSet = false;
                    games[room].currentTurn = 0;
                }
            }

            // Check if the room is empty after player removal
            if (Object.keys(games[room].players).length === 0) {
                console.log(`Room ${room} is empty. Deleting game state.`);
                delete games[room];
            } else {
                // Only emit state if the room still exists and has players
                io.to(room).emit('state', games[room]);
            }
        }
    });

    socket.on('pickTurnOrder', () => {
        console.log('Received pickTurnOrder event from player:', playerId, 'in room:', room);
        if (room && games[room]) {
            // Get all player IDs and shuffle them
            const playerIds = Object.keys(games[room].players);
            console.log('Players in room:', playerIds);
            const shuffledOrder = [...playerIds];
            
            // Fisher-Yates shuffle
            for (let i = shuffledOrder.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffledOrder[i], shuffledOrder[j]] = [shuffledOrder[j], shuffledOrder[i]];
            }
            
            games[room].turnOrder = shuffledOrder;
            games[room].currentTurn = 0;
            games[room].turnOrderSet = true;
            
            console.log('Set turn order:', shuffledOrder, 'current turn:', games[room].currentTurn);
            
            io.to(room).emit('state', games[room]);
        }
    });

    socket.on('endTurn', () => {
        console.log('Received endTurn event from player:', playerId, 'in room:', room);
        if (room && games[room] && games[room].turnOrderSet) {
            // Check if it's actually this player's turn
            const currentTurnPlayer = games[room].turnOrder[games[room].currentTurn];
            if (currentTurnPlayer !== playerId) {
                console.log('Player', playerId, 'tried to end turn but it\'s not their turn. Current turn:', currentTurnPlayer);
                return; // Ignore the request
            }
            
            // Move to next player's turn
            games[room].currentTurn = (games[room].currentTurn + 1) % games[room].turnOrder.length;
            console.log('Turn ended, new current turn:', games[room].currentTurn, 'player:', games[room].turnOrder[games[room].currentTurn]);
            io.to(room).emit('state', games[room]);
        }
    });


});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});
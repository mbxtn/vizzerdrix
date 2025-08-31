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

function createDeck(cardNames) {
    // Create card objects with unique IDs
    let counter = 0;
    const timestamp = Date.now();
    return cardNames.map(name => ({
        id: `card-${timestamp}-${counter++}-${Math.floor(Math.random() * 10000)}`,
        name,
        displayName: name
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
        const { roomName, displayName, decklist } = data;
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
        games[roomName].players[socket.id] = {
            hand: [],
            library: createDeck(deck), // Fill library with card objects
            graveyard: [],
            exile: [],
            command: [],
            displayName: displayName || `Player ${Object.keys(games[roomName].players).length + 1}`,
            decklist: deck
        };
        games[roomName].playZones[socket.id] = [];
        socket.join(roomName);
        room = roomName;
        
        // Migration: Ensure all existing players have command zones
        Object.keys(games[roomName].players).forEach(existingPlayerId => {
            if (!games[roomName].players[existingPlayerId].command) {
                games[roomName].players[existingPlayerId].command = [];
            }
        });
        
        io.to(room).emit('state', games[room]);
    });

    socket.on('move', (data) => {
        // data: { playZone, hand, library, graveyard, exile, command }
        if (room && games[room] && games[room].players[playerId]) {
            // Preserve displayName
            const currentDisplayName = games[room].players[playerId].displayName;
            games[room].players[playerId] = {
                hand: data.hand,
                library: data.library,
                graveyard: data.graveyard,
                exile: data.exile,
                command: data.command || [], // Ensure command is always an array
                displayName: currentDisplayName // Re-add the preserved displayName
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
        if (room && games[room]) {
            delete games[room].players[playerId];
            delete games[room].playZones[playerId];

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

    socket.on('disconnect', () => {
        if (room && games[room]) {
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});
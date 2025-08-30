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
    game.players[playerId] = { hand: [], library: createDeck([]), discard: [], displayName: displayName };
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
                playZones: {}
            };
        }
        const deck = Array.isArray(decklist) ? decklist : [];
        games[roomName].players[socket.id] = {
            hand: [],
            library: createDeck(deck), // Fill library with card objects
            discard: [],
            displayName: displayName || `Player ${Object.keys(games[roomName].players).length + 1}`,
            decklist: deck
        };
        games[roomName].playZones[socket.id] = [];
        socket.join(roomName);
        room = roomName;
        io.to(room).emit('state', games[room]);
    });

    socket.on('move', (data) => {
        // data: { playZone, hand, library, discard }
        if (room && games[room] && games[room].players[playerId]) {
            // Preserve displayName
            const currentDisplayName = games[room].players[playerId].displayName;
            games[room].players[playerId] = {
                hand: data.hand,
                library: data.library,
                discard: data.discard,
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
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Multiplayer server running on port ${PORT}`);
});
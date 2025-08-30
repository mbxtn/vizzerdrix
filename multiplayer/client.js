const socket = io();
let room = null;
let playerId = null;
let gameState = null;

const joinBtn = document.getElementById('join-btn');
const roomInput = document.getElementById('room-input');
const myPlayZone = document.getElementById('my-play-zone');
const otherPlayZones = document.getElementById('other-play-zones');

joinBtn.onclick = () => {
    room = roomInput.value.trim();
    if (room) {
        socket.emit('join', room);
    }
};

socket.on('connect', () => {
    playerId = socket.id;
});

socket.on('state', (state) => {
    gameState = state;
    render();
});

function render() {
    if (!gameState || !playerId) return;
    // Render my play zone
    myPlayZone.innerHTML = `<h2>Your Play Zone</h2>`;
    const myCards = gameState.playZones[playerId] || [];
    myCards.forEach(card => {
        const el = document.createElement('div');
        el.className = 'card';
        el.textContent = card;
        myPlayZone.appendChild(el);
    });
    // Render other players' play zones
    otherPlayZones.innerHTML = `<h2>Other Players</h2>`;
    Object.keys(gameState.playZones).forEach(pid => {
        if (pid !== playerId) {
            const zone = document.createElement('div');
            zone.innerHTML = `<strong>Player ${pid}</strong>`;
            (gameState.playZones[pid] || []).forEach(card => {
                const el = document.createElement('div');
                el.className = 'card';
                el.textContent = card;
                zone.appendChild(el);
            });
            otherPlayZones.appendChild(zone);
        }
    });
}
// You would add code here to send moves to the server, update your hand, etc.

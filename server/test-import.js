import { Game } from "../shared/state/game.js";

console.log("Game import test:", Game);

const testGame = new Game("test");
console.log("Test game created:", testGame.roomName);
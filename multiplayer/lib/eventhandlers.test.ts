import { describe, expect, it } from 'vitest';
import { EventHandler } from './eventhandlers';

describe('eventhandlers', () => {
  it('should create a game', () => {
    let eventHandler = new EventHandler();
    let roomName = "testroom";
    let roomNameBar = "testroombar";

    eventHandler.joinGameHandler("123", "foo", roomName, ["vren"], ["swamp"]);
    expect(eventHandler.games.size).toEqual(1);
    expect(eventHandler.games.get(roomName)?.players.size).toEqual(1);


    eventHandler.joinGameHandler("456", "bar", roomName, ["vren"], []);
    expect(eventHandler.games.size).toEqual(1);
    expect(eventHandler.games.get(roomName)?.players.size).toEqual(2);

    eventHandler.joinGameHandler("456", "bar", roomNameBar, ["vren"], []);
    expect(eventHandler.games.size).toEqual(2);
    expect(eventHandler.games.get(roomNameBar)?.players.size).toEqual(1);

  });
});

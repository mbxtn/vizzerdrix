import { describe, it } from 'vitest';
import { Player } from './player';
import { BaseCard } from './basecard';

describe('updates', () => {
  it('should describe card movement', () => {
    let player = new Player("test", "testName", ["vren"], ["swamp", "swamp"]);
    let playerchange = new Player("test", "testName", ["vren"], ["swamp", "swamp"]);
    playerchange.commandZone.push(new BaseCard("cardid", "cardName", true));
  });
});

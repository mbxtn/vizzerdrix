import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Player } from "./player";
import { CardMoved, EmptyUpdate, Update } from "./updates";
import { Card } from "./card";
import { Zone } from "./socketinterface";
import { update } from "idb-keyval";


describe('player object unit tests', () => {
    it('update combiner', () => {
        let player = new Player("123", "234", ["vren"], ["swamp"]);
        let baseCard = new Card("testcardid", "testcard");
        let updateA = new CardMoved(baseCard, Zone.graveyard, Zone.battlefield);
        updateA.time = 10;
        let updateB = new CardMoved(baseCard, Zone.battlefield, Zone.command);
        updateB.time = 100;

        
        player.updates.push(updateA);
        player.updates.push(updateB);

        player.updateGameLog();

        console.log(player.gameLog);
    });
});
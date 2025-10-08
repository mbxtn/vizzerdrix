import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Player } from "./player";
import { CardMoved, EmptyUpdate, Update } from "./updates";
import { Card, CardFactory, ScryfallCardFactory } from "./card";
import { Zone } from "./socketinterface";
import { update } from "idb-keyval";


describe('player updates unit tests', () => {
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

describe('player deck creation unit tests', () => {
    it('create deck', () => {
        let factory : CardFactory = new ScryfallCardFactory("testplayerid");
        let commanders = ["island", "sol ring"];
        let library = ["swamp", "plains", "mountain"]
        let player = new Player("testplayerid", "testname", commanders, library);
        return new Promise<void>(resolve => {
            factory.loadCardsFromNames([...commanders, ...library], (loaded, total)=>{
                if(loaded == total) {
                    // We should be synchronous from here
                    player.createDeck(factory);
                    console.log(player)
                    resolve()
                }
            })
        })
    });
});
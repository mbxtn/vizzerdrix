import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { Player } from "./player";
import { CardMoved, EmptyUpdate, Update } from "./updates";
import { Card, CardFactory, ScryfallCardFactory } from "./card";
import { Zone } from "./socketinterface";
import { update } from "idb-keyval";
import e from "express";

describe('card factory tests', () => {
    it('basic load', () => {
        let factory : CardFactory = new ScryfallCardFactory("test");
        return new Promise<void>((resolve) => {
                    factory.loadCardsFromNames(["Stump Stomp", "Swamp"], (loaded, total, currentCard) => {
                        // Little janky but test logic should go in here;
                        console.log("loaded " + loaded)
                        if(loaded == total) {
                            resolve()
                        }
                    });
        });
    });

    it('basic load by id', () => {
        let factory : CardFactory = new ScryfallCardFactory("test");
        return new Promise<void>((resolve) => {
                    factory.loadCardsFromIds([mountainid], (loaded, total, currentCard) => {
                        // Little janky but test logic should go in here;
                        console.log("loaded " + loaded)
                        if(loaded == total) {
                            resolve()
                        }
                    });
        });
    });

    it('basic create (should be after load)', () => {
        let factory: CardFactory = new ScryfallCardFactory("test");
        let cards = factory.createCardsFromNames(["Swamp", "Mountain"])
        
        expect(cards.length).toEqual(2)
        // Probably a brittle assumption
        expect(cards[0].scryfallId).toEqual(swampid)
        expect(cards[1].scryfallId).toEqual(mountainid)

    });

    it('basic create by id (should be after load)', () => {
        let factory: CardFactory = new ScryfallCardFactory("test");
        let cards = factory.createCardsFromIds([swampid, mountainid])
        expect(cards.length).toEqual(2)
        // Probably a brittle assumption
        expect(cards[0].cardName).toEqual("Swamp")
        expect(cards[1].cardName).toEqual("Mountain")

    });

    const swampid = "f0b234d8-d6bb-48ec-8a4d-d8a570a69c62"
    const mountainid = "c44f81ca-f72f-445c-8901-3a894a2a47f9"
});
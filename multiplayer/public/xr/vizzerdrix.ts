// Main game component, should be attached to the scene  itself. 
import * as THREEType from 'three';
declare const THREE: typeof THREEType;
declare var AFRAME: any;

AFRAME.registerComponent('vizzerdrix', {
    init: function () {
        // let's see for input we'd eventually like
        //  room name
        //  display name
        //  decklist (and commander(s))
        //
        // I'm sort of imagining you can put those in before entering xr
        // so we won't need any other features. Bonus, we can load cards
        // in ahead of time. We could maybe even take game state (i.e. wait
        // for everyone to load in and have a decklist before we jump into xr)
    }
});
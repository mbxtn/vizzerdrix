import * as THREEType from 'three';
declare const THREE: typeof THREEType;
declare var AFRAME: any;

AFRAME.registerComponent('vizfinger', {
    schema: {
        handEl: {type: 'selector'},
        finger: {default: "index-finger-tip"},
        fingerbase: {default: 'index-finger-phalanx-proximal'},
        thumb: {default: false},
        handbox: {type: 'selector', default: null},
        battlefield: {type:'selector', default:null},
    },
    init: function () {
        this.cardsTouched = [];
        this.cardsHeld = [];
        this.touchingThumb = false;
        this.recentTouch = false;
        this.falseLetGoTimeout = 50;
        this.fingerBase = {};
        this.el.addEventListener("obbcollisionstarted", (event: any) => {
            // We'll do stuff if we tap a card... sometimes
            if(event.detail.withEl.components.card) {
                //console.log("We saw a card!");
                this.el.emit("cardTouched", {withEl: event.detail.withEl});
                this.cardsTouched.push(event.detail.withEl);
            }
            if(event.detail.withEl.components.vizfinger && event.detail.withEl.components.vizfinger.data.thumb) {
                console.log(this.data.finger + " touched a thumb");
                this.touchingThumb = true;

                while(this.cardsTouched.length > 0) {
                    const card = this.cardsTouched.pop();
                    card.removeAttribute('obb-collider');
                    this.cardsHeld.push(card);
                    this.el.appendChild(card.parentNode);
                    
                    card.parentNode.object3D.position.set(0,0,0);
                    card.parentNode.object3D.rotation.set(THREE.MathUtils.degToRad(30), THREE.MathUtils.degToRad(-90), THREE.MathUtils.degToRad(0));
                }

                this.recentTouch = true;
                setTimeout(() => {
                    this.recentTouch = false;
                }, 100);
                console.log("cards held:", this.cardsHeld.length);
            }
        });
         this.el.addEventListener("obbcollisionended", (event: any) => {
            if(event.detail.withEl.components.card) {
                console.log("We stopped touching a card");
                const index = this.cardsTouched.indexOf(event.detail.withEl);
                if ( index > -1) {
                    this.cardsTouched.splice(indexedDB, 1);
                }
            }
             if (event.detail.withEl.components.vizfinger && event.detail.withEl.components.vizfinger.data.thumb) {
                 if (this.recentTouch) {
                     return;
                 }
                 console.log(this.data.finger + " stopped touching a thumb");
                 this.touchingThumb = false;
                 console.log(this.data);
                 if (this.data.handbox) {
                     while (this.cardsHeld.length > 0) {
                        const card = this.cardsHeld.pop();
                         if (this.data.battlefield) {
                            console.log("trying to place the card first");
                            const worldPosition = new THREE.Vector3();
                            card.parentNode.object3D.getWorldPosition(worldPosition);

                            this.data.battlefield.appendChild(card.parentNode);

                            const localPosition = this.data.battlefield.object3D.worldToLocal(worldPosition);
                            card.parentNode.object3D.position.copy(localPosition);
                            card.parentNode.object3D.position.z = 0.01;
                            card.parentNode.object3D.rotation.set(0, 0, 0);

                         } else {
                             console.log("putting a card back");
                             this.data.handbox.appendChild(card.parentNode);

                             card.parentNode.object3D.position.set(0, 0, 0);
                             card.parentNode.object3D.rotation.set(0, 0, 0);
                         }
                         card.setAttribute('obb-collider', {
                             size: 0,
                             trackedObject3D: '',
                             minimumColliderDimension: 0.02,
                             centerModel: false,
                         });
                     }
                 }

             }
        });
    },

    tick: function() {
        var handtrackingcontrols = this.data.handEl.components['hand-tracking-controls'];
        if (handtrackingcontrols && handtrackingcontrols.bones) {
            //console.log(handtrackingcontrols);
            var fingerTip = handtrackingcontrols.getBone(this.data.finger);
            if (fingerTip) {
                this.el.object3D.position.copy(fingerTip.position);
                this.el.object3D.quaternion.copy(fingerTip.quaternion);
            }
            this.fingerBase = handtrackingcontrols.getBone(this.data.fingerbase);
        }
        if(this.cardsTouched.length > 0) {
           // console.log("we're touching some cards: " + this.cardsTouched);
        } 
        if(this.touchingThumb > 0) {
           // console.log(this.data.finger + "is touching it's thumb");
        }
    }
});


AFRAME.registerComponent('vizhand', {
    schema: {
        indexFinger: {type: 'selector'},
        thumb: {type:'selector'},
    },
    init: function () {
        this.data.indexFinger.addEventListener("cardTouched", function(event: any) {
            
        });
    }
});
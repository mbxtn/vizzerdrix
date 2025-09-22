import * as THREE from 'three';
declare var AFRAME: any;

// Basic entry point
const enterVrButton = document.getElementById('enter-vr-button');
if (enterVrButton) {
    enterVrButton.addEventListener('click', function() {
        // I couldn't find typescript stuff for aframe, just treat it 
        // like an any for now?
        var scene : any = document.querySelector('a-scene');
        if (scene && scene.enterVR) scene.enterVR();
    });
}

var INDEX_TIP_INDEX  = 4;

// TODO add a deck selection
AFRAME.registerComponent('pinchtohand',
    {
        schema: {
            bound: {type:'selector'},
            rig: {type: 'selector'}
        },

        init: function () {
            this.enabled = false;
            console.log(this.handEl);
            if(this.data.bound) {
                this.el.addEventListener('pinchstarted', (e : any)=> {
                    this.enabled = !this.enabled;
                    console.log(e);
                });
            }
        },

        tick: function(time: any, timeDelta: any) {
            var handtrackingcontrols = this.el.components['hand-tracking-controls'];
            if(this.enabled) {
                var fingerBone = handtrackingcontrols.getBone('index-finger-tip');
                var fingerBase = handtrackingcontrols.getBone('index-finger-phalanx-proximal');

                // idea the hand should positioned on your hand. 


                console.log(fingerBase);
                var indexTipPosition = new THREE.Vector3();
                indexTipPosition.copy(fingerBase.position);
                indexTipPosition.add(this.data.rig.object3D.position);
                this.data.bound.object3D.position.set(indexTipPosition.x, indexTipPosition.y , indexTipPosition.z);

                var indexTipRotation = new THREE.Vector3();
                indexTipRotation.copy(fingerBone.rotation);
                this.data.bound.object3D.lookAt(fingerBone.position);

            }
            else {
               this.data.bound.object3D.position.set(0, 3, -2);
            }
        },
    }
);
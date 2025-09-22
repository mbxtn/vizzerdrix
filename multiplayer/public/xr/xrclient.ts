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
            bound: {type:'string'}
        },

        init: function () {
            this.boundEl = this.el.sceneEl.querySelector(this.data.bound);
            this.enabled = false;
            console.log(this.handEl);
            if(this.boundEl) {
                this.el.addEventListener('pinchstarted', (e : any)=> {
                    this.enabled = !this.enabled;
                    console.log(e);
                });
            }
        },

        tick: function(time: any, timeDelta: any) {
            var handtrackingcontrols = this.el.components['hand-tracking-controls'];
            if(this.enabled) {
                // var indexTipPose = new THREE.Vector4();
                // indexTipPose.fromArray(handtrackingcontrols.jointPoses, INDEX_TIP_INDEX * 16);
                // console.log(indexTipPose);
                console.log(handtrackingcontrols.getBone('index-finger-tip'));
                this.boundEl.object3D.rotation.set(handtrackingcontrols.getBone('index-finger-tip').quarternion);
                this.boundEl.object3D.position.set(0, 1, 1);
            }
        },
    }
);
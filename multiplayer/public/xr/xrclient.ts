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
                var fingerTip = handtrackingcontrols.getBone('index-finger-tip');
                var fingerBase = handtrackingcontrols.getBone('index-finger-phalanx-proximal');
                var wrist = handtrackingcontrols.getBone('wrist');
                console.log(wrist);
                
                var midPoint = new THREE.Vector3().lerpVectors(fingerBase.position, fingerTip.position, 0.5);
                this.data.bound.object3D.position.copy(midPoint);

                this.data.bound.object3D.lookAt(fingerTip.position);

                // 5. Apply the roll from the first joint to the box
                const direction = new THREE.Vector3().subVectors(fingerTip.position, fingerBase.position).normalize();
                const jointUp = new THREE.Vector3(0, 1, 0).applyQuaternion(fingerBase.quaternion);
                const boxUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.data.bound.object3D.quaternion);

                const rollAxis = new THREE.Vector3().crossVectors(boxUp, jointUp).dot(direction);
                const rollAngle = Math.atan2(rollAxis, boxUp.dot(jointUp));

                this.data.bound.object3D.rotateZ(rollAngle); // Apply the roll to the box
                this.data.bound.object3D.position.add(this.data.rig.object3D.position);
            }
            else {
               this.data.bound.object3D.position.set(0, 3, -2);
            }
        },
    }
);
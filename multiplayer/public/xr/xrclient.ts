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

// TODO add a deck selection
AFRAME.registerComponent('pinchtohand',
    {
        schema: {
            parent: {type:'string'},
            bound: {type:'string'}
        },
        init: function () {
            let sceneEl = document.querySelector('a-scene');
            this.handEl = sceneEl?.querySelector(this.data.parent);
            this.boundEl = sceneEl?.querySelector(this.data.bound);
            console.log(this.handEl);
            if(this.handEl && this.boundEl) {
                this.handEl.addEventListener('pinchstarted', (e : any)=> {
                    console.log("we starting pinching, we should maybe do something");
                });
                this.handEl.addEventListener('pinchended', (e : any)=> {
                    console.log("we stopped pinching, we should maybe do something");
                });
                this.handEl.addEventListener('pinchmoved', (e : any)=> {
                    console.log("we're moving while pinching, update the hand position");
                    console.log(e);
                    this.boundEl.setAttribute('position', {x: e.detail.position.x, y: e.detail.position.y, z: e.detail.position.z});
                    this.boundEl.setAttribute('rotation', {x: e.detail.wristRotation.x, y: e.detail.wristRotation.y, z: e.detail.wristRotation.z});
                });
            }
        },
    }
);
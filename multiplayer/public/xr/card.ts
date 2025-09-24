declare var THREE: any;
declare var AFRAME: any;

var extendDeep = AFRAME.utils.extendDeep;

// The mesh mixin provides common material properties for creating mesh-based primitives.
// This makes the material component a default component and maps all the base material properties.
var meshMixin = AFRAME.primitives.getMeshMixin();

AFRAME.registerPrimitive('a-card', extendDeep({}, meshMixin, {


}));


function createDynamicTexture(imageURL: string) : any {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    canvas.width = 745;
    canvas.height = 1040;

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const img = new Image();
    img.crossOrigin = "anonymous"
    img.onload = () => {
        context?.drawImage(img, 0, 0, canvas.width, canvas.height);
        texture.needsUpdate = true;
    }
    img.src = imageURL;
    
    return texture;
}


AFRAME.registerComponent('card', {
    schema: {
        front: {type:'string'},
        back: {type:'string'},
        extraback: {type:'string', default: "./assets/cardback.png"},
    },

    init: function() {
        // Create textures for the front and back
        const frontTexture = createDynamicTexture(this.data.front);
        const backTexture = createDynamicTexture(this.data.back);

        const materials = [
            new THREE.MeshBasicMaterial({ color: 0x000000 }), // Right (+X) - Black
            new THREE.MeshBasicMaterial({ color: 0x000000 }), // Left (-X) - Black
            new THREE.MeshBasicMaterial({ color: 0x000000 }), // Top (+Y) - Black
            new THREE.MeshBasicMaterial({ color: 0x000000 }), // Bottom (-Y) - Black
            new THREE.MeshBasicMaterial({ map: frontTexture }), // Front (+Z) - Dynamic Image
            new THREE.MeshBasicMaterial({ map: backTexture })  // Back (-Z) - Dynamic Image
        ];

        const geometry = new THREE.BoxGeometry(0.063, 0.088, 0.001); 
        const mesh = new THREE.Mesh( geometry, materials );
        this.el.setObject3D('card', mesh);
        this.el.object3D.position.set(-0.063 / 2, 0.088 / 2, 0);
    }
});
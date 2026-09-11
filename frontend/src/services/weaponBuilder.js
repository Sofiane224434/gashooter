import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Constructeur & Chargeur d'armes 3D réelles (.GLB) avec fallback procédural PBR
export class WeaponBuilder {
    static gltfLoader = new GLTFLoader();

    static createPlaceholder() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.8, roughness: 0.3 });
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), mat);
        mesh.position.set(0.24, -0.22, -0.45);
        group.add(mesh);
        return group;
    }

    /**
     * Charge un fichier 3D GLB et le normalise pour la vue première personne
     */
    static loadGLBWeapon(url, options = {}) {
        const weaponContainer = new THREE.Group();
        const placeholder = this.createPlaceholder();
        weaponContainer.add(placeholder);

        this.gltfLoader.load(
            url,
            (gltf) => {
                const model = gltf.scene;
                
                // Activer ombres et optimiser matériaux PBR
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;
                            if (options.metalness !== undefined) child.material.metalness = options.metalness;
                            if (options.roughness !== undefined) child.material.roughness = options.roughness;
                        }
                    }
                });

                // Calculer la boîte englobante pour un redimensionnement parfait
                const box = new THREE.Box3().setFromObject(model);
                const size = new THREE.Vector3();
                box.getSize(size);
                const maxDim = Math.max(size.x, size.y, size.z);
                
                const targetSize = options.targetSize || 0.7; // Taille standard d'arme FPS en mètres
                const scale = maxDim > 0 ? (targetSize / maxDim) * (options.scaleMultiplier || 1) : 1;
                model.scale.set(scale, scale, scale);

                // Recalculer après redimensionnement
                const scaledBox = new THREE.Box3().setFromObject(model);
                const center = new THREE.Vector3();
                scaledBox.getCenter(center);

                // Positionner à l'offset désiré
                const posX = options.position ? options.position[0] : 0.28;
                const posY = options.position ? options.position[1] : -0.25;
                const posZ = options.position ? options.position[2] : -0.55;

                model.position.set(
                    posX - (center.x - model.position.x),
                    posY - (center.y - model.position.y),
                    posZ - (center.z - model.position.z)
                );

                if (options.rotation) {
                    model.rotation.set(options.rotation[0], options.rotation[1], options.rotation[2]);
                }

                // Remplacer le placeholder par le vrai modèle GLB
                weaponContainer.remove(placeholder);
                weaponContainer.add(model);
                weaponContainer.userData.realModel = model;
            },
            undefined,
            (error) => {
                console.warn(`[WeaponBuilder] Erreur chargement GLB (${url}):`, error);
            }
        );

        return weaponContainer;
    }

    // 1. FUSIL D'ASSAUT RÉEL (.GLB)
    static createAssaultRifle() {
        return this.loadGLBWeapon('/models/rifle.glb', {
            targetSize: 0.75,
            position: [0.26, -0.22, -0.5],
            rotation: [0, Math.PI, 0],
            metalness: 0.85,
            roughness: 0.25
        });
    }

    // 2. FUSIL DE COMBAT TACTIQUE (.GLB)
    static createSniperRifle() {
        return this.loadGLBWeapon('/models/aim_rifle.glb', {
            targetSize: 0.9,
            position: [0.27, -0.24, -0.58],
            rotation: [0, Math.PI, 0],
            metalness: 0.9,
            roughness: 0.2
        });
    }

    // 3. CANON LOURD MULTI-TUBES (.GLB)
    static createHeavyGun() {
        return this.loadGLBWeapon('/models/heavy_gun.glb', {
            targetSize: 0.85,
            position: [0.3, -0.28, -0.6],
            rotation: [0, 0, 0],
            metalness: 0.9,
            roughness: 0.3
        });
    }

    // 4. PISTOLET TACTIQUE 9MM (.GLB)
    static createPistol() {
        return this.loadGLBWeapon('/models/pistol.glb', {
            targetSize: 0.4,
            position: [0.22, -0.18, -0.38],
            rotation: [0, Math.PI, 0],
            metalness: 0.95,
            roughness: 0.2
        });
    }

    // 5. LAME TACTIQUE DE COMBAT (.GLB)
    static createSword() {
        return this.loadGLBWeapon('/models/sword.glb', {
            targetSize: 0.8,
            position: [0.26, -0.22, -0.48],
            rotation: [Math.PI / 8, -Math.PI / 4, Math.PI / 6],
            metalness: 0.95,
            roughness: 0.15
        });
    }

    // 6. TOURELLE DE DÉFENSE EXTÉRIEURE (.GLB)
    static loadTurret(onLoaded) {
        this.gltfLoader.load(
            '/models/turret.glb',
            (gltf) => {
                const model = gltf.scene;
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                model.scale.set(1.5, 1.5, 1.5);
                if (onLoaded) onLoaded(model);
            },
            undefined,
            (err) => console.warn('Erreur chargement tourelle 3D:', err)
        );
    }
}

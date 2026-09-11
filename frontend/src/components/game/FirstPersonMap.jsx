import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PBRTextureGenerator } from '../../services/textureGenerator.js';

export default function FirstPersonMap({ onExit }) {
    const canvasRef = useRef(null);
    const onExitRef = useRef(onExit);
    onExitRef.current = onExit;

    const [isLocked, setIsLocked] = useState(false);
    const [targetsHit, setTargetsHit] = useState(0);
    const [currentZoneName, setCurrentZoneName] = useState('PLAINE NATURELLE');
    const totalTargets = 10;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 1. Scene, Camera & Renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x60a5fa); // Ciel bleu naturel réaliste
        scene.fog = new THREE.FogExp2(0x93c5fd, 0.005); // Brume atmosphérique légère

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(-20, 1.7, 20); // Spawn dans la Plaine

        const renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.35;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 2. Post-Processing
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.4,
            0.3,
            0.8
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // 3. Éclairage Naturel Réaliste (Soleil d'après-midi + Ciel)
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.5);
        sunLight.position.set(45, 65, 35);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 160;
        sunLight.shadow.bias = -0.0003;
        scene.add(sunLight);

        const skyFillLight = new THREE.DirectionalLight(0xbfdbfe, 1.4);
        skyFillLight.position.set(-40, 40, -30);
        scene.add(skyFillLight);

        // Lumière rougeoyante au-dessus du Volcan
        const volcanoLight = new THREE.PointLight(0xf97316, 5, 45, 1.1);
        volcanoLight.position.set(0, 8, -25);
        scene.add(volcanoLight);

        // 4. Matériaux PBR Réalistes
        const grassMat = PBRTextureGenerator.createGrassTerrainMaterial(20, 20);
        const volcanoMat = PBRTextureGenerator.createVolcanoTerrainMaterial(16, 16);
        const asphaltMat = PBRTextureGenerator.createCityAsphaltMaterial(16, 16);
        const buildingMat = PBRTextureGenerator.createCityBuildingMaterial(4, 4);
        const rockMat = PBRTextureGenerator.createNaturalRockMaterial();
        const woodMat = PBRTextureGenerator.createWoodMaterial();

        // 5. Terrains Réalistes par Secteur
        const addTerrain = (x, z, w, d, material) => {
            const geo = new THREE.PlaneGeometry(w, d);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, 0, z);
            mesh.rotation.x = -Math.PI / 2;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        };

        // Zone 1: Plaine Verte & Nature (Sud-Ouest : X: -25, Z: 25)
        addTerrain(-25, 25, 50, 50, grassMat);
        // Zone 2: Cratère Volcanique & Lave (Nord : X: 0, Z: -25)
        addTerrain(0, -25, 100, 50, volcanoMat);
        // Zone 3: Ville & Asphalte Urbain (Sud-Est : X: 25, Z: 25)
        addTerrain(25, 25, 50, 50, asphaltMat);

        // 6. Système de Boîtes de Collision (AABB) Stricte
        const colliders = [];

        // Murs invisibles d'enceinte pour délimiter la map
        const boundaryMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.9,
            metalness: 0.1
        });

        const addBoundary = (x, y, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, boundaryMat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
            return mesh;
        };

        addBoundary(0, 5, -50, 100, 10, 2);
        addBoundary(0, 5, 50, 100, 10, 2);
        addBoundary(-50, 5, 0, 2, 10, 100);
        addBoundary(50, 5, 0, 2, 10, 100);

        // Helper pour ajouter un objet solide sur lequel on peut monter
        const addSolidObject = (mesh) => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
            return mesh;
        };

        // ---------------------------------------------------------------------
        // ZONE 1 : PLAINE NATURELLE & FORÊT (Sud-Ouest : X: -50..0, Z: 0..50)
        // ---------------------------------------------------------------------
        // Gros rochers de granit moussus (pour sauter dessus)
        const addRock = (x, y, z, sx, sy, sz) => {
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mesh = new THREE.Mesh(geo, rockMat);
            mesh.position.set(x, y + sy / 2, z);
            mesh.rotation.y = Math.random() * Math.PI;
            addSolidObject(mesh);
        };

        addRock(-15, 0, 15, 4, 1.4, 4);       // Rocher Palier 1 (H=1.4m)
        addRock(-20, 0, 12, 3.5, 2.5, 3.5);   // Rocher Palier 2 (H=2.5m)
        addRock(-26, 0, 16, 5, 3.8, 5);       // Grand Rocher Sommet (H=3.8m)
        addRock(-35, 0, 30, 6, 2.2, 5);
        addRock(-10, 0, 35, 4, 1.6, 4);

        // Troncs d'arbres / souches en bois
        const addLog = (x, z, h = 1.2, r = 1.2) => {
            const geo = new THREE.CylinderGeometry(r, r, h, 16);
            const mesh = new THREE.Mesh(geo, woodMat);
            mesh.position.set(x, h / 2, z);
            addSolidObject(mesh);
        };
        addLog(-12, 22, 1.2, 1.4);
        addLog(-30, 18, 1.8, 1.5);
        addLog(-25, 35, 2.2, 1.6);

        // ---------------------------------------------------------------------
        // ZONE 2 : CRATÈRE VOLCANIQUE & LAVE (Nord : X: -50..50, Z: -50..0)
        // ---------------------------------------------------------------------
        // Piliers de basalte & dalles d'obsidienne (parcours au-dessus de la lave)
        const addVolcanicSteppingStone = (x, y, z, size, height) => {
            const geo = new THREE.BoxGeometry(size, height, size);
            const mesh = new THREE.Mesh(geo, volcanoMat);
            mesh.position.set(x, y + height / 2, z);
            addSolidObject(mesh);
        };

        // Parcours de saut volcanique de gauche à droite
        addVolcanicSteppingStone(-35, 0, -20, 4, 1.2);   // Pierre 1 (1.2m)
        addVolcanicSteppingStone(-26, 0, -26, 4, 2.4);   // Pierre 2 (2.4m)
        addVolcanicSteppingStone(-16, 0, -32, 4, 3.8);   // Pierre 3 (3.8m)
        addVolcanicSteppingStone(-4, 0, -38, 5, 5.2);    // Pierre 4 (5.2m)
        addVolcanicSteppingStone(8, 0, -38, 5, 6.4);     // Sommet Cratère (6.4m)
        addVolcanicSteppingStone(20, 0, -30, 5, 4.6);    // Descente (4.6m)
        addVolcanicSteppingStone(32, 0, -22, 5, 2.6);    // Descente (2.6m)
        addVolcanicSteppingStone(38, 0, -12, 4, 1.2);    // Entrée vers la Ville (1.2m)

        // ---------------------------------------------------------------------
        // ZONE 3 : RUE URBAINE & VILLE RÉALISTE (Sud-Est : X: 0..50, Z: 0..50)
        // ---------------------------------------------------------------------
        // Bâtiments en briques réalistes avec fenêtres
        const addBuilding = (x, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, buildingMat);
            mesh.position.set(x, h / 2, z);
            addSolidObject(mesh);
        };

        addBuilding(38, 38, 18, 12, 18);  // Grand Immeuble de ville
        addBuilding(15, 38, 12, 6, 12);   // Bâtiment R+1 avec toit montable
        addBuilding(38, 15, 14, 5, 12);   // Magasin avec terrasse accessible

        // Trottoirs en béton surélevés
        const addSidewalk = (x, z, w, d) => {
            const geo = new THREE.BoxGeometry(w, 0.35, d);
            const mat = new THREE.MeshStandardMaterial({ color: 0x71717a, roughness: 0.8 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 0.175, z);
            addSolidObject(mesh);
        };

        addSidewalk(25, 20, 30, 4);
        addSidewalk(20, 30, 4, 24);

        // Conteneurs urbains & obstacles de rue
        const addStreetCrate = (x, z, sx, sy, sz) => {
            const geo = new THREE.BoxGeometry(sx, sy, sz);
            const mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, sy / 2, z);
            addSolidObject(mesh);
        };
        addStreetCrate(15, 18, 2.2, 1.4, 2.2);
        addStreetCrate(18, 18, 2.0, 2.4, 2.0); // Escalier de caisses pour monter sur le bâtiment
        addStreetCrate(30, 12, 3.0, 1.8, 1.5);

        // 7. Cibles Drones réparties dans les 3 environnements
        const targetDrones = [];
        const droneLocations = [
            { pos: [-20, 4.5, 20], zone: 'Plaine' },
            { pos: [-35, 5.0, 30], zone: 'Plaine' },
            { pos: [-26, 6.0, 16], zone: 'Plaine' },
            { pos: [-26, 5.5, -26], zone: 'Volcan' },
            { pos: [0, 8.5, -38], zone: 'Volcan' },
            { pos: [20, 7.0, -30], zone: 'Volcan' },
            { pos: [38, 5.0, -12], zone: 'Volcan' },
            { pos: [15, 4.5, 25], zone: 'Ville' },
            { pos: [38, 8.0, 15], zone: 'Ville (Terrasse)' },
            { pos: [15, 8.5, 38], zone: 'Ville (Toit)' }
        ];

        droneLocations.forEach(({ pos }) => {
            const droneGroup = new THREE.Group();
            droneGroup.position.set(pos[0], pos[1], pos[2]);

            const coreGeo = new THREE.SphereGeometry(0.55, 24, 24);
            const coreMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
            const core = new THREE.Mesh(coreGeo, coreMat);
            droneGroup.add(core);

            const ringGeo = new THREE.TorusGeometry(0.9, 0.06, 16, 32);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0x38bdf8,
                emissive: 0x0284c7,
                emissiveIntensity: 0.8,
                metalness: 0.9,
                roughness: 0.2
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            droneGroup.add(ring);

            droneGroup.userData = {
                isTarget: true,
                core,
                ring,
                initialY: pos[1],
                offset: Math.random() * Math.PI * 2
            };

            scene.add(droneGroup);
            targetDrones.push(droneGroup);
        });

        // 8. Arme Blaster FPS
        const weaponGroup = new THREE.Group();
        const bodyGeo = new THREE.BoxGeometry(0.14, 0.18, 0.55);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.85 });
        const gunBody = new THREE.Mesh(bodyGeo, bodyMat);
        gunBody.position.set(0.24, -0.22, -0.45);
        weaponGroup.add(gunBody);

        const barrelGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.45, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.2, metalness: 0.95 });
        const gunBarrel = new THREE.Mesh(barrelGeo, barrelMat);
        gunBarrel.position.set(0.24, -0.19, -0.72);
        weaponGroup.add(gunBarrel);

        const stripGeo = new THREE.BoxGeometry(0.02, 0.03, 0.35);
        const stripMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const energyStrip = new THREE.Mesh(stripGeo, stripMat);
        energyStrip.position.set(0.31, -0.16, -0.45);
        weaponGroup.add(energyStrip);

        camera.add(weaponGroup);
        scene.add(camera);

        // 9. Particules d'Étincelles
        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

        const createSparks = (pos) => {
            for (let i = 0; i < 14; i++) {
                const spark = new THREE.Mesh(sparkGeo, sparkMat);
                spark.position.copy(pos);
                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 9,
                    Math.random() * 7 + 2,
                    (Math.random() - 0.5) * 9
                );
                scene.add(spark);
                sparks.push({ mesh: spark, vel, life: 1.0 });
            }
        };

        // 10. PointerLockControls & Clavier
        const controls = new PointerLockControls(camera, canvas);
        const onLock = () => setIsLocked(true);
        const onUnlock = () => setIsLocked(false);
        controls.addEventListener('lock', onLock);
        controls.addEventListener('unlock', onUnlock);

        const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
        const velocity = new THREE.Vector3();
        let canJump = true;

        const onKeyDown = (e) => {
            switch (e.code) {
                case 'KeyW':
                case 'KeyZ':
                case 'ArrowUp':
                    moveState.forward = true;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    moveState.backward = true;
                    break;
                case 'KeyA':
                case 'KeyQ':
                case 'ArrowLeft':
                    moveState.left = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    moveState.right = true;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    moveState.sprint = true;
                    break;
                case 'Space':
                    if (canJump) {
                        velocity.y = 9.0;
                        canJump = false;
                    }
                    break;
                case 'Escape':
                    if (!controls.isLocked) onExitRef.current();
                    break;
                default:
                    break;
            }
        };

        const onKeyUp = (e) => {
            switch (e.code) {
                case 'KeyW':
                case 'KeyZ':
                case 'ArrowUp':
                    moveState.forward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    moveState.backward = false;
                    break;
                case 'KeyA':
                case 'KeyQ':
                case 'ArrowLeft':
                    moveState.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    moveState.right = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    moveState.sprint = false;
                    break;
                default:
                    break;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        // 11. Tirs Laser
        const raycaster = new THREE.Raycaster();
        const lasers = [];

        const fireLaser = () => {
            if (!controls.isLocked) return;

            weaponGroup.position.z += 0.12;
            weaponGroup.rotation.x += 0.08;
            setTimeout(() => {
                weaponGroup.position.z = 0;
                weaponGroup.rotation.x = 0;
            }, 70);

            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(scene.children, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                createSparks(hit.point);

                let obj = hit.object;
                while (obj.parent && !obj.userData?.isTarget && obj.parent !== scene) {
                    obj = obj.parent;
                }

                if (obj && obj.userData && obj.userData.isTarget) {
                    obj.userData.core.material.color.setHex(0xffffff);
                    setTargetsHit((prev) => prev + 1);

                    setTimeout(() => {
                        obj.position.x = (Math.random() - 0.5) * 75;
                        obj.position.z = (Math.random() - 0.5) * 75;
                        obj.userData.core.material.color.setHex(0xef4444);
                    }, 300);
                }
            }

            const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8);
            laserGeo.rotateX(Math.PI / 2);
            const laserMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
            const laserMesh = new THREE.Mesh(laserGeo, laserMat);

            const startPos = new THREE.Vector3(0.24, -0.19, -0.72);
            startPos.applyMatrix4(camera.matrixWorld);
            laserMesh.position.copy(startPos);

            const shootDir = new THREE.Vector3();
            camera.getWorldDirection(shootDir);
            laserMesh.quaternion.copy(camera.quaternion);

            scene.add(laserMesh);
            lasers.push({ mesh: laserMesh, dir: shootDir, distance: 0 });
        };

        window.addEventListener('mousedown', fireLaser);

        // 12. Resize
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // 13. Moteur de Détection de Collision Stricte (Zéro enfoncement)
        const playerRadius = 0.65;

        const checkCollisionAt = (posX, posZ, currentY) => {
            const playerFeetY = currentY - 1.68;
            const playerHeadY = currentY + 0.15;

            const playerBox = new THREE.Box3(
                new THREE.Vector3(posX - playerRadius, playerFeetY, posZ - playerRadius),
                new THREE.Vector3(posX + playerRadius, playerHeadY, posZ + playerRadius)
            );

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                // Si la boîte de l'obstacle est à la même hauteur que le corps du joueur
                if (playerFeetY < box.max.y - 0.05 && playerHeadY > box.min.y) {
                    if (playerBox.intersectsBox(box)) {
                        return true;
                    }
                }
            }
            return false;
        };

        const getGroundHeightAt = (posX, posZ, currentY) => {
            let highestGround = 1.7; // Hauteur normale des yeux au sol (1.7m)

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                if (
                    posX >= box.min.x - playerRadius * 0.9 &&
                    posX <= box.max.x + playerRadius * 0.9 &&
                    posZ >= box.min.z - playerRadius * 0.9 &&
                    posZ <= box.max.z + playerRadius * 0.9
                ) {
                    const standableY = box.max.y + 1.7;
                    // Si le joueur est au-dessus ou retombe dessus
                    if (currentY >= standableY - 0.8) {
                        if (standableY > highestGround) {
                            highestGround = standableY;
                        }
                    }
                }
            }
            return highestGround;
        };

        // 14. Boucle de Rendu
        let prevTime = performance.now();
        let animId;
        let walkCycle = 0;

        const animate = () => {
            animId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);

            // Animation des cibles
            targetDrones.forEach((drone) => {
                drone.position.y = drone.userData.initialY + Math.sin(time * 0.003 + drone.userData.offset) * 0.4;
                drone.userData.ring.rotation.x += 0.03;
                drone.userData.ring.rotation.y += 0.04;
            });

            // Lasers
            for (let i = lasers.length - 1; i >= 0; i--) {
                const laser = lasers[i];
                laser.mesh.position.addScaledVector(laser.dir, 95 * delta);
                laser.distance += 95 * delta;
                if (laser.distance > 130) {
                    scene.remove(laser.mesh);
                    lasers.splice(i, 1);
                }
            }

            // Étincelles
            for (let i = sparks.length - 1; i >= 0; i--) {
                const sp = sparks[i];
                sp.life -= delta * 2.5;
                sp.vel.y -= 15 * delta;
                sp.mesh.position.addScaledVector(sp.vel, delta);
                sp.mesh.scale.setScalar(Math.max(0.01, sp.life));
                if (sp.life <= 0) {
                    scene.remove(sp.mesh);
                    sparks.splice(i, 1);
                }
            }

            if (controls.isLocked) {
                // Détection de zone géographique
                const px = camera.position.x;
                const pz = camera.position.z;
                if (pz <= 0) setCurrentZoneName('CRATÈRE VOLCANIQUE & LAVE');
                else if (px <= 0) setCurrentZoneName('PLAINE NATURELLE & FORÊT');
                else setCurrentZoneName('RUE URBAINE & VILLE');

                // Calcul des vecteurs de déplacement
                const speed = moveState.sprint ? 72.0 : 42.0;
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 22.0 * delta; // Gravité

                const moveZ = Number(moveState.forward) - Number(moveState.backward);
                const moveX = Number(moveState.right) - Number(moveState.left);

                if (moveZ !== 0) velocity.z -= moveZ * speed * delta;
                if (moveX !== 0) velocity.x -= moveX * speed * delta;

                // Vecteurs de direction caméra projetés sur le plan horizontal (XZ)
                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();

                const right = new THREE.Vector3();
                right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

                const moveDeltaX = (right.x * velocity.x + forward.x * -velocity.z) * delta;
                const moveDeltaZ = (right.z * velocity.x + forward.z * -velocity.z) * delta;

                // Déplacement horizontal avec résolution indépendante Axe X puis Axe Z (sans enfoncement)
                const targetX = camera.position.x + moveDeltaX;
                if (!checkCollisionAt(targetX, camera.position.z, camera.position.y)) {
                    camera.position.x = targetX;
                } else {
                    velocity.x = 0;
                }

                const targetZ = camera.position.z + moveDeltaZ;
                if (!checkCollisionAt(camera.position.x, targetZ, camera.position.y)) {
                    camera.position.z = targetZ;
                } else {
                    velocity.z = 0;
                }

                // Déplacement vertical & Atterrissage parfait sur caisses, rochers, plateformes
                camera.position.y += velocity.y * delta;
                const currentGround = getGroundHeightAt(camera.position.x, camera.position.z, camera.position.y);

                if (camera.position.y <= currentGround) {
                    camera.position.y = currentGround;
                    velocity.y = 0;
                    canJump = true;
                }

                // Head-Bobbing réaliste
                const isMoving = (moveX !== 0 || moveZ !== 0);
                if (isMoving && Math.abs(camera.position.y - currentGround) < 0.05) {
                    walkCycle += delta * (moveState.sprint ? 14 : 9);
                    weaponGroup.position.x = Math.sin(walkCycle) * 0.015;
                    weaponGroup.position.y = Math.cos(walkCycle * 2) * 0.012;
                } else {
                    weaponGroup.position.x = THREE.MathUtils.lerp(weaponGroup.position.x, 0, 0.1);
                    weaponGroup.position.y = THREE.MathUtils.lerp(weaponGroup.position.y, 0, 0.1);
                }

                camera.position.x = Math.max(-47, Math.min(47, camera.position.x));
                camera.position.z = Math.max(-47, Math.min(47, camera.position.z));
            }

            composer.render();
            prevTime = time;
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mousedown', fireLaser);
            cancelAnimationFrame(animId);
            controls.removeEventListener('lock', onLock);
            controls.removeEventListener('unlock', onUnlock);
            controls.dispose();
            renderer.dispose();
        };
    }, []);

    const requestLock = useCallback(() => {
        if (canvasRef.current) {
            canvasRef.current.requestPointerLock();
        }
    }, []);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black select-none font-sans">
            <canvas
                ref={canvasRef}
                onClick={requestLock}
                className="w-full h-full block cursor-crosshair"
            />

            {/* Réticule de visée */}
            {isLocked && (
                <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-20">
                    <div className="relative w-7 h-7">
                        <div className="absolute top-1/2 left-0 w-2.5 h-0.5 bg-emerald-400 -translate-y-1/2 shadow-[0_0_8px_#10b981]"></div>
                        <div className="absolute top-1/2 right-0 w-2.5 h-0.5 bg-emerald-400 -translate-y-1/2 shadow-[0_0_8px_#10b981]"></div>
                        <div className="absolute top-0 left-1/2 w-0.5 h-2.5 bg-emerald-400 -translate-x-1/2 shadow-[0_0_8px_#10b981]"></div>
                        <div className="absolute bottom-0 left-1/2 w-0.5 h-2.5 bg-emerald-400 -translate-x-1/2 shadow-[0_0_8px_#10b981]"></div>
                        <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-emerald-200 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_10px_#10b981]"></div>
                    </div>
                </div>
            )}

            {/* HUD Supérieur Réaliste */}
            <div className="pointer-events-none absolute top-4 left-6 z-20 flex flex-wrap items-center gap-3 font-mono text-xs sm:text-sm text-zinc-100">
                <div className="px-4 py-2 bg-slate-900/90 border border-emerald-500/50 rounded-xl backdrop-blur-md shadow-lg flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>BIOME ACTIF : <strong className="text-emerald-400 font-bold">{currentZoneName}</strong></span>
                </div>
                <div className="px-4 py-2 bg-slate-900/90 border border-zinc-700 rounded-xl backdrop-blur-md">
                    CIBLES : <strong className="text-emerald-400 font-bold">{targetsHit}</strong> / {totalTargets}
                </div>
            </div>

            {/* Bouton Quitter */}
            <div className="absolute top-4 right-6 z-30">
                <button
                    onClick={onExit}
                    className="px-4 py-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold uppercase tracking-wider rounded-xl transition cursor-pointer backdrop-blur-md shadow-lg"
                >
                    ✕ Quitter vers le Menu
                </button>
            </div>

            {/* Overlay d'accueil & Pause */}
            {!isLocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-white pointer-events-auto p-4">
                    <div className="max-w-lg w-full p-8 bg-zinc-950/95 border border-emerald-500/40 rounded-2xl shadow-2xl text-center">
                        <div className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-mono font-bold tracking-widest uppercase mb-3">
                            Environnements Réalistes & Physique Corrigée
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider mb-2 text-white font-mono">
                            Biomes Réalistes & Saut
                        </h2>
                        <p className="text-xs text-zinc-300 mb-6">
                            Explorez 3 vrais environnements naturels et urbains : <strong>Plaine Verdoyante</strong> (herbe, rochers, troncs), <strong>Cratère Volcanique</strong> (lave et obsidienne montable) et <strong>Rue Urbaine</strong> (route en asphalte, trottoirs, immeubles).
                        </p>

                        <div className="space-y-2 mb-6 text-xs text-zinc-300 bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 text-left font-mono">
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Déplacement :</span>
                                <strong className="text-zinc-100">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Saut / Escalade :</span>
                                <strong className="text-emerald-400">Espace (montez sur rochers, toits et lave)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Course (Sprint) :</span>
                                <strong className="text-zinc-100">Maj (Shift)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Tir Laser :</span>
                                <strong className="text-emerald-400">Clic Gauche (Étincelles)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Libérer la souris :</span>
                                <strong className="text-zinc-100">Échap (ESC)</strong>
                            </div>
                        </div>

                        <button
                            onClick={requestLock}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black uppercase tracking-wider rounded-xl transition text-sm cursor-pointer shadow-lg shadow-emerald-500/30"
                        >
                            ▶ Entrer dans le Monde 3D
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

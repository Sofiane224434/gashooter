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
    const [currentZoneName, setCurrentZoneName] = useState('HANGAR DE CHARGEMENT');
    const totalTargets = 10;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 1. Scene, Camera & Renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.FogExp2(0x0f172a, 0.007);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(-15, 1.7, 25); // Spawn dans le Hangar

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
        renderer.toneMappingExposure = 1.4;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 2. Post-Processing
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.65,
            0.4,
            0.75
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // 3. Éclairages
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xf8fafc, 3.2);
        sunLight.position.set(40, 60, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.bias = -0.0004;
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.8);
        fillLight.position.set(-40, 45, -30);
        scene.add(fillLight);

        // Lumières thématiques par zone
        const addZoneLight = (x, y, z, color, intensity = 4.5, dist = 40) => {
            const light = new THREE.PointLight(color, intensity, dist, 1.2);
            light.position.set(x, y, z);
            scene.add(light);

            const bulb = new THREE.Mesh(
                new THREE.SphereGeometry(0.35, 16, 16),
                new THREE.MeshBasicMaterial({ color })
            );
            bulb.position.set(x, y, z);
            scene.add(bulb);
        };

        // Éclairage Hangar (Cyan/Blanc)
        addZoneLight(-20, 9, 20, 0x38bdf8);
        // Éclairage Parkour (Bleu/Violet)
        addZoneLight(-25, 12, -25, 0x818cf8);
        // Éclairage Labo Toxique (Vert émeraude intense)
        addZoneLight(25, 9, -25, 0x10b981);
        addZoneLight(25, 5, -12, 0x34d399);
        // Éclairage Canyon Lunaire (Ambré/Orange)
        addZoneLight(25, 9, 25, 0xf59e0b);

        // 4. Matériaux PBR Thématiques
        const hangarFloorMat = PBRTextureGenerator.createIndustrialMetalMaterial(15, 15);
        const toxicFloorMat = PBRTextureGenerator.createToxicFloorMaterial(12, 12);
        const lunarFloorMat = PBRTextureGenerator.createLunarRockMaterial(18, 18);
        const platformMat = PBRTextureGenerator.createPlatformGrateMaterial();
        const containerBlueMat = PBRTextureGenerator.createContainerMaterial('#0284c7', 'CARGO-A1');
        const containerOrangeMat = PBRTextureGenerator.createContainerMaterial('#d97706', 'FUEL-X9');
        const bioTankMat = PBRTextureGenerator.createBioTankMaterial();
        const wallMat = PBRTextureGenerator.createWallMaterial(10, 2);

        // 5. Sols différenciés par quadrants (4 Zones)
        const addFloorSection = (x, z, w, d, material) => {
            const geo = new THREE.PlaneGeometry(w, d);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, 0, z);
            mesh.rotation.x = -Math.PI / 2;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        };

        // Zone 1: Hangar (Sud-Ouest)
        addFloorSection(-25, 25, 50, 50, hangarFloorMat);
        // Zone 2: Parkour & Plateformes (Nord-Ouest)
        addFloorSection(-25, -25, 50, 50, hangarFloorMat);
        // Zone 3: Labo Toxique (Nord-Est)
        addFloorSection(25, -25, 50, 50, toxicFloorMat);
        // Zone 4: Canyon Lunaire (Sud-Est)
        addFloorSection(25, 25, 50, 50, lunarFloorMat);

        // Ligne de démarcation centrale lumineuse
        const centerLineGeo = new THREE.BoxGeometry(100, 0.05, 0.8);
        const centerLineMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const lineX = new THREE.Mesh(centerLineGeo, centerLineMat);
        lineX.position.set(0, 0.02, 0);
        scene.add(lineX);

        const lineZ = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 100), centerLineMat);
        lineZ.position.set(0, 0.02, 0);
        scene.add(lineZ);

        // 6. Murs d'enceinte globaux
        const colliders = [];

        const addWall = (x, y, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, wallMat);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
            return mesh;
        };

        addWall(0, 4.5, -50, 100, 9, 2);
        addWall(0, 4.5, 50, 100, 9, 2);
        addWall(-50, 4.5, 0, 2, 9, 100);
        addWall(50, 4.5, 0, 2, 9, 100);

        // Helper pour ajouter des boîtes / caisses / plateformes solides
        const addSolidBox = (x, y, z, w, h, d, material) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, y + h / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
            return mesh;
        };

        // ---------------------------------------------------------------------
        // ZONE 1: HANGAR MILITAIRE (Sud-Ouest : X: -50..0, Z: 0..50)
        // ---------------------------------------------------------------------
        // Grands conteneurs de fret
        addSolidBox(-30, 0, 20, 6, 4, 12, containerBlueMat);
        addSolidBox(-30, 4, 20, 6, 4, 10, containerOrangeMat); // Deuxième étage
        addSolidBox(-15, 0, 35, 12, 4, 6, containerOrangeMat);

        // Escaliers de caisses pour monter sur les conteneurs
        addSolidBox(-22, 0, 20, 2.5, 1.2, 2.5, hangarFloorMat);
        addSolidBox(-25, 0, 20, 2.5, 2.5, 2.5, hangarFloorMat);

        // ---------------------------------------------------------------------
        // ZONE 2: PARCOURS PARKOUR & PLATEFORMES (Nord-Ouest : X: -50..0, Z: -50..0)
        // ---------------------------------------------------------------------
        // Paliers flottants à hauteurs progressives
        addSolidBox(-18, 0, -12, 4, 1.2, 4, platformMat);       // Palier 1: H=1.2m
        addSolidBox(-26, 0, -12, 4, 2.6, 4, platformMat);       // Palier 2: H=2.6m
        addSolidBox(-34, 0, -16, 4, 4.2, 4, platformMat);       // Palier 3: H=4.2m
        addSolidBox(-34, 0, -26, 4, 5.8, 4, platformMat);       // Palier 4: H=5.8m
        addSolidBox(-24, 0, -34, 5, 7.4, 5, platformMat);       // Palier 5: H=7.4m (Sommet)

        // Passerelle suspendue de liaison
        addSolidBox(-10, 0, -34, 16, 7.4, 3, platformMat);

        // Piliers de soutien sous les plateformes
        const addPillar = (x, z, h) => {
            const geo = new THREE.CylinderGeometry(0.5, 0.5, h, 16);
            const mat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.3 });
            const pillar = new THREE.Mesh(geo, mat);
            pillar.position.set(x, h / 2, z);
            pillar.castShadow = true;
            scene.add(pillar);
        };
        addPillar(-24, -34, 7.4);
        addPillar(-34, -26, 5.8);

        // ---------------------------------------------------------------------
        // ZONE 3: LABORATOIRE BIO-TOXIQUE & RÉACTEUR (Nord-Est : X: 0..50, Z: -50..0)
        // ---------------------------------------------------------------------
        // Cuves de bio-gaz toxique cylindriques
        const addBioTank = (x, z) => {
            const geo = new THREE.CylinderGeometry(3, 3, 7, 24);
            const tank = new THREE.Mesh(geo, bioTankMat);
            tank.position.set(x, 3.5, z);
            tank.castShadow = true;
            tank.receiveShadow = true;
            scene.add(tank);
            colliders.push(new THREE.Box3().setFromObject(tank));

            // Anneau de contention
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(3.2, 0.15, 16, 32),
                new THREE.MeshBasicMaterial({ color: 0x10b981 })
            );
            ring.rotation.x = Math.PI / 2;
            ring.position.set(x, 4.5, z);
            scene.add(ring);
        };

        addBioTank(25, -20);
        addBioTank(35, -35);
        addBioTank(15, -35);

        // Passerelle surélevée d'observation du réacteur
        addSolidBox(25, 0, -20, 8, 2.5, 8, platformMat);

        // ---------------------------------------------------------------------
        // ZONE 4: ARÈNE / CANYON LUNAIRE (Sud-Est : X: 0..50, Z: 0..50)
        // ---------------------------------------------------------------------
        // Monolithes et abris de tir
        addSolidBox(25, 0, 20, 4, 8, 4, lunarFloorMat);
        addSolidBox(15, 0, 30, 2, 4, 8, lunarFloorMat);
        addSolidBox(35, 0, 15, 8, 3, 2, lunarFloorMat);
        addSolidBox(35, 0, 35, 5, 5, 5, containerBlueMat);

        // 7. Cibles Drones réparties dans les 4 zones
        const targetDrones = [];
        const droneLocations = [
            { pos: [-30, 6, 20], zone: 'Hangar' },
            { pos: [-15, 5, 35], zone: 'Hangar' },
            { pos: [-34, 7.5, -26], zone: 'Parkour' },
            { pos: [-24, 9.2, -34], zone: 'Parkour' },
            { pos: [-10, 9.0, -34], zone: 'Passerelle' },
            { pos: [25, 6, -20], zone: 'Labo Toxique' },
            { pos: [35, 6.5, -35], zone: 'Labo Toxique' },
            { pos: [15, 6.5, -35], zone: 'Labo Toxique' },
            { pos: [25, 5.5, 20], zone: 'Canyon' },
            { pos: [35, 6.0, 35], zone: 'Canyon' }
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

        // 9. Particules d'Étincelles (Sparks FX)
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
        const direction = new THREE.Vector3();
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
                        velocity.y = 8.8;
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

        // 13. Détection des collisions & Hauteur de sol
        const playerRadius = 0.55;

        const checkCollision = (posX, posZ, currentY) => {
            const playerBox = new THREE.Box3(
                new THREE.Vector3(posX - playerRadius, currentY - 1.6, posZ - playerRadius),
                new THREE.Vector3(posX + playerRadius, currentY + 0.2, posZ + playerRadius)
            );

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                if (currentY - 1.5 < box.max.y && playerBox.intersectsBox(box)) {
                    return true;
                }
            }
            return false;
        };

        const getGroundHeight = (posX, posZ, currentY) => {
            let highestGround = 1.7;

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                if (
                    posX >= box.min.x - playerRadius &&
                    posX <= box.max.x + playerRadius &&
                    posZ >= box.min.z - playerRadius &&
                    posZ <= box.max.z + playerRadius
                ) {
                    const standableY = box.max.y + 1.7;
                    if (currentY >= standableY - 0.7) {
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

            // Drones flottants
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
                // Détection de la zone active
                const px = camera.position.x;
                const pz = camera.position.z;
                if (px <= 0 && pz >= 0) setCurrentZoneName('HANGAR MILITAIRE');
                else if (px <= 0 && pz < 0) setCurrentZoneName('PARCOURS & PLATEFORMES (PARKOUR)');
                else if (px > 0 && pz < 0) setCurrentZoneName('LABORATOIRE BIO-TOXIQUE');
                else setCurrentZoneName('ARÈNE / SURFACE LUNAIRE');

                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 22.0 * delta;

                direction.z = Number(moveState.forward) - Number(moveState.backward);
                direction.x = Number(moveState.right) - Number(moveState.left);
                direction.normalize();

                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                const baseSpeed = moveState.sprint ? 75.0 : 45.0;

                if (moveState.forward || moveState.backward) velocity.z -= direction.z * baseSpeed * delta;
                if (moveState.left || moveState.right) velocity.x -= direction.x * baseSpeed * delta;

                // Application du mouvement avec collisions solides
                const prevX = camera.position.x;
                const prevZ = camera.position.z;

                controls.moveRight(-velocity.x * delta);
                if (checkCollision(camera.position.x, camera.position.z, camera.position.y)) {
                    camera.position.x = prevX;
                    velocity.x = 0;
                }

                controls.moveForward(-velocity.z * delta);
                if (checkCollision(camera.position.x, camera.position.z, camera.position.y)) {
                    camera.position.z = prevZ;
                    velocity.z = 0;
                }

                // Déplacement vertical & Atterrissage sur caisses/plateformes
                camera.position.y += velocity.y * delta;
                const currentGround = getGroundHeight(camera.position.x, camera.position.z, camera.position.y);

                if (camera.position.y <= currentGround) {
                    camera.position.y = currentGround;
                    velocity.y = 0;
                    canJump = true;
                }

                // Head-Bobbing
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

            {/* HUD Supérieur : Détection de Zone en Direct & Score */}
            <div className="pointer-events-none absolute top-4 left-6 z-20 flex flex-wrap items-center gap-3 font-mono text-xs sm:text-sm text-zinc-300">
                <div className="px-3.5 py-1.5 bg-slate-950/85 border border-emerald-500/40 rounded-xl backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>ZONE ACTIVE : <strong className="text-emerald-400 font-bold">{currentZoneName}</strong></span>
                </div>
                <div className="px-3.5 py-1.5 bg-slate-950/85 border border-zinc-700 rounded-xl backdrop-blur-md">
                    CIBLES : <strong className="text-emerald-400 font-bold">{targetsHit}</strong> / {totalTargets}
                </div>
            </div>

            {/* Bouton Quitter */}
            <div className="absolute top-4 right-6 z-30">
                <button
                    onClick={onExit}
                    className="px-4 py-2 bg-zinc-950/90 hover:bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold uppercase tracking-wider rounded-xl transition cursor-pointer backdrop-blur-md shadow-lg"
                >
                    ✕ Quitter vers le Menu
                </button>
            </div>

            {/* Overlay d'accueil & Pause */}
            {!isLocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-white pointer-events-auto p-4">
                    <div className="max-w-lg w-full p-8 bg-zinc-950/95 border border-emerald-500/30 rounded-2xl shadow-[0_0_60px_rgba(16,185,129,0.2)] text-center">
                        <div className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-mono font-bold tracking-widest uppercase mb-3">
                            4 Secteurs de Test • Collisions & Plateformes
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider mb-2 text-white font-mono">
                            Complexe d'Entraînement 3D
                        </h2>
                        <p className="text-xs text-zinc-400 mb-6">
                            Explorez 4 biomes distincts : <strong>Hangar</strong> (conteneurs), <strong>Parkour</strong> (plateformes montables), <strong>Labo Toxique</strong> (cuves de gaz) et <strong>Canyon Lunaire</strong> (monolithes).
                        </p>

                        <div className="space-y-2 mb-6 text-xs text-zinc-300 bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-left font-mono">
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Déplacement :</span>
                                <strong className="text-zinc-200">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Saut & Parkour :</span>
                                <strong className="text-emerald-400">Espace (grimpez de palier en palier)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Sprint :</span>
                                <strong className="text-zinc-200">Maj (Shift)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Tir Blaster :</span>
                                <strong className="text-emerald-400">Clic Gauche (Étincelles)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Pause / Menu :</span>
                                <strong className="text-zinc-200">Échap (ESC)</strong>
                            </div>
                        </div>

                        <button
                            onClick={requestLock}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black uppercase tracking-wider rounded-xl transition text-sm cursor-pointer shadow-lg shadow-emerald-500/30"
                        >
                            ▶ Entrer dans le Complexe 3D
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

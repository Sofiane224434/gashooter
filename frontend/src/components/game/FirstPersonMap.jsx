import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { PBRTextureGenerator } from '../../services/textureGenerator.js';
import { ModelBuilder } from '../../services/modelBuilder.js';
import { WeaponBuilder } from '../../services/weaponBuilder.js';

export default function FirstPersonMap({ onExit }) {
    const canvasRef = useRef(null);
    const onExitRef = useRef(onExit);
    onExitRef.current = onExit;

    const [isLocked, setIsLocked] = useState(false);
    const [targetsHit, setTargetsHit] = useState(0);
    const [currentZoneName, setCurrentZoneName] = useState('PLAINE FORESTIÈRE');
    const [currentWeaponIndex, setCurrentWeaponIndex] = useState(0); // 0..4
    const totalTargets = 10;

    const weaponsList = [
        { id: 'rifle', name: "FUSIL D'ASSAUT M4 (Modèle 3D GLB)", type: 'Automatique', icon: '🔫', rpm: '650 RPM', damage: 'Moyen' },
        { id: 'sniper', name: 'FUSIL TACTIQUE SNIPER (Modèle 3D GLB)', type: 'Précision', icon: '🎯', rpm: '60 RPM', damage: 'Ultra Élevé' },
        { id: 'heavy_gun', name: 'CANON LOURD MULTI-TUBES (Modèle 3D GLB)', type: 'Lourd', icon: '💥', rpm: '400 RPM', damage: 'Dévastateur' },
        { id: 'pistol', name: 'PISTOLET TACTIQUE 9MM (Modèle 3D GLB)', type: 'Semi-Auto', icon: '🗡️', rpm: '350 RPM', damage: 'Équilibré' },
        { id: 'sword', name: 'LAME DE COMBAT TACTIQUE (Modèle 3D GLB)', type: 'Mêlée / Assaut', icon: '⚔️', rpm: 'Attaque Rapide', damage: 'Tranchant' }
    ];

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 1. Scene, Camera & Renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x38bdf8);
        scene.fog = new THREE.FogExp2(0xbae6fd, 0.005);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(-22, 1.7, 22);

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
            0.85
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // 3. Éclairage
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfffbeb, 3.4);
        sunLight.position.set(45, 70, 40);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 170;
        sunLight.shadow.bias = -0.0003;
        scene.add(sunLight);

        const skyFill = new THREE.DirectionalLight(0x7dd3fc, 1.3);
        skyFill.position.set(-45, 35, -35);
        scene.add(skyFill);

        // 4. Terrains
        const grassMat = PBRTextureGenerator.createGrassTerrainMaterial(20, 20);
        const volcanoMat = PBRTextureGenerator.createVolcanoTerrainMaterial(16, 16);
        const asphaltMat = PBRTextureGenerator.createCityAsphaltMaterial(16, 16);

        const addTerrain = (x, z, w, d, material) => {
            const geo = new THREE.PlaneGeometry(w, d);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(x, 0, z);
            mesh.rotation.x = -Math.PI / 2;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        };

        addTerrain(-25, 25, 50, 50, grassMat);
        addTerrain(0, -25, 100, 50, volcanoMat);
        addTerrain(25, 25, 50, 50, asphaltMat);

        // 5. Collisions & Objets
        const colliders = [];
        const registerCollider = (obj) => {
            obj.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(obj);
            colliders.push(box);
            return box;
        };

        // Limites
        const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
        const addBoundary = (x, y, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, boundaryMat);
            mesh.position.set(x, y, z);
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
        };
        addBoundary(0, 5, -50, 100, 10, 2);
        addBoundary(0, 5, 50, 100, 10, 2);
        addBoundary(-50, 5, 0, 2, 10, 100);
        addBoundary(50, 5, 0, 2, 10, 100);

        // Zone 1 : Plaine
        const addTree = (x, z, type = 'oak', scale = 1) => {
            const tree = (type === 'oak') ? ModelBuilder.createOakTree(scale) : ModelBuilder.createPineTree(scale);
            tree.position.set(x, 0, z);
            scene.add(tree);
            const trunkBox = new THREE.Box3(
                new THREE.Vector3(x - 0.7 * scale, 0, z - 0.7 * scale),
                new THREE.Vector3(x + 0.7 * scale, 3.5 * scale, z + 0.7 * scale)
            );
            colliders.push(trunkBox);
        };
        addTree(-10, 15, 'oak', 1.2);
        addTree(-28, 12, 'oak', 1.0);
        addTree(-38, 25, 'pine', 1.3);
        addTree(-18, 38, 'pine', 1.1);
        addTree(-35, 42, 'oak', 1.15);

        const addNaturalRock = (x, y, z, size = 3) => {
            const rock = ModelBuilder.createNaturalRock(size);
            rock.position.set(x, y + size * 0.8, z);
            scene.add(rock);
            registerCollider(rock);
        };
        addNaturalRock(-15, 0, 25, 2.2);
        addNaturalRock(-20, 0, 28, 3.2);
        addNaturalRock(-26, 0, 32, 4.2);
        addNaturalRock(-8, 0, 30, 2.0);

        // Zone 2 : Volcan
        const addVolcanicPlatform = (x, y, z, size = 3.5) => {
            const rock = ModelBuilder.createVolcanicRock(size);
            rock.position.set(x, y + size * 0.7, z);
            scene.add(rock);
            registerCollider(rock);
        };
        addVolcanicPlatform(-36, 0, -16, 2.8);
        addVolcanicPlatform(-28, 0, -24, 3.4);
        addVolcanicPlatform(-18, 0, -32, 4.0);
        addVolcanicPlatform(-4, 0, -38, 4.6);
        addVolcanicPlatform(10, 0, -38, 5.0);
        addVolcanicPlatform(22, 0, -30, 4.2);
        addVolcanicPlatform(34, 0, -20, 3.2);

        // Zone 3 : Ville
        const addHouse = (x, z, w, h, d, wallColor, roofColor) => {
            const house = ModelBuilder.createHouse(w, h, d, wallColor, roofColor);
            house.position.set(x, 0, z);
            scene.add(house);
            registerCollider(house);
        };
        addHouse(36, 36, 12, 6, 14, 0xb91c1c, 0x18181b);
        addHouse(16, 38, 10, 5, 10, 0xd97706, 0x292524);

        const addCar = (x, z, rotY = 0, color = 0x2563eb) => {
            const car = ModelBuilder.createCar(color);
            car.position.set(x, 0, z);
            car.rotation.y = rotY;
            scene.add(car);
            registerCollider(car);
        };
        addCar(15, 18, Math.PI / 6, 0x2563eb);
        addCar(28, 15, -Math.PI / 4, 0xdc2626);
        addCar(38, 22, Math.PI / 2, 0x16a34a);

        const addLamp = (x, z, rotY = 0) => {
            const lamp = ModelBuilder.createStreetLamp();
            lamp.position.set(x, 0, z);
            lamp.rotation.y = rotY;
            scene.add(lamp);
            colliders.push(new THREE.Box3(
                new THREE.Vector3(x - 0.3, 0, z - 0.3),
                new THREE.Vector3(x + 0.3, 5.5, z + 0.3)
            ));
        };
        addLamp(12, 10, Math.PI / 4);
        addLamp(25, 26, -Math.PI / 3);
        addLamp(35, 10, 0);

        const addSidewalk = (x, z, w, d) => {
            const geo = new THREE.BoxGeometry(w, 0.35, d);
            const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 0.175, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
        };
        addSidewalk(25, 20, 30, 4);
        addSidewalk(20, 30, 4, 24);

        // 6. Cibles Drones
        const targetDrones = [];
        const droneLocations = [
            { pos: [-15, 4.5, 25], zone: 'Plaine' },
            { pos: [-38, 5.0, 25], zone: 'Plaine' },
            { pos: [-28, 5.5, 12], zone: 'Plaine' },
            { pos: [-28, 5.0, -24], zone: 'Volcan' },
            { pos: [10, 8.5, -38], zone: 'Volcan' },
            { pos: [34, 5.5, -20], zone: 'Volcan' },
            { pos: [15, 3.5, 18], zone: 'Ville' },
            { pos: [28, 3.5, 15], zone: 'Ville' },
            { pos: [36, 8.5, 36], zone: 'Ville' },
            { pos: [16, 7.5, 38], zone: 'Ville' }
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

        // Tourelles 3D défensives interactives sur la carte
        WeaponBuilder.loadTurret((turret1) => {
            turret1.position.set(5, 0, 8);
            scene.add(turret1);
            registerCollider(turret1);
        });
        WeaponBuilder.loadTurret((turret2) => {
            turret2.position.set(-10, 0, -14);
            turret2.rotation.y = Math.PI / 4;
            scene.add(turret2);
            registerCollider(turret2);
        });

        // 7. ARSENAL DE 5 ARMES 3D RÉELLES (.GLB)
        const weaponModels = [
            WeaponBuilder.createAssaultRifle(), // 0: M4 Assault Rifle GLB
            WeaponBuilder.createSniperRifle(),  // 1: Aim Rifle Sniper GLB
            WeaponBuilder.createHeavyGun(),     // 2: Heavy Machine Gun GLB
            WeaponBuilder.createPistol(),       // 3: Tactical Pistol GLB
            WeaponBuilder.createSword()         // 4: Combat Sword Blade GLB
        ];

        const weaponHolder = new THREE.Group();
        weaponModels.forEach((wModel, idx) => {
            wModel.visible = (idx === 0);
            weaponHolder.add(wModel);
        });

        camera.add(weaponHolder);
        scene.add(camera);

        let activeWeaponIdx = 0;
        const setWeapon = (idx) => {
            if (idx < 0 || idx >= weaponModels.length) return;
            activeWeaponIdx = idx;
            setCurrentWeaponIndex(idx);
            weaponModels.forEach((m, i) => {
                m.visible = (i === idx);
            });
        };

        // 8. Particules
        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

        const createSparks = (pos, count = 14) => {
            for (let i = 0; i < count; i++) {
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

        // 9. PointerLock & Clavier
        const controls = new PointerLockControls(camera, canvas);
        const onLock = () => setIsLocked(true);
        const onUnlock = () => setIsLocked(false);
        controls.addEventListener('lock', onLock);
        controls.addEventListener('unlock', onUnlock);

        const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
        const velocity = new THREE.Vector3();
        let canJump = true;

        const onKeyDown = (e) => {
            // Touches armes [1..5]
            if (e.key >= '1' && e.key <= '5') {
                setWeapon(Number(e.key) - 1);
                return;
            }

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

        const onWheel = (e) => {
            if (e.deltaY > 0) {
                setWeapon((activeWeaponIdx + 1) % weaponModels.length);
            } else {
                setWeapon((activeWeaponIdx - 1 + weaponModels.length) % weaponModels.length);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('wheel', onWheel);

        // 10. Système de Tir Balistique selon l'arme
        const raycaster = new THREE.Raycaster();
        const lasers = [];

        const fireWeapon = () => {
            if (!controls.isLocked) return;

            // Recul de l'arme
            const currentWeapon = weaponModels[activeWeaponIdx];
            const recoilZ = (activeWeaponIdx === 1 || activeWeaponIdx === 2) ? 0.22 : 0.12;
            const recoilRot = (activeWeaponIdx === 1 || activeWeaponIdx === 2) ? 0.16 : 0.08;

            currentWeapon.position.z += recoilZ;
            currentWeapon.rotation.x += recoilRot;
            setTimeout(() => {
                currentWeapon.position.z = 0;
                currentWeapon.rotation.x = 0;
            }, 80);

            // Tir en gerbe (Shotgun = 7 plombs) ou Tir unique
            const pellets = (activeWeaponIdx === 2) ? 7 : 1;

            for (let p = 0; p < pellets; p++) {
                const spreadX = (activeWeaponIdx === 2) ? (Math.random() - 0.5) * 0.08 : 0;
                const spreadY = (activeWeaponIdx === 2) ? (Math.random() - 0.5) * 0.08 : 0;

                raycaster.setFromCamera(new THREE.Vector2(spreadX, spreadY), camera);
                const intersects = raycaster.intersectObjects(scene.children, true);

                if (intersects.length > 0) {
                    const hit = intersects[0];
                    createSparks(hit.point, (activeWeaponIdx === 2) ? 6 : 14);

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

                // Laser / Projectile visuel
                const laserColor = (activeWeaponIdx === 1) ? 0xfacc15 : (activeWeaponIdx === 4 ? 0x06b6d4 : 0x34d399);
                const laserGeo = new THREE.CylinderGeometry(0.025, 0.025, (activeWeaponIdx === 1 ? 2.5 : 1.6), 8);
                laserGeo.rotateX(Math.PI / 2);
                const laserMat = new THREE.MeshBasicMaterial({ color: laserColor });
                const laserMesh = new THREE.Mesh(laserGeo, laserMat);

                const startPos = new THREE.Vector3(0.24, -0.19, -0.72);
                startPos.applyMatrix4(camera.matrixWorld);
                laserMesh.position.copy(startPos);

                const shootDir = new THREE.Vector3();
                camera.getWorldDirection(shootDir);
                shootDir.x += spreadX;
                shootDir.y += spreadY;
                shootDir.normalize();

                laserMesh.quaternion.copy(camera.quaternion);
                scene.add(laserMesh);
                lasers.push({ mesh: laserMesh, dir: shootDir, distance: 0 });
            }
        };

        window.addEventListener('mousedown', fireWeapon);

        // 11. Resize
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // 12. Collisions Stricte
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
                if (playerFeetY < box.max.y - 0.05 && playerHeadY > box.min.y) {
                    if (playerBox.intersectsBox(box)) return true;
                }
            }
            return false;
        };

        const getGroundHeightAt = (posX, posZ, currentY) => {
            let highestGround = 1.7;

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                if (
                    posX >= box.min.x - playerRadius * 0.85 &&
                    posX <= box.max.x + playerRadius * 0.85 &&
                    posZ >= box.min.z - playerRadius * 0.85 &&
                    posZ <= box.max.z + playerRadius * 0.85
                ) {
                    const standableY = box.max.y + 1.7;
                    if (currentY >= standableY - 0.8) {
                        if (standableY > highestGround) {
                            highestGround = standableY;
                        }
                    }
                }
            }
            return highestGround;
        };

        // 13. Boucle de Rendu
        let prevTime = performance.now();
        let animId;
        let walkCycle = 0;

        const animate = () => {
            animId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);

            targetDrones.forEach((drone) => {
                drone.position.y = drone.userData.initialY + Math.sin(time * 0.003 + drone.userData.offset) * 0.4;
                drone.userData.ring.rotation.x += 0.03;
                drone.userData.ring.rotation.y += 0.04;
            });

            for (let i = lasers.length - 1; i >= 0; i--) {
                const laser = lasers[i];
                laser.mesh.position.addScaledVector(laser.dir, 100 * delta);
                laser.distance += 100 * delta;
                if (laser.distance > 140) {
                    scene.remove(laser.mesh);
                    lasers.splice(i, 1);
                }
            }

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
                const px = camera.position.x;
                const pz = camera.position.z;
                if (pz <= 0) setCurrentZoneName('CRATÈRE VOLCANIQUE & LAVE');
                else if (px <= 0) setCurrentZoneName('PLAINE NATURELLE & FORÊT');
                else setCurrentZoneName('RUE URBAINE & VILLE');

                const speed = moveState.sprint ? 72.0 : 42.0;
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 22.0 * delta;

                const moveZ = Number(moveState.forward) - Number(moveState.backward);
                const moveX = Number(moveState.right) - Number(moveState.left);

                if (moveZ !== 0) velocity.z -= moveZ * speed * delta;
                if (moveX !== 0) velocity.x -= moveX * speed * delta;

                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);
                forward.y = 0;
                forward.normalize();

                const right = new THREE.Vector3();
                right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

                const moveDeltaX = (right.x * velocity.x + forward.x * -velocity.z) * delta;
                const moveDeltaZ = (right.z * velocity.x + forward.z * -velocity.z) * delta;

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

                camera.position.y += velocity.y * delta;
                const currentGround = getGroundHeightAt(camera.position.x, camera.position.z, camera.position.y);

                if (camera.position.y <= currentGround) {
                    camera.position.y = currentGround;
                    velocity.y = 0;
                    canJump = true;
                }

                const isMoving = (moveX !== 0 || moveZ !== 0);
                if (isMoving && Math.abs(camera.position.y - currentGround) < 0.05) {
                    walkCycle += delta * (moveState.sprint ? 14 : 9);
                    weaponHolder.position.x = Math.sin(walkCycle) * 0.015;
                    weaponHolder.position.y = Math.cos(walkCycle * 2) * 0.012;
                } else {
                    weaponHolder.position.x = THREE.MathUtils.lerp(weaponHolder.position.x, 0, 0.1);
                    weaponHolder.position.y = THREE.MathUtils.lerp(weaponHolder.position.y, 0, 0.1);
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
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousedown', fireWeapon);
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
                    <span>BIOME : <strong className="text-emerald-400 font-bold">{currentZoneName}</strong></span>
                </div>
                <div className="px-4 py-2 bg-slate-900/90 border border-zinc-700 rounded-xl backdrop-blur-md">
                    CIBLES : <strong className="text-emerald-400 font-bold">{targetsHit}</strong> / {totalTargets}
                </div>
            </div>

            {/* SÉLECTEUR D'ARMES DYNAMIQUE (Bas de l'écran) */}
            <div className="pointer-events-none absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 font-mono">
                {weaponsList.map((w, idx) => {
                    const isSelected = currentWeaponIndex === idx;
                    return (
                        <div
                            key={w.id}
                            className={`px-3 py-1.5 rounded-xl backdrop-blur-md transition-all border flex items-center gap-2 ${
                                isSelected
                                    ? 'bg-emerald-500/25 border-emerald-400 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)] scale-105'
                                    : 'bg-slate-950/80 border-white/10 text-zinc-400 opacity-70'
                            }`}
                        >
                            <span className="text-xs font-black text-emerald-400">[{idx + 1}]</span>
                            <span className="text-sm">{w.icon}</span>
                            <div className="text-left hidden sm:block">
                                <div className="text-xs font-bold leading-tight">{w.name}</div>
                                <div className="text-[10px] text-zinc-400">{w.type} • {w.rpm}</div>
                            </div>
                        </div>
                    );
                })}
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
                            Arsenal Réaliste • 5 Armes 3D
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider mb-2 text-white font-mono">
                            Armurerie & Monde 3D
                        </h2>
                        <p className="text-xs text-zinc-300 mb-6">
                            Testez 5 modèles d'armes 3D réalistes : <strong>Fusil d'Assaut [1]</strong>, <strong>Sniper AWM [2]</strong>, <strong>Fusil à Pompe [3]</strong>, <strong>Pistolet [4]</strong> et <strong>Lance-Plasma [5]</strong> ou via la molette de la souris.
                        </p>

                        <div className="space-y-2 mb-6 text-xs text-zinc-300 bg-zinc-900/90 p-4 rounded-xl border border-zinc-800 text-left font-mono">
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Changer d'arme :</span>
                                <strong className="text-emerald-400">Touches [1, 2, 3, 4, 5] ou Molette</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Déplacement :</span>
                                <strong className="text-zinc-100">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Saut & Escalade :</span>
                                <strong className="text-emerald-400">Espace (grimpez sur voitures & rochers)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Tir selon l'arme :</span>
                                <strong className="text-emerald-400">Clic Gauche (Balistique adaptée)</strong>
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

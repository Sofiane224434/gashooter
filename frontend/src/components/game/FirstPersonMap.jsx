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
    const totalTargets = 8;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // 1. Scene, Camera & Renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111827); // Ciel plus clair et visible
        scene.fog = new THREE.FogExp2(0x0f172a, 0.008); // Brouillard léger sans assombrir

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 1.7, 14);

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
        renderer.toneMappingExposure = 1.45; // Luminosité vive et contrastée
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // 2. Post-Processing (Bloom pour lueurs & OutputPass)
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.6, // Force équilibrée
            0.4,
            0.75
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // 3. Éclairages Puissants & Lumineux
        // Lumière ambiante claire
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        scene.add(ambientLight);

        // Soleil principal
        const sunLight = new THREE.DirectionalLight(0xf8fafc, 3.2);
        sunLight.position.set(35, 50, 25);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 140;
        sunLight.shadow.bias = -0.0004;
        scene.add(sunLight);

        // Lumière de débouchage opposée (Fill Light)
        const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.6);
        fillLight.position.set(-35, 40, -25);
        scene.add(fillLight);

        // Projecteurs de plafond de la station (Hangar Floodlights)
        const addFloodlight = (x, z, color = 0xffffff) => {
            const light = new THREE.PointLight(color, 4.5, 45, 1.2);
            light.position.set(x, 10, z);
            scene.add(light);

            // Lampe visible
            const bulbGeo = new THREE.SphereGeometry(0.3, 16, 16);
            const bulbMat = new THREE.MeshBasicMaterial({ color });
            const bulb = new THREE.Mesh(bulbGeo, bulbMat);
            bulb.position.set(x, 10, z);
            scene.add(bulb);
        };

        addFloodlight(-20, -20, 0x38bdf8);
        addFloodlight(20, -20, 0x10b981);
        addFloodlight(-20, 20, 0x10b981);
        addFloodlight(20, 20, 0x38bdf8);
        addFloodlight(0, 10, -25, 0xc084fc);

        // 4. Matériaux PBR Seamless
        const floorPbrMat = PBRTextureGenerator.createSciFiFloorMaterial(30, 30);
        const wallPbrMat = PBRTextureGenerator.createWallMaterial(10, 2);
        const cratePbrMat = PBRTextureGenerator.createCrateMaterial();

        // 5. Sol PBR
        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floor = new THREE.Mesh(floorGeo, floorPbrMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // 6. Système de Boîtes de Collision (AABB)
        const colliders = [];

        // Murs d'enceinte PBR
        const wallGeoH = new THREE.BoxGeometry(100, 8, 2);
        const wallNorth = new THREE.Mesh(wallGeoH, wallPbrMat);
        wallNorth.position.set(0, 4, -50);
        wallNorth.castShadow = true;
        wallNorth.receiveShadow = true;
        scene.add(wallNorth);
        colliders.push(new THREE.Box3().setFromObject(wallNorth));

        const wallSouth = new THREE.Mesh(wallGeoH, wallPbrMat);
        wallSouth.position.set(0, 4, 50);
        wallSouth.castShadow = true;
        wallSouth.receiveShadow = true;
        scene.add(wallSouth);
        colliders.push(new THREE.Box3().setFromObject(wallSouth));

        const wallGeoV = new THREE.BoxGeometry(2, 8, 100);
        const wallWest = new THREE.Mesh(wallGeoV, wallPbrMat);
        wallWest.position.set(-50, 4, 0);
        wallWest.castShadow = true;
        wallWest.receiveShadow = true;
        scene.add(wallWest);
        colliders.push(new THREE.Box3().setFromObject(wallWest));

        const wallEast = new THREE.Mesh(wallGeoV, wallPbrMat);
        wallEast.position.set(50, 4, 0);
        wallEast.castShadow = true;
        wallEast.receiveShadow = true;
        scene.add(wallEast);
        colliders.push(new THREE.Box3().setFromObject(wallEast));

        // 7. Caisses & Obstacles avec Collisions
        const addCrate = (x, y, z, size = 2) => {
            const geo = new THREE.BoxGeometry(size, size, size);
            const mesh = new THREE.Mesh(geo, cratePbrMat);
            mesh.position.set(x, y + size / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            colliders.push(new THREE.Box3().setFromObject(mesh));
            return mesh;
        };

        addCrate(6, 0, -4, 2.2);
        addCrate(6, 2.2, -4, 1.8);
        addCrate(8.4, 0, -4, 2);
        addCrate(-8, 0, 5, 2.5);
        addCrate(-8, 2.5, 5, 1.8);
        addCrate(15, 0, 2, 2.2);
        addCrate(-15, 0, -2, 2.2);

        // Piliers avec Collisions
        const addPillar = (x, z) => {
            const pillarGeo = new THREE.CylinderGeometry(1.4, 1.4, 10, 24);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.8 });
            const pillar = new THREE.Mesh(pillarGeo, pillarMat);
            pillar.position.set(x, 5, z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            scene.add(pillar);

            // Anneau néon
            const ringGeo = new THREE.TorusGeometry(1.5, 0.09, 16, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(x, 5, z);
            scene.add(ring);

            colliders.push(new THREE.Box3().setFromObject(pillar));
        };

        addPillar(-12, -12);
        addPillar(12, -12);
        addPillar(-12, 12);
        addPillar(12, 12);

        // Plateforme d'observation
        const platGeo = new THREE.BoxGeometry(20, 2, 14);
        const platMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
        const platform = new THREE.Mesh(platGeo, platMat);
        platform.position.set(0, 1, -28);
        platform.castShadow = true;
        platform.receiveShadow = true;
        scene.add(platform);
        colliders.push(new THREE.Box3().setFromObject(platform));

        // 8. Cibles Drones 3D
        const targetDrones = [];
        const dronePositions = [
            [-12, 4.5, -12],
            [12, 4.5, -12],
            [0, 5.5, -28],
            [-18, 3.5, 12],
            [18, 3.5, 12],
            [-25, 3.0, -8],
            [25, 3.0, -8],
            [0, 3.5, 18]
        ];

        dronePositions.forEach((pos) => {
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

        // 9. Arme FPS Sci-Fi
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

        // 10. Particules d'Étincelles (Sparks)
        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 8, 8);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });

        const createSparks = (pos) => {
            for (let i = 0; i < 14; i++) {
                const spark = new THREE.Mesh(sparkGeo, sparkMat);
                spark.position.copy(pos);
                const velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 9,
                    Math.random() * 7 + 2,
                    (Math.random() - 0.5) * 9
                );
                scene.add(spark);
                sparks.push({ mesh: spark, vel: velocity, life: 1.0 });
            }
        };

        // 11. PointerLockControls & Clavier
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
                        velocity.y = 8.5;
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

        // 12. Tirs Blaster
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
                        obj.position.x = (Math.random() - 0.5) * 65;
                        obj.position.z = (Math.random() - 0.5) * 65;
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

        // 13. Redimensionnement
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
            composer.setSize(w, h);
        };
        window.addEventListener('resize', handleResize);

        // 14. Moteur Physique & Détection des Collisions
        let prevTime = performance.now();
        let animId;
        let walkCycle = 0;
        const playerRadius = 0.55;

        // Fonction de vérification de collision avec le joueur
        const checkCollision = (posX, posZ, currentY) => {
            const playerBox = new THREE.Box3(
                new THREE.Vector3(posX - playerRadius, currentY - 1.6, posZ - playerRadius),
                new THREE.Vector3(posX + playerRadius, currentY + 0.2, posZ + playerRadius)
            );

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                // Si le joueur est en dessous du sommet de l'obstacle
                if (currentY - 1.5 < box.max.y && playerBox.intersectsBox(box)) {
                    return true;
                }
            }
            return false;
        };

        // Calcul de la hauteur du sol sous le joueur (sol normal ou dessus de caisse/plateforme)
        const getGroundHeight = (posX, posZ, currentY) => {
            let highestGround = 1.7; // Hauteur des yeux au sol normal (1.7m)

            for (let i = 0; i < colliders.length; i++) {
                const box = colliders[i];
                if (
                    posX >= box.min.x - playerRadius &&
                    posX <= box.max.x + playerRadius &&
                    posZ >= box.min.z - playerRadius &&
                    posZ <= box.max.z + playerRadius
                ) {
                    const standableY = box.max.y + 1.7;
                    // Si le joueur est au-dessus ou proche du sommet
                    if (currentY >= standableY - 0.6) {
                        if (standableY > highestGround) {
                            highestGround = standableY;
                        }
                    }
                }
            }
            return highestGround;
        };

        const animate = () => {
            animId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);

            // Drones flottants
            targetDrones.forEach((drone) => {
                drone.position.y = drone.userData.initialY + Math.sin(time * 0.003 + drone.userData.offset) * 0.35;
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
                // Frottements & Gravité
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 22.0 * delta; // Gravité

                direction.z = Number(moveState.forward) - Number(moveState.backward);
                direction.x = Number(moveState.right) - Number(moveState.left);
                direction.normalize();

                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                const baseSpeed = moveState.sprint ? 75.0 : 45.0;

                if (moveState.forward || moveState.backward) velocity.z -= direction.z * baseSpeed * delta;
                if (moveState.left || moveState.right) velocity.x -= direction.x * baseSpeed * delta;

                // Application du mouvement avec résolution de collision pas-à-pas
                const prevX = camera.position.x;
                const prevZ = camera.position.z;

                // 1. Déplacement latéral (X)
                controls.moveRight(-velocity.x * delta);
                if (checkCollision(camera.position.x, camera.position.z, camera.position.y)) {
                    camera.position.x = prevX;
                    velocity.x = 0;
                }

                // 2. Déplacement avant/arrière (Z)
                controls.moveForward(-velocity.z * delta);
                if (checkCollision(camera.position.x, camera.position.z, camera.position.y)) {
                    camera.position.z = prevZ;
                    velocity.z = 0;
                }

                // 3. Déplacement vertical & Hauteur du sol (Marche sur caisses / plateformes)
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

                // Limites extérieures absolues
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
            {/* 3D Canvas avec Post-Processing UnrealBloom & PBR */}
            <canvas
                ref={canvasRef}
                onClick={requestLock}
                className="w-full h-full block cursor-crosshair"
            />

            {/* Réticule de visée Sci-Fi */}
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

            {/* HUD Supérieur Sci-Fi */}
            <div className="pointer-events-none absolute top-4 left-6 z-20 flex items-center gap-4 font-mono text-xs sm:text-sm text-zinc-300">
                <div className="px-3.5 py-1.5 bg-slate-950/85 border border-emerald-500/40 rounded-xl backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>ZONE 3D : <strong className="text-emerald-400 font-bold">STATION ALPHA (PBR + COLLISIONS ACTIVES)</strong></span>
                </div>
                <div className="px-3.5 py-1.5 bg-slate-950/85 border border-zinc-700 rounded-xl backdrop-blur-md">
                    DRONES DÉTRUITS : <strong className="text-emerald-400 font-bold">{targetsHit}</strong> / {totalTargets}
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
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md text-white pointer-events-auto">
                    <div className="max-w-md w-full mx-4 p-8 bg-zinc-950/95 border border-emerald-500/30 rounded-2xl shadow-[0_0_60px_rgba(16,185,129,0.2)] text-center">
                        <div className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-mono font-bold tracking-widest uppercase mb-3">
                            Moteur 3D • Éclairage Amélioré & Collisions
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider mb-2 text-white font-mono">
                            Zone de Test Graphique
                        </h2>
                        <p className="text-xs text-zinc-400 mb-6">
                            L'environnement est maintenant plus lumineux avec un système physique de collisions réelles (murs, piliers, caisses montables).
                        </p>

                        <div className="space-y-2 mb-6 text-xs text-zinc-300 bg-zinc-900/80 p-4 rounded-xl border border-zinc-800 text-left font-mono">
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Regarder :</span>
                                <strong className="text-zinc-200">Mouvement Souris (360°)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Déplacement :</span>
                                <strong className="text-zinc-200">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Sauter / Monter :</span>
                                <strong className="text-zinc-200">Espace (grimpez sur les caisses)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Course (Sprint) :</span>
                                <strong className="text-zinc-200">Maj (Shift)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Tir Blaster :</span>
                                <strong className="text-emerald-400">Clic Gauche (Étincelles)</strong>
                            </div>
                            <div className="flex justify-between py-0.5">
                                <span className="text-zinc-400">Pause / Curseur :</span>
                                <strong className="text-zinc-200">Échap (ESC)</strong>
                            </div>
                        </div>

                        <button
                            onClick={requestLock}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-zinc-950 font-black uppercase tracking-wider rounded-xl transition text-sm cursor-pointer shadow-lg shadow-emerald-500/30"
                        >
                            ▶ Entrer dans la Zone 3D
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

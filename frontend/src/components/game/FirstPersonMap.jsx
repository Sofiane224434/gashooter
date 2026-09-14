import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sound } from '../../services/sound.js';
import { SaveService } from '../../services/saveService.js';

export default function FirstPersonMap({ onExit }) {
    const canvasRef = useRef(null);
    const onExitRef = useRef(onExit);
    onExitRef.current = onExit;

    const [isLocked, setIsLocked] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [score, setScore] = useState(0);
    const [shotsFired, setShotsFired] = useState(0);
    const [shotsHit, setShotsHit] = useState(0);
    const [savedStats, setSavedStats] = useState(() => SaveService.getSaveData());
    const [saveToast, setSaveToast] = useState(false);
    const [activeMessage, setActiveMessage] = useState('Cliquez pour verrouiller la vue et viser');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // --- 1. SCÈNE, CAMÉRA & RENDERER (ÉCLAIRAGE CLAIR & LUMINEUX) ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e293b); // Ardoise lumineuse
        scene.fog = new THREE.FogExp2(0x1e293b, 0.008);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        camera.position.set(0, 1.7, 18);

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

        // --- 2. POST-PROCESSING (BLOOM & NETTETÉ) ---
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3,
            0.3,
            0.85
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // --- 3. ÉCLAIRAGE HAUTE VISIBILITÉ ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.4);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 3.8);
        sunLight.position.set(25, 40, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 120;
        sunLight.shadow.camera.left = -40;
        sunLight.shadow.camera.right = 40;
        sunLight.shadow.camera.top = 40;
        sunLight.shadow.camera.bottom = -40;
        sunLight.shadow.bias = -0.0003;
        scene.add(sunLight);

        const skyFill = new THREE.DirectionalLight(0x93c5fd, 1.6);
        skyFill.position.set(-25, 20, -25);
        scene.add(skyFill);

        // --- 4. MATÉRIAUX DESIGN SYSTEM LUMINEUX ---
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x334155, // Dalles béton ardoise claire
            roughness: 0.5,
            metalness: 0.2
        });
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x475569, // Parois gris métallisé clair
            roughness: 0.6,
            metalness: 0.3
        });
        const columnMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.35,
            metalness: 0.8
        });
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.4,
            metalness: 0.5
        });
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

        // --- 5. GÉOMÉTRIE DE L'ARÈNE & COLLISIONS ---
        const colliders = [];
        const registerBox = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            return box;
        };

        // Sol principal
        const floorGeo = new THREE.PlaneGeometry(65, 65);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Lignes de guidage lumineuses
        const addGroundMark = (x, z, w, d, mat = neonCyanMat) => {
            const geo = new THREE.PlaneGeometry(w, d);
            const strip = new THREE.Mesh(geo, mat);
            strip.position.set(x, 0.015, z);
            strip.rotation.x = -Math.PI / 2;
            scene.add(strip);
        };
        addGroundMark(0, -10, 45, 0.25, neonCyanMat);
        addGroundMark(0, 10, 45, 0.25, neonCyanMat);
        addGroundMark(-16, 0, 0.25, 35, neonOrangeMat);
        addGroundMark(16, 0, 0.25, 35, neonOrangeMat);

        // Murs d'enceinte
        const wallH = 10;
        const addWall = (x, y, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const wall = new THREE.Mesh(geo, wallMat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerBox(wall);
        };
        addWall(0, wallH / 2, -32, 65, wallH, 1.5);
        addWall(0, wallH / 2, 32, 65, wallH, 1.5);
        addWall(-32, wallH / 2, 0, 1.5, wallH, 65);
        addWall(32, wallH / 2, 0, 1.5, wallH, 65);

        // Piliers avec anneaux néon
        const addPillar = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const pGeo = new THREE.BoxGeometry(2.4, 8, 2.4);
            const pillar = new THREE.Mesh(pGeo, columnMat);
            pillar.position.y = 4;
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            group.add(pillar);

            const rGeo = new THREE.BoxGeometry(2.5, 0.2, 2.5);
            const ring = new THREE.Mesh(rGeo, neonCyanMat);
            ring.position.y = 4;
            group.add(ring);

            scene.add(group);
            registerBox(pillar);
        };
        addPillar(-12, -8);
        addPillar(12, -8);
        addPillar(-12, 12);
        addPillar(12, 12);

        // Plateformes surélevées avec rampes
        const addPlatform = (x, y, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mesh = new THREE.Mesh(geo, platformMat);
            mesh.position.set(x, y + h / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            registerBox(mesh);

            const rampGeo = new THREE.BoxGeometry(w, 0.4, 4);
            const ramp = new THREE.Mesh(rampGeo, platformMat);
            ramp.position.set(x, (y + h) / 2, z + d / 2 + 1.8);
            ramp.rotation.x = -Math.atan2(y + h, 4);
            ramp.castShadow = true;
            ramp.receiveShadow = true;
            scene.add(ramp);
            registerBox(ramp);
        };
        addPlatform(-18, 0, -18, 8, 2.0, 8);
        addPlatform(18, 0, -18, 8, 2.5, 8);
        addPlatform(0, 0, -22, 10, 3.0, 6);

        // --- 6. CIBLES D'ENTRAÎNEMENT ULTRA-VISIBLES ---
        const targetObjects = [];
        const targetPositions = [
            [-8, 2.8, -12],
            [8, 2.8, -12],
            [-18, 4.5, -18],
            [18, 5.0, -18],
            [0, 5.5, -22],
            [-22, 3.0, 0],
            [22, 3.0, 0],
            [-14, 2.5, 8],
            [14, 2.5, 8],
            [0, 3.2, -6]
        ];

        targetPositions.forEach((pos, idx) => {
            const group = new THREE.Group();
            group.position.set(pos[0], pos[1], pos[2]);

            // Cœur de cible lumineux orange/rouge
            const coreGeo = new THREE.SphereGeometry(0.55, 24, 24);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xf97316,
                emissive: 0xe11d48,
                emissiveIntensity: 0.9,
                metalness: 0.2,
                roughness: 0.1
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.castShadow = true;
            group.add(core);

            // Double anneau orbital cyan
            const ringGeo = new THREE.TorusGeometry(0.9, 0.06, 16, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            group.add(ring);

            // Point central blanc (Bullseye)
            const dotGeo = new THREE.SphereGeometry(0.18, 16, 16);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            group.add(dot);

            group.userData = {
                isTarget: true,
                index: idx,
                core,
                ring,
                dot,
                initialY: pos[1],
                timeOffset: idx * 0.8
            };

            scene.add(group);
            targetObjects.push(group);
        });

        // --- 7. ARME TACTIQUE PREMIÈRE PERSONNE AVEC VISEUR HAUTE VISIBILITÉ ---
        const weaponPivot = new THREE.Group();
        const weaponMeshGroup = new THREE.Group();

        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.3 });
        const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.2 });
        const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        // Corps de l'arme
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.6), gunMetalMat);
        body.position.set(0.24, -0.22, -0.45);
        body.castShadow = true;
        weaponMeshGroup.add(body);

        // Canon
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16), gunSteelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.24, -0.18, -0.8);
        weaponMeshGroup.add(barrel);

        // Frein de bouche
        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), gunSteelMat);
        muzzle.position.set(0.24, -0.18, -1.06);
        weaponMeshGroup.add(muzzle);

        // Chargeur
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), gunSteelMat);
        mag.position.set(0.24, -0.36, -0.42);
        mag.rotation.x = Math.PI / 12;
        weaponMeshGroup.add(mag);

        // Poignée
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gunMetalMat);
        grip.position.set(0.24, -0.34, -0.26);
        grip.rotation.x = -Math.PI / 6;
        weaponMeshGroup.add(grip);

        // Viseur Holographique Élevé (Haute Visibilité)
        const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.16), gunMetalMat);
        sightBase.position.set(0.24, -0.11, -0.45);
        weaponMeshGroup.add(sightBase);

        // Cadre de lentille
        const sightFrame = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 16), gunMetalMat);
        sightFrame.position.set(0.24, -0.065, -0.5);
        weaponMeshGroup.add(sightFrame);

        // Réticule point rouge lumineux
        const sightDot = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.016, 16), sightGlowMat);
        sightDot.position.set(0.24, -0.065, -0.5);
        weaponMeshGroup.add(sightDot);

        // Muzzle flash lumineux
        const flashLight = new THREE.PointLight(0xffedd5, 0, 8);
        flashLight.position.set(0.24, -0.18, -1.1);
        weaponMeshGroup.add(flashLight);

        weaponPivot.add(weaponMeshGroup);
        camera.add(weaponPivot);
        scene.add(camera);

        const hipPosition = new THREE.Vector3(0, 0, 0);
        const adsPosition = new THREE.Vector3(-0.24, 0.065, 0.08); // Réticule pile au centre de l'écran en ADS
        let isAimingADS = false;

        // --- 8. SYSTÈME DE VRAIES BALLES 3D PHYSIQUES (TRACER BULLETS) ---
        const bullets = [];
        const bulletGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfde047 }); // Laiton lumineux

        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

        const createSparks = (pos) => {
            for (let i = 0; i < 12; i++) {
                const spark = new THREE.Mesh(sparkGeo, sparkMat);
                spark.position.copy(pos);
                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 8,
                    Math.random() * 6 + 1,
                    (Math.random() - 0.5) * 8
                );
                scene.add(spark);
                sparks.push({ mesh: spark, vel, life: 0.7 });
            }
        };

        const spawnBullet = () => {
            // Point de départ au bout du canon
            const muzzleWorldPos = new THREE.Vector3();
            muzzle.getWorldPosition(muzzleWorldPos);

            const bullet = new THREE.Mesh(bulletGeo, bulletMat);
            bullet.position.copy(muzzleWorldPos);

            // Direction de tir précise depuis le centre de la caméra
            const shootDir = new THREE.Vector3();
            camera.getWorldDirection(shootDir);
            bullet.quaternion.copy(camera.quaternion);

            scene.add(bullet);
            bullets.push({
                mesh: bullet,
                dir: shootDir.clone(),
                speed: 180.0, // Vélocité en m/s
                startPos: muzzleWorldPos.clone(),
                distTravelled: 0,
                maxDist: 200.0
            });
        };

        // --- 9. CONTRÔLES & MOUVEMENT DU JOUEUR ---
        const controls = new PointerLockControls(camera, canvas);

        const onLock = () => {
            setIsLocked(true);
            setActiveMessage('Entraînement en cours - Visez les cibles holographiques');
        };
        const onUnlock = () => {
            setIsLocked(false);
            isAimingADS = false;
            setIsAiming(false);
            setActiveMessage('Pause - Cliquez pour reprendre le contrôle');
        };
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

        // --- 10. DÉCLENCHEMENT DU TIR ---
        const fireWeapon = () => {
            if (!controls.isLocked) return;

            setShotsFired((prev) => prev + 1);
            sound.playGunshot(); // Son d'arme à feu réaliste multi-couches
            spawnBullet();       // Vraie balle 3D physique avec tracer

            // Recul de l'arme
            const recoilAmount = isAimingADS ? 0.05 : 0.12;
            const recoilRot = isAimingADS ? 0.03 : 0.08;
            weaponMeshGroup.position.z += recoilAmount;
            weaponMeshGroup.rotation.x += recoilRot;
            flashLight.intensity = 6;

            setTimeout(() => {
                weaponMeshGroup.position.z = 0;
                weaponMeshGroup.rotation.x = 0;
                flashLight.intensity = 0;
            }, 60);
        };

        // Gestion Souris : Clic Gauche = Tir, Clic Droit = Visée (ADS)
        const onMouseDown = (e) => {
            if (!controls.isLocked) return;
            if (e.button === 0) {
                fireWeapon();
            } else if (e.button === 2) {
                isAimingADS = true;
                setIsAiming(true);
            }
        };

        const onMouseUp = (e) => {
            if (e.button === 2) {
                isAimingADS = false;
                setIsAiming(false);
            }
        };

        const onContextMenu = (e) => e.preventDefault();

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('contextmenu', onContextMenu);

        // --- 11. BOUCLE PRINCIPALE & PHYSIQUE DES BALLES ---
        let prevTime = performance.now();
        let bobTimer = 0;
        let animationFrameId;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);
            prevTime = time;

            // Rotation douce et lévitation des cibles
            targetObjects.forEach((t) => {
                t.userData.ring.rotation.z += delta * 1.5;
                t.userData.ring.rotation.x += delta * 0.8;
                t.position.y = t.userData.initialY + Math.sin(time * 0.003 + t.userData.timeOffset) * 0.25;
            });

            // Mise à jour de la physique des vraies balles 3D
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                const stepDist = b.speed * delta;
                const oldPos = b.mesh.position.clone();
                b.mesh.position.addScaledVector(b.dir, stepDist);
                b.distTravelled += stepDist;

                // Raycast le long du trajet de la balle pour détection d'impact
                const stepRay = new THREE.Raycaster(oldPos, b.dir, 0, stepDist + 0.5);
                const intersects = stepRay.intersectObjects(scene.children, true);

                let collided = false;
                if (intersects.length > 0) {
                    for (const hit of intersects) {
                        if (hit.object === b.mesh || hit.object.parent === weaponMeshGroup) continue;

                        collided = true;
                        createSparks(hit.point);

                        let obj = hit.object;
                        while (obj.parent && !obj.userData?.isTarget && obj.parent !== scene) {
                            obj = obj.parent;
                        }

                        if (obj && obj.userData && obj.userData.isTarget) {
                            sound.playHitmarker();
                            setShotsHit((prev) => prev + 1);
                            setScore((prev) => {
                                const newScore = prev + 100;
                                // Sauvegarde automatique persistante
                                const updated = SaveService.saveGameSession({
                                    score: newScore,
                                    shotsFired: 0,
                                    shotsHit: 1,
                                    targetsDestroyed: 1
                                });
                                if (updated) {
                                    setSavedStats(updated);
                                    setSaveToast(true);
                                    setTimeout(() => setSaveToast(false), 2000);
                                }
                                return newScore;
                            });

                            obj.userData.core.material.emissive.setHex(0xffffff);
                            obj.userData.core.material.color.setHex(0xffffff);

                            setTimeout(() => {
                                obj.position.x = (Math.random() - 0.5) * 44;
                                obj.position.z = -10 - Math.random() * 16;
                                obj.userData.core.material.emissive.setHex(0xe11d48);
                                obj.userData.core.material.color.setHex(0xf97316);
                            }, 250);
                        }
                        break;
                    }
                }

                if (collided || b.distTravelled >= b.maxDist) {
                    scene.remove(b.mesh);
                    bullets.splice(i, 1);
                }
            }

            // Particules d'étincelles
            for (let i = sparks.length - 1; i >= 0; i--) {
                const s = sparks[i];
                s.life -= delta * 2;
                s.mesh.position.addScaledVector(s.vel, delta);
                s.vel.y -= 9.8 * delta;
                if (s.life <= 0) {
                    scene.remove(s.mesh);
                    sparks.splice(i, 1);
                }
            }

            if (controls.isLocked) {
                // Frottement & Amortissement
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 22.0 * delta;

                const baseSpeed = moveState.sprint ? 14.0 : 8.5;
                const speed = isAimingADS ? baseSpeed * 0.55 : baseSpeed;
                const dir = new THREE.Vector3();

                if (moveState.forward) dir.z += 1;
                if (moveState.backward) dir.z -= 1;
                if (moveState.left) dir.x -= 1;
                if (moveState.right) dir.x += 1;
                dir.normalize();

                if (moveState.forward || moveState.backward) velocity.z += dir.z * speed * 10.0 * delta;
                if (moveState.left || moveState.right) velocity.x += dir.x * speed * 10.0 * delta;

                // Collisions orthogonales X / Z
                const oldX = camera.position.x;
                controls.moveRight(velocity.x * delta);
                const playerBoxX = new THREE.Box3(
                    new THREE.Vector3(camera.position.x - 0.4, camera.position.y - 1.5, camera.position.z - 0.4),
                    new THREE.Vector3(camera.position.x + 0.4, camera.position.y + 0.3, camera.position.z + 0.4)
                );
                for (const col of colliders) {
                    if (playerBoxX.intersectsBox(col)) {
                        camera.position.x = oldX;
                        velocity.x = 0;
                        break;
                    }
                }

                const oldZ = camera.position.z;
                controls.moveForward(velocity.z * delta);
                const playerBoxZ = new THREE.Box3(
                    new THREE.Vector3(camera.position.x - 0.4, camera.position.y - 1.5, camera.position.z - 0.4),
                    new THREE.Vector3(camera.position.x + 0.4, camera.position.y + 0.3, camera.position.z + 0.4)
                );
                for (const col of colliders) {
                    if (playerBoxZ.intersectsBox(col)) {
                        camera.position.z = oldZ;
                        velocity.z = 0;
                        break;
                    }
                }

                // Gravité et support des sols/plateformes
                camera.position.y += velocity.y * delta;
                let groundY = 1.7;
                for (const col of colliders) {
                    if (
                        camera.position.x >= col.min.x - 0.35 &&
                        camera.position.x <= col.max.x + 0.35 &&
                        camera.position.z >= col.min.z - 0.35 &&
                        camera.position.z <= col.max.z + 0.35
                    ) {
                        const topY = col.max.y + 1.7;
                        if (camera.position.y <= topY + 0.4 && topY >= groundY) {
                            groundY = topY;
                        }
                    }
                }

                if (camera.position.y <= groundY) {
                    camera.position.y = groundY;
                    velocity.y = 0;
                    canJump = true;
                }

                // Transition FOV et centrage de visée (ADS)
                const targetFov = isAimingADS ? 44 : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 14);
                camera.updateProjectionMatrix();

                const targetPivotPos = isAimingADS ? adsPosition : hipPosition;
                weaponPivot.position.lerp(targetPivotPos, delta * 16);

                // Weapon sway / bobbing au pas
                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                if (isMoving && canJump && !isAimingADS) {
                    bobTimer += delta * (moveState.sprint ? 14 : 9);
                    weaponMeshGroup.position.x = Math.sin(bobTimer) * 0.015;
                    weaponMeshGroup.position.y = Math.cos(bobTimer * 2) * 0.01;
                } else if (isAimingADS) {
                    bobTimer += delta * 2;
                    weaponMeshGroup.position.x = Math.sin(bobTimer) * 0.001;
                    weaponMeshGroup.position.y = Math.cos(bobTimer * 2) * 0.001;
                } else {
                    weaponMeshGroup.position.x = 0;
                    weaponMeshGroup.position.y = 0;
                }
            }

            composer.render();
        };

        animate();

        // --- 12. REDIMENSIONNEMENT & CLEANUP ---
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
            composer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('contextmenu', onContextMenu);
            controls.removeEventListener('lock', onLock);
            controls.removeEventListener('unlock', onUnlock);
            controls.dispose();
            renderer.dispose();
        };
    }, []);

    const accuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 100;

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none font-sans">
            {/* Canvas 3D */}
            <canvas
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair"
                onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas && !isLocked) canvas.requestPointerLock();
                }}
            />

            {/* Réticule de visée haute précision */}
            {isLocked && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        {/* Point central rouge éclatant */}
                        <div className={`rounded-full transition-all duration-150 ${
                            isAiming
                                ? 'w-2 h-2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] ring-2 ring-red-400/80'
                                : 'w-1.5 h-1.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]'
                        }`}></div>

                        {/* Barres réticule au jugé */}
                        <div className={`absolute w-4 h-0.5 bg-cyan-400/80 -left-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute w-4 h-0.5 bg-cyan-400/80 -right-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-4 w-0.5 bg-cyan-400/80 -top-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-4 w-0.5 bg-cyan-400/80 -bottom-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                    </div>
                </div>
            )}

            {/* HUD Supérieur : Score, Précision, Carrière & Sauvegarde */}
            <div className="pointer-events-none absolute top-6 left-8 right-8 flex items-center justify-between text-white">
                <div className="flex items-center space-x-6 bg-slate-900/85 backdrop-blur border border-slate-700/70 px-5 py-3 rounded-lg shadow-xl">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Session</div>
                        <div className="text-2xl font-black text-cyan-400 tracking-tight">{score}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Précision</div>
                        <div className="text-xl font-bold text-slate-200">{accuracy}%</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Touches</div>
                        <div className="text-xl font-bold text-emerald-400">{shotsHit} / {shotsFired}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">Record Sauvegardé</div>
                        <div className="text-xl font-bold text-amber-300">{savedStats?.highScore || 0} pts</div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {/* Badge Toast de Sauvegarde Automatique */}
                    {saveToast && (
                        <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center space-x-1.5 animate-bounce shadow-lg">
                            <span>💾</span>
                            <span>Progression Sauvegardée</span>
                        </div>
                    )}

                    {isAiming && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-3 py-1.5 rounded text-[11px] font-bold tracking-widest uppercase animate-pulse">
                            ADS ACTIF • ZOOM 1.8X
                        </div>
                    )}

                    <div className="bg-slate-900/85 backdrop-blur border border-slate-700/70 px-4 py-2.5 rounded-lg text-xs tracking-wider text-slate-300">
                        STAND DE TIR • <span className="text-cyan-400 font-medium">GASHOOTER</span>
                    </div>
                </div>
            </div>

            {/* HUD Inférieur : Commandes & Aide */}
            <div className="pointer-events-none absolute bottom-6 left-8 right-8 flex items-end justify-between">
                <div className="bg-slate-900/85 backdrop-blur border border-slate-700/70 px-4 py-3 rounded-lg text-xs text-slate-300 space-y-1 shadow-xl">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Commandes</div>
                    <div><span className="text-cyan-400 font-semibold">[Z / Q / S / D]</span> : Se déplacer • <span className="text-cyan-400 font-semibold">[ESPACE]</span> : Sauter</div>
                    <div><span className="text-cyan-400 font-semibold">[CLIC GAUCHE]</span> : Tirer (Balles 3D) • <span className="text-cyan-400 font-semibold">[CLIC DROIT MAINTENU]</span> : 🎯 Viser (ADS Zoom)</div>
                    <div><span className="text-cyan-400 font-semibold">[SHIFT]</span> : Courir • <span className="text-cyan-400 font-semibold">[ÉCHAP]</span> : Menu</div>
                </div>

                <button
                    onClick={() => {
                        SaveService.saveGameSession({
                            score,
                            shotsFired,
                            shotsHit,
                            targetsDestroyed: shotsHit
                        });
                        onExitRef.current();
                    }}
                    className="pointer-events-auto px-5 py-2.5 bg-slate-800/90 hover:bg-red-950/80 text-slate-300 hover:text-red-300 border border-slate-700 hover:border-red-700/50 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all shadow-md cursor-pointer"
                >
                    Quitter l'entraînement
                </button>
            </div>

            {/* Overlay d'accueil / pause */}
            {!isLocked && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                    <div className="bg-slate-900/95 border border-slate-700 p-8 rounded-xl max-w-md w-full text-center shadow-2xl space-y-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-2xl font-bold">
                            🎯
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-white tracking-wide uppercase">
                                Stand de Tir Tactique
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">
                                {activeMessage}
                            </p>
                        </div>

                        {/* Statistiques sauvegardées de carrière */}
                        <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 text-left text-xs space-y-1.5 text-slate-300">
                            <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Statistiques de Carrière Sauvegardées</div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Meilleur Score :</span>
                                <span className="font-semibold text-amber-300">{savedStats?.highScore || 0} pts</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Cibles Totales Abattues :</span>
                                <span className="font-semibold text-emerald-400">{savedStats?.totalTargetsDestroyed || 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Sessions Jouées :</span>
                                <span className="font-semibold text-slate-200">{savedStats?.gamesPlayed || 0}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    const canvas = canvasRef.current;
                                    if (canvas) canvas.requestPointerLock();
                                }}
                                className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-sm uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
                            >
                                Commencer à Tirer
                            </button>
                            <button
                                onClick={() => onExitRef.current()}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs uppercase tracking-wider transition-colors cursor-pointer"
                            >
                                Retour au Menu Principal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

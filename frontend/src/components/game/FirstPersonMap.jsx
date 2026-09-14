import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export default function FirstPersonMap({ onExit }) {
    const canvasRef = useRef(null);
    const onExitRef = useRef(onExit);
    onExitRef.current = onExit;

    const [isLocked, setIsLocked] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [score, setScore] = useState(0);
    const [shotsFired, setShotsFired] = useState(0);
    const [shotsHit, setShotsHit] = useState(0);
    const [activeMessage, setActiveMessage] = useState('Cliquez pour verrouiller la vue et viser');

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // --- 1. SCÈNE, CAMÉRA & RENDERER ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0e17);
        scene.fog = new THREE.FogExp2(0x0a0e17, 0.015);

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
        renderer.toneMappingExposure = 1.2;
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        // --- 2. POST-PROCESSING (BLOOM SUBTIL) ---
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.35,
            0.4,
            0.8
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // --- 3. ÉCLAIRAGE COHÉRENT & ÉPURÉ ---
        const ambientLight = new THREE.AmbientLight(0x1e293b, 1.8);
        scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xe2e8f0, 2.5);
        mainLight.position.set(20, 30, 25);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 0.5;
        mainLight.shadow.camera.far = 100;
        mainLight.shadow.camera.left = -35;
        mainLight.shadow.camera.right = 35;
        mainLight.shadow.camera.top = 35;
        mainLight.shadow.camera.bottom = -35;
        mainLight.shadow.bias = -0.0005;
        scene.add(mainLight);

        const cyanBacklight = new THREE.PointLight(0x06b6d4, 3.0, 40);
        cyanBacklight.position.set(0, 8, -20);
        scene.add(cyanBacklight);

        const amberAccent = new THREE.PointLight(0xf59e0b, 2.0, 30);
        amberAccent.position.set(-15, 6, 0);
        scene.add(amberAccent);

        // --- 4. MATÉRIAUX DESIGN SYSTEM UNIFIÉ ---
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x111827,
            roughness: 0.65,
            metalness: 0.2
        });
        const gridWallMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.8,
            metalness: 0.3
        });
        const columnMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.4,
            metalness: 0.7
        });
        const accentNeonMat = new THREE.MeshBasicMaterial({
            color: 0x38bdf8
        });
        const platformMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.5,
            metalness: 0.5
        });

        // --- 5. GÉOMÉTRIE DE L'ARÈNE (COLLISIONS SOLIDES) ---
        const colliders = [];

        const registerBox = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            return box;
        };

        // Sol principal
        const floorGeo = new THREE.PlaneGeometry(60, 60);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // Murs d'enceinte
        const wallH = 10;
        const addWall = (x, y, z, w, h, d) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const wall = new THREE.Mesh(geo, gridWallMat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerBox(wall);
        };
        addWall(0, wallH / 2, -30, 60, wallH, 1.5);
        addWall(0, wallH / 2, 30, 60, wallH, 1.5);
        addWall(-30, wallH / 2, 0, 1.5, wallH, 60);
        addWall(30, wallH / 2, 0, 1.5, wallH, 60);

        // Lignes lumineuses au sol
        const addGroundStrip = (x, z, w, d) => {
            const geo = new THREE.PlaneGeometry(w, d);
            const strip = new THREE.Mesh(geo, accentNeonMat);
            strip.position.set(x, 0.01, z);
            strip.rotation.x = -Math.PI / 2;
            scene.add(strip);
        };
        addGroundStrip(0, -10, 40, 0.2);
        addGroundStrip(0, 10, 40, 0.2);
        addGroundStrip(-15, 0, 0.2, 30);
        addGroundStrip(15, 0, 0.2, 30);

        // Piliers avec bandes néon
        const addPillar = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0, z);

            const pillarGeo = new THREE.BoxGeometry(2.2, 8, 2.2);
            const pillar = new THREE.Mesh(pillarGeo, columnMat);
            pillar.position.y = 4;
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            group.add(pillar);

            const ringGeo = new THREE.BoxGeometry(2.3, 0.15, 2.3);
            const ring = new THREE.Mesh(ringGeo, accentNeonMat);
            ring.position.y = 4;
            group.add(ring);

            scene.add(group);
            registerBox(pillar);
        };
        addPillar(-12, -8);
        addPillar(12, -8);
        addPillar(-12, 12);
        addPillar(12, 12);

        // Plateformes surélevées
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

        // --- 6. CIBLES D'ENTRAÎNEMENT RÉACTIVES ---
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

            const coreGeo = new THREE.SphereGeometry(0.5, 24, 24);
            const coreMat = new THREE.MeshStandardMaterial({
                color: 0xef4444,
                emissive: 0xdc2626,
                emissiveIntensity: 0.6,
                metalness: 0.3,
                roughness: 0.2
            });
            const core = new THREE.Mesh(coreGeo, coreMat);
            core.castShadow = true;
            group.add(core);

            const ringGeo = new THREE.TorusGeometry(0.85, 0.05, 16, 32);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            group.add(ring);

            group.userData = {
                isTarget: true,
                index: idx,
                core,
                ring,
                initialY: pos[1],
                timeOffset: idx * 0.8
            };

            scene.add(group);
            targetObjects.push(group);
        });

        // --- 7. ARME TACTIQUE PREMIÈRE PERSONNE ---
        const weaponPivot = new THREE.Group();
        const weaponMeshGroup = new THREE.Group();

        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.3 });
        const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.2 });
        const gunSightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

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

        // Viseur Point Rouge (Holographic Red Dot)
        const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.14), gunMetalMat);
        sightBase.position.set(0.24, -0.12, -0.45);
        weaponMeshGroup.add(sightBase);

        const sightDot = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.024, 16), gunSightMat);
        sightDot.position.set(0.24, -0.095, -0.5);
        weaponMeshGroup.add(sightDot);

        // Muzzle flash lumineux
        const flashLight = new THREE.PointLight(0xffedd5, 0, 6);
        flashLight.position.set(0.24, -0.18, -1.1);
        weaponMeshGroup.add(flashLight);

        weaponPivot.add(weaponMeshGroup);
        camera.add(weaponPivot);
        scene.add(camera);

        // Positions cibles pour le Tir au jugé (Hip-fire) vs Visée épaulée (ADS)
        const hipPosition = new THREE.Vector3(0, 0, 0);
        const adsPosition = new THREE.Vector3(-0.24, 0.095, 0.08); // Centre le réticule rouge pile sur la ligne de visée
        let isAimingADS = false;

        // --- 8. AUDIO SYNTHÉTISÉ ---
        let audioCtx = null;
        const playShotSound = () => {
            try {
                if (!audioCtx) {
                    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                }
                if (audioCtx.state === 'suspended') audioCtx.resume();

                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(40, now + 0.08);

                gain.gain.setValueAtTime(0.3, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.08);
            } catch (e) {}
        };

        const playHitSound = () => {
            try {
                if (!audioCtx) return;
                const now = audioCtx.currentTime;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();

                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1320, now + 0.06);

                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

                osc.connect(gain);
                gain.connect(audioCtx.destination);

                osc.start(now);
                osc.stop(now + 0.06);
            } catch (e) {}
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

        // --- 10. SYSTÈME DE TIR & IMPACTS ---
        const raycaster = new THREE.Raycaster();
        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

        const createSparks = (pos) => {
            for (let i = 0; i < 10; i++) {
                const spark = new THREE.Mesh(sparkGeo, sparkMat);
                spark.position.copy(pos);
                const vel = new THREE.Vector3(
                    (Math.random() - 0.5) * 6,
                    Math.random() * 5 + 1,
                    (Math.random() - 0.5) * 6
                );
                scene.add(spark);
                sparks.push({ mesh: spark, vel, life: 0.8 });
            }
        };

        const fireWeapon = () => {
            if (!controls.isLocked) return;

            setShotsFired((prev) => prev + 1);
            playShotSound();

            // Recul de l'arme
            const recoilAmount = isAimingADS ? 0.06 : 0.12;
            const recoilRot = isAimingADS ? 0.04 : 0.08;
            weaponMeshGroup.position.z += recoilAmount;
            weaponMeshGroup.rotation.x += recoilRot;
            flashLight.intensity = 5;

            setTimeout(() => {
                weaponMeshGroup.position.z = 0;
                weaponMeshGroup.rotation.x = 0;
                flashLight.intensity = 0;
            }, 60);

            // Raycast central
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
                    playHitSound();
                    setShotsHit((prev) => prev + 1);
                    setScore((prev) => prev + 100);

                    obj.userData.core.material.emissive.setHex(0xffffff);
                    obj.userData.core.material.color.setHex(0xffffff);

                    setTimeout(() => {
                        obj.position.x = (Math.random() - 0.5) * 44;
                        obj.position.z = -10 - Math.random() * 16;
                        obj.userData.core.material.emissive.setHex(0xdc2626);
                        obj.userData.core.material.color.setHex(0xef4444);
                    }, 250);
                }
            }
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

        const onContextMenu = (e) => {
            e.preventDefault(); // Empêcher le menu contextuel du clic droit
        };

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('contextmenu', onContextMenu);

        // --- 11. BOUCLE PRINCIPALE & PHYSIQUE FLUIDE ---
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

                // Vitesse ralentie si en cours de visée (ADS)
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

                // Test de déplacement en X avec collision
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

                // Test de déplacement en Z avec collision
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

                // Test de gravité en Y
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

                // --- GESTION VISÉE (ADS) ET TRANSITION FLUIDE ---
                const targetFov = isAimingADS ? 44 : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 14);
                camera.updateProjectionMatrix();

                const targetPivotPos = isAimingADS ? adsPosition : hipPosition;
                weaponPivot.position.lerp(targetPivotPos, delta * 16);

                // Weapon sway / bobbing au pas (atténué si en visée)
                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                if (isMoving && canJump && !isAimingADS) {
                    bobTimer += delta * (moveState.sprint ? 14 : 9);
                    weaponMeshGroup.position.x = Math.sin(bobTimer) * 0.015;
                    weaponMeshGroup.position.y = Math.cos(bobTimer * 2) * 0.01;
                } else if (isAimingADS) {
                    // Respiration subtile au viseur
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

        // --- 12. REDIMENSIONNEMENT ---
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
        <div className="relative w-screen h-screen overflow-hidden bg-black select-none font-sans">
            {/* Canvas 3D */}
            <canvas
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair"
                onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas && !isLocked) canvas.requestPointerLock();
                }}
            />

            {/* Réticule de visée tactique dynamique */}
            {isLocked && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        {/* Point central fin */}
                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-150 ${
                            isAiming ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] scale-75' : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]'
                        }`}></div>

                        {/* Barres réticule au jugé (s'estompent en mode visée ADS) */}
                        <div className={`absolute w-4 h-0.5 bg-cyan-400/70 -left-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute w-4 h-0.5 bg-cyan-400/70 -right-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-4 w-0.5 bg-cyan-400/70 -top-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-4 w-0.5 bg-cyan-400/70 -bottom-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                    </div>
                </div>
            )}

            {/* HUD Supérieur : Score, Précision, Touches */}
            <div className="pointer-events-none absolute top-6 left-8 right-8 flex items-center justify-between text-white">
                <div className="flex items-center space-x-6 bg-slate-900/80 backdrop-blur border border-slate-700/60 px-5 py-3 rounded-lg shadow-lg">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Score</div>
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
                </div>

                <div className="flex items-center space-x-3">
                    {isAiming && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-3 py-1.5 rounded text-[11px] font-bold tracking-widest uppercase animate-pulse">
                            ADS ACTIF • ZOOM 1.8X
                        </div>
                    )}
                    <div className="bg-slate-900/80 backdrop-blur border border-slate-700/60 px-4 py-2.5 rounded-lg text-xs tracking-wider text-slate-300">
                        STAND DE TIR • <span className="text-cyan-400 font-medium">GASHOOTER</span>
                    </div>
                </div>
            </div>

            {/* HUD Inférieur : Commandes & Aide */}
            <div className="pointer-events-none absolute bottom-6 left-8 right-8 flex items-end justify-between">
                <div className="bg-slate-900/80 backdrop-blur border border-slate-700/60 px-4 py-3 rounded-lg text-xs text-slate-300 space-y-1 shadow-lg">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Commandes</div>
                    <div><span className="text-cyan-400 font-semibold">[Z / Q / S / D]</span> : Se déplacer • <span className="text-cyan-400 font-semibold">[ESPACE]</span> : Sauter</div>
                    <div><span className="text-cyan-400 font-semibold">[CLIC GAUCHE]</span> : Tirer • <span className="text-cyan-400 font-semibold">[CLIC DROIT MAINTENU]</span> : 🎯 Viser (ADS Zoom)</div>
                    <div><span className="text-cyan-400 font-semibold">[SHIFT]</span> : Courir • <span className="text-cyan-400 font-semibold">[ÉCHAP]</span> : Menu</div>
                </div>

                {/* Bouton Quitter */}
                <button
                    onClick={() => onExitRef.current()}
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

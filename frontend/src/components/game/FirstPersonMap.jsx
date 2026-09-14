import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { sound } from '../../services/sound.js';
import { SaveService } from '../../services/saveService.js';
import { MultiplayerClient } from '../../services/multiplayerClient.js';

export default function FirstPersonMap({ onExit, initialMode = 'multiplayer' }) {
    const canvasRef = useRef(null);
    const onExitRef = useRef(onExit);
    onExitRef.current = onExit;

    const [isLocked, setIsLocked] = useState(false);
    const [isAiming, setIsAiming] = useState(false);
    const [isCrouching, setIsCrouching] = useState(false);
    const [isSliding, setIsSliding] = useState(false);
    const [activeWeaponSlot, setActiveWeaponSlot] = useState(1); // 1 = Fusil d'Assaut, 2 = Sniper
    const [autoSprint, setAutoSprint] = useState(() => {
        const saved = localStorage.getItem('gashooter_autosprint');
        return saved === null ? true : saved === 'true';
    });

    const [score, setScore] = useState(0);
    const [playerHp, setPlayerHp] = useState(100);
    const [playerKills, setPlayerKills] = useState(0);
    const [playerDeaths, setPlayerDeaths] = useState(0);
    const [shotsFired, setShotsFired] = useState(0);
    const [shotsHit, setShotsHit] = useState(0);

    // Munitions séparées par arme
    const [weaponsAmmo, setWeaponsAmmo] = useState({
        1: { mag: 30, maxMag: 30, reserve: 90, name: 'AR-47 ASSAULT', fireRate: 110, damage: 20 },
        2: { mag: 5, maxMag: 5, reserve: 25, name: 'AWP-50 SNIPER', fireRate: 1150, damage: 65 }
    });

    const [isReloading, setIsReloading] = useState(false);
    const [reloadProgress, setReloadProgress] = useState(0);
    const [connectedPlayersCount, setConnectedPlayersCount] = useState(1);
    const [networkStatus, setNetworkStatus] = useState('Connexion...');
    const [killFeed, setKillFeed] = useState([]);
    const [hitBanner, setHitBanner] = useState(null);
    const [ammoToast, setAmmoToast] = useState(null);
    const [movementToast, setMovementToast] = useState(null);
    const [damageFlash, setDamageFlash] = useState(false);
    const [isDead, setIsDead] = useState(false);
    const [respawnTimer, setRespawnTimer] = useState(0);
    const [lastKiller, setLastKiller] = useState(null);
    const [spawnProtection, setSpawnProtection] = useState(false);

    const autoSprintRef = useRef(autoSprint);
    autoSprintRef.current = autoSprint;

    const toggleAutoSprint = () => {
        setAutoSprint((prev) => {
            const next = !prev;
            localStorage.setItem('gashooter_autosprint', String(next));
            return next;
        });
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // --- 1. SCÈNE, CAMÉRA & RENDERER ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0f172a);
        scene.fog = new THREE.FogExp2(0x0f172a, 0.005);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            600
        );
        camera.position.set(0, 1.7, 45);

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

        // --- 2. POST-PROCESSING ---
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.35,
            0.3,
            0.82
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // --- 3. ÉCLAIRAGE HAUTE VISIBILITÉ ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.3);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 3.4);
        sunLight.position.set(40, 70, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 250;
        sunLight.shadow.camera.left = -80;
        sunLight.shadow.camera.right = 80;
        sunLight.shadow.camera.top = 80;
        sunLight.shadow.camera.bottom = -80;
        sunLight.shadow.bias = -0.0003;
        scene.add(sunLight);

        const fillLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
        fillLight.position.set(-50, 30, -50);
        scene.add(fillLight);

        // --- 4. GÉOMÉTRIE DE LA CARTE 140x140m ---
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6, metalness: 0.2 });
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.3 });
        const metalStructureMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
        const platformMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.4 });
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const neonPurpleMat = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

        const colliders = [];
        const colliderMeshes = [];
        const registerBox = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            colliderMeshes.push(mesh);
            return box;
        };

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const addGroundMark = (x, z, w, d, mat = neonCyanMat) => {
            const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
            strip.position.set(x, 0.02, z);
            strip.rotation.x = -Math.PI / 2;
            scene.add(strip);
        };
        addGroundMark(0, 0, 120, 0.4, neonCyanMat);
        addGroundMark(0, 0, 0.4, 120, neonCyanMat);
        addGroundMark(-35, 0, 0.3, 80, neonOrangeMat);
        addGroundMark(35, 0, 0.3, 80, neonOrangeMat);
        addGroundMark(0, -35, 80, 0.3, neonPurpleMat);
        addGroundMark(0, 35, 80, 0.3, neonPurpleMat);

        const wallH = 12;
        const addWall = (x, y, z, w, h, d, mat = wallMat) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerBox(wall);
        };
        addWall(0, wallH / 2, -70, 140, wallH, 2);
        addWall(0, wallH / 2, 70, 140, wallH, 2);
        addWall(-70, wallH / 2, 0, 2, wallH, 140);
        addWall(70, wallH / 2, 0, 2, wallH, 140);

        const addPlatform = (x, y, z, w, h, d, withRamp = true, rampDir = 'z') => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), platformMat);
            mesh.position.set(x, y + h / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            registerBox(mesh);

            const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.15, d + 0.1), neonCyanMat);
            trim.position.set(x, y + h, z);
            scene.add(trim);

            if (withRamp) {
                const rampLength = 8;
                const ramp = new THREE.Mesh(new THREE.BoxGeometry(rampDir === 'z' ? 4 : rampLength, 0.3, rampDir === 'z' ? rampLength : 4), platformMat);
                if (rampDir === 'z') {
                    ramp.position.set(x, y + h / 2, z + d / 2 + rampLength / 2 - 0.4);
                    ramp.rotation.x = -Math.atan2(h, rampLength);
                } else {
                    ramp.position.set(x + w / 2 + rampLength / 2 - 0.4, y + h / 2, z);
                    ramp.rotation.z = Math.atan2(h, rampLength);
                }
                ramp.castShadow = true;
                ramp.receiveShadow = true;
                scene.add(ramp);
                registerBox(ramp);
            }
        };

        addPlatform(0, 0, 0, 24, 3.5, 24, true, 'z');
        addPlatform(0, 0, -18, 12, 3.5, 10, true, 'z');

        const addSniperTower = (x, z) => {
            addPlatform(x, 0, z, 12, 6.0, 12, true, z > 0 ? 'z' : 'x');
            addWall(x, 6.0 + 0.6, z - 5.5, 12, 1.2, 0.6, metalStructureMat);
            addWall(x, 6.0 + 0.6, z + 5.5, 12, 1.2, 0.6, metalStructureMat);
            addWall(x - 5.5, 6.0 + 0.6, z, 0.6, 1.2, 12, metalStructureMat);
            addWall(x + 5.5, 6.0 + 0.6, z, 0.6, 1.2, 12, metalStructureMat);
        };
        addSniperTower(-45, -45);
        addSniperTower(45, -45);
        addSniperTower(-45, 45);
        addSniperTower(45, 45);

        const addBarricade = (x, z, rot = 0, isHigh = false) => {
            const h = isHigh ? 3.0 : 1.6;
            const w = isHigh ? 6.0 : 4.5;
            const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), wallMat);
            bar.position.set(x, h / 2, z);
            bar.rotation.y = rot;
            bar.castShadow = true;
            bar.receiveShadow = true;
            scene.add(bar);
            registerBox(bar);

            const lightStrip = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.85), isHigh ? neonOrangeMat : neonCyanMat);
            lightStrip.position.set(x, h, z);
            lightStrip.rotation.y = rot;
            scene.add(lightStrip);
        };

        const barricadeCoords = [
            [-22, 15, 0], [22, 15, 0], [-22, -15, 0], [22, -15, 0],
            [0, 25, Math.PI / 2], [0, -25, Math.PI / 2],
            [-35, 10, Math.PI / 4, true], [35, 10, -Math.PI / 4, true],
            [-35, -10, -Math.PI / 4, true], [35, -10, Math.PI / 4, true],
            [-15, 35, Math.PI / 2], [15, 35, Math.PI / 2],
            [-15, -35, Math.PI / 2], [15, -35, Math.PI / 2]
        ];
        barricadeCoords.forEach(([x, z, rot, isHigh]) => addBarricade(x, z, rot, isHigh));

        const addGiantPillar = (x, z) => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(3.5, wallH, 3.5), metalStructureMat);
            pillar.position.set(x, wallH / 2, z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            scene.add(pillar);
            registerBox(pillar);

            const ring = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.3, 3.7), neonCyanMat);
            ring.position.set(x, 5.0, z);
            scene.add(ring);
        };
        addGiantPillar(-25, -25);
        addGiantPillar(25, -25);
        addGiantPillar(-25, 25);
        addGiantPillar(25, 25);

        // --- 5. MODÈLE DE JOUEUR ADVERSE AVEC ARME DÉTAILLÉE ---
        const remotePlayersMap = new Map();

        const createRealisticPlayerModel = (name, colorHex, spawnPos) => {
            const fighterGroup = new THREE.Group();
            fighterGroup.position.set(spawnPos[0], (spawnPos[1] || 1.7) - 1.7, spawnPos[2]);

            const armorMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.6, roughness: 0.35 });
            const darkTacticalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7, metalness: 0.3 });
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.6 });

            // Torse & Gilet
            const chestGroup = new THREE.Group();
            chestGroup.position.set(0, 1.15, 0);

            const innerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), darkTacticalMat);
            innerTorso.castShadow = true;
            chestGroup.add(innerTorso);

            const plateCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.36), armorMat);
            plateCarrier.position.set(0, 0.05, 0);
            chestGroup.add(plateCarrier);

            for (let i = -1; i <= 1; i++) {
                const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), plateMat);
                magPouch.position.set(i * 0.16, -0.08, 0.21);
                chestGroup.add(magPouch);
            }

            const shoulderL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.22), plateMat);
            shoulderL.position.set(-0.35, 0.25, 0);
            chestGroup.add(shoulderL);

            const shoulderR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.22), plateMat);
            shoulderR.position.set(0.35, 0.25, 0);
            chestGroup.add(shoulderR);
            fighterGroup.add(chestGroup);

            // Ceinture & Holster
            const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.34), plateMat);
            belt.position.set(0, 0.76, 0);
            fighterGroup.add(belt);

            const holster = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.14), darkTacticalMat);
            holster.position.set(0.32, 0.65, 0);
            fighterGroup.add(holster);

            // Jambes & Bottes
            const legLeftGroup = new THREE.Group();
            legLeftGroup.position.set(-0.16, 0.7, 0);
            const thighL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), darkTacticalMat);
            thighL.position.set(0, -0.21, 0);
            legLeftGroup.add(thighL);
            const kneeL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.12), plateMat);
            kneeL.position.set(0, -0.38, 0.1);
            legLeftGroup.add(kneeL);
            const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.3), darkTacticalMat);
            bootL.position.set(0, -0.56, 0.04);
            legLeftGroup.add(bootL);
            fighterGroup.add(legLeftGroup);

            const legRightGroup = new THREE.Group();
            legRightGroup.position.set(0.16, 0.7, 0);
            const thighR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.22), darkTacticalMat);
            thighR.position.set(0, -0.21, 0);
            legRightGroup.add(thighR);
            const kneeR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.12), plateMat);
            kneeR.position.set(0, -0.38, 0.1);
            legRightGroup.add(kneeR);
            const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.3), darkTacticalMat);
            bootR.position.set(0, -0.56, 0.04);
            legRightGroup.add(bootR);
            fighterGroup.add(legRightGroup);

            // Bras & Fusil d'Assaut
            const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), armorMat);
            armLeft.position.set(-0.38, 1.15, 0.2);
            armLeft.rotation.x = -Math.PI / 4;
            armLeft.rotation.z = Math.PI / 10;
            fighterGroup.add(armLeft);

            const armRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), armorMat);
            armRight.position.set(0.38, 1.15, 0.25);
            armRight.rotation.x = -Math.PI / 3;
            armRight.rotation.z = -Math.PI / 12;
            fighterGroup.add(armRight);

            const rifleGroup = new THREE.Group();
            rifleGroup.position.set(0.12, 1.05, 0.45);

            const rBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), plateMat);
            rifleGroup.add(rBody);

            const rBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 12), new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9 }));
            rBarrel.rotation.x = Math.PI / 2;
            rBarrel.position.set(0, 0.02, -0.45);
            rifleGroup.add(rBarrel);

            const rMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.12), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6 }));
            rMag.position.set(0, -0.14, -0.08);
            rMag.rotation.x = Math.PI / 12;
            rifleGroup.add(rMag);

            const rMuzzleFlash = new THREE.PointLight(0xffedd5, 0, 8);
            rMuzzleFlash.position.set(0, 0.02, -0.75);
            rifleGroup.add(rMuzzleFlash);

            fighterGroup.add(rifleGroup);

            // Tête Cible de Tir
            const headGroup = new THREE.Group();
            headGroup.position.set(0, 1.85, 0);

            const neckCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 16), darkTacticalMat);
            neckCollar.position.set(0, -0.15, 0);
            headGroup.add(neckCollar);

            const headDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4 }));
            headDisc.rotation.x = Math.PI / 2;
            headDisc.castShadow = true;
            headGroup.add(headDisc);

            const ringR = [0.42, 0.32, 0.22, 0.1];
            const ringColors = [0xffffff, 0x0284c7, 0xdc2626, 0xfacc15];

            ringR.forEach((r, idx) => {
                const rMesh = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: ringColors[idx], side: THREE.DoubleSide }));
                rMesh.position.set(0, 0, 0.055 + idx * 0.002);
                headGroup.add(rMesh);
            });

            const bullseyeCenter = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            bullseyeCenter.position.set(0, 0, 0.065);
            headGroup.add(bullseyeCenter);

            fighterGroup.add(headGroup);

            // Barre de Vie 3D Billboard
            const billboardGroup = new THREE.Group();
            billboardGroup.position.set(0, 2.55, 0);

            const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.14), new THREE.MeshBasicMaterial({ color: 0x09090b, side: THREE.DoubleSide }));
            billboardGroup.add(hpBg);

            const hpFill = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.10), new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide }));
            hpFill.position.set(0, 0, 0.01);
            billboardGroup.add(hpFill);

            const nameCanvas = document.createElement('canvas');
            nameCanvas.width = 256;
            nameCanvas.height = 64;
            const nctx = nameCanvas.getContext('2d');
            nctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            nctx.roundRect(4, 4, 248, 56, 12);
            nctx.fill();
            nctx.strokeStyle = '#38bdf8';
            nctx.lineWidth = 3;
            nctx.stroke();
            nctx.fillStyle = '#ffffff';
            nctx.font = 'bold 26px sans-serif';
            nctx.textAlign = 'center';
            nctx.textBaseline = 'middle';
            nctx.fillText(name, 128, 32);

            const nameTexture = new THREE.CanvasTexture(nameCanvas);
            const nameSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: nameTexture }));
            nameSprite.position.set(0, 0.22, 0);
            nameSprite.scale.set(1.4, 0.35, 1);
            billboardGroup.add(nameSprite);

            fighterGroup.add(billboardGroup);

            fighterGroup.userData = {
                name,
                hp: 100,
                maxHp: 100,
                isFighter: true,
                chestGroup,
                headGroup,
                billboardGroup,
                hpFill,
                rMuzzleFlash,
                targetPos: new THREE.Vector3(spawnPos[0], (spawnPos[1] || 1.7) - 1.7, spawnPos[2]),
                targetRotY: 0,
                isAlive: true
            };

            scene.add(fighterGroup);
            return fighterGroup;
        };

        // --- 6. MULTIJOUEUR WEBSOCKET ---
        const mpClient = new MultiplayerClient();

        mpClient.callbacks.onInitState = (data) => {
            setNetworkStatus(`Connecté au Salon • ${data.players.length} Joueur(s)`);
            if (data.mySpawn) {
                camera.position.set(data.mySpawn[0], data.mySpawn[1], data.mySpawn[2]);
            }
            data.players.forEach((p) => {
                if (p.id !== data.myId && !remotePlayersMap.has(p.id)) {
                    const model = createRealisticPlayerModel(p.name, p.color, p.pos || [0, 1.7, 0]);
                    remotePlayersMap.set(p.id, model);
                }
            });
            setConnectedPlayersCount(data.players.length);
        };

        mpClient.callbacks.onPlayerJoined = (p) => {
            if (!remotePlayersMap.has(p.id)) {
                const model = createRealisticPlayerModel(p.name, p.color, p.pos || [0, 1.7, 0]);
                remotePlayersMap.set(p.id, model);
                setConnectedPlayersCount((prev) => prev + 1);
                setKillFeed((prev) => [`🎮 ${p.name} a rejoint le combat`, ...prev.slice(0, 4)]);
            }
        };

        mpClient.callbacks.onPlayerMoved = (data) => {
            const playerModel = remotePlayersMap.get(data.id);
            if (playerModel) {
                playerModel.userData.targetPos.set(data.pos[0], data.pos[1] - 1.7, data.pos[2]);
                playerModel.userData.targetRotY = data.rotY;
            }
        };

        mpClient.callbacks.onPlayerShot = (data) => {
            spawnBullet(false, new THREE.Vector3(...data.origin), new THREE.Vector3(...data.dir));
            sound.playGunshot();

            const playerModel = remotePlayersMap.get(data.id);
            if (playerModel && playerModel.userData.rMuzzleFlash) {
                playerModel.userData.rMuzzleFlash.intensity = 6;
                setTimeout(() => {
                    if (playerModel.userData.rMuzzleFlash) playerModel.userData.rMuzzleFlash.intensity = 0;
                }, 60);
            }
        };

        mpClient.callbacks.onDamageApplied = (data) => {
            if (data.targetId === mpClient.myId) {
                setDamageFlash(true);
                setTimeout(() => setDamageFlash(false), 220);
                setPlayerHp(data.newHp);

                if (data.isKill) {
                    setIsDead(true);
                    setLastKiller(data.shooterName || 'Un combattant');
                    setPlayerDeaths((d) => d + 1);
                    setKillFeed((prev) => [`💀 ${data.shooterName} vous a éliminé (${data.hitType})`, ...prev.slice(0, 4)]);

                    let count = 3;
                    setRespawnTimer(count);
                    const cd = setInterval(() => {
                        count -= 1;
                        setRespawnTimer(count);
                        if (count <= 0) {
                            clearInterval(cd);
                            setIsDead(false);
                            setSpawnProtection(true);
                            setTimeout(() => setSpawnProtection(false), 2500);
                            mpClient.sendRespawn();
                        }
                    }, 1000);
                }
            } else {
                const targetModel = remotePlayersMap.get(data.targetId);
                if (targetModel) {
                    targetModel.userData.hp = data.newHp;
                    const hpPercent = Math.max(0, data.newHp / 100);
                    targetModel.userData.hpFill.scale.x = hpPercent;
                    targetModel.userData.hpFill.position.x = -(1 - hpPercent) * 0.58;

                    if (hpPercent > 0.5) targetModel.userData.hpFill.material.color.setHex(0x10b981);
                    else if (hpPercent > 0.25) targetModel.userData.hpFill.material.color.setHex(0xf59e0b);
                    else targetModel.userData.hpFill.material.color.setHex(0xef4444);

                    if (data.isKill) {
                        targetModel.rotation.x = Math.PI / 2;
                        targetModel.position.y = 0.2;
                        setKillFeed((prev) => [`⚡ ${data.shooterName} a éliminé ${data.targetName} (${data.hitType})`, ...prev.slice(0, 4)]);
                        setTimeout(() => {
                            targetModel.visible = false;
                        }, 2000);
                    }
                }
            }
        };

        mpClient.callbacks.onPlayerRespawned = (data) => {
            if (data.id === mpClient.myId) {
                setPlayerHp(100);
                if (data.spawnPos) camera.position.set(data.spawnPos[0], data.spawnPos[1], data.spawnPos[2]);
            } else {
                const model = remotePlayersMap.get(data.id);
                if (model) {
                    model.visible = true;
                    model.rotation.x = 0;
                    model.userData.hp = 100;
                    model.userData.hpFill.scale.x = 1;
                    model.userData.hpFill.position.x = 0;
                    model.userData.hpFill.material.color.setHex(0x10b981);
                    if (data.spawnPos) model.position.set(data.spawnPos[0], data.spawnPos[1] - 1.7, data.spawnPos[2]);
                }
            }
        };

        mpClient.callbacks.onPlayerLeft = (id) => {
            const model = remotePlayersMap.get(id);
            if (model) {
                scene.remove(model);
                remotePlayersMap.delete(id);
                setConnectedPlayersCount((prev) => Math.max(1, prev - 1));
            }
        };

        mpClient.connect(`Joueur_${Math.floor(Math.random() * 900 + 100)}`, 'global_arena');

        // --- 7. CAISSES DE MUNITIONS ---
        const ammoCrates = [];
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.4, metalness: 0.5 });
        const iconGlowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

        const crateLocations = [
            [-25, 0, 25], [25, 0, 25], [-25, 0, -25], [25, 0, -25],
            [0, 3.5, 0], [-45, 6.0, -45], [45, 6.0, 45], [0, 0, 40]
        ];
        crateLocations.forEach(([x, y, z]) => {
            const crateGroup = new THREE.Group();
            crateGroup.position.set(x, y, z);

            const box = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.9), crateMat);
            box.position.y = 0.4;
            box.castShadow = true;
            box.receiveShadow = true;
            crateGroup.add(box);

            const iconGroup = new THREE.Group();
            iconGroup.position.y = 1.4;
            for (let b = -1; b <= 1; b++) {
                const bulletIcon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), iconGlowMat);
                bulletIcon.position.x = b * 0.16;
                bulletIcon.rotation.z = b * 0.2;
                iconGroup.add(bulletIcon);
            }
            crateGroup.add(iconGroup);

            crateGroup.userData = { isCrate: true, available: true, baseY: y, iconGroup, respawnTimer: 0, radius: 2.0 };
            scene.add(crateGroup);
            ammoCrates.push(crateGroup);
            registerBox(box);
        });

        // --- 8. SYSTÈME MULTI-ARMES (FUSIL D'ASSAUT & SNIPER) ---
        const weaponPivot = new THREE.Group();
        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.9, roughness: 0.25 });
        const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.95, roughness: 0.15 });
        const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const scopeGreenGlowMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });

        // Modèle 1 : Fusil d'Assaut AR-47
        const arMeshGroup = new THREE.Group();
        const arBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.62), gunMetalMat);
        arBody.position.set(0.24, -0.22, -0.45);
        arMeshGroup.add(arBody);

        const arBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.52, 16), gunSteelMat);
        arBarrel.rotation.x = Math.PI / 2;
        arBarrel.position.set(0.24, -0.18, -0.82);
        arMeshGroup.add(arBarrel);

        const arMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), gunSteelMat);
        arMuzzle.position.set(0.24, -0.18, -1.08);
        arMeshGroup.add(arMuzzle);

        const arMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6 }));
        arMag.position.set(0.24, -0.36, -0.42);
        arMag.rotation.x = Math.PI / 12;
        arMeshGroup.add(arMag);

        const arSight = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.016, 16), sightGlowMat);
        arSight.position.set(0.24, -0.065, -0.5);
        arMeshGroup.add(arSight);

        const arFlash = new THREE.PointLight(0xffedd5, 0, 8);
        arFlash.position.set(0.24, -0.18, -1.1);
        arMeshGroup.add(arFlash);

        weaponPivot.add(arMeshGroup);

        // Modèle 2 : Fusil de Sniper AWP-50
        const sniperMeshGroup = new THREE.Group();
        sniperMeshGroup.visible = false;

        const snipBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.8), gunMetalMat);
        snipBody.position.set(0.24, -0.22, -0.45);
        sniperMeshGroup.add(snipBody);

        // Canon lourd sniper
        const snipBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.9, 16), gunSteelMat);
        snipBarrel.rotation.x = Math.PI / 2;
        snipBarrel.position.set(0.24, -0.16, -1.05);
        sniperMeshGroup.add(snipBarrel);

        const snipBrake = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.12), gunSteelMat);
        snipBrake.position.set(0.24, -0.16, -1.5);
        sniperMeshGroup.add(snipBrake);

        // Grande Lunette de Visée Téléscopique
        const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.35, 16), gunMetalMat);
        scopeTube.rotation.x = Math.PI / 2;
        scopeTube.position.set(0.24, -0.04, -0.45);
        sniperMeshGroup.add(scopeTube);

        const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.038, 16), scopeGreenGlowMat);
        scopeLens.position.set(0.24, -0.04, -0.27);
        sniperMeshGroup.add(scopeLens);

        const snipMag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.2, 0.14), gunSteelMat);
        snipMag.position.set(0.24, -0.36, -0.38);
        sniperMeshGroup.add(snipMag);

        const snipFlash = new THREE.PointLight(0xffedd5, 0, 10);
        snipFlash.position.set(0.24, -0.16, -1.55);
        sniperMeshGroup.add(snipFlash);

        weaponPivot.add(sniperMeshGroup);

        camera.add(weaponPivot);
        scene.add(camera);

        let currentWeaponSlot = 1;
        const hipPosition = new THREE.Vector3(0, 0, 0);
        const arAdsPos = new THREE.Vector3(-0.24, 0.065, 0.08);
        const snipAdsPos = new THREE.Vector3(-0.24, 0.04, 0.12);
        let isAimingADS = false;

        const switchWeapon = (slot) => {
            if (slot === currentWeaponSlot || isReloading || isDead) return;
            currentWeaponSlot = slot;
            setActiveWeaponSlot(slot);
            sound.playSelect();

            if (slot === 1) {
                arMeshGroup.visible = true;
                sniperMeshGroup.visible = false;
            } else {
                arMeshGroup.visible = false;
                sniperMeshGroup.visible = true;
            }

            // Animation de swap
            weaponPivot.position.y = -0.25;
            setTimeout(() => {
                weaponPivot.position.y = 0;
            }, 120);
        };

        // --- 9. BALLES PHYSIQUES ---
        const bullets = [];
        const bulletGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.55, 8);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        const sniperBulletMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

        const createSparks = (pos) => {
            for (let i = 0; i < 14; i++) {
                const spark = new THREE.Mesh(sparkGeo, sparkMat);
                spark.position.copy(pos);
                const vel = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 1, (Math.random() - 0.5) * 8);
                scene.add(spark);
                sparks.push({ mesh: spark, vel, life: 0.7 });
            }
        };

        const spawnBullet = (fromPlayer = true, originPos = null, dirVec = null, isSniper = false) => {
            const bMat = fromPlayer ? (isSniper ? sniperBulletMat : bulletMat) : enemyBulletMat;
            const bullet = new THREE.Mesh(bulletGeo, bMat);
            let shootDir = new THREE.Vector3();

            if (fromPlayer) {
                const muzzlePos = new THREE.Vector3();
                const activeMuzzle = isSniper ? snipBrake : arMuzzle;
                activeMuzzle.getWorldPosition(muzzlePos);
                bullet.position.copy(muzzlePos);
                camera.getWorldDirection(shootDir);
                bullet.quaternion.copy(camera.quaternion);

                mpClient.sendShoot(muzzlePos, shootDir);
            } else {
                bullet.position.copy(originPos);
                shootDir.copy(dirVec);
                bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), shootDir);
            }

            scene.add(bullet);
            bullets.push({
                mesh: bullet,
                dir: shootDir.clone(),
                speed: fromPlayer ? (isSniper ? 320.0 : 210.0) : 110.0,
                fromPlayer,
                isSniper,
                distTravelled: 0,
                maxDist: 350.0
            });
        };

        // --- 10. RECHARGEMENT POLI AVEC ANIMATION DE CULASSE MULTI-PHASE ---
        let currentWeaponsAmmo = {
            1: { mag: 30, maxMag: 30, reserve: 90, name: 'AR-47 ASSAULT', fireRate: 110, damage: 20 },
            2: { mag: 5, maxMag: 5, reserve: 25, name: 'AWP-50 SNIPER', fireRate: 1150, damage: 65 }
        };

        let reloading = false;
        let reloadTimer = 0;
        let reloadTotalDuration = 1.4;
        let lastShotTime = 0;

        const executeReload = () => {
            const curW = currentWeaponsAmmo[currentWeaponSlot];
            if (reloading || curW.mag >= curW.maxMag || curW.reserve <= 0 || isDead) return;

            reloading = true;
            reloadTimer = 0;
            reloadTotalDuration = currentWeaponSlot === 2 ? 1.8 : 1.35;
            setIsReloading(true);
            setReloadProgress(0);
            sound.playReload();
        };

        // --- 11. CONTRÔLES, AUTO-SPRINT, GLISSADE TACTIQUE ET WALL JUMP ---
        const controls = new PointerLockControls(camera, canvas);
        controls.addEventListener('lock', () => setIsLocked(true));
        controls.addEventListener('unlock', () => {
            setIsLocked(false);
            isAimingADS = false;
            setIsAiming(false);
        });

        const moveState = { forward: false, backward: false, left: false, right: false, sprint: false, crouch: false };
        const velocity = new THREE.Vector3();
        let canJump = true;
        let sliding = false;
        let slideTimer = 0;
        let slideDirVec = new THREE.Vector3();
        let wallJumpCooldown = 0;
        let normalEyeHeight = 1.7;
        let currentEyeHeight = 1.7;

        const onKeyDown = (e) => {
            if (isDead) return;

            if (e.code === 'Digit1' || e.code === 'Numpad1') {
                switchWeapon(1);
                return;
            }
            if (e.code === 'Digit2' || e.code === 'Numpad2') {
                switchWeapon(2);
                return;
            }

            if (e.code === 'KeyR') {
                executeReload();
                return;
            }

            switch (e.code) {
                case 'KeyW': case 'KeyZ': case 'ArrowUp': moveState.forward = true; break;
                case 'KeyS': case 'ArrowDown': moveState.backward = true; break;
                case 'KeyA': case 'KeyQ': case 'ArrowLeft': moveState.left = true; break;
                case 'KeyD': case 'ArrowRight': moveState.right = true; break;
                case 'ShiftLeft': case 'ShiftRight': moveState.sprint = true; break;

                case 'KeyC':
                case 'ControlLeft':
                case 'ControlRight':
                    moveState.crouch = true;
                    const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                    const shouldSprint = autoSprintRef.current || moveState.sprint;

                    if (isMoving && shouldSprint && canJump && !sliding) {
                        // GLISSADE DANS LA DIRECTION DU VECTEUR DE MOUVEMENT ACTUEL
                        const inputVec = new THREE.Vector3();
                        if (moveState.forward) inputVec.z += 1;
                        if (moveState.backward) inputVec.z -= 1;
                        if (moveState.left) inputVec.x -= 1;
                        if (moveState.right) inputVec.x += 1;
                        if (inputVec.lengthSq() === 0) inputVec.z = 1;
                        inputVec.normalize();

                        slideDirVec.set(inputVec.x, 0, -inputVec.z);
                        slideDirVec.applyEuler(new THREE.Euler(0, camera.rotation.y, 0, 'YXZ'));
                        slideDirVec.y = 0;
                        slideDirVec.normalize();

                        sliding = true;
                        slideTimer = 0.8;
                        setIsSliding(true);
                        sound.playSlide();
                        setMovementToast('⚡ GLISSADE');
                        setTimeout(() => setMovementToast(null), 1000);

                        velocity.x = slideDirVec.x * 17.5;
                        velocity.z = slideDirVec.z * 17.5;
                    } else {
                        setIsCrouching(true);
                    }
                    break;

                case 'Space':
                    if (canJump) {
                        velocity.y = 8.8;
                        canJump = false;
                    } else if (wallJumpCooldown <= 0) {
                        const rayAngles = [0, Math.PI / 4, Math.PI / 2, 3 * Math.PI / 4, Math.PI, -3 * Math.PI / 4, -Math.PI / 2, -Math.PI / 4];
                        let foundWall = false;
                        let wallNormal = new THREE.Vector3();

                        for (const angle of rayAngles) {
                            const dir = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize();
                            const ray = new THREE.Raycaster(camera.position, dir, 0, 1.4);
                            const hits = ray.intersectObjects(colliderMeshes, false);
                            if (hits.length > 0 && hits[0].face) {
                                wallNormal.copy(hits[0].face.normal).normalize();
                                foundWall = true;
                                break;
                            }
                        }

                        if (foundWall) {
                            velocity.y = 9.2;
                            velocity.x += wallNormal.x * 11.0;
                            velocity.z += wallNormal.z * 11.0;
                            wallJumpCooldown = 0.45;
                            sound.playWallJump();
                            setMovementToast('🧗 WALL JUMP !');
                            setTimeout(() => setMovementToast(null), 1000);
                        }
                    }
                    break;

                case 'Escape':
                    if (!controls.isLocked) onExitRef.current();
                    break;
            }
        };

        const onKeyUp = (e) => {
            switch (e.code) {
                case 'KeyW': case 'KeyZ': case 'ArrowUp': moveState.forward = false; break;
                case 'KeyS': case 'ArrowDown': moveState.backward = false; break;
                case 'KeyA': case 'KeyQ': case 'ArrowLeft': moveState.left = false; break;
                case 'KeyD': case 'ArrowRight': moveState.right = false; break;
                case 'ShiftLeft': case 'ShiftRight': moveState.sprint = false; break;
                case 'KeyC':
                case 'ControlLeft':
                case 'ControlRight':
                    moveState.crouch = false;
                    setIsCrouching(false);
                    sliding = false;
                    setIsSliding(false);
                    break;
            }
        };

        const onWheel = (e) => {
            if (e.deltaY > 0) switchWeapon(2);
            else if (e.deltaY < 0) switchWeapon(1);
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('wheel', onWheel);

        // --- TIR AVEC CADENCE RÉALISTE PAR ARME ---
        const fireWeapon = () => {
            if (!controls.isLocked || reloading || isDead) return;

            const now = performance.now();
            const curW = currentWeaponsAmmo[currentWeaponSlot];

            // Respect de la cadence de tir (cooldown)
            if (now - lastShotTime < curW.fireRate) {
                return;
            }

            if (curW.mag <= 0) {
                sound.playDryFire();
                if (curW.reserve > 0) executeReload();
                return;
            }

            lastShotTime = now;
            curW.mag -= 1;
            setWeaponsAmmo({ ...currentWeaponsAmmo });
            setShotsFired((prev) => prev + 1);

            const isSniper = currentWeaponSlot === 2;

            if (isSniper) {
                sound.playSniperShot();
                snipFlash.intensity = 10;
                setTimeout(() => { snipFlash.intensity = 0; }, 70);
                setTimeout(() => sound.playBoltAction(), 300);
            } else {
                sound.playGunshot();
                arFlash.intensity = 6;
                setTimeout(() => { arFlash.intensity = 0; }, 60);
            }

            spawnBullet(true, null, null, isSniper);

            // Recul de l'arme
            const recoilAmount = isSniper ? 0.22 : (isAimingADS ? 0.05 : 0.12);
            const recoilRot = isSniper ? 0.14 : (isAimingADS ? 0.03 : 0.08);
            weaponPivot.position.z += recoilAmount;
            weaponPivot.rotation.x += recoilRot;

            setTimeout(() => {
                weaponPivot.position.z = 0;
                weaponPivot.rotation.x = 0;
            }, isSniper ? 140 : 60);
        };

        let isMouseDown = false;
        const onMouseDown = (e) => {
            if (!controls.isLocked || isDead) return;
            if (e.button === 0) {
                isMouseDown = true;
                fireWeapon();
            } else if (e.button === 2) {
                isAimingADS = true;
                setIsAiming(true);
            }
        };

        const onMouseUp = (e) => {
            if (e.button === 0) isMouseDown = false;
            else if (e.button === 2) {
                isAimingADS = false;
                setIsAiming(false);
            }
        };

        const onContextMenu = (e) => e.preventDefault();

        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('contextmenu', onContextMenu);

        // --- 12. DÉGÂTS PAR ZONE & BULLSEYE ---
        const handleTargetHit = (fighter, hitPoint, targetId, isSniper) => {
            sound.playHitmarker();
            setShotsHit((prev) => prev + 1);

            const headWorldPos = new THREE.Vector3();
            fighter.userData.headGroup.getWorldPosition(headWorldPos);
            const distToHeadCenter = hitPoint.distanceTo(headWorldPos);

            let damage = isSniper ? 65 : 20;
            let hitType = isSniper ? '💥 SNIPER CORPS (65 DMG)' : 'CORPS (20 DMG)';
            let isHeadshot = false;

            if (distToHeadCenter <= 0.45) {
                isHeadshot = true;
                if (distToHeadCenter <= 0.10) {
                    damage = 100;
                    hitType = isSniper ? '🎯 ONE-SHOT SNIPER HEADSHOT ! (100 DMG)' : '🎯 BULLSEYE HEADSHOT ! (100 DMG)';
                } else if (distToHeadCenter <= 0.24) {
                    damage = isSniper ? 100 : 65;
                    hitType = '🔴 ANNEAU ROUGE (TÊTE)';
                } else if (distToHeadCenter <= 0.36) {
                    damage = isSniper ? 85 : 40;
                    hitType = '🔵 ANNEAU BLEU (TÊTE)';
                } else {
                    damage = isSniper ? 75 : 25;
                    hitType = '⚪ BORD DE CIBLE';
                }
            } else if (hitPoint.y < headWorldPos.y - 0.9) {
                damage = isSniper ? 50 : 15;
                hitType = isSniper ? 'SNIPER JAMBE (50 DMG)' : 'JAMBES (15 DMG)';
            }

            setHitBanner({ type: hitType, isHeadshot, damage });
            setTimeout(() => setHitBanner(null), 1800);

            mpClient.sendHit(targetId, damage, hitType, hitPoint);
            setScore((prev) => prev + (isHeadshot ? (damage >= 100 ? 500 : 250) : 100));
        };

        // --- 13. BOUCLE PRINCIPALE ---
        let prevTime = performance.now();
        let lastSyncTime = 0;
        let bobTimer = 0;
        let animationFrameId;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);
            prevTime = time;

            if (wallJumpCooldown > 0) wallJumpCooldown -= delta;

            // Tir continu en automatique pour le fusil d'assaut
            if (isMouseDown && currentWeaponSlot === 1 && !reloading && !isDead && controls.isLocked) {
                if (time - lastShotTime >= currentWeaponsAmmo[1].fireRate) {
                    fireWeapon();
                }
            }

            // ANIMATION DE RECHARGEMENT HAUTE QUALITÉ
            const activeGunGroup = currentWeaponSlot === 1 ? arMeshGroup : sniperMeshGroup;
            if (reloading) {
                reloadTimer += delta;
                const ratio = Math.min(1.0, reloadTimer / reloadTotalDuration);
                setReloadProgress(Math.round(ratio * 100));

                // Phase 1 : Ejection chargeur (0% - 30%)
                if (ratio < 0.3) {
                    const p = ratio / 0.3;
                    activeGunGroup.position.y = -0.2 * p;
                    activeGunGroup.position.z = -0.05 * p;
                    activeGunGroup.rotation.x = -0.35 * p;
                    activeGunGroup.rotation.z = 0.2 * p;
                }
                // Phase 2 : Insertion nouveau chargeur (30% - 65%)
                else if (ratio < 0.65) {
                    const p = (ratio - 0.3) / 0.35;
                    activeGunGroup.position.y = -0.2 + Math.sin(p * Math.PI) * 0.05;
                    activeGunGroup.rotation.x = -0.35 + p * 0.15;
                    activeGunGroup.rotation.z = 0.2 - p * 0.1;
                }
                // Phase 3 : Armement culasse (65% - 100%)
                else {
                    const p = (ratio - 0.65) / 0.35;
                    activeGunGroup.position.y = -0.05 * (1 - p);
                    activeGunGroup.position.z = -0.04 * (1 - p);
                    activeGunGroup.rotation.x = -0.2 * (1 - p);
                    activeGunGroup.rotation.z = 0.1 * (1 - p);
                }

                if (reloadTimer >= reloadTotalDuration) {
                    const curW = currentWeaponsAmmo[currentWeaponSlot];
                    const needed = curW.maxMag - curW.mag;
                    const toLoad = Math.min(needed, curW.reserve);
                    curW.mag += toLoad;
                    curW.reserve -= toLoad;

                    setWeaponsAmmo({ ...currentWeaponsAmmo });

                    activeGunGroup.position.set(0, 0, 0);
                    activeGunGroup.rotation.set(0, 0, 0);
                    reloading = false;
                    setIsReloading(false);
                    setReloadProgress(0);
                }
            } else {
                activeGunGroup.position.y = 0;
                activeGunGroup.rotation.x = 0;
                activeGunGroup.rotation.z = 0;
            }

            // Synchronisation réseau du joueur local (25 FPS)
            if (controls.isLocked && time - lastSyncTime > 40 && !isDead) {
                lastSyncTime = time;
                const camRotY = camera.rotation.y;
                mpClient.sendMove(camera.position, camRotY, camera.rotation.x, isAimingADS);
            }

            // Interpolation et Billboard Health Bar des autres combattants
            for (const [id, f] of remotePlayersMap.entries()) {
                f.position.lerp(f.userData.targetPos, delta * 12);
                f.rotation.y = THREE.MathUtils.lerp(f.rotation.y, f.userData.targetRotY, delta * 12);
                f.userData.headGroup.lookAt(camera.position.x, f.position.y + 1.85, camera.position.z);
                f.userData.billboardGroup.quaternion.copy(camera.quaternion);
            }

            // Caisses de munitions
            ammoCrates.forEach((c) => {
                if (!c.userData.available) {
                    c.userData.respawnTimer -= delta;
                    if (c.userData.respawnTimer <= 0) {
                        c.userData.available = true;
                        c.visible = true;
                    }
                } else {
                    c.userData.iconGroup.rotation.y += delta * 2.2;
                    c.userData.iconGroup.position.y = 1.4 + Math.sin(time * 0.004) * 0.08;

                    const playerPos = new THREE.Vector2(camera.position.x, camera.position.z);
                    const cratePos = new THREE.Vector2(c.position.x, c.position.z);
                    if (playerPos.distanceTo(cratePos) < c.userData.radius && Math.abs(camera.position.y - (c.userData.baseY + 1.7)) < 2.0) {
                        c.userData.available = false;
                        c.userData.respawnTimer = 14.0;
                        c.visible = false;

                        sound.playAmmoPickup();
                        currentWeaponsAmmo[1].reserve += 60;
                        currentWeaponsAmmo[2].reserve += 15;
                        setWeaponsAmmo({ ...currentWeaponsAmmo });

                        setAmmoToast('+60 AR / +15 SNIPER');
                        setTimeout(() => setAmmoToast(null), 2000);
                    }
                }
            });

            // Physique des Balles 3D
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                const stepDist = b.speed * delta;
                const oldPos = b.mesh.position.clone();
                b.mesh.position.addScaledVector(b.dir, stepDist);
                b.distTravelled += stepDist;

                const stepRay = new THREE.Raycaster(oldPos, b.dir, 0, stepDist + 0.5);
                const intersects = stepRay.intersectObjects(scene.children, true);

                let collided = false;
                if (intersects.length > 0) {
                    for (const hit of intersects) {
                        if (hit.object === b.mesh || hit.object.parent === weaponPivot || hit.object.parent === arMeshGroup || hit.object.parent === sniperMeshGroup) continue;

                        collided = true;
                        createSparks(hit.point);

                        if (b.fromPlayer) {
                            for (const [targetId, f] of remotePlayersMap.entries()) {
                                let obj = hit.object;
                                while (obj && obj !== scene) {
                                    if (obj === f) {
                                        handleTargetHit(f, hit.point, targetId, b.isSniper);
                                        break;
                                    }
                                    obj = obj.parent;
                                }
                            }
                        }
                        break;
                    }
                }

                if (collided || b.distTravelled >= b.maxDist) {
                    scene.remove(b.mesh);
                    bullets.splice(i, 1);
                }
            }

            // Particules
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

            // PHYSIQUE DU JOUEUR LOCAL SANS TP DE MUR
            if (controls.isLocked && !isDead) {
                if (sliding) {
                    slideTimer -= delta;
                    velocity.x -= velocity.x * 2.8 * delta;
                    velocity.z -= velocity.z * 2.8 * delta;
                    if (slideTimer <= 0) {
                        sliding = false;
                        setIsSliding(false);
                    }
                } else {
                    velocity.x -= velocity.x * 10.0 * delta;
                    velocity.z -= velocity.z * 10.0 * delta;
                }
                velocity.y -= 24.0 * delta;

                const shouldSprint = (autoSprintRef.current || moveState.sprint) && !moveState.crouch && !isAimingADS;
                let baseSpeed = shouldSprint ? 15.0 : (moveState.crouch ? 4.8 : 9.0);
                if (isAimingADS) baseSpeed *= currentWeaponSlot === 2 ? 0.35 : 0.55;

                const dir = new THREE.Vector3();
                if (moveState.forward) dir.z += 1;
                if (moveState.backward) dir.z -= 1;
                if (moveState.left) dir.x -= 1;
                if (moveState.right) dir.x += 1;
                dir.normalize();

                if (!sliding) {
                    if (moveState.forward || moveState.backward) velocity.z += dir.z * baseSpeed * 10.0 * delta;
                    if (moveState.left || moveState.right) velocity.x += dir.x * baseSpeed * 10.0 * delta;
                }

                // Collisions Horizontales X
                const oldX = camera.position.x;
                controls.moveRight(velocity.x * delta);
                const playerBoxX = new THREE.Box3(
                    new THREE.Vector3(camera.position.x - 0.45, camera.position.y - (currentEyeHeight - 0.2), camera.position.z - 0.45),
                    new THREE.Vector3(camera.position.x + 0.45, camera.position.y + 0.3, camera.position.z + 0.45)
                );
                for (const col of colliders) {
                    if (playerBoxX.intersectsBox(col)) {
                        camera.position.x = oldX;
                        velocity.x = 0;
                        break;
                    }
                }

                // Collisions Horizontales Z
                const oldZ = camera.position.z;
                controls.moveForward(velocity.z * delta);
                const playerBoxZ = new THREE.Box3(
                    new THREE.Vector3(camera.position.x - 0.45, camera.position.y - (currentEyeHeight - 0.2), camera.position.z - 0.45),
                    new THREE.Vector3(camera.position.x + 0.45, camera.position.y + 0.3, camera.position.z + 0.45)
                );
                for (const col of colliders) {
                    if (playerBoxZ.intersectsBox(col)) {
                        camera.position.z = oldZ;
                        velocity.z = 0;
                        break;
                    }
                }

                const targetEye = sliding ? 0.85 : moveState.crouch ? 0.95 : normalEyeHeight;
                currentEyeHeight = THREE.MathUtils.lerp(currentEyeHeight, targetEye, delta * 12);

                // DÉTECTION DU SOL PRÉCISE (AUCUN TP EN HAUT DES MURS)
                camera.position.y += velocity.y * delta;
                let groundY = currentEyeHeight;

                for (const col of colliders) {
                    if (
                        camera.position.x >= col.min.x - 0.45 &&
                        camera.position.x <= col.max.x + 0.45 &&
                        camera.position.z >= col.min.z - 0.45 &&
                        camera.position.z <= col.max.z + 0.45
                    ) {
                        const topY = col.max.y + currentEyeHeight;
                        // On ne grimpe sur la plateforme que si nos pieds sont déjà au niveau supérieur (marche ou chute sur plateforme)
                        // Cela empêche totalement la téléportation quand on longe un grand mur ou pilier
                        if (camera.position.y >= topY - 0.45 && topY >= groundY) {
                            groundY = topY;
                        }
                    }
                }

                if (camera.position.y <= groundY) {
                    camera.position.y = groundY;
                    velocity.y = 0;
                    canJump = true;
                }

                // FOV & ADS (Zoom 4.0X pour Sniper, 1.5X pour AR)
                const targetFov = isAimingADS ? (currentWeaponSlot === 2 ? 18 : 46) : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 14);
                camera.updateProjectionMatrix();

                const targetAdsPos = currentWeaponSlot === 2 ? snipAdsPos : arAdsPos;
                const targetPivotPos = isAimingADS ? targetAdsPos : hipPosition;
                weaponPivot.position.lerp(targetPivotPos, delta * 16);

                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                if (isMoving && canJump && !isAimingADS && !reloading && !sliding) {
                    bobTimer += delta * (shouldSprint ? 14 : 9);
                    weaponPivot.position.x = Math.sin(bobTimer) * 0.015;
                    weaponPivot.position.y = Math.cos(bobTimer * 2) * 0.01;
                } else if (!reloading && !isAimingADS) {
                    weaponPivot.position.x = 0;
                    weaponPivot.position.y = 0;
                }
            } else if (isDead) {
                camera.position.y = THREE.MathUtils.lerp(camera.position.y, 0.35, delta * 8);
                camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, 0.4, delta * 6);
            }

            composer.render();
        };

        animate();

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
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('contextmenu', onContextMenu);
            controls.removeEventListener('lock', () => setIsLocked(true));
            controls.removeEventListener('unlock', () => setIsLocked(false));
            mpClient.disconnect();
            controls.dispose();
            renderer.dispose();
        };
    }, []);

    const accuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 100;
    const currentWeapon = weaponsAmmo[activeWeaponSlot];

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none font-sans">
            {/* Flash rouge de dégât reçu */}
            {damageFlash && (
                <div className="pointer-events-none absolute inset-0 bg-red-600/40 z-40 animate-pulse"></div>
            )}

            {/* Bouclier d'invulnérabilité au Respawn */}
            {spawnProtection && (
                <div className="pointer-events-none absolute inset-0 border-[6px] border-cyan-400/80 bg-cyan-500/10 z-30 animate-pulse"></div>
            )}

            {/* LUNETTE DE SNIPER TACTIQUE PLEIN ÉCRAN (ADS SNIPER) */}
            {isLocked && isAiming && activeWeaponSlot === 2 && !isDead && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-30">
                    <div className="absolute inset-0 bg-radial from-transparent via-black/70 to-black/95"></div>
                    <div className="relative w-96 h-96 rounded-full border-2 border-emerald-400/70 shadow-[0_0_50px_rgba(16,185,129,0.3)] flex items-center justify-center">
                        <div className="absolute w-full h-px bg-emerald-400/80"></div>
                        <div className="absolute h-full w-px bg-emerald-400/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                        <div className="absolute bottom-6 text-[10px] text-emerald-400 font-mono tracking-widest uppercase">
                            AWP-50 • RANGE 4.0X • READY
                        </div>
                    </div>
                </div>
            )}

            {/* Canvas 3D */}
            <canvas
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair"
                onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas && !isLocked && !isDead) canvas.requestPointerLock();
                }}
            />

            {/* ÉCRAN DE MORT */}
            {isDead && (
                <div className="absolute inset-0 bg-red-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-fadeIn">
                    <div className="bg-slate-900/95 border-2 border-red-500/80 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.5)] space-y-6">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-4xl animate-bounce">
                            💀
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-red-500 uppercase tracking-widest">
                                ÉLIMINÉ !
                            </h2>
                            <p className="text-sm text-slate-300 mt-2">
                                Éliminé par <span className="text-cyan-400 font-bold">{lastKiller}</span>
                            </p>
                        </div>

                        <div className="py-4 bg-slate-800/80 rounded-xl border border-slate-700">
                            <div className="text-xs uppercase tracking-widest text-slate-400 font-bold">Réapparition dans</div>
                            <div className="text-5xl font-black text-white mt-1 animate-pulse">
                                {respawnTimer}s
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Réticule de visée normal */}
            {isLocked && !isDead && !(isAiming && activeWeaponSlot === 2) && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        <div className={`rounded-full transition-all duration-150 ${
                            isAiming
                                ? 'w-2.5 h-2.5 bg-red-500 shadow-[0_0_14px_rgba(239,68,68,1)] ring-2 ring-red-400'
                                : 'w-1.5 h-1.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]'
                        }`}></div>

                        <div className={`absolute w-5 h-0.5 bg-cyan-400/80 -left-7 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute w-5 h-0.5 bg-cyan-400/80 -right-7 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-5 w-0.5 bg-cyan-400/80 -top-7 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-5 w-0.5 bg-cyan-400/80 -bottom-7 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                    </div>
                </div>
            )}

            {/* Bannière de Touche / Bullseye */}
            {hitBanner && (
                <div className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 animate-bounce">
                    <div className={`px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-2xl backdrop-blur border ${
                        hitBanner.isHeadshot
                            ? 'bg-amber-500/90 text-zinc-950 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.8)] scale-110'
                            : 'bg-slate-900/90 text-cyan-300 border-cyan-500/50'
                    }`}>
                        {hitBanner.type}
                    </div>
                </div>
            )}

            {/* Toast Mouvement (Wall Jump / Slide) */}
            {movementToast && (
                <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 z-30">
                    <div className="bg-cyan-500/90 text-zinc-950 font-black px-4 py-1.5 rounded-full text-xs uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-pulse">
                        {movementToast}
                    </div>
                </div>
            )}

            {/* KillFeed en haut à droite */}
            <div className="pointer-events-none absolute top-20 right-8 flex flex-col space-y-2 z-30">
                {killFeed.map((kf, i) => (
                    <div key={i} className="bg-slate-900/90 border border-slate-700/80 text-xs px-3.5 py-1.5 rounded-lg text-slate-200 shadow-lg animate-fadeIn">
                        {kf}
                    </div>
                ))}
            </div>

            {/* HUD Supérieur */}
            <div className="pointer-events-none absolute top-6 left-8 right-8 flex items-center justify-between text-white">
                <div className="flex items-center space-x-6 bg-slate-900/85 backdrop-blur border border-slate-700/70 px-5 py-3 rounded-xl shadow-xl">
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Score</div>
                        <div className="text-2xl font-black text-cyan-400 tracking-tight">{score}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Kills / Morts</div>
                        <div className="text-xl font-bold text-emerald-400">{playerKills} <span className="text-slate-500">/</span> {playerDeaths}</div>
                    </div>
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Précision</div>
                        <div className="text-xl font-bold text-slate-200">{accuracy}%</div>
                    </div>
                </div>

                <div className="flex items-center space-x-3 pointer-events-auto">
                    {/* Bouton Option Course Auto */}
                    <button
                        onClick={toggleAutoSprint}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all cursor-pointer ${
                            autoSprint
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                    >
                        ⚡ COURSE AUTO: {autoSprint ? 'ON' : 'OFF'}
                    </button>

                    <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>MULTIJOUEUR • {connectedPlayersCount} / 4 JOUEURS</span>
                    </div>

                    {ammoToast && (
                        <div className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider flex items-center space-x-1.5 animate-pulse shadow-lg">
                            <span>📦</span>
                            <span>{ammoToast}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* SÉLECTEUR D'ARMES RAPIDE (SLOT 1 & SLOT 2) */}
            <div className="pointer-events-none absolute bottom-28 right-8 flex space-x-2 z-30">
                <div className={`px-4 py-2 rounded-xl border backdrop-blur text-xs font-bold transition-all ${
                    activeWeaponSlot === 1
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-105'
                        : 'bg-slate-900/70 border-slate-700 text-slate-400'
                }`}>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400">[1] ASSAULT</div>
                    <div className="text-sm font-black text-white">AR-47</div>
                </div>

                <div className={`px-4 py-2 rounded-xl border backdrop-blur text-xs font-bold transition-all ${
                    activeWeaponSlot === 2
                        ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] scale-105'
                        : 'bg-slate-900/70 border-slate-700 text-slate-400'
                }`}>
                    <div className="text-[9px] uppercase tracking-widest text-slate-400">[2] SNIPER</div>
                    <div className="text-sm font-black text-white">AWP-50</div>
                </div>
            </div>

            {/* Barre de Vie (HP) du Joueur en bas à gauche */}
            <div className="pointer-events-none absolute bottom-6 left-8 z-30">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 p-4 rounded-xl shadow-2xl w-64 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Santé du Joueur</span>
                        <span className={`font-black ${playerHp > 40 ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`}>{playerHp} / 100 HP</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                        <div
                            className={`h-full transition-all duration-200 ${playerHp > 50 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]' : playerHp > 25 ? 'bg-amber-500' : 'bg-red-500 animate-pulse'}`}
                            style={{ width: `${playerHp}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* Indicateur de Rechargement Animé au Centre */}
            {isReloading && (
                <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center space-y-2">
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                            <path
                                className="text-slate-800"
                                strokeWidth="3.5"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                                className="text-cyan-400 transition-all duration-75"
                                strokeDasharray={`${reloadProgress}, 100`}
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                stroke="currentColor"
                                fill="none"
                                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                        </svg>
                        <span className="absolute text-xs font-black text-cyan-300">{reloadProgress}%</span>
                    </div>
                    <div className="bg-slate-900/90 border border-cyan-500/50 text-cyan-300 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest shadow-lg animate-pulse">
                        🔄 RECHARGEMENT {currentWeapon.name}...
                    </div>
                </div>
            )}

            {/* HUD Munitions en bas à droite */}
            <div className="pointer-events-none absolute bottom-6 right-8 flex flex-col items-end z-30">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 px-6 py-4 rounded-xl shadow-2xl flex items-baseline space-x-3 text-white">
                    <div className="flex flex-col items-start mr-3">
                        <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">{currentWeapon.name}</span>
                        <span className="text-[9px] text-slate-500">MOLETTE / [1,2] POUR CHANGER</span>
                    </div>
                    <div className={`text-4xl font-black tracking-tight ${currentWeapon.mag <= 2 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {currentWeapon.mag}
                    </div>
                    <div className="text-xl font-bold text-slate-500">/</div>
                    <div className="text-2xl font-bold text-slate-300">
                        {currentWeapon.reserve}
                    </div>
                </div>

                {currentWeapon.mag === 0 && !isReloading && (
                    <div className="mt-2 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest animate-bounce">
                        ⚠️ APPUYEZ SUR [R] POUR RECHARGER
                    </div>
                )}
            </div>

            {/* Overlay d'accueil / Pause */}
            {!isLocked && !isDead && (
                <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                    <div className="bg-slate-900/95 border border-slate-700 p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl space-y-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-3xl font-bold">
                            ⚔️
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">
                                Arène Multijoueur Tactique (140x140m)
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">
                                {networkStatus} • Affrontez de vrais joueurs avec AR-47 & Sniper AWP-50 !
                            </p>
                        </div>

                        {/* Options en jeu */}
                        <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200">Course Automatique (Auto-Sprint)</span>
                            <button
                                onClick={toggleAutoSprint}
                                className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                                    autoSprint
                                        ? 'bg-amber-500 text-zinc-950 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                            >
                                {autoSprint ? 'ACTIVÉE (ON)' : 'DÉSACTIVÉE (OFF)'}
                            </button>
                        </div>

                        {/* Guide des Commandes Avancées */}
                        <div className="grid grid-cols-2 gap-2 text-left text-xs bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 text-slate-300">
                            <div><span className="font-bold text-cyan-400">[1 / 2 / Molette]</span> : Changer d'arme</div>
                            <div><span className="font-bold text-cyan-400">[Z,Q,S,D]</span> : Déplacement</div>
                            <div><span className="font-bold text-cyan-400">[ESPACE]</span> : Saut / <span className="text-amber-400 font-bold">Wall Jump</span></div>
                            <div><span className="font-bold text-cyan-400">[C / CTRL]</span> : Accroupi</div>
                            <div><span className="font-bold text-amber-400">[Sprint + C]</span> : <span className="text-amber-400 font-bold">Glissade</span></div>
                            <div><span className="font-bold text-cyan-400">[R]</span> : Recharger</div>
                            <div><span className="font-bold text-cyan-400">[CLIC DROIT]</span> : Viser (Scope / ADS)</div>
                            <div><span className="font-bold text-cyan-400">[CLIC GAUCHE]</span> : Tirer</div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    const canvas = canvasRef.current;
                                    if (canvas) canvas.requestPointerLock();
                                }}
                                className="w-full py-3.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-sm uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer"
                            >
                                Entrer dans la Partie
                            </button>
                            <button
                                onClick={() => onExitRef.current()}
                                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs uppercase tracking-wider transition-colors cursor-pointer"
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

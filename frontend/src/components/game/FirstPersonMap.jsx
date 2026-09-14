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
    const [activeWeaponSlot, setActiveWeaponSlot] = useState(1); // 1 = AR-47, 2 = AWP-50 Sniper
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

    const [weaponsAmmo, setWeaponsAmmo] = useState({
        1: { mag: 30, maxMag: 30, reserve: 90, name: 'AR-47 BATTLE', fireRate: 110, damage: 20 },
        2: { mag: 5, maxMag: 5, reserve: 25, name: 'AWP-50 SNIPER', fireRate: 1150, damage: 65 }
    });

    const [isReloading, setIsReloading] = useState(false);
    const [reloadProgress, setReloadProgress] = useState(0);
    const [connectedPlayersCount, setConnectedPlayersCount] = useState(1);
    const [networkStatus, setNetworkStatus] = useState('Connexion...');
    const [killFeed, setKillFeed] = useState([]);
    const [hitBanner, setHitBanner] = useState(null);
    const [ammoToast, setAmmoToast] = useState(null);
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

        // --- 1. SCÈNE, CAMÉRA & RENDERER (BATTLEFIELD MILITARY ATMOSPHERE) ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0e1726);
        scene.fog = new THREE.FogExp2(0x0e1726, 0.006);

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
            0.3,
            0.3,
            0.85
        );
        composer.addPass(bloomPass);

        const outputPass = new OutputPass();
        composer.addPass(outputPass);

        // --- 3. ÉCLAIRAGE MILITAIRE HAUTE FIDÉLITÉ ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffedd5, 3.6);
        sunLight.position.set(50, 80, 60);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 280;
        sunLight.shadow.camera.left = -90;
        sunLight.shadow.camera.right = 90;
        sunLight.shadow.camera.top = 90;
        sunLight.shadow.camera.bottom = -90;
        sunLight.shadow.bias = -0.0003;
        scene.add(sunLight);

        const skyFill = new THREE.DirectionalLight(0x38bdf8, 1.3);
        skyFill.position.set(-60, 40, -60);
        scene.add(skyFill);

        // --- 4. MAP BATTLEFIELD ÉPIQUE : "OPÉRATION MÉTRO & CASPIAN SECTOR" (140x140m) ---
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.2 });
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.3 });
        const metalPlateMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.8 });
        const militaryOliveMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.5, metalness: 0.4 });
        const rustContainerMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6, metalness: 0.4 });
        const blueContainerMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5, metalness: 0.5 });
        const metroTrainMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
        const yellowHazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

        const colliders = [];
        const colliderMeshes = [];
        const registerBox = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            colliderMeshes.push(mesh);
            return box;
        };

        // Sol Principal Asphalt (140x140m)
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), asphaltMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Murs d'Enceinte de la Carte (140x140m)
        const wallH = 14;
        const addSolidWall = (x, y, z, w, h, d, mat = concreteMat) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerBox(wall);
        };
        addSolidWall(0, wallH / 2, -70, 140, wallH, 3);
        addSolidWall(0, wallH / 2, 70, 140, wallH, 3);
        addSolidWall(-70, wallH / 2, 0, 3, wallH, 140);
        addSolidWall(70, wallH / 2, 0, 3, wallH, 140);

        // SECTEUR CENTRAL : STATION DE MÉTRO & VOIE FERRÉE (OPÉRATION MÉTRO)
        // 1. Quai de Métro Surélevé (Largeur 26m, Longueur 40m, Hauteur 2.8m)
        const addSolidPlatform = (x, y, z, w, h, d, mat = concreteMat) => {
            const platform = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            platform.position.set(x, y + h / 2, z);
            platform.receiveShadow = true;
            platform.castShadow = true;
            scene.add(platform);
            registerBox(platform);

            // Bandes d'alerte jaune sur les bords du quai
            const stripLeft = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, d), yellowHazardMat);
            stripLeft.position.set(x - w / 2 + 0.2, y + h + 0.02, z);
            scene.add(stripLeft);

            const stripRight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, d), yellowHazardMat);
            stripRight.position.set(x + w / 2 - 0.2, y + h + 0.02, z);
            scene.add(stripRight);

            // Rampes d'accès solides
            const rampLen = 7.0;
            const addRamp = (rx, rz, isFront) => {
                const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.6, rampLen), concreteMat);
                ramp.position.set(rx, y + h / 2, rz);
                ramp.rotation.x = isFront ? -Math.atan2(h, rampLen) : Math.atan2(h, rampLen);
                ramp.castShadow = true;
                ramp.receiveShadow = true;
                scene.add(ramp);
                registerBox(ramp);
            };
            addRamp(x - 6, z + d / 2 + rampLen / 2 - 0.3, true);
            addRamp(x + 6, z + d / 2 + rampLen / 2 - 0.3, true);
            addRamp(x - 6, z - d / 2 - rampLen / 2 + 0.3, false);
            addRamp(x + 6, z - d / 2 - rampLen / 2 + 0.3, false);
        };
        addSolidPlatform(0, 0, 0, 24, 2.8, 36);

        // 2. Rame de Métro Déserte (Wagon Métro Central de Combat)
        const addMetroCar = (x, z) => {
            const carGroup = new THREE.Group();
            carGroup.position.set(x, 2.8, z);

            // Toit du wagon
            const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 18), metroTrainMat);
            roof.position.y = 3.2;
            roof.castShadow = true;
            roof.receiveShadow = true;
            carGroup.add(roof);
            registerBox(roof);

            // Parois latérales avec ouvertures de fenêtres/portes
            const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 18), metroTrainMat);
            wallLeft.position.set(-2.25, 1.6, 0);
            wallLeft.castShadow = true;
            carGroup.add(wallLeft);
            registerBox(wallLeft);

            const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 18), metroTrainMat);
            wallRight.position.set(2.25, 1.6, 0);
            wallRight.castShadow = true;
            carGroup.add(wallRight);
            registerBox(wallRight);

            // Panneau Enseigne Métro
            const sign = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.5, 0.1), neonCyanMat);
            sign.position.set(0, 3.4, 9.05);
            carGroup.add(sign);

            scene.add(carGroup);
        };
        addMetroCar(0, 0);

        // 3. Piliers Structuraux en Béton Armé
        const addConcretePillars = (x, z) => {
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9.0, 2.2), concreteMat);
            pillar.position.set(x, 4.5, z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            scene.add(pillar);
            registerBox(pillar);
        };
        addConcretePillars(-18, 12);
        addConcretePillars(18, 12);
        addConcretePillars(-18, -12);
        addConcretePillars(18, -12);

        // SECTEUR ALPHA : BASE CHECKPOINT MILITAIRE (SUD)
        // Tour Radar de Télécommunication (Hauteur 11m)
        const addRadarTower = (x, z) => {
            addSolidPlatform(x, 0, z, 14, 6.5, 14, concreteMat);
            // Rambardes solides
            addSolidWall(x, 6.5 + 0.6, z - 6.5, 14, 1.2, 0.8, metalPlateMat);
            addSolidWall(x, 6.5 + 0.6, z + 6.5, 14, 1.2, 0.8, metalPlateMat);
            addSolidWall(x - 6.5, 6.5 + 0.6, z, 0.8, 1.2, 14, metalPlateMat);
            addSolidWall(x + 6.5, 6.5 + 0.6, z, 0.8, 1.2, 14, metalPlateMat);

            // Antenne Radar
            const dish = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.3, 16), metalPlateMat);
            dish.position.set(x, 6.5 + 4.5, z);
            dish.rotation.x = Math.PI / 4;
            scene.add(dish);
        };
        addRadarTower(-42, 42);
        addRadarTower(42, -42);

        // Conteneurs Maritimes Militaires Empilés
        const addShippingContainer = (x, y, z, rot = 0, mat = rustContainerMat) => {
            const cont = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 7.5), mat);
            cont.position.set(x, y + 1.6, z);
            cont.rotation.y = rot;
            cont.castShadow = true;
            cont.receiveShadow = true;
            scene.add(cont);
            registerBox(cont);
        };
        addShippingContainer(-30, 0, 22, 0, rustContainerMat);
        addShippingContainer(-30, 3.2, 22, 0, blueContainerMat);
        addShippingContainer(-24, 0, 26, Math.PI / 2, militaryOliveMat);

        addShippingContainer(30, 0, -22, 0, blueContainerMat);
        addShippingContainer(30, 3.2, -22, 0, rustContainerMat);
        addShippingContainer(24, 0, -26, Math.PI / 2, militaryOliveMat);

        addShippingContainer(-40, 0, -35, Math.PI / 4, rustContainerMat);
        addShippingContainer(40, 0, 35, -Math.PI / 4, blueContainerMat);

        // Barricades de Béton & Tranchées Jersey
        const addJerseyBarrier = (x, z, rot = 0) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.4, 0.8), concreteMat);
            b.position.set(x, 0.7, z);
            b.rotation.y = rot;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
            registerBox(b);

            const neon = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.08, 0.85), neonOrangeMat);
            neon.position.set(x, 1.42, z);
            neon.rotation.y = rot;
            scene.add(neon);
        };

        [
            [-12, 24, 0], [12, 24, 0], [-12, -24, 0], [12, -24, 0],
            [-35, 0, Math.PI / 2], [35, 0, Math.PI / 2],
            [-45, 15, 0], [45, 15, 0], [-45, -15, 0], [45, -15, 0]
        ].forEach(([bx, bz, brot]) => addJerseyBarrier(bx, bz, brot));

        // --- 5. MODÈLE DE JOUEUR ADVERSE ---
        const remotePlayersMap = new Map();

        const createRealisticPlayerModel = (name, colorHex, spawnPos) => {
            const fighterGroup = new THREE.Group();
            fighterGroup.position.set(spawnPos[0], (spawnPos[1] || 1.7) - 1.7, spawnPos[2]);

            const armorMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.6, roughness: 0.35 });
            const darkTacticalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7, metalness: 0.3 });
            const plateMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.6 });

            const chestGroup = new THREE.Group();
            chestGroup.position.set(0, 1.15, 0);

            const innerTorso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), darkTacticalMat);
            innerTorso.castShadow = true;
            chestGroup.add(innerTorso);

            const plateCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.55, 0.36), armorMat);
            plateCarrier.position.set(0, 0.05, 0);
            plateCarrier.castShadow = true;
            chestGroup.add(plateCarrier);

            for (let i = -1; i <= 1; i++) {
                const magPouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.08), plateMat);
                magPouch.position.set(i * 0.16, -0.08, 0.21);
                chestGroup.add(magPouch);
            }

            fighterGroup.add(chestGroup);

            const belt = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.12, 0.34), plateMat);
            belt.position.set(0, 0.76, 0);
            fighterGroup.add(belt);

            const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), darkTacticalMat);
            legL.position.set(-0.16, 0.38, 0);
            fighterGroup.add(legL);

            const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.24), darkTacticalMat);
            legR.position.set(0.16, 0.38, 0);
            fighterGroup.add(legR);

            const armLeft = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), armorMat);
            armLeft.position.set(-0.38, 1.15, 0.2);
            armLeft.rotation.x = -Math.PI / 4;
            fighterGroup.add(armLeft);

            const armRight = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), armorMat);
            armRight.position.set(0.38, 1.15, 0.25);
            armRight.rotation.x = -Math.PI / 3;
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

            // Tête de Cible
            const headGroup = new THREE.Group();
            headGroup.position.set(0, 1.85, 0);

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
            setNetworkStatus(`En ligne • ${data.players.length} Joueur(s)`);
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
                setKillFeed((prev) => [`🎮 ${p.name} a rejoint`, ...prev.slice(0, 4)]);
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
                    setKillFeed((prev) => [`💀 ${data.shooterName} vous a éliminé`, ...prev.slice(0, 4)]);

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
                        setKillFeed((prev) => [`⚡ ${data.shooterName} a éliminé ${data.targetName}`, ...prev.slice(0, 4)]);
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
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.4, metalness: 0.5 });
        const iconGlowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

        const crateLocations = [
            [-20, 0, 20], [20, 0, 20], [-20, 0, -20], [20, 0, -20],
            [0, 2.8, 0], [-42, 6.5, 42], [42, 6.5, -42], [0, 0, 40]
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

        // --- 8. ARME DU JOUEUR LOCAL : AR-47 & AWP-50 SNIPER ---
        const weaponPivot = new THREE.Group();
        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.3 });
        const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.2 });
        const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        // MODÈLE 1 : FUSIL D'ASSAUT AR-47
        const arMeshGroup = new THREE.Group();

        const arBody = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.6), gunMetalMat);
        arBody.position.set(0.24, -0.22, -0.45);
        arMeshGroup.add(arBody);

        const arBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16), gunSteelMat);
        arBarrel.rotation.x = Math.PI / 2;
        arBarrel.position.set(0.24, -0.18, -0.8);
        arMeshGroup.add(arBarrel);

        const arMuzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), gunSteelMat);
        arMuzzle.position.set(0.24, -0.18, -1.06);
        arMeshGroup.add(arMuzzle);

        const arMag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), gunSteelMat);
        arMag.position.set(0.24, -0.36, -0.42);
        arMag.rotation.x = Math.PI / 12;
        arMeshGroup.add(arMag);

        const arGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gunMetalMat);
        arGrip.position.set(0.24, -0.34, -0.26);
        arGrip.rotation.x = -Math.PI / 6;
        arMeshGroup.add(arGrip);

        const arSightBase = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.16), gunMetalMat);
        arSightBase.position.set(0.24, -0.11, -0.45);
        arMeshGroup.add(arSightBase);

        const arSightFrame = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 16), gunMetalMat);
        arSightFrame.position.set(0.24, -0.065, -0.5);
        arMeshGroup.add(arSightFrame);

        const arSightDot = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.016, 16), sightGlowMat);
        arSightDot.position.set(0.24, -0.065, -0.5);
        arMeshGroup.add(arSightDot);

        const arFlash = new THREE.PointLight(0xffedd5, 0, 8);
        arFlash.position.set(0.24, -0.18, -1.1);
        arMeshGroup.add(arFlash);

        weaponPivot.add(arMeshGroup);

        // MODÈLE 2 : FUSIL SNIPER AWP-50
        const sniperMeshGroup = new THREE.Group();
        sniperMeshGroup.visible = false;

        const snipBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.75), gunMetalMat);
        snipBody.position.set(0.24, -0.22, -0.45);
        sniperMeshGroup.add(snipBody);

        const snipBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.02, 0.85, 16), gunSteelMat);
        snipBarrel.rotation.x = Math.PI / 2;
        snipBarrel.position.set(0.24, -0.16, -1.0);
        sniperMeshGroup.add(snipBarrel);

        const snipBrake = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.12), gunSteelMat);
        snipBrake.position.set(0.24, -0.16, -1.45);
        sniperMeshGroup.add(snipBrake);

        const snipMag = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.14), gunSteelMat);
        snipMag.position.set(0.24, -0.36, -0.38);
        sniperMeshGroup.add(snipMag);

        const snipGrip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gunMetalMat);
        snipGrip.position.set(0.24, -0.34, -0.26);
        snipGrip.rotation.x = -Math.PI / 6;
        sniperMeshGroup.add(snipGrip);

        const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.32, 16), gunMetalMat);
        scopeBody.rotation.x = Math.PI / 2;
        scopeBody.position.set(0.24, -0.04, -0.45);
        sniperMeshGroup.add(scopeBody);

        const snipFlash = new THREE.PointLight(0xffedd5, 0, 10);
        snipFlash.position.set(0.24, -0.16, -1.5);
        sniperMeshGroup.add(snipFlash);

        weaponPivot.add(sniperMeshGroup);

        camera.add(weaponPivot);
        scene.add(camera);

        let currentWeaponSlot = 1;
        const hipPosition = new THREE.Vector3(0, 0, 0);
        const arAdsPos = new THREE.Vector3(-0.24, 0.065, 0.08);
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

        // --- 10. RECHARGEMENT ---
        let currentWeaponsAmmo = {
            1: { mag: 30, maxMag: 30, reserve: 90, name: 'AR-47 BATTLE', fireRate: 110, damage: 20 },
            2: { mag: 5, maxMag: 5, reserve: 25, name: 'AWP-50 SNIPER', fireRate: 1150, damage: 65 }
        };

        let reloading = false;
        let reloadTimer = 0;
        let reloadTotalDuration = 1.35;
        let lastShotTime = 0;

        const executeReload = () => {
            const curW = currentWeaponsAmmo[currentWeaponSlot];
            if (reloading || curW.mag >= curW.maxMag || curW.reserve <= 0 || isDead) return;

            reloading = true;
            reloadTimer = 0;
            reloadTotalDuration = currentWeaponSlot === 2 ? 1.7 : 1.3;
            setIsReloading(true);
            setReloadProgress(0);
            sound.playReload();
        };

        // --- 11. CONTRÔLES, AUTO-SPRINT, GLISSADE & EFFETS SONORES DE MOUVEMENT ---
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
        let slideCooldown = 0;
        let wallJumpCooldown = 0;
        let footstepTimer = 0;
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
                    sound.playCrouch();
                    const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                    const shouldSprint = autoSprintRef.current || moveState.sprint;

                    if (isMoving && shouldSprint && canJump && !sliding && slideCooldown <= 0) {
                        const forward = new THREE.Vector3();
                        camera.getWorldDirection(forward);
                        forward.y = 0;
                        forward.normalize();

                        const right = new THREE.Vector3();
                        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

                        const slideDir = new THREE.Vector3();
                        if (moveState.forward) slideDir.add(forward);
                        if (moveState.backward) slideDir.sub(forward);
                        if (moveState.right) slideDir.add(right);
                        if (moveState.left) slideDir.sub(right);

                        if (slideDir.lengthSq() < 0.01) slideDir.copy(forward);
                        slideDir.normalize();

                        sliding = true;
                        slideTimer = 0.65;
                        slideCooldown = 1.3;
                        setIsSliding(true);
                        sound.playSlide();

                        velocity.x = slideDir.x * 18.0;
                        velocity.z = slideDir.z * 18.0;
                    }
                    break;

                case 'Space':
                    if (canJump) {
                        velocity.y = 8.8;
                        canJump = false;
                        sound.playJump();
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

        const fireWeapon = () => {
            if (!controls.isLocked || reloading || isDead) return;

            const now = performance.now();
            const curW = currentWeaponsAmmo[currentWeaponSlot];

            if (now - lastShotTime < curW.fireRate) return;

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
                setTimeout(() => sound.playBoltAction(), 320);
            } else {
                sound.playGunshot();
                arFlash.intensity = 6;
                setTimeout(() => { arFlash.intensity = 0; }, 60);
            }

            spawnBullet(true, null, null, isSniper);

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
            let hitType = isSniper ? 'SNIPER (65 DMG)' : 'CORPS (20 DMG)';
            let isHeadshot = false;

            if (distToHeadCenter <= 0.45) {
                isHeadshot = true;
                if (distToHeadCenter <= 0.10) {
                    damage = 100;
                    hitType = isSniper ? '🎯 ONE-SHOT HEADSHOT !' : '🎯 BULLSEYE HEADSHOT !';
                } else if (distToHeadCenter <= 0.24) {
                    damage = isSniper ? 100 : 65;
                    hitType = '🔴 ANNEAU ROUGE';
                } else if (distToHeadCenter <= 0.36) {
                    damage = isSniper ? 85 : 40;
                    hitType = '🔵 ANNEAU BLEU';
                } else {
                    damage = isSniper ? 75 : 25;
                    hitType = '⚪ CIBLE';
                }
            } else if (hitPoint.y < headWorldPos.y - 0.9) {
                damage = isSniper ? 50 : 15;
                hitType = isSniper ? 'JAMBE (50 DMG)' : 'JAMBE (15 DMG)';
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
            if (slideCooldown > 0) slideCooldown -= delta;

            if (isMouseDown && currentWeaponSlot === 1 && !reloading && !isDead && controls.isLocked) {
                if (time - lastShotTime >= currentWeaponsAmmo[1].fireRate) {
                    fireWeapon();
                }
            }

            const activeGunGroup = currentWeaponSlot === 1 ? arMeshGroup : sniperMeshGroup;
            if (reloading) {
                reloadTimer += delta;
                const ratio = Math.min(1.0, reloadTimer / reloadTotalDuration);
                setReloadProgress(Math.round(ratio * 100));

                if (ratio < 0.3) {
                    const p = ratio / 0.3;
                    activeGunGroup.position.y = -0.2 * p;
                    activeGunGroup.position.z = -0.05 * p;
                    activeGunGroup.rotation.x = -0.35 * p;
                    activeGunGroup.rotation.z = 0.2 * p;
                } else if (ratio < 0.65) {
                    const p = (ratio - 0.3) / 0.35;
                    activeGunGroup.position.y = -0.2 + Math.sin(p * Math.PI) * 0.05;
                    activeGunGroup.rotation.x = -0.35 + p * 0.15;
                    activeGunGroup.rotation.z = 0.2 - p * 0.1;
                } else {
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

            if (controls.isLocked && time - lastSyncTime > 40 && !isDead) {
                lastSyncTime = time;
                const camRotY = camera.rotation.y;
                mpClient.sendMove(camera.position, camRotY, camera.rotation.x, isAimingADS);
            }

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

            // Balles
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

            // DÉPLACEMENT DU JOUEUR LOCAL SANS AUCUN PASS-THROUGH
            if (controls.isLocked && !isDead) {
                if (sliding) {
                    slideTimer -= delta;
                    velocity.x -= velocity.x * 3.0 * delta;
                    velocity.z -= velocity.z * 3.0 * delta;
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

                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;

                if (!sliding) {
                    if (moveState.forward || moveState.backward) velocity.z += dir.z * baseSpeed * 10.0 * delta;
                    if (moveState.left || moveState.right) velocity.x += dir.x * baseSpeed * 10.0 * delta;
                }

                // BRUITS DE PAS DYNAMIQUES
                if (isMoving && canJump && !sliding) {
                    footstepTimer += delta;
                    const stepInterval = shouldSprint ? 0.28 : 0.44;
                    if (footstepTimer >= stepInterval) {
                        footstepTimer = 0;
                        sound.playFootstep(shouldSprint);
                    }
                } else {
                    footstepTimer = 0.2;
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

                // DÉTECTION DU SOL & ANTI-CLIPPING VERTICAL
                const wasAirborne = !canJump;
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
                        // On ne monte que si les pieds sont à la hauteur de la surface supérieure
                        if (camera.position.y >= topY - 0.45 && topY >= groundY) {
                            groundY = topY;
                        }

                        // Anti-traversée par le bas (plafond sous plateforme)
                        if (velocity.y > 0 && camera.position.y >= col.min.y - 0.1 && camera.position.y <= col.max.y) {
                            camera.position.y = col.min.y - 0.1;
                            velocity.y = 0;
                        }
                    }
                }

                if (camera.position.y <= groundY) {
                    camera.position.y = groundY;
                    if (wasAirborne && velocity.y < -4.0) {
                        sound.playLand();
                    }
                    velocity.y = 0;
                    canJump = true;
                }

                // FOV & ADS
                const targetFov = isAimingADS ? (currentWeaponSlot === 2 ? 16 : 46) : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 14);
                camera.updateProjectionMatrix();

                let targetPivotPos = hipPosition;
                if (isAimingADS) {
                    if (currentWeaponSlot === 1) {
                        targetPivotPos = arAdsPos;
                    } else {
                        targetPivotPos = new THREE.Vector3(0, -1.2, 0);
                    }
                }
                weaponPivot.position.lerp(targetPivotPos, delta * 16);

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

            {/* LUNETTE DE SNIPER TACTIQUE PLEIN ÉCRAN ULTRA-CLAIRE */}
            {isLocked && isAiming && activeWeaponSlot === 2 && !isDead && (
                <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center z-30"
                    style={{
                        background: 'radial-gradient(circle 260px at center, transparent 96%, rgba(0,0,0,0.92) 98%, #000000 100%)'
                    }}
                >
                    <div className="relative w-[520px] h-[520px] rounded-full border-2 border-emerald-400/80 shadow-[0_0_40px_rgba(16,185,129,0.3)] flex items-center justify-center">
                        <div className="absolute w-full h-[1.5px] bg-emerald-400/80"></div>
                        <div className="absolute h-full w-[1.5px] bg-emerald-400/80"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,1)]"></div>

                        <div className="absolute top-1/4 w-8 h-[1px] bg-emerald-400/70"></div>
                        <div className="absolute top-1/3 w-12 h-[1.5px] bg-emerald-400/70"></div>
                        <div className="absolute bottom-1/3 w-12 h-[1.5px] bg-emerald-400/70"></div>
                        <div className="absolute bottom-1/4 w-8 h-[1px] bg-emerald-400/70"></div>

                        <div className="absolute left-1/4 h-8 w-[1px] bg-emerald-400/70"></div>
                        <div className="absolute right-1/4 h-8 w-[1px] bg-emerald-400/70"></div>

                        <div className="absolute bottom-8 text-[11px] text-emerald-400 font-mono tracking-widest uppercase font-bold bg-black/60 px-3 py-1 rounded-full border border-emerald-500/40">
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

            {/* Bannière de Touche */}
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

            {/* KillFeed épuré en haut à droite */}
            <div className="pointer-events-none absolute top-20 right-8 flex flex-col space-y-2 z-30">
                {killFeed.map((kf, i) => (
                    <div key={i} className="bg-slate-900/90 border border-slate-700/80 text-xs px-3.5 py-1.5 rounded-lg text-slate-200 shadow-lg animate-fadeIn">
                        {kf}
                    </div>
                ))}
            </div>

            {/* HUD Supérieur Battlefield Minimaliste */}
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
                    <button
                        onClick={toggleAutoSprint}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase border transition-all cursor-pointer ${
                            autoSprint
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                    >
                        ⚡ SPRINT AUTO: {autoSprint ? 'ON' : 'OFF'}
                    </button>

                    <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>OPÉRATION MÉTRO • {connectedPlayersCount} / 4 JOUEURS</span>
                    </div>

                    {ammoToast && (
                        <div className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider flex items-center space-x-1.5 animate-pulse shadow-lg">
                            <span>📦</span>
                            <span>{ammoToast}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Sélecteur d'Armes */}
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

            {/* Barre de Vie (HP) du Joueur */}
            <div className="pointer-events-none absolute bottom-6 left-8 z-30">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 p-4 rounded-xl shadow-2xl w-64 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Santé</span>
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

            {/* Rechargement Animé */}
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
                        🔄 RECHARGEMENT...
                    </div>
                </div>
            )}

            {/* HUD Munitions */}
            <div className="pointer-events-none absolute bottom-6 right-8 flex flex-col items-end z-30">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 px-6 py-4 rounded-xl shadow-2xl flex items-baseline space-x-3 text-white">
                    <div className="flex flex-col items-start mr-3">
                        <span className="text-[10px] uppercase tracking-widest text-cyan-400 font-bold">{currentWeapon.name}</span>
                        <span className="text-[9px] text-slate-500">MOLETTE / [1,2]</span>
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
                        ⚠️ [R] POUR RECHARGER
                    </div>
                )}
            </div>

            {/* Menu Pause */}
            {!isLocked && !isDead && (
                <div className="absolute inset-0 bg-black/65 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                    <div className="bg-slate-900/95 border border-slate-700 p-8 rounded-2xl max-w-lg w-full text-center shadow-2xl space-y-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-3xl font-bold">
                            ⚔️
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white tracking-wide uppercase">
                                Opération Métro • Caspian Sector (140x140m)
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">
                                {networkStatus} • Carte Battlefield avec Quai de Métro, Wagon de Combat & Base Militaire !
                            </p>
                        </div>

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

                        <div className="grid grid-cols-2 gap-2 text-left text-xs bg-slate-800/80 p-3.5 rounded-xl border border-slate-700/80 text-slate-300">
                            <div><span className="font-bold text-cyan-400">[1 / 2 / Molette]</span> : Armes</div>
                            <div><span className="font-bold text-cyan-400">[Z,Q,S,D]</span> : Déplacement</div>
                            <div><span className="font-bold text-cyan-400">[ESPACE]</span> : Saut / <span className="text-amber-400 font-bold">Wall Jump</span></div>
                            <div><span className="font-bold text-cyan-400">[C / CTRL]</span> : Accroupi</div>
                            <div><span className="font-bold text-amber-400">[Sprint + C]</span> : <span className="text-amber-400 font-bold">Glissade</span></div>
                            <div><span className="font-bold text-cyan-400">[R]</span> : Recharger</div>
                            <div><span className="font-bold text-cyan-400">[CLIC DROIT]</span> : Viser</div>
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
                                Déployer dans la Partie
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

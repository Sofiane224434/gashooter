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
    const [gameMode, setGameMode] = useState(initialMode);
    const [score, setScore] = useState(0);
    const [playerHp, setPlayerHp] = useState(100);
    const [playerKills, setPlayerKills] = useState(0);
    const [playerDeaths, setPlayerDeaths] = useState(0);
    const [shotsFired, setShotsFired] = useState(0);
    const [shotsHit, setShotsHit] = useState(0);
    const [magAmmo, setMagAmmo] = useState(30);
    const [reserveAmmo, setReserveAmmo] = useState(90);
    const [isReloading, setIsReloading] = useState(false);
    const [connectedPlayersCount, setConnectedPlayersCount] = useState(1);
    const [networkStatus, setNetworkStatus] = useState('Connexion...');
    const [killFeed, setKillFeed] = useState([]);
    const [hitBanner, setHitBanner] = useState(null);
    const [ammoToast, setAmmoToast] = useState(null);
    const [damageFlash, setDamageFlash] = useState(false);
    const [savedStats, setSavedStats] = useState(() => SaveService.getSaveData());

    const maxMag = 30;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // --- 1. SCÈNE, CAMÉRA & RENDERER ---
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e293b);
        scene.fog = new THREE.FogExp2(0x1e293b, 0.007);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            500
        );
        camera.position.set(0, 1.7, 22);

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

        // --- 3. ÉCLAIRAGE HAUTE VISIBILITÉ ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 3.8);
        sunLight.position.set(25, 45, 30);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 130;
        sunLight.shadow.camera.left = -40;
        sunLight.shadow.camera.right = 40;
        sunLight.shadow.camera.top = 40;
        sunLight.shadow.camera.bottom = -40;
        sunLight.shadow.bias = -0.0003;
        scene.add(sunLight);

        const skyFill = new THREE.DirectionalLight(0x93c5fd, 1.5);
        skyFill.position.set(-25, 20, -25);
        scene.add(skyFill);

        // --- 4. GÉOMÉTRIE & MATÉRIAUX DE L'ARÈNE ---
        const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5, metalness: 0.2 });
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.6, metalness: 0.3 });
        const columnMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
        const platformMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.4, metalness: 0.5 });
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

        const colliders = [];
        const registerBox = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            return box;
        };

        const floor = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        const addGroundMark = (x, z, w, d, mat = neonCyanMat) => {
            const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
            strip.position.set(x, 0.015, z);
            strip.rotation.x = -Math.PI / 2;
            scene.add(strip);
        };
        addGroundMark(0, -10, 50, 0.25, neonCyanMat);
        addGroundMark(0, 10, 50, 0.25, neonCyanMat);
        addGroundMark(-18, 0, 0.25, 40, neonOrangeMat);
        addGroundMark(18, 0, 0.25, 40, neonOrangeMat);

        const wallH = 10;
        const addWall = (x, y, z, w, h, d) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerBox(wall);
        };
        addWall(0, wallH / 2, -35, 70, wallH, 1.5);
        addWall(0, wallH / 2, 35, 70, wallH, 1.5);
        addWall(-35, wallH / 2, 0, 1.5, wallH, 70);
        addWall(35, wallH / 2, 0, 1.5, wallH, 70);

        const addPillar = (x, z) => {
            const group = new THREE.Group();
            group.position.set(x, 0, z);
            const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 8, 2.4), columnMat);
            pillar.position.y = 4;
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            group.add(pillar);

            const ring = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.2, 2.5), neonCyanMat);
            ring.position.y = 4;
            group.add(ring);

            scene.add(group);
            registerBox(pillar);
        };
        addPillar(-14, -10);
        addPillar(14, -10);
        addPillar(-14, 14);
        addPillar(14, 14);

        const addPlatform = (x, y, z, w, h, d) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), platformMat);
            mesh.position.set(x, y + h / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            registerBox(mesh);

            const ramp = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 4), platformMat);
            ramp.position.set(x, (y + h) / 2, z + d / 2 + 1.8);
            ramp.rotation.x = -Math.atan2(y + h, 4);
            ramp.castShadow = true;
            ramp.receiveShadow = true;
            scene.add(ramp);
            registerBox(ramp);
        };
        addPlatform(-20, 0, -20, 8, 2.2, 8);
        addPlatform(20, 0, -20, 8, 2.6, 8);
        addPlatform(0, 0, -24, 10, 3.2, 6);

        // --- 5. GESTION DES COMBATTANTS AVEC TÊTES DE CIBLES (TARGET-HEAD FIGHTERS) ---
        const remotePlayersMap = new Map(); // id -> Group

        const createTargetHeadModel = (name, colorHex, spawnPos) => {
            const fighterGroup = new THREE.Group();
            fighterGroup.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);

            const armorMat = new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.7, roughness: 0.3 });
            const darkKevlar = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });

            // Corps / Torse
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.4), armorMat);
            torso.position.y = 1.1;
            torso.castShadow = true;
            fighterGroup.add(torso);

            // Jambes
            const legL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.28), darkKevlar);
            legL.position.set(-0.2, 0.38, 0);
            fighterGroup.add(legL);

            const legR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.75, 0.28), darkKevlar);
            legR.position.set(0.2, 0.38, 0);
            fighterGroup.add(legR);

            // Bras & Arme
            const armL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), armorMat);
            armL.position.set(-0.48, 1.1, 0.1);
            armL.rotation.x = -Math.PI / 6;
            fighterGroup.add(armL);

            const armR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), armorMat);
            armR.position.set(0.48, 1.1, 0.1);
            armR.rotation.x = -Math.PI / 4;
            fighterGroup.add(armR);

            const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.65), darkKevlar);
            gun.position.set(0.42, 0.95, 0.4);
            fighterGroup.add(gun);

            // TÊTE DE CIBLE DE TIR À L'ARC À ANNEAUX CONCENTRIQUES
            const headGroup = new THREE.Group();
            headGroup.position.set(0, 1.85, 0);

            const headDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 32), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 }));
            headDisc.rotation.x = Math.PI / 2;
            headDisc.castShadow = true;
            headGroup.add(headDisc);

            const ringR = [0.4, 0.3, 0.2, 0.09];
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

            // Barre de PV 3D
            const hpBarBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
            hpBarBg.position.set(0, 2.45, 0);
            fighterGroup.add(hpBarBg);

            const hpBarFill = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.08), new THREE.MeshBasicMaterial({ color: 0x10b981, side: THREE.DoubleSide }));
            hpBarFill.position.set(0, 2.45, 0.005);
            fighterGroup.add(hpBarFill);

            fighterGroup.userData = {
                name,
                hp: 100,
                maxHp: 100,
                isFighter: true,
                torso,
                headGroup,
                hpBarFill,
                hpBarBg,
                targetPos: new THREE.Vector3(spawnPos[0], spawnPos[1], spawnPos[2]),
                targetRotY: 0,
                isAlive: true,
                isBot: false
            };

            scene.add(fighterGroup);
            return fighterGroup;
        };

        // --- 6. CLIENT MULTIJOUEUR WEBSOCKET ---
        const mpClient = new MultiplayerClient();

        mpClient.callbacks.onInitState = (data) => {
            setNetworkStatus(`Connecté au Salon (Slot ${data.mySlot + 1}/4)`);
            if (data.mySpawn) {
                camera.position.set(data.mySpawn[0], data.mySpawn[1], data.mySpawn[2]);
            }

            // Instancier les autres joueurs connectés
            data.players.forEach((p) => {
                if (p.id !== data.myId && !remotePlayersMap.has(p.id)) {
                    const model = createTargetHeadModel(p.name, p.color, p.pos || [0, 1.7, 0]);
                    remotePlayersMap.set(p.id, model);
                }
            });

            // Si moins de 4 joueurs, compléter avec des bots cibles tactiques
            const totalPlayers = data.players.length;
            setConnectedPlayersCount(totalPlayers);
            spawnFillBots(4 - totalPlayers);
        };

        mpClient.callbacks.onPlayerJoined = (p) => {
            if (!remotePlayersMap.has(p.id)) {
                const model = createTargetHeadModel(p.name, p.color, p.pos || [0, 1.7, 0]);
                remotePlayersMap.set(p.id, model);
                setConnectedPlayersCount((prev) => prev + 1);
                setKillFeed((prev) => [`🎮 ${p.name} a rejoint la partie`, ...prev.slice(0, 3)]);
            }
        };

        mpClient.callbacks.onPlayerMoved = (data) => {
            const playerModel = remotePlayersMap.get(data.id);
            if (playerModel) {
                playerModel.userData.targetPos.set(data.pos[0], data.pos[1], data.pos[2]);
                playerModel.userData.targetRotY = data.rotY;
            }
        };

        mpClient.callbacks.onPlayerShot = (data) => {
            spawnBullet(false, new THREE.Vector3(...data.origin), new THREE.Vector3(...data.dir));
            sound.playGunshot();
        };

        mpClient.callbacks.onDamageApplied = (data) => {
            // Mise à jour de la barre de PV du combattant touché
            if (data.targetId === mpClient.myId) {
                // Le joueur local a été touché
                setDamageFlash(true);
                setTimeout(() => setDamageFlash(false), 200);
                setPlayerHp(data.newHp);

                if (data.isKill) {
                    setPlayerDeaths((d) => d + 1);
                    setKillFeed((prev) => [`💀 ${data.shooterName} vous a éliminé (${data.hitType})`, ...prev.slice(0, 3)]);
                    setTimeout(() => mpClient.sendRespawn(), 3000);
                }
            } else {
                const targetModel = remotePlayersMap.get(data.targetId);
                if (targetModel) {
                    targetModel.userData.hp = data.newHp;
                    const hpPercent = Math.max(0, data.newHp / 100);
                    targetModel.userData.hpBarFill.scale.x = hpPercent;
                    targetModel.userData.hpBarFill.position.x = -(1 - hpPercent) * 0.48;

                    if (data.isKill) {
                        targetModel.visible = false;
                        setKillFeed((prev) => [`⚡ ${data.shooterName} a éliminé ${data.targetName}`, ...prev.slice(0, 3)]);
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
                    model.userData.hp = 100;
                    model.userData.hpBarFill.scale.x = 1;
                    model.userData.hpBarFill.position.x = 0;
                    if (data.spawnPos) model.position.set(data.spawnPos[0], data.spawnPos[1], data.spawnPos[2]);
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

        // Bots de remplissage pour garantir 4 combattants
        const fillBots = [];
        const spawnFillBots = (count) => {
            const botNames = ['Target-Alpha', 'Target-Bravo', 'Target-Charlie'];
            const botColors = [0xdc2626, 0x9333ea, 0xd97706];
            const botSpawns = [[-14, 0, -12], [14, 0, -14], [0, 0, -20]];

            for (let i = 0; i < Math.min(count, 3); i++) {
                const botId = `bot_${i}`;
                if (!remotePlayersMap.has(botId)) {
                    const bot = createTargetHeadModel(botNames[i], botColors[i], botSpawns[i]);
                    bot.userData.isBot = true;
                    bot.userData.id = botId;
                    bot.userData.shootCooldown = Math.random() * 2.5 + 1.5;
                    bot.userData.moveTarget = new THREE.Vector3((Math.random() - 0.5) * 40, 0, (Math.random() - 0.5) * 40);
                    remotePlayersMap.set(botId, bot);
                    fillBots.push(bot);
                }
            }
        };

        // --- 7. CAISSES DE MUNITIONS AU SOL ---
        const ammoCrates = [];
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x2e4a2b, roughness: 0.5, metalness: 0.4 });
        const iconGlowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

        const crateLocations = [[-12, 0, 6], [12, 0, 6], [-22, 0, -8], [22, 0, -8], [0, 0, 10]];
        crateLocations.forEach(([x, z]) => {
            const crateGroup = new THREE.Group();
            crateGroup.position.set(x, 0, z);

            const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), crateMat);
            box.position.y = 0.35;
            box.castShadow = true;
            box.receiveShadow = true;
            crateGroup.add(box);

            const iconGroup = new THREE.Group();
            iconGroup.position.y = 1.3;
            for (let b = -1; b <= 1; b++) {
                const bulletIcon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), iconGlowMat);
                bulletIcon.position.x = b * 0.15;
                bulletIcon.rotation.z = b * 0.2;
                iconGroup.add(bulletIcon);
            }
            crateGroup.add(iconGroup);

            crateGroup.userData = { isCrate: true, available: true, iconGroup, respawnTimer: 0, radius: 1.8 };
            scene.add(crateGroup);
            ammoCrates.push(crateGroup);
            registerBox(box);
        });

        // --- 8. ARME TACTIQUE DU JOUEUR ---
        const weaponPivot = new THREE.Group();
        const weaponMeshGroup = new THREE.Group();

        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.3 });
        const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.2 });
        const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.6), gunMetalMat);
        body.position.set(0.24, -0.22, -0.45);
        weaponMeshGroup.add(body);

        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16), gunSteelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.24, -0.18, -0.8);
        weaponMeshGroup.add(barrel);

        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), gunSteelMat);
        muzzle.position.set(0.24, -0.18, -1.06);
        weaponMeshGroup.add(muzzle);

        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), gunSteelMat);
        mag.position.set(0.24, -0.36, -0.42);
        mag.rotation.x = Math.PI / 12;
        weaponMeshGroup.add(mag);

        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gunMetalMat);
        grip.position.set(0.24, -0.34, -0.26);
        grip.rotation.x = -Math.PI / 6;
        weaponMeshGroup.add(grip);

        const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.06, 0.16), gunMetalMat);
        sightBase.position.set(0.24, -0.11, -0.45);
        weaponMeshGroup.add(sightBase);

        const sightFrame = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.006, 8, 16), gunMetalMat);
        sightFrame.position.set(0.24, -0.065, -0.5);
        weaponMeshGroup.add(sightFrame);

        const sightDot = new THREE.Mesh(new THREE.RingGeometry(0.008, 0.016, 16), sightGlowMat);
        sightDot.position.set(0.24, -0.065, -0.5);
        weaponMeshGroup.add(sightDot);

        const flashLight = new THREE.PointLight(0xffedd5, 0, 8);
        flashLight.position.set(0.24, -0.18, -1.1);
        weaponMeshGroup.add(flashLight);

        weaponPivot.add(weaponMeshGroup);
        camera.add(weaponPivot);
        scene.add(camera);

        const hipPosition = new THREE.Vector3(0, 0, 0);
        const adsPosition = new THREE.Vector3(-0.24, 0.065, 0.08);
        let isAimingADS = false;

        // --- 9. BALLES 3D PHYSIQUES & IMPACTS ---
        const bullets = [];
        const bulletGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
        const enemyBulletMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        const sparks = [];
        const sparkGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });

        const createSparks = (pos) => {
            for (let i = 0; i < 14; i++) {
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

        const spawnBullet = (fromPlayer = true, originPos = null, dirVec = null) => {
            const bullet = new THREE.Mesh(bulletGeo, fromPlayer ? bulletMat : enemyBulletMat);
            let shootDir = new THREE.Vector3();

            if (fromPlayer) {
                const muzzleWorldPos = new THREE.Vector3();
                muzzle.getWorldPosition(muzzleWorldPos);
                bullet.position.copy(muzzleWorldPos);
                camera.getWorldDirection(shootDir);
                bullet.quaternion.copy(camera.quaternion);

                // Diffuser aux autres joueurs via WebSocket
                mpClient.sendShoot(muzzleWorldPos, shootDir);
            } else {
                bullet.position.copy(originPos);
                shootDir.copy(dirVec);
                bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), shootDir);
            }

            scene.add(bullet);
            bullets.push({
                mesh: bullet,
                dir: shootDir.clone(),
                speed: fromPlayer ? 190.0 : 95.0,
                fromPlayer,
                distTravelled: 0,
                maxDist: 200.0
            });
        };

        // --- 10. RECHARGEMENT & CLAVIER ---
        let currentMag = 30;
        let currentReserve = 90;
        let reloading = false;

        const executeReload = () => {
            if (reloading || currentMag >= maxMag || currentReserve <= 0) return;
            reloading = true;
            setIsReloading(true);
            sound.playReload();

            weaponMeshGroup.position.y -= 0.15;
            weaponMeshGroup.rotation.x -= 0.2;

            setTimeout(() => {
                const needed = maxMag - currentMag;
                const toLoad = Math.min(needed, currentReserve);
                currentMag += toLoad;
                currentReserve -= toLoad;

                setMagAmmo(currentMag);
                setReserveAmmo(currentReserve);

                weaponMeshGroup.position.y = 0;
                weaponMeshGroup.rotation.x = 0;
                reloading = false;
                setIsReloading(false);
            }, 1200);
        };

        const controls = new PointerLockControls(camera, canvas);
        controls.addEventListener('lock', () => setIsLocked(true));
        controls.addEventListener('unlock', () => {
            setIsLocked(false);
            isAimingADS = false;
            setIsAiming(false);
        });

        const moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
        const velocity = new THREE.Vector3();
        let canJump = true;

        const onKeyDown = (e) => {
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
                case 'Space':
                    if (canJump) { velocity.y = 8.5; canJump = false; }
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
            }
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);

        const fireWeapon = () => {
            if (!controls.isLocked || reloading) return;
            if (currentMag <= 0) {
                sound.playDryFire();
                if (currentReserve > 0) executeReload();
                return;
            }

            currentMag -= 1;
            setMagAmmo(currentMag);
            setShotsFired((prev) => prev + 1);

            sound.playGunshot();
            spawnBullet(true);

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

        const onMouseDown = (e) => {
            if (!controls.isLocked) return;
            if (e.button === 0) fireWeapon();
            else if (e.button === 2) {
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

        // --- 11. CALCUL DÉGÂTS PAR ZONE & BULLSEYE RÉEL ---
        const handleTargetHit = (fighter, hitPoint, targetId) => {
            sound.playHitmarker();
            setShotsHit((prev) => prev + 1);

            const headWorldPos = new THREE.Vector3();
            fighter.userData.headGroup.getWorldPosition(headWorldPos);
            const distToHeadCenter = hitPoint.distanceTo(headWorldPos);

            let damage = 20;
            let hitType = 'CORPS (20 DMG)';
            let isHeadshot = false;

            if (distToHeadCenter <= 0.45) {
                isHeadshot = true;
                if (distToHeadCenter <= 0.10) {
                    // BULLSEYE PARFAIT AU CENTRE : 100 DMG (ONE-SHOT KILL !)
                    damage = 100;
                    hitType = '🎯 BULLSEYE HEADSHOT ! (100 DMG)';
                } else if (distToHeadCenter <= 0.24) {
                    damage = 65;
                    hitType = '🔴 ANNEAU ROUGE (65 DMG)';
                } else if (distToHeadCenter <= 0.36) {
                    damage = 40;
                    hitType = '🔵 ANNEAU BLEU (40 DMG)';
                } else {
                    damage = 25;
                    hitType = '⚪ BORD DE CIBLE (25 DMG)';
                }
            } else if (hitPoint.y < headWorldPos.y - 0.9) {
                damage = 15;
                hitType = 'JAMBES / BRAS (15 DMG)';
            }

            setHitBanner({ type: hitType, isHeadshot, damage });
            setTimeout(() => setHitBanner(null), 1800);

            // Transmettre l'impact via WebSocket pour synchronisation multi
            mpClient.sendHit(targetId, damage, hitType, hitPoint);

            setScore((prev) => prev + (isHeadshot ? (damage === 100 ? 500 : 250) : 100));
        };

        // --- 12. BOUCLE PRINCIPALE ---
        let prevTime = performance.now();
        let lastSyncTime = 0;
        let bobTimer = 0;
        let animationFrameId;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);
            prevTime = time;

            // Synchronisation réseau du joueur local (25 fois par seconde)
            if (controls.isLocked && time - lastSyncTime > 40) {
                lastSyncTime = time;
                const camRotY = camera.rotation.y;
                mpClient.sendMove(camera.position, camRotY, camera.rotation.x, isAimingADS);
            }

            // Interpolation et mise à jour des combattants distants et bots
            for (const [id, f] of remotePlayersMap.entries()) {
                if (f.userData.isBot) {
                    // Logique locale pour les bots
                    f.userData.headGroup.lookAt(camera.position.x, 1.85, camera.position.z);
                    f.userData.hpBarBg.lookAt(camera.position);
                    f.userData.hpBarFill.lookAt(camera.position);

                    const distToMove = f.position.distanceTo(f.userData.moveTarget);
                    if (distToMove < 2.0) {
                        f.userData.moveTarget.set((Math.random() - 0.5) * 44, 0, (Math.random() - 0.5) * 44);
                    } else {
                        const moveDir = new THREE.Vector3().subVectors(f.userData.moveTarget, f.position).normalize();
                        f.position.addScaledVector(moveDir, delta * 3.5);
                        f.lookAt(f.userData.moveTarget.x, f.position.y, f.userData.moveTarget.z);
                    }

                    f.userData.shootCooldown -= delta;
                    if (f.userData.shootCooldown <= 0) {
                        f.userData.shootCooldown = Math.random() * 3.5 + 2.0;
                        const shootOrigin = f.position.clone();
                        shootOrigin.y = 1.2;
                        const targetPlayerPos = camera.position.clone();
                        targetPlayerPos.y -= 0.3;
                        const dirToPlayer = new THREE.Vector3().subVectors(targetPlayerPos, shootOrigin).normalize();
                        spawnBullet(false, shootOrigin, dirToPlayer);
                    }
                } else {
                    // Joueurs humains distants
                    f.position.lerp(f.userData.targetPos, delta * 12);
                    f.rotation.y = THREE.MathUtils.lerp(f.rotation.y, f.userData.targetRotY, delta * 12);
                    f.userData.headGroup.lookAt(camera.position.x, 1.85, camera.position.z);
                    f.userData.hpBarBg.lookAt(camera.position);
                    f.userData.hpBarFill.lookAt(camera.position);
                }
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
                    c.userData.iconGroup.rotation.y += delta * 2.0;
                    c.userData.iconGroup.position.y = 1.3 + Math.sin(time * 0.004) * 0.08;

                    const playerPos = new THREE.Vector2(camera.position.x, camera.position.z);
                    const cratePos = new THREE.Vector2(c.position.x, c.position.z);
                    if (playerPos.distanceTo(cratePos) < c.userData.radius) {
                        c.userData.available = false;
                        c.userData.respawnTimer = 14.0;
                        c.visible = false;

                        sound.playAmmoPickup();
                        currentReserve += 60;
                        setReserveAmmo(currentReserve);

                        setAmmoToast('+60 MUNITIONS');
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
                        if (hit.object === b.mesh || hit.object.parent === weaponMeshGroup) continue;

                        collided = true;
                        createSparks(hit.point);

                        if (b.fromPlayer) {
                            // Chercher si un combattant est touché
                            for (const [targetId, f] of remotePlayersMap.entries()) {
                                let obj = hit.object;
                                while (obj && obj !== scene) {
                                    if (obj === f) {
                                        handleTargetHit(f, hit.point, targetId);
                                        break;
                                    }
                                    obj = obj.parent;
                                }
                            }
                        } else {
                            // Dégât reçu par le joueur local
                            const distToCamera = hit.point.distanceTo(camera.position);
                            if (distToCamera < 1.4) {
                                setDamageFlash(true);
                                setTimeout(() => setDamageFlash(false), 200);

                                setPlayerHp((prev) => {
                                    const nextHp = Math.max(0, prev - 20);
                                    if (nextHp <= 0) {
                                        setPlayerDeaths((d) => d + 1);
                                        camera.position.set((Math.random() - 0.5) * 30, 1.7, 20);
                                        mpClient.sendRespawn();
                                        return 100;
                                    }
                                    return nextHp;
                                });
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

            if (controls.isLocked) {
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

                const targetFov = isAimingADS ? 44 : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 14);
                camera.updateProjectionMatrix();

                const targetPivotPos = isAimingADS ? adsPosition : hipPosition;
                weaponPivot.position.lerp(targetPivotPos, delta * 16);

                const isMoving = moveState.forward || moveState.backward || moveState.left || moveState.right;
                if (isMoving && canJump && !isAimingADS && !reloading) {
                    bobTimer += delta * (moveState.sprint ? 14 : 9);
                    weaponMeshGroup.position.x = Math.sin(bobTimer) * 0.015;
                    weaponMeshGroup.position.y = Math.cos(bobTimer * 2) * 0.01;
                } else if (isAimingADS && !reloading) {
                    bobTimer += delta * 2;
                    weaponMeshGroup.position.x = Math.sin(bobTimer) * 0.001;
                    weaponMeshGroup.position.y = Math.cos(bobTimer * 2) * 0.001;
                } else if (!reloading) {
                    weaponMeshGroup.position.x = 0;
                    weaponMeshGroup.position.y = 0;
                }
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

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-slate-900 select-none font-sans">
            {/* Flash rouge lors d'un dégât reçu */}
            {damageFlash && (
                <div className="pointer-events-none absolute inset-0 bg-red-600/35 z-40 animate-pulse"></div>
            )}

            {/* Canvas 3D */}
            <canvas
                ref={canvasRef}
                className="w-full h-full block cursor-crosshair"
                onClick={() => {
                    const canvas = canvasRef.current;
                    if (canvas && !isLocked) canvas.requestPointerLock();
                }}
            />

            {/* Réticule de visée */}
            {isLocked && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="relative flex items-center justify-center">
                        <div className={`rounded-full transition-all duration-150 ${
                            isAiming
                                ? 'w-2 h-2 bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)] ring-2 ring-red-400/80'
                                : 'w-1.5 h-1.5 bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)]'
                        }`}></div>

                        <div className={`absolute w-4 h-0.5 bg-cyan-400/80 -left-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute w-4 h-0.5 bg-cyan-400/80 -right-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-4 w-0.5 bg-cyan-400/80 -top-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
                        <div className={`absolute h-4 w-0.5 bg-cyan-400/80 -bottom-6 transition-opacity duration-150 ${isAiming ? 'opacity-0' : 'opacity-100'}`}></div>
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
                <div className="flex items-center space-x-6 bg-slate-900/85 backdrop-blur border border-slate-700/70 px-5 py-3 rounded-lg shadow-xl">
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

                <div className="flex items-center space-x-3">
                    <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>MULTIJOUEUR EN LIGNE • {connectedPlayersCount} / 4 JOUEURS</span>
                    </div>

                    {ammoToast && (
                        <div className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-3.5 py-1.5 rounded-lg text-xs font-bold tracking-wider flex items-center space-x-1.5 animate-pulse shadow-lg">
                            <span>📦</span>
                            <span>{ammoToast}</span>
                        </div>
                    )}

                    {isAiming && (
                        <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-3 py-1.5 rounded text-[11px] font-bold tracking-widest uppercase animate-pulse">
                            ADS ACTIF • ZOOM 1.8X
                        </div>
                    )}
                </div>
            </div>

            {/* Barre de Vie (HP) du Joueur en bas à gauche */}
            <div className="pointer-events-none absolute bottom-6 left-8 z-30">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 p-4 rounded-xl shadow-2xl w-64 space-y-1.5">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Santé du Joueur</span>
                        <span className={`font-black ${playerHp > 40 ? 'text-emerald-400' : 'text-red-400 animate-pulse'}`}>{playerHp} / 100 HP</span>
                    </div>
                    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                        <div
                            className={`h-full transition-all duration-200 ${playerHp > 50 ? 'bg-emerald-500' : playerHp > 25 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${playerHp}%` }}
                        ></div>
                    </div>
                </div>
            </div>

            {/* HUD Munitions */}
            <div className="pointer-events-none absolute bottom-6 right-8 flex flex-col items-end z-30">
                <div className="bg-slate-900/90 backdrop-blur border border-slate-700/80 px-6 py-4 rounded-xl shadow-2xl flex items-baseline space-x-3 text-white">
                    <div className={`text-4xl font-black tracking-tight ${magAmmo <= 5 ? 'text-red-500 animate-pulse' : 'text-cyan-400'}`}>
                        {magAmmo}
                    </div>
                    <div className="text-xl font-bold text-slate-500">/</div>
                    <div className="text-2xl font-bold text-slate-300">
                        {reserveAmmo}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold ml-2">
                        BALLES
                    </div>
                </div>

                {isReloading && (
                    <div className="mt-2 bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest animate-pulse">
                        🔄 Rechargement...
                    </div>
                )}

                {magAmmo === 0 && !isReloading && (
                    <div className="mt-2 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest animate-bounce">
                        ⚠️ [R] POUR RECHARGER
                    </div>
                )}
            </div>

            {/* Overlay d'accueil / pause */}
            {!isLocked && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
                    <div className="bg-slate-900/95 border border-slate-700 p-8 rounded-xl max-w-lg w-full text-center shadow-2xl space-y-6">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-2xl font-bold">
                            ⚔️
                        </div>
                        <div>
                            <h2 className="text-2xl font-extrabold text-white tracking-wide uppercase">
                                Arène Multijoueur Temps Réel (4 Joueurs)
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">
                                {networkStatus} • Connectez plusieurs navigateurs ou appareils pour jouer ensemble en direct !
                            </p>
                        </div>

                        {/* Barème des Dégâts */}
                        <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3.5 text-left text-xs space-y-2 text-slate-300">
                            <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Barème des Dégâts par Zone</div>
                            <div className="flex items-center justify-between text-amber-300 font-bold">
                                <span>🎯 Bullseye Centre (Tête) :</span>
                                <span className="bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/40">100 DMG (One-Shot)</span>
                            </div>
                            <div className="flex items-center justify-between text-red-400 font-semibold">
                                <span>🔴 Anneau Rouge (Tête) :</span>
                                <span>65 DMG</span>
                            </div>
                            <div className="flex items-center justify-between text-sky-400 font-medium">
                                <span>🔵 Anneau Bleu (Tête) :</span>
                                <span>40 DMG</span>
                            </div>
                            <div className="flex items-center justify-between text-slate-400">
                                <span>🛡️ Torse / Membres :</span>
                                <span>15 - 20 DMG</span>
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
                                Entrer dans la Partie
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

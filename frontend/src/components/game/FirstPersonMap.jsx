import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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
        scene.background = new THREE.Color(0x1a2332);
        scene.fog = new THREE.FogExp2(0x1a2332, 0.0035);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            800
        );
        camera.position.set(0, 1.7, 80);

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

        // --- 3. ÉCLAIRAGE MILITAIRE HAUTE FIDÉLITÉ (280x200m MAP) ---
        const ambientLight = new THREE.AmbientLight(0xd4e0f0, 2.6);
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffecd2, 4.0);
        sunLight.position.set(80, 120, 90);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 400;
        sunLight.shadow.camera.left = -150;
        sunLight.shadow.camera.right = 150;
        sunLight.shadow.camera.top = 120;
        sunLight.shadow.camera.bottom = -120;
        sunLight.shadow.bias = -0.0002;
        scene.add(sunLight);

        const skyFill = new THREE.DirectionalLight(0x7ec8e3, 1.6);
        skyFill.position.set(-80, 60, -80);
        scene.add(skyFill);

        // Lumière tunnel métro (zone centrale froide)
        const tunnelFill = new THREE.DirectionalLight(0x38bdf8, 0.8);
        tunnelFill.position.set(0, 10, 0);
        scene.add(tunnelFill);

        // --- 4. MAP OPÉRATION MÉTRO (280x200m) — 3 ZONES IMMERSIVES ---
        const MAP_W = 280, MAP_D = 200;
        const ZONE_A_Z_MAX = 100;   // Parc extérieur : z = 30..100
        const ZONE_B_Z_MIN = -30, ZONE_B_Z_MAX = 30; // Tunnel métro : z = -30..30
        const ZONE_C_Z_MIN = -100;  // Rue urbaine : z = -100..-30

        // =========================================================================
        // GÉNÉRATEUR DE TEXTURES PBR RÉALISTES (CANVAS PROCEDURAL TEXTURES)
        // Diffuse, Normal/Bump, et Roughness maps haute fidélité Battlefield
        // =========================================================================
        const createPBRTexture = (width, height, drawFn) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            drawFn(ctx, width, height);
            const tex = new THREE.CanvasTexture(canvas);
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            return tex;
        };

        // 1. Asphalte de voirie (grain d'agrégat, usure, micro-fissures)
        const asphaltDiffTex = createPBRTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#1e2530';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 25000; i++) {
                const x = Math.random() * w, y = Math.random() * h;
                const c = Math.floor(25 + Math.random() * 35);
                ctx.fillStyle = `rgb(${c},${c + 2},${c + 6})`;
                ctx.fillRect(x, y, 1.5, 1.5);
            }
            // Fissures sombres d'usure
            ctx.strokeStyle = '#0f141c';
            ctx.lineWidth = 1.2;
            for (let j = 0; j < 5; j++) {
                ctx.beginPath();
                let cx = Math.random() * w, cy = Math.random() * h;
                ctx.moveTo(cx, cy);
                for (let k = 0; k < 6; k++) {
                    cx += (Math.random() - 0.5) * 50;
                    cy += (Math.random() - 0.5) * 50;
                    ctx.lineTo(cx, cy);
                }
                ctx.stroke();
            }
        });
        asphaltDiffTex.repeat.set(12, 12);

        const asphaltBumpTex = createPBRTexture(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 15000; i++) {
                const x = Math.random() * w, y = Math.random() * h;
                const v = Math.floor(Math.random() * 255);
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(x, y, 1.5, 1.5);
            }
        });
        asphaltBumpTex.repeat.set(12, 12);

        // 2. Béton armé vieilli & fissuré (plaques de coffrage, salissures)
        const concreteDiffTex = createPBRTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#64748b';
            ctx.fillRect(0, 0, w, h);
            for (let i = 0; i < 18000; i++) {
                const x = Math.random() * w, y = Math.random() * h;
                const c = Math.floor(80 + Math.random() * 50);
                ctx.fillStyle = `rgba(${c},${c},${c},0.3)`;
                ctx.fillRect(x, y, 2, 2);
            }
            // Joints de dilatation
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(4, 4, w - 8, h - 8);
        });
        concreteDiffTex.repeat.set(6, 6);

        // 3. Tôle de conteneur ondulée et rouillée (Corten steel)
        const cortenDiffTex = createPBRTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#854d0e';
            ctx.fillRect(0, 0, w, h);
            // Bandes d'ondulation
            for (let x = 0; x < w; x += 32) {
                const grad = ctx.createLinearGradient(x, 0, x + 32, 0);
                grad.addColorStop(0, '#9a3412');
                grad.addColorStop(0.5, '#7c2d12');
                grad.addColorStop(1, '#451a03');
                ctx.fillStyle = grad;
                ctx.fillRect(x, 0, 32, h);
            }
            // Taches d'oxydation et de rouille
            for (let r = 0; r < 25; r++) {
                const rx = Math.random() * w, ry = Math.random() * h, rad = 10 + Math.random() * 30;
                const rustGrad = ctx.createRadialGradient(rx, ry, 2, rx, ry, rad);
                rustGrad.addColorStop(0, 'rgba(69, 26, 3, 0.8)');
                rustGrad.addColorStop(1, 'rgba(154, 52, 18, 0)');
                ctx.fillStyle = rustGrad;
                ctx.fillRect(rx - rad, ry - rad, rad * 2, rad * 2);
            }
        });
        cortenDiffTex.repeat.set(3, 2);

        // 4. Brique haussmannienne avec mortier
        const brickDiffTex = createPBRTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#94a3b8'; // mortier
            ctx.fillRect(0, 0, w, h);
            const rows = 16, cols = 8;
            const rh = h / rows, cw = w / cols;
            for (let r = 0; r < rows; r++) {
                const offset = (r % 2) * (cw / 2);
                for (let c = -1; c <= cols; c++) {
                    const bx = c * cw + offset + 2;
                    const by = r * rh + 2;
                    const shade = Math.floor(100 + Math.random() * 40);
                    ctx.fillStyle = `rgb(${shade + 25},${shade - 30},${shade - 40})`;
                    ctx.fillRect(bx, by, cw - 4, rh - 4);
                }
            }
        });
        brickDiffTex.repeat.set(4, 4);

        // 5. Carrelage parisien de métro (brillant avec joints)
        const tileDiffTex = createPBRTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#475569'; // joints
            ctx.fillRect(0, 0, w, h);
            const ts = 32;
            for (let tx = 0; tx < w; tx += ts) {
                for (let ty = 0; ty < h; ty += ts) {
                    const lum = Math.floor(180 + Math.random() * 40);
                    ctx.fillStyle = `rgb(${lum},${lum + 5},${lum + 10})`;
                    ctx.fillRect(tx + 1.5, ty + 1.5, ts - 3, ts - 3);
                }
            }
        });
        tileDiffTex.repeat.set(8, 8);

        // 6. Toile de jute militaire (sacs de sable)
        const sandbagDiffTex = createPBRTexture(256, 256, (ctx, w, h) => {
            ctx.fillStyle = '#4d5b38';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#384328';
            ctx.lineWidth = 1;
            for (let i = 0; i < w; i += 6) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
            }
        });
        sandbagDiffTex.repeat.set(4, 4);

        // Matériaux PBR réalistes avec Textures & Bump
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d5016, roughness: 0.9, metalness: 0.05 });
        const dirtPathMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.95, metalness: 0.05 });
        const asphaltMat = new THREE.MeshStandardMaterial({
            map: asphaltDiffTex,
            bumpMap: asphaltBumpTex,
            bumpScale: 0.04,
            roughness: 0.75,
            metalness: 0.15
        });
        const concreteMat = new THREE.MeshStandardMaterial({
            map: concreteDiffTex,
            bumpMap: asphaltBumpTex,
            bumpScale: 0.03,
            roughness: 0.65,
            metalness: 0.2
        });
        const concreteDarkMat = new THREE.MeshStandardMaterial({
            map: concreteDiffTex,
            color: 0x334155,
            roughness: 0.7,
            metalness: 0.25
        });
        const metalPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.85 });
        const metalRustMat = new THREE.MeshStandardMaterial({ map: cortenDiffTex, roughness: 0.7, metalness: 0.5 });
        const militaryOliveMat = new THREE.MeshStandardMaterial({ map: sandbagDiffTex, roughness: 0.85, metalness: 0.2 });
        const rustContainerMat = new THREE.MeshStandardMaterial({ map: cortenDiffTex, roughness: 0.65, metalness: 0.45 });
        const blueContainerMat = new THREE.MeshStandardMaterial({ map: cortenDiffTex, color: 0x0284c7, roughness: 0.55, metalness: 0.5 });
        const greenContainerMat = new THREE.MeshStandardMaterial({ map: cortenDiffTex, color: 0x16a34a, roughness: 0.55, metalness: 0.5 });
        const metroTrainMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 });
        const metroTrainAccentMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.25, metalness: 0.6 });
        const yellowHazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const brickMat = new THREE.MeshStandardMaterial({ map: brickDiffTex, roughness: 0.8, metalness: 0.1 });
        const brickLightMat = new THREE.MeshStandardMaterial({ map: brickDiffTex, color: 0xd97706, roughness: 0.8, metalness: 0.1 });
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1, metalness: 0.95 });
        const tileFloorMat = new THREE.MeshStandardMaterial({
            map: tileDiffTex,
            roughness: 0.4,
            metalness: 0.3
        });
        const railMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.3, metalness: 0.9 });
        const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x271c19, roughness: 0.9, metalness: 0.05 });
        const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8, metalness: 0.05 });
        const treeLeafDarkMat = new THREE.MeshStandardMaterial({ color: 0x0d3f14, roughness: 0.85, metalness: 0.05 });
        const stoneMat = new THREE.MeshStandardMaterial({ map: concreteDiffTex, roughness: 0.75, metalness: 0.15 });
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.85 });
        const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.4, metalness: 0.7 });
        const carBurntMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85, metalness: 0.25 });

        const colliders = [];      // Box3 array pour collision horizontale (murs) 
        const colliderMeshes = [];  // meshes pour raycasting balles
        const groundBoxes = [];    // Box3 pour détection de sol (sol + plateformes)
        const registerBox = (mesh, isGround = false) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            colliderMeshes.push(mesh);
            if (isGround) groundBoxes.push(box);
            return box;
        };
        // Register un objet UNIQUEMENT comme mur (pas de ground)
        const registerWall = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            colliders.push(box);
            colliderMeshes.push(mesh);
            return box;
        };
        // Register un sol walkable (ground seulement, pas de blocage horizontal)
        const registerGround = (mesh) => {
            mesh.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(mesh);
            groundBoxes.push(box);
            colliderMeshes.push(mesh);
            return box;
        };

        // =========================================================================
        // ARCHITECTURE NIVEAU 1:1 BATTLEFIELD — OPERATION MÉTRO (FROSTBITE DESIGN)
        // Lead Level Designer & Technical Artist Standards (UE5 / Frostbite Metrics)
        // =========================================================================

        // Helpers de construction standardisés (Échelle 1:1 militaire)
        const addSolidWall = (x, y, z, w, h, d, mat = concreteMat) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerWall(wall);
            return wall;
        };

        const addSolidPlatform = (x, y, z, w, h, d, mat = concreteMat) => {
            const platform = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            platform.position.set(x, y + h / 2, z);
            platform.receiveShadow = true;
            platform.castShadow = true;
            scene.add(platform);
            registerGround(platform);
            return platform;
        };

        // Micro-couvertures militaires normalisées (Hauteur 0.95m = low cover accroupi standard)
        const addJerseyBarrier = (x, z, rot = 0) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.95, 0.6), concreteDarkMat);
            b.position.set(x, 0.475, z);
            b.rotation.y = rot;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
            registerWall(b);
        };

        const addSandbagBunker = (x, z, rot = 0) => {
            const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.95, 0.8), militaryOliveMat);
            wallMesh.position.set(x, 0.475, z);
            wallMesh.rotation.y = rot;
            wallMesh.castShadow = true;
            scene.add(wallMesh);
            registerWall(wallMesh);
        };

        // Conteneurs maritimes ISO 20ft (6.06m L x 2.44m W x 2.59m H)
        const addISOContainer = (x, y, z, rot = 0, mat = rustContainerMat) => {
            const cont = new THREE.Mesh(new THREE.BoxGeometry(2.44, 2.59, 6.06), mat);
            cont.position.set(x, y + 1.295, z);
            cont.rotation.y = rot;
            cont.castShadow = true;
            cont.receiveShadow = true;
            scene.add(cont);
            registerBox(cont, true); // Sol praticable sur le toit + mur sur les côtés
        };

        // Escaliers militaires anti-glitch (Marches régulières 0.18m + détection sol directe)
        const addTacticalStairs = (startX, startY, startZ, width, totalH, totalL, stepCount, dirZ = -1) => {
            const stepH = totalH / stepCount;
            const stepL = totalL / stepCount;
            for (let s = 0; s < stepCount; s++) {
                const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(width, stepH + 0.1, stepL * 1.05), concreteDarkMat);
                stepMesh.position.set(
                    startX,
                    startY + s * stepH + (stepH / 2),
                    startZ + dirZ * (s * stepL + stepL / 2)
                );
                stepMesh.receiveShadow = true;
                stepMesh.castShadow = true;
                scene.add(stepMesh);
                registerGround(stepMesh);
            }
            // Garde-corps latéraux
            const railH = 1.1;
            const railW = 0.25;
            const railL = Math.abs(totalL);
            const sideLeft = new THREE.Mesh(new THREE.BoxGeometry(railW, totalH + railH, railL), concreteMat);
            sideLeft.position.set(startX - width / 2 - railW / 2, startY + (totalH + railH) / 2, startZ + dirZ * (totalL / 2));
            scene.add(sideLeft);
            registerWall(sideLeft);

            const sideRight = new THREE.Mesh(new THREE.BoxGeometry(railW, totalH + railH, railL), concreteMat);
            sideRight.position.set(startX + width / 2 + railW / 2, startY + (totalH + railH) / 2, startZ + dirZ * (totalL / 2));
            scene.add(sideRight);
            registerWall(sideRight);
        };

        // Arbres réalistes (troncs solides, feuillage en hauteur au-dessus du joueur)
        const addBattlefieldTree = (x, z, scale = 1.0) => {
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * scale, 0.5 * scale, 5.0 * scale, 8), treeTrunkMat);
            trunk.position.set(x, 2.5 * scale, z);
            trunk.castShadow = true;
            scene.add(trunk);
            registerWall(trunk);

            const crownMat = Math.random() > 0.5 ? treeLeafMat : treeLeafDarkMat;
            const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2 * scale, 6.0 * scale, 7), crownMat);
            crown.position.set(x, 6.5 * scale, z);
            crown.castShadow = true;
            scene.add(crown);
        };

        // Véhicule blindé / Épave militaire de combat
        const addCombatVehicle = (x, z, rot = 0) => {
            const vGroup = new THREE.Group();
            vGroup.position.set(x, 0, z);
            vGroup.rotation.y = rot;

            // Châssis principal (H = 1.4m, W = 2.6m, L = 5.6m)
            const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 5.6), carBurntMat);
            chassis.position.set(0, 0.9, 0);
            chassis.castShadow = true;
            vGroup.add(chassis);

            // Tourelle blindée
            const turret = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 1.8), militaryOliveMat);
            turret.position.set(0, 1.85, -0.4);
            turret.castShadow = true;
            vGroup.add(turret);

            // Canon
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8), metalPlateMat);
            barrel.rotation.x = Math.PI / 2;
            barrel.position.set(0, 1.85, 1.8);
            vGroup.add(barrel);

            scene.add(vGroup);
            vGroup.updateMatrixWorld(true);
            registerBox(chassis, true); // On peut grimper sur le blindé
            registerWall(turret);
        };

        // Bâtiment militaire traversable (Porte 2.2m x 1.4m réglementaire)
        const addTacticalBuilding = (x, z, w, h, d, doorX = 0) => {
            const halfW = w / 2;
            const halfD = d / 2;
            const doorW = 1.6;
            const doorH = 2.4;

            // Sol intérieur
            addSolidPlatform(x, 0, z, w - 0.4, 0.15, d - 0.4, concreteDarkMat);

            // Murs gauche et droit du bâtiment
            addSolidWall(x - halfW + 0.2, h / 2, z, 0.4, h, d, brickMat);
            addSolidWall(x + halfW - 0.2, h / 2, z, 0.4, h, d, brickMat);

            // Mur arrière
            addSolidWall(x, h / 2, z - halfD + 0.2, w, h, 0.4, brickMat);

            // Mur avant avec ouverture de porte
            const leftPartW = Math.max(0.5, (halfW + doorX) - doorW / 2);
            const rightPartW = Math.max(0.5, (halfW - doorX) - doorW / 2);

            addSolidWall(x - halfW + leftPartW / 2, h / 2, z + halfD - 0.2, leftPartW, h, 0.4, brickMat);
            addSolidWall(x + halfW - rightPartW / 2, h / 2, z + halfD - 0.2, rightPartW, h, 0.4, brickMat);

            // Linteau au-dessus de la porte
            const lintelH = h - doorH;
            addSolidWall(x + doorX, doorH + lintelH / 2, z + halfD - 0.2, doorW, lintelH, 0.4, concreteDarkMat);

            // Toit praticable
            const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, d), concreteMat);
            roof.position.set(x, h + 0.2, z);
            scene.add(roof);
            registerGround(roof);
        };

        // Rame de métro tactique traversable (Paris Metro style, 4 portes doubles de 1.80m)
        const addBattlefieldTrain = (x, z) => {
            const carGroup = new THREE.Group();
            carGroup.position.set(x, 0, z);
            scene.add(carGroup);

            // Plancher surélevé à 0.85m (sol praticable)
            const floor = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.25, 20.0), metroTrainMat);
            floor.position.set(0, 0.85, 0);
            floor.receiveShadow = true;
            carGroup.add(floor);

            // Toit
            const roof = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.35, 20.0), metroTrainMat);
            roof.position.set(0, 3.65, 0);
            roof.castShadow = true;
            carGroup.add(roof);

            // Parois latérales avec 2 grandes doubles-portes béantes de 2.2m x 2.2m de chaque côté
            // Sections de murs : avant (z = 7.5 à 10), centre (z = -2.5 à 2.5), arrière (z = -10 à -7.5)
            const sideWalls = [];
            for (let side = -1; side <= 1; side += 2) {
                const sX = side * 1.4;
                // Section mur avant
                const wFront = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.55, 3.5), metroTrainMat);
                wFront.position.set(sX, 2.25, 7.5);
                carGroup.add(wFront);
                sideWalls.push(wFront);

                // Section mur central
                const wMid = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.55, 4.0), metroTrainMat);
                wMid.position.set(sX, 2.25, 0);
                carGroup.add(wMid);
                sideWalls.push(wMid);

                // Section mur arrière
                const wBack = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.55, 3.5), metroTrainMat);
                wBack.position.set(sX, 2.25, -7.5);
                carGroup.add(wBack);
                sideWalls.push(wBack);

                // Bandeau décoratif cyan
                const accent = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.25, 20.0), metroTrainAccentMat);
                accent.position.set(side * 1.41, 1.9, 0);
                carGroup.add(accent);
            }

            // Murs d'extrémités avant et arrière
            const endFront = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.55, 0.2), metroTrainMat);
            endFront.position.set(0, 2.25, 10.0);
            carGroup.add(endFront);
            sideWalls.push(endFront);

            const endBack = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.55, 0.2), metroTrainMat);
            endBack.position.set(0, 2.25, -10.0);
            carGroup.add(endBack);
            sideWalls.push(endBack);

            // Mise à jour de la matrice monde
            carGroup.updateMatrixWorld(true);

            // Enregistrement des colliders propres
            registerGround(floor);
            registerWall(roof);
            sideWalls.forEach(w => registerWall(w));
        };

        // =========================================================================
        // GÉNÉRATION DE LA CARTE 280x200m EN 3 ZONES STRATÉGIQUES (THREE LANES)
        // =========================================================================

        // SOL PRINCIPAL PBR EN 3 BIOMES CONTINUS
        // Zone A (Parc Monceau) : Z = 30 à 100
        const groundParc = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, 70), grassMat);
        groundParc.rotation.x = -Math.PI / 2;
        groundParc.position.set(0, 0, 65);
        groundParc.receiveShadow = true;
        scene.add(groundParc);

        // Zone B (Station Métro) : Z = -30 à 30
        const groundMetro = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, 60), tileFloorMat);
        groundMetro.rotation.x = -Math.PI / 2;
        groundMetro.position.set(0, 0, 0);
        groundMetro.receiveShadow = true;
        scene.add(groundMetro);

        // Zone C (Boulevard Urbain) : Z = -100 à -30
        const groundBoulevard = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, 70), asphaltMat);
        groundBoulevard.rotation.x = -Math.PI / 2;
        groundBoulevard.position.set(0, 0, -65);
        groundBoulevard.receiveShadow = true;
        scene.add(groundBoulevard);

        // MURS D'ENCEINTE DU CHAMP DE BATAILLE (16m de hauteur)
        const wallH = 16;
        addSolidWall(0, wallH / 2, -MAP_D / 2, MAP_W, wallH, 3, concreteDarkMat);
        addSolidWall(0, wallH / 2, MAP_D / 2, MAP_W, wallH, 3, concreteDarkMat);
        addSolidWall(-MAP_W / 2, wallH / 2, 0, 3, wallH, MAP_D, concreteDarkMat);
        addSolidWall(MAP_W / 2, wallH / 2, 0, 3, wallH, MAP_D, concreteDarkMat);

        // -------------------------------------------------------------------------
        // ZONE A : PARC MONCEAU & AVANT-POSTE MILITAIRE (Z = 30 à 100)
        // -------------------------------------------------------------------------

        // Allée centrale pavée de 8 mètres de large
        const centralPath = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 65.0), dirtPathMat);
        centralPath.rotation.x = -Math.PI / 2;
        centralPath.position.set(0, 0.02, 65);
        centralPath.receiveShadow = true;
        scene.add(centralPath);

        // Alignement d'arbres le long des allées tactiques
        for (let az = 35; az <= 90; az += 10) {
            addBattlefieldTree(-7, az, 1.0);
            addBattlefieldTree(7, az, 1.0);
            addBattlefieldTree(-30, az, 1.2);
            addBattlefieldTree(30, az, 1.2);
        }

        // Mémorial / Fontaine centrale avec abris en béton
        addSolidPlatform(0, 0, 65, 12, 0.6, 12, stoneMat);
        addSolidWall(0, 3.0, 65, 2.0, 6.0, 2.0, stoneMat); // Obélisque central
        addJerseyBarrier(-4.5, 65, Math.PI / 2);
        addJerseyBarrier(4.5, 65, Math.PI / 2);

        // Tranchées de sacs de sable et fortifications d'escouade
        addSandbagBunker(-15, 80, 0);
        addSandbagBunker(15, 80, 0);
        addSandbagBunker(-20, 50, Math.PI / 4);
        addSandbagBunker(20, 50, -Math.PI / 4);

        // Grande Descente d'Escalier vers la station de métro (12m de large, Z = 34 à 30)
        addTacticalStairs(0, 0, 34, 12.0, 2.4, 6.0, 10, -1);

        // -------------------------------------------------------------------------
        // ZONE B : STATION DE MÉTRO SOUTERRAINE (Z = -30 à 30)
        // -------------------------------------------------------------------------

        // Voûte et Plafond du Tunnel
        const tunnelRoof = new THREE.Mesh(new THREE.BoxGeometry(MAP_W, 1.2, 58.0), concreteDarkMat);
        tunnelRoof.position.set(0, 7.5, 0);
        scene.add(tunnelRoof);
        registerWall(tunnelRoof);

        // Murs de séparation du tunnel
        addSolidWall(0, 3.5, 30, MAP_W, 7.0, 1.5, concreteMat);
        addSolidWall(0, 3.5, -30, MAP_W, 7.0, 1.5, concreteMat);

        // Quai central surélevé de 0.85m (Largeur 10m, Longueur 52m)
        addSolidPlatform(0, 0, 0, 10.0, 0.85, 52.0, tileFloorMat);

        // Rampes d'accès aux extrémités du quai
        addTacticalStairs(0, 0, 28, 6.0, 0.85, 2.5, 4, -1);
        addTacticalStairs(0, 0, -28, 6.0, 0.85, 2.5, 4, 1);

        // Voies ferrées gauche (X = -12) et droite (X = 12)
        for (let trackX of [-12, 12]) {
            const trackBed = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.15, 54.0), asphaltMat);
            trackBed.position.set(trackX, 0.08, 0);
            scene.add(trackBed);

            for (let railX of [-0.9, 0.9]) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 54.0), railMat);
                rail.position.set(trackX + railX, 0.22, 0);
                scene.add(rail);
            }
        }

        // Rames de métro détruites servant de forteresses CQC
        addBattlefieldTrain(-12, 0);
        addBattlefieldTrain(12, 0);

        // Piliers de soutènement massifs en béton (briseurs de lignes de vue tous les 10m)
        for (let pz = -22; pz <= 22; pz += 11) {
            const colLeft = addSolidWall(-4.0, 3.8, pz, 1.2, 7.6, 1.2, concreteDarkMat);
            const colRight = addSolidWall(4.0, 3.8, pz, 1.2, 7.6, 1.2, concreteDarkMat);

            // Néons d'urgence à haute intensité
            const neonLamp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 0.15), neonCyanMat);
            neonLamp.position.set(0, 6.8, pz);
            scene.add(neonLamp);
        }

        // Guichets & billetterie centrale (micro-couvertures à la sortie)
        addJerseyBarrier(-3, -20, 0);
        addJerseyBarrier(3, -20, 0);

        // Grande Montée d'Escalier vers le Boulevard (12m de large, Z = -30 à -34)
        addTacticalStairs(0, 0, -30, 12.0, 2.4, 6.0, 10, -1);

        // -------------------------------------------------------------------------
        // ZONE C : BOULEVARD URBAIN & RUE COMMERCIALE (Z = -100 à -30)
        // -------------------------------------------------------------------------

        // Chaussée asphaltée 2 voies (Largeur 7.0m, Z = -35 à -95)
        const road = new THREE.Mesh(new THREE.PlaneGeometry(7.0, 60.0), asphaltMat);
        road.rotation.x = -Math.PI / 2;
        road.position.set(0, 0.02, -65);
        road.receiveShadow = true;
        scene.add(road);

        // Ligne médiane jaune discontinue
        for (let yl = -90; yl <= -40; yl += 8) {
            const line = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 4.0), yellowHazardMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(0, 0.03, yl);
            scene.add(line);
        }

        // Trottoirs surélevés de 0.20m (flanquements Ouest et Est)
        addSolidPlatform(-15, 0, -65, 18.0, 0.20, 62.0, concreteMat);
        addSolidPlatform(15, 0, -65, 18.0, 0.20, 62.0, concreteMat);

        // Blindés de combat et épaves urbaines sur la chaussée
        addCombatVehicle(-1.5, -45, 0.15);
        addCombatVehicle(1.8, -75, -0.22);

        // Barricades de barrage routier et check-point militaire
        addJerseyBarrier(-3.2, -58, 0.2);
        addJerseyBarrier(3.2, -60, -0.15);
        addSandbagBunker(-5.0, -85, Math.PI / 8);
        addSandbagBunker(5.0, -85, -Math.PI / 8);

        // Immeubles urbains tactiques traversables (Flanc Ouest : X = -38 à -65)
        addTacticalBuilding(-42, -50, 18.0, 8.5, 16.0, 3.0);
        addTacticalBuilding(-42, -75, 18.0, 8.5, 16.0, -3.0);

        // Dépôt logistique de conteneurs maritimes (Flanc Est : CQC & verticalité, X = 32 à 65)
        addISOContainer(36, 0, -45, 0, rustContainerMat);
        addISOContainer(36, 2.59, -45, 0, blueContainerMat); // Empilé (verticalité)
        addISOContainer(42, 0, -50, Math.PI / 2, militaryOliveMat);
        addISOContainer(42, 0, -65, 0, greenContainerMat);
        addISOContainer(48, 0, -75, Math.PI / 2, rustContainerMat);
        addISOContainer(36, 0, -80, 0, blueContainerMat);

        // Escalier d'accès métallique vers le toit des conteneurs
        addTacticalStairs(36, 0, -39, 2.4, 2.59, 4.0, 8, -1);

        // Miradors de surveillance aux deux coins stratégiques
        addSolidPlatform(-60, 0, -85, 6.0, 4.5, 6.0, concreteDarkMat);
        addTacticalStairs(-60, 0, -78, 2.0, 4.5, 6.5, 12, -1);
        addJerseyBarrier(-60, -87.5, 0);

        addSolidPlatform(60, 0, -85, 6.0, 4.5, 6.0, concreteDarkMat);
        addTacticalStairs(60, 0, -78, 2.0, 4.5, 6.5, 12, -1);
        addJerseyBarrier(60, -87.5, 0);

        // =========================================================================
        // CHARGEMENT DE VRAIS ASSETS 3D GLTF/GLB (POLYGONAL MIND & THREE.JS REAL ASSETS)
        // Rames de métro 3D, Rails, Véhicules, Clôtures, Végétation et Mobilier urbain
        // =========================================================================
        const gltfLoader = new GLTFLoader();

        // 1. Vraies Rames de Métro 3D
        gltfLoader.load('/assets/models/Train_01_Art.glb', (gltf) => {
            const train1 = gltf.scene.clone();
            train1.scale.set(0.014, 0.014, 0.014);
            train1.position.set(-12, 0.1, 0);
            train1.rotation.y = Math.PI / 2;
            train1.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    colliderMeshes.push(c);
                }
            });
            scene.add(train1);

            const train2 = gltf.scene.clone();
            train2.scale.set(0.014, 0.014, 0.014);
            train2.position.set(12, 0.1, 0);
            train2.rotation.y = -Math.PI / 2;
            train2.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    colliderMeshes.push(c);
                }
            });
            scene.add(train2);
        }, undefined, (e) => console.log('Train GLB load:', e?.message || e));

        // 2. Vrais Rails 3D
        gltfLoader.load('/assets/models/Train_Track_01.glb', (gltf) => {
            for (let trackX of [-12, 12]) {
                for (let tz = -24; tz <= 24; tz += 12) {
                    const track = gltf.scene.clone();
                    track.scale.set(0.018, 0.018, 0.018);
                    track.position.set(trackX, 0.06, tz);
                    scene.add(track);
                }
            }
        }, undefined, () => {});

        // 3. Vrais Véhicules 3D
        gltfLoader.load('/assets/models/ferrari.glb', (gltf) => {
            const car1 = gltf.scene.clone();
            car1.scale.set(1.15, 1.15, 1.15);
            car1.position.set(-1.8, 0.02, -45);
            car1.rotation.y = 0.25;
            car1.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    colliderMeshes.push(c);
                }
            });
            scene.add(car1);

            const car2 = gltf.scene.clone();
            car2.scale.set(1.15, 1.15, 1.15);
            car2.position.set(2.0, 0.02, -75);
            car2.rotation.y = -0.3;
            car2.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                    colliderMeshes.push(c);
                }
            });
            scene.add(car2);
        }, undefined, () => {});

        // 4. Vrais Bancs de Parc 3D
        gltfLoader.load('/assets/models/Bench_01_Art.glb', (gltf) => {
            const benchPositions = [
                [-4.5, 65, Math.PI / 2],
                [4.5, 65, -Math.PI / 2],
                [-4.5, 75, Math.PI / 2],
                [4.5, 75, -Math.PI / 2]
            ];
            benchPositions.forEach(([bx, bz, brot]) => {
                const bench = gltf.scene.clone();
                bench.scale.set(0.015, 0.015, 0.015);
                bench.position.set(bx, 0, bz);
                bench.rotation.y = brot;
                bench.traverse((c) => {
                    if (c.isMesh) {
                        c.castShadow = true;
                        colliderMeshes.push(c);
                    }
                });
                scene.add(bench);
            });
        }, undefined, () => {});

        // 5. Vraie Végétation & Buissons 3D
        gltfLoader.load('/assets/models/Bush_01_Art.glb', (gltf) => {
            for (let i = 0; i < 14; i++) {
                const bush = gltf.scene.clone();
                const bx = (i % 2 === 0 ? -1 : 1) * (10 + (i * 7) % 30);
                const bz = 40 + (i * 8) % 55;
                bush.scale.set(0.016, 0.016, 0.016);
                bush.position.set(bx, 0, bz);
                bush.rotation.y = Math.random() * Math.PI * 2;
                bush.traverse((c) => { if (c.isMesh) c.castShadow = true; });
                scene.add(bush);
            }
        }, undefined, () => {});

        // 6. Vraies Clôtures de Gare 3D
        gltfLoader.load('/assets/models/Tower_Station_Fence_Art.glb', (gltf) => {
            for (let fz = -20; fz <= 20; fz += 10) {
                const fenceL = gltf.scene.clone();
                fenceL.scale.set(0.015, 0.015, 0.015);
                fenceL.position.set(-6, 0.85, fz);
                scene.add(fenceL);

                const fenceR = gltf.scene.clone();
                fenceR.scale.set(0.015, 0.015, 0.015);
                fenceR.position.set(6, 0.85, fz);
                fenceR.rotation.y = Math.PI;
                scene.add(fenceR);
            }
        }, undefined, () => {});

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
            [-30, 0, 60], [30, 0, 60], [0, 0, 80],
            [-40, 1.2, 0], [40, 1.2, 0], [0, 0, 15], [0, 0, -15],
            [-30, 0, -55], [30, 0, -55], [0, 0, -80],
            [60, 5.0, -50], [-60, 5.0, -80]
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
            registerBox(box, false); // crate = mur seulement
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
                        sliding = true;
                        slideTimer = 0.65;
                        slideCooldown = 1.3;
                        sound.playSlide();

                        // En PointerLockControls, velocity.z correspond à l'axe avant/arrière de la caméra
                        // 18.0 vers l'avant garantit une glissade droite et ultra réactive
                        velocity.z = 18.0;
                        velocity.x = 0;
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
        const bulletRay = new THREE.Raycaster();

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

            if (controls.isLocked && time - lastSyncTime > 55 && !isDead) {
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

                bulletRay.set(oldPos, b.dir);
                bulletRay.near = 0;
                bulletRay.far = stepDist + 0.5;

                // Optimisation performance multi : cibler uniquement les colliders et les joueurs distants
                const bulletTargets = [...colliderMeshes, ...Array.from(remotePlayersMap.values())];
                const intersects = bulletRay.intersectObjects(bulletTargets, true);

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

            // DÉPLACEMENT DU JOUEUR LOCAL — BOX3 COLLISION OPTIMISÉE
            if (controls.isLocked && !isDead) {
                if (sliding) {
                    slideTimer -= delta;
                    // Décélération plus douce pour la glissade
                    velocity.x *= (1.0 - 2.5 * delta);
                    velocity.z *= (1.0 - 2.5 * delta);
                    if (slideTimer <= 0) {
                        sliding = false;
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

                // ===== COLLISION HORIZONTALE (MURS) — Box3 avec marge réduite =====
                const PLAYER_R = 0.35; // rayon joueur réduit (0.45 était trop large)

                const oldX = camera.position.x;
                controls.moveRight(velocity.x * delta);
                for (const col of colliders) {
                    if (
                        camera.position.x + PLAYER_R > col.min.x &&
                        camera.position.x - PLAYER_R < col.max.x &&
                        camera.position.z + PLAYER_R > col.min.z &&
                        camera.position.z - PLAYER_R < col.max.z
                    ) {
                        const feetY = camera.position.y - currentEyeHeight;
                        const headY = camera.position.y + 0.3;
                        // Ne pas bloquer si c'est une petite marche/trottoir franchissable (<= 0.42m)
                        const isStepObstacle = (col.max.y - feetY <= 0.42);
                        if (!isStepObstacle && feetY < col.max.y - 0.25 && headY > col.min.y + 0.1) {
                            camera.position.x = oldX;
                            velocity.x = 0;
                            break;
                        }
                    }
                }

                const oldZ = camera.position.z;
                controls.moveForward(velocity.z * delta);
                for (const col of colliders) {
                    if (
                        camera.position.x + PLAYER_R > col.min.x &&
                        camera.position.x - PLAYER_R < col.max.x &&
                        camera.position.z + PLAYER_R > col.min.z &&
                        camera.position.z - PLAYER_R < col.max.z
                    ) {
                        const feetY = camera.position.y - currentEyeHeight;
                        const headY = camera.position.y + 0.3;
                        const isStepObstacle = (col.max.y - feetY <= 0.42);
                        if (!isStepObstacle && feetY < col.max.y - 0.25 && headY > col.min.y + 0.1) {
                            camera.position.z = oldZ;
                            velocity.z = 0;
                            break;
                        }
                    }
                }

                const targetEye = sliding ? 0.85 : moveState.crouch ? 0.95 : normalEyeHeight;
                currentEyeHeight = THREE.MathUtils.lerp(currentEyeHeight, targetEye, delta * 12);

                // ===== DÉTECTION DU SOL — Box3 RAPIDE (pas de Raycaster) =====
                const wasAirborne = !canJump;
                camera.position.y += velocity.y * delta;

                const playerX = camera.position.x;
                const playerZ = camera.position.z;
                const feetY = camera.position.y - currentEyeHeight;
                let groundY = 0; // sol de base y=0

                for (const col of groundBoxes) {
                    // Vérifier si le joueur est dans l'emprise XZ de la surface
                    if (
                        playerX >= col.min.x - PLAYER_R &&
                        playerX <= col.max.x + PLAYER_R &&
                        playerZ >= col.min.z - PLAYER_R &&
                        playerZ <= col.max.z + PLAYER_R
                    ) {
                        const surfaceTop = col.max.y;
                        // Accepter cette surface si les pieds sont au-dessus ou proche du sommet (step-up jusqu'à 0.55m)
                        if (feetY >= surfaceTop - 0.55 && surfaceTop > groundY && surfaceTop - groundY < 8.0) {
                            groundY = surfaceTop;
                        }
                    }
                }

                const targetY = groundY + currentEyeHeight;

                // Anti-traversée de plafond
                if (velocity.y > 0) {
                    for (const col of colliders) {
                        if (
                            playerX >= col.min.x - PLAYER_R &&
                            playerX <= col.max.x + PLAYER_R &&
                            playerZ >= col.min.z - PLAYER_R &&
                            playerZ <= col.max.z + PLAYER_R &&
                            camera.position.y + 0.3 >= col.min.y &&
                            camera.position.y < col.min.y + 1.5
                        ) {
                            camera.position.y = col.min.y - 0.35;
                            velocity.y = 0;
                            break;
                        }
                    }
                }

                if (camera.position.y <= targetY) {
                    camera.position.y = targetY;
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
                                Opération Métro (280x200m)
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">
                                {networkStatus} • Parc Extérieur → Tunnel Métro → Rue Urbaine
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

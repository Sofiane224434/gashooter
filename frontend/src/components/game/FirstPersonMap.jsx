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

        // Matériaux réalistes
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x2d5016, roughness: 0.85, metalness: 0.05 });
        const dirtPathMat = new THREE.MeshStandardMaterial({ color: 0x5c4a32, roughness: 0.9, metalness: 0.05 });
        const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.2 });
        const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6, metalness: 0.25 });
        const concreteDarkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.3 });
        const metalPlateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.8 });
        const metalRustMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7, metalness: 0.5 });
        const militaryOliveMat = new THREE.MeshStandardMaterial({ color: 0x1e3a1e, roughness: 0.5, metalness: 0.4 });
        const rustContainerMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.6, metalness: 0.4 });
        const blueContainerMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.5, metalness: 0.5 });
        const greenContainerMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55, metalness: 0.45 });
        const metroTrainMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.7 });
        const metroTrainAccentMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.3, metalness: 0.6 });
        const yellowHazardMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
        const neonCyanMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonOrangeMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
        const neonRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const brickMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.75, metalness: 0.15 });
        const brickLightMat = new THREE.MeshStandardMaterial({ color: 0xa3623a, roughness: 0.8, metalness: 0.1 });
        const windowMat = new THREE.MeshStandardMaterial({ color: 0x172554, roughness: 0.1, metalness: 0.9 });
        const tileFloorMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.3 });
        const railMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.3, metalness: 0.9 });
        const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9, metalness: 0.05 });
        const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.8, metalness: 0.05 });
        const treeLeafDarkMat = new THREE.MeshStandardMaterial({ color: 0x0d3f14, roughness: 0.85, metalness: 0.05 });
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7, metalness: 0.2 });
        const lampMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3, metalness: 0.8 });
        const carBodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5, metalness: 0.6 });
        const carBurntMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8, metalness: 0.3 });

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

        const addSolidWall = (x, y, z, w, h, d, mat = concreteMat) => {
            const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            wall.position.set(x, y, z);
            wall.receiveShadow = true;
            wall.castShadow = true;
            scene.add(wall);
            registerBox(wall, false); // mur = collision horizontale
        };

        const addSolidPlatform = (x, y, z, w, h, d, mat = concreteMat) => {
            const platform = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            platform.position.set(x, y + h / 2, z);
            platform.receiveShadow = true;
            platform.castShadow = true;
            scene.add(platform);
            registerBox(platform, true); // plateforme = collision horizontale + sol
        };;

        const addShippingContainer = (x, y, z, rot = 0, mat = rustContainerMat) => {
            const cont = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.2, 7.5), mat);
            cont.position.set(x, y + 1.6, z);
            cont.rotation.y = rot;
            cont.castShadow = true;
            cont.receiveShadow = true;
            scene.add(cont);
            registerBox(cont, true); // on peut marcher dessus
        };

        const addJerseyBarrier = (x, z, rot = 0) => {
            const b = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.4, 0.8), concreteMat);
            b.position.set(x, 0.7, z);
            b.rotation.y = rot;
            b.castShadow = true;
            b.receiveShadow = true;
            scene.add(b);
            registerBox(b, false); // barrière = mur seulement
        };;

        const addTree = (x, z, scale = 1.0) => {
            // Tronc = mur (collision horizontale seulement, pas de ground)
            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 4.5 * scale, 6), treeTrunkMat);
            trunk.position.set(x, 2.25 * scale, z);
            trunk.castShadow = true;
            scene.add(trunk);
            registerWall(trunk); // seulement mur, pas sol
            const leafMat = Math.random() > 0.5 ? treeLeafMat : treeLeafDarkMat;
            // Couronnes = décor uniquement, PAS de collider (sinon on bloque partout)
            const crown1 = new THREE.Mesh(new THREE.SphereGeometry(2.5 * scale, 6, 6), leafMat);
            crown1.position.set(x, 5.5 * scale, z);
            crown1.castShadow = true;
            scene.add(crown1);
            const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.8 * scale, 6, 6), leafMat);
            crown2.position.set(x + 1.2 * scale, 6.2 * scale, z - 0.8 * scale);
            scene.add(crown2);
        };

        const addLampPost = (x, z) => {
            const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.5, 6), lampMat);
            pole.position.set(x, 2.75, z);
            scene.add(pole);
            registerWall(pole);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), lampMat);
            arm.position.set(x + 0.6, 5.3, z);
            scene.add(arm);
            const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 0.3), new THREE.MeshBasicMaterial({ color: 0xfef3c7 }));
            lampHead.position.set(x + 1.1, 5.2, z);
            scene.add(lampHead);
            // PAS de PointLight individuel (performance) - utiliser emissive
        };

        const addDestroyedCar = (x, z, rot = 0) => {
            const carGroup = new THREE.Group();
            carGroup.position.set(x, 0, z);
            carGroup.rotation.y = rot;
            const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 4.5), carBodyMat);
            body.position.set(0, 0.85, 0);
            body.castShadow = true;
            carGroup.add(body);
            registerBox(body, true); // voiture = on peut marcher dessus
            const roof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.5), carBurntMat);
            roof.position.set(0, 1.85, -0.3);
            carGroup.add(roof);
            // Pas de registerBox pour roof (petite pièce décorative)
            for (let wx = -1; wx <= 1; wx += 2) {
                for (let wz = -1; wz <= 1; wz += 2) {
                    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.2, 8), metalPlateMat);
                    wheel.position.set(wx * 1.0, 0.35, wz * 1.5);
                    wheel.rotation.z = Math.PI / 2;
                    carGroup.add(wheel);
                }
            }
            scene.add(carGroup);
        };

        const addBuildingFacade = (x, z, w, h, d, mat = brickMat, floors = 3) => {
            const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
            building.position.set(x, h / 2, z);
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            registerBox(building, false); // immeuble = mur seulement
            // Fenêtres simplifiées (pas de boucle coûteuse)
            const floorH = h / floors;
            for (let f = 0; f < floors; f++) {
                const windowsPerRow = Math.floor(w / 3.5);
                for (let wi = 0; wi < windowsPerRow; wi++) {
                    const wx = x - w / 2 + 2.0 + wi * 3.2;
                    const wy = floorH * 0.5 + f * floorH + 0.5;
                    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), windowMat);
                    win.position.set(wx, wy, z + d / 2 + 0.02);
                    scene.add(win);
                }
            }
            const roofEdge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.6, d + 0.5), concreteDarkMat);
            roofEdge.position.set(x, h + 0.3, z);
            scene.add(roofEdge);
        };

        // ===== SOL PRINCIPAL 280x200m =====
        // Zone A (Parc) : herbe
        const groundA = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, 70), grassMat);
        groundA.rotation.x = -Math.PI / 2;
        groundA.position.set(0, 0, 65);
        groundA.receiveShadow = true;
        scene.add(groundA);

        // Zone B (Tunnel) : béton/carrelage
        const groundB = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, 60), tileFloorMat);
        groundB.rotation.x = -Math.PI / 2;
        groundB.position.set(0, 0, 0);
        groundB.receiveShadow = true;
        scene.add(groundB);

        // Zone C (Rue) : asphalte
        const groundC = new THREE.Mesh(new THREE.PlaneGeometry(MAP_W, 70), asphaltMat);
        groundC.rotation.x = -Math.PI / 2;
        groundC.position.set(0, 0, -65);
        groundC.receiveShadow = true;
        scene.add(groundC);

        // ===== MURS D'ENCEINTE 280x200m =====
        const wallH = 16;
        addSolidWall(0, wallH / 2, -MAP_D / 2, MAP_W, wallH, 3);     // SUD
        addSolidWall(0, wallH / 2, MAP_D / 2, MAP_W, wallH, 3);      // NORD
        addSolidWall(-MAP_W / 2, wallH / 2, 0, 3, wallH, MAP_D);     // OUEST
        addSolidWall(MAP_W / 2, wallH / 2, 0, 3, wallH, MAP_D);      // EST

        // =============================================
        // ===== ZONE A : PARC EXTÉRIEUR (z = 30..100) =====
        // =============================================

        // Chemin central en terre à travers le parc
        const parkPath = new THREE.Mesh(new THREE.PlaneGeometry(8, 65), dirtPathMat);
        parkPath.rotation.x = -Math.PI / 2;
        parkPath.position.set(0, 0.02, 62);
        scene.add(parkPath);

        // Rangées d'arbres le long du chemin
        for (let i = 0; i < 10; i++) {
            const zz = 35 + i * 6.5;
            addTree(-6 - Math.random() * 4, zz, 0.85 + Math.random() * 0.35);
            addTree(6 + Math.random() * 4, zz, 0.85 + Math.random() * 0.35);
        }
        // Arbres dispersés sur les côtés
        for (let i = 0; i < 20; i++) {
            const tx = (Math.random() - 0.5) * 240;
            const tz = 35 + Math.random() * 58;
            if (Math.abs(tx) > 15) addTree(tx, tz, 0.7 + Math.random() * 0.5);
        }

        // Fontaine centrale du parc
        const fountainBase = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 1.2, 16), stoneMat);
        fountainBase.position.set(0, 0.6, 65);
        scene.add(fountainBase);
        registerBox(fountainBase, true);
        const fountainPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.8, 3.5, 8), stoneMat);
        fountainPillar.position.set(0, 2.95, 65);
        scene.add(fountainPillar);
        registerWall(fountainPillar);
        const fountainTop = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.8, 0.5, 12), stoneMat);
        fountainTop.position.set(0, 4.45, 65);
        scene.add(fountainTop);
        // Eau simulée
        const waterMat = new THREE.MeshStandardMaterial({ color: 0x155e75, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.7 });
        const water = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 0.15, 24), waterMat);
        water.position.set(0, 1.15, 65);
        scene.add(water);

        // Bancs de parc
        const addBench = (bx, bz, rot = 0) => {
            const seat = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.12, 0.6), treeTrunkMat);
            seat.position.set(bx, 0.52, bz);
            seat.rotation.y = rot;
            seat.castShadow = true;
            scene.add(seat);
            registerBox(seat, false); // petit objet, mur seulement
            const back = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.8, 0.1), treeTrunkMat);
            back.position.set(bx, 0.95, bz - 0.25 * Math.cos(rot) + 0.25 * Math.sin(rot));
            back.rotation.y = rot;
            scene.add(back);
        };
        addBench(-14, 58); addBench(-14, 72); addBench(14, 58); addBench(14, 72);
        addBench(-28, 65, Math.PI / 2); addBench(28, 65, -Math.PI / 2);

        // Murets de parc (couverture tactique)
        addSolidWall(-35, 0.7, 50, 12, 1.4, 0.8);
        addSolidWall(35, 0.7, 50, 12, 1.4, 0.8);
        addSolidWall(-50, 0.7, 70, 0.8, 1.4, 18);
        addSolidWall(50, 0.7, 70, 0.8, 1.4, 18);
        addSolidWall(-20, 0.7, 85, 16, 1.4, 0.8);
        addSolidWall(20, 0.7, 85, 16, 1.4, 0.8);

        // Grand escalier du parc vers le tunnel (zone A→B transition)
        for (let step = 0; step < 8; step++) {
            const stairBlock = new THREE.Mesh(new THREE.BoxGeometry(22, 0.35, 2.0), concreteMat);
            stairBlock.position.set(0, step * 0.35 + 0.175, 30 - step * 1.8);
            stairBlock.receiveShadow = true;
            stairBlock.castShadow = true;
            scene.add(stairBlock);
            registerGround(stairBlock);
        }
        // Rampes latérales de l'escalier
        addSolidWall(-12, 1.6, 22, 0.8, 3.2, 16, concreteDarkMat);
        addSolidWall(12, 1.6, 22, 0.8, 3.2, 16, concreteDarkMat);

        // Lampadaires du parc
        addLampPost(-20, 45); addLampPost(20, 45);
        addLampPost(-40, 65); addLampPost(40, 65);
        addLampPost(-20, 85); addLampPost(20, 85);

        // Kiosque / gazebo
        addSolidPlatform(-60, 0, 70, 10, 0.4, 10, concreteMat);
        const gazeboPillarPositions = [[-65, 70], [-55, 70], [-65, 75], [-55, 75], [-65, 65], [-55, 65]];
        gazeboPillarPositions.forEach(([px, pz]) => {
            const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.5, 8), stoneMat);
            p.position.set(px, 2.15, pz);
            scene.add(p);
            registerWall(p);
        });
        const gazeboRoof = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 12), concreteDarkMat);
        gazeboRoof.position.set(-60, 3.95, 70);
        scene.add(gazeboRoof);
        registerBox(gazeboRoof, true);

        // Statue / obélisque dans le parc
        const obelisk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 6.0, 1.5), stoneMat);
        obelisk.position.set(60, 3.0, 70);
        obelisk.castShadow = true;
        scene.add(obelisk);
        registerWall(obelisk);
        const obeliskTop = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.0, 4), stoneMat);
        obeliskTop.position.set(60, 7.0, 70);
        obeliskTop.rotation.y = Math.PI / 4;
        scene.add(obeliskTop);

        // =============================================
        // ===== ZONE B : TUNNEL DU MÉTRO (z = -30..30) =====
        // =============================================

        // Plafond du tunnel (toit béton massif)
        const tunnelCeiling = new THREE.Mesh(new THREE.BoxGeometry(MAP_W - 10, 1.2, 56), concreteDarkMat);
        tunnelCeiling.position.set(0, 9.0, 0);
        tunnelCeiling.receiveShadow = true;
        scene.add(tunnelCeiling);
        registerBox(tunnelCeiling, false); // plafond = mur seulement

        // Murs latéraux du tunnel (avec relief)
        for (let side = -1; side <= 1; side += 2) {
            const tunnelWall = new THREE.Mesh(new THREE.BoxGeometry(2.5, 9.0, 56), concreteDarkMat);
            tunnelWall.position.set(side * (MAP_W / 2 - 6), 4.5, 0);
            tunnelWall.castShadow = true;
            scene.add(tunnelWall);
            registerBox(tunnelWall, false);
        }

        // Quai de Métro Gauche (surélevé 1.2m)
        addSolidPlatform(-40, 0, 0, 30, 1.2, 50, concreteMat);
        // Bandes de sécurité jaunes
        const stripL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 50), yellowHazardMat);
        stripL.position.set(-25.2, 1.23, 0);
        scene.add(stripL);

        // Quai de Métro Droit (surélevé 1.2m)
        addSolidPlatform(40, 0, 0, 30, 1.2, 50, concreteMat);
        const stripR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 50), yellowHazardMat);
        stripR.position.set(25.2, 1.23, 0);
        scene.add(stripR);

        // Rails de métro (2 voies)
        for (let trackX = -15; trackX <= 15; trackX += 30) {
            for (let rOff = -1.2; rOff <= 1.2; rOff += 2.4) {
                const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 54), railMat);
                rail.position.set(trackX + rOff, 0.075, 0);
                scene.add(rail);
            }
            // Traverses
            for (let tz = -26; tz <= 26; tz += 2) {
                const tie = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 0.3), treeTrunkMat);
                tie.position.set(trackX, 0.06, tz);
                scene.add(tie);
            }
        }

        // Rames de métro (wagons) - wagons traversables sur chaque voie
        const addMetroCar = (x, z) => {
            const carGroup = new THREE.Group();
            carGroup.position.set(x, 0.15, z);
            scene.add(carGroup);

            // Plancher walkable
            const floor = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.25, 16), metroTrainMat);
            floor.position.y = 0.85;
            floor.receiveShadow = true;
            carGroup.add(floor);

            // Toit
            const roof = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.35, 16), metroTrainMat);
            roof.position.y = 3.75;
            roof.castShadow = true;
            carGroup.add(roof);

            // Parois latérales (portes ouvertes au centre : z de -2.2 à +2.2)
            const walls = [];
            for (let side = -1; side <= 1; side += 2) {
                const wallFront = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.65, 5.2), metroTrainMat);
                wallFront.position.set(side * 2.3, 2.3, 5.2);
                wallFront.castShadow = true;
                carGroup.add(wallFront);
                walls.push(wallFront);

                const wallBack = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.65, 5.2), metroTrainMat);
                wallBack.position.set(side * 2.3, 2.3, -5.2);
                wallBack.castShadow = true;
                carGroup.add(wallBack);
                walls.push(wallBack);

                const accent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 16), metroTrainAccentMat);
                accent.position.set(side * 2.31, 2.0, 0);
                carGroup.add(accent);
            }

            // Extrémités du wagon
            const wallEnd1 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.65, 0.2), metroTrainMat);
            wallEnd1.position.set(0, 2.3, 8.0);
            carGroup.add(wallEnd1);
            walls.push(wallEnd1);

            const wallEnd2 = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.65, 0.2), metroTrainMat);
            wallEnd2.position.set(0, 2.3, -8.0);
            carGroup.add(wallEnd2);
            walls.push(wallEnd2);

            // Enseigne néon
            const sign = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.45, 0.08), neonCyanMat);
            sign.position.set(0, 4.0, 8.05);
            carGroup.add(sign);

            // Mise à jour de la hiérarchie dans la scène avant enregistrement des colliders
            carGroup.updateMatrixWorld(true);

            // Le plancher est un SOL (on peut marcher dessus et entrer par les portes)
            registerGround(floor);
            registerWall(roof);
            walls.forEach(w => registerWall(w));
        };
        // Voie gauche
        addMetroCar(-15, -12); addMetroCar(-15, 12);
        // Voie droite
        addMetroCar(15, -8); addMetroCar(15, 16);

        // Piliers structuraux du tunnel (rangées)
        for (let pz = -24; pz <= 24; pz += 12) {
            for (let px = -70; px <= 70; px += 35) {
                if (Math.abs(px) < 22) continue; // pas de pilier sur les voies
                const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 8.5, 1.8), concreteMat);
                pillar.position.set(px, 4.25, pz);
                pillar.castShadow = true;
                pillar.receiveShadow = true;
                scene.add(pillar);
                registerBox(pillar);
            }
        }

        // Néons au plafond du tunnel (réduit - pas de PointLight individuel)
        for (let nz = -22; nz <= 22; nz += 11) {
            for (let nx = -80; nx <= 80; nx += 55) {
                const neonBar = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.15), neonCyanMat);
                neonBar.position.set(nx, 8.35, nz);
                scene.add(neonBar);
            }
        }
        // Seulement 4 PointLights pour tout le tunnel (au lieu de 25+)
        const tunnelLight1 = new THREE.PointLight(0x06b6d4, 2.0, 40);
        tunnelLight1.position.set(-50, 8, 0);
        scene.add(tunnelLight1);
        const tunnelLight2 = new THREE.PointLight(0x06b6d4, 2.0, 40);
        tunnelLight2.position.set(50, 8, 0);
        scene.add(tunnelLight2);
        const tunnelLight3 = new THREE.PointLight(0x06b6d4, 1.5, 40);
        tunnelLight3.position.set(0, 8, -15);
        scene.add(tunnelLight3);
        const tunnelLight4 = new THREE.PointLight(0x06b6d4, 1.5, 40);
        tunnelLight4.position.set(0, 8, 15);
        scene.add(tunnelLight4);

        // Panneaux de signalisation du métro
        const addMetroSign = (sx, sz, text, mat = neonCyanMat) => {
            const signMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 0.12), mat);
            signMesh.position.set(sx, 6.5, sz);
            scene.add(signMesh);
            const bgMesh = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.0, 0.1), concreteDarkMat);
            bgMesh.position.set(sx, 6.5, sz - 0.08);
            scene.add(bgMesh);
        };
        addMetroSign(-40, -25, 'SORTIE ←');
        addMetroSign(-40, 25, '→ QUAI A');
        addMetroSign(40, -25, 'SORTIE →');
        addMetroSign(40, 25, '← QUAI B');

        // Barricades et couvertures dans le tunnel
        addJerseyBarrier(-8, 10); addJerseyBarrier(8, 10);
        addJerseyBarrier(-8, -10); addJerseyBarrier(8, -10);
        addJerseyBarrier(0, 0, Math.PI / 2);
        addJerseyBarrier(-60, 5); addJerseyBarrier(60, 5);
        addJerseyBarrier(-60, -15); addJerseyBarrier(60, -15);

        // Conteneurs dans le tunnel
        addShippingContainer(-80, 0, 10, 0, militaryOliveMat);
        addShippingContainer(-80, 3.2, 10, 0, blueContainerMat);
        addShippingContainer(80, 0, -10, 0, rustContainerMat);
        addShippingContainer(80, 3.2, -10, 0, greenContainerMat);

        // Escaliers de sortie du tunnel (zone B→C transition)
        for (let step = 0; step < 8; step++) {
            const stairBlock = new THREE.Mesh(new THREE.BoxGeometry(18, 0.35, 2.0), concreteMat);
            stairBlock.position.set(0, step * 0.35 + 0.175, -30 + step * 1.8);
            stairBlock.receiveShadow = true;
            stairBlock.castShadow = true;
            scene.add(stairBlock);
            registerGround(stairBlock);
        }
        addSolidWall(-10, 1.6, -22, 0.8, 3.2, 16, concreteDarkMat);
        addSolidWall(10, 1.6, -22, 0.8, 3.2, 16, concreteDarkMat);

        // =============================================
        // ===== ZONE C : RUE URBAINE (z = -100..-30) =====
        // =============================================

        // Trottoirs surélevés
        addSolidPlatform(-60, 0, -65, 100, 0.25, 65, concreteMat);
        addSolidPlatform(60, 0, -65, 100, 0.25, 65, concreteMat);

        // Route centrale (marquage)
        const roadCenter = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 60), yellowHazardMat);
        roadCenter.rotation.x = -Math.PI / 2;
        roadCenter.position.set(0, 0.025, -65);
        scene.add(roadCenter);
        // Lignes latérales
        for (let lx = -1; lx <= 1; lx += 2) {
            const lane = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 60), new THREE.MeshBasicMaterial({ color: 0xffffff }));
            lane.rotation.x = -Math.PI / 2;
            lane.position.set(lx * 8, 0.025, -65);
            scene.add(lane);
        }

        // Immeubles côté ouest (5 bâtiments)
        addBuildingFacade(-95, -45, 22, 14, 10, brickMat, 3);
        addBuildingFacade(-95, -65, 22, 18, 10, brickLightMat, 4);
        addBuildingFacade(-95, -85, 22, 12, 10, brickMat, 3);
        addBuildingFacade(-75, -55, 14, 16, 10, concreteDarkMat, 4);
        addBuildingFacade(-75, -80, 14, 10, 10, brickLightMat, 2);

        // Immeubles côté est (5 bâtiments)
        addBuildingFacade(95, -45, 22, 16, 10, brickLightMat, 4);
        addBuildingFacade(95, -65, 22, 12, 10, brickMat, 3);
        addBuildingFacade(95, -85, 22, 20, 10, concreteDarkMat, 5);
        addBuildingFacade(75, -55, 14, 14, 10, brickMat, 3);
        addBuildingFacade(75, -80, 14, 10, 10, brickLightMat, 2);

        // Véhicules détruits dans la rue
        addDestroyedCar(-5, -50, 0.15);
        addDestroyedCar(12, -60, -0.3);
        addDestroyedCar(-18, -72, Math.PI / 2 + 0.2);
        addDestroyedCar(25, -80, 0.1);
        addDestroyedCar(-30, -55, Math.PI / 4);
        addDestroyedCar(0, -90, -0.1);

        // Barricades dans la rue
        addJerseyBarrier(-15, -45); addJerseyBarrier(15, -45);
        addJerseyBarrier(-25, -65, Math.PI / 4); addJerseyBarrier(25, -65, -Math.PI / 4);
        addJerseyBarrier(0, -75, Math.PI / 2);
        addJerseyBarrier(-40, -55); addJerseyBarrier(40, -55);
        addJerseyBarrier(-15, -85); addJerseyBarrier(15, -85);

        // Conteneurs dans la rue
        addShippingContainer(-50, 0, -50, 0, rustContainerMat);
        addShippingContainer(-50, 3.2, -50, 0, blueContainerMat);
        addShippingContainer(50, 0, -70, Math.PI / 2, militaryOliveMat);
        addShippingContainer(50, 0, -90, 0, greenContainerMat);
        addShippingContainer(50, 3.2, -90, 0, rustContainerMat);

        // Lampadaires de la rue
        addLampPost(-12, -42); addLampPost(12, -42);
        addLampPost(-12, -60); addLampPost(12, -60);
        addLampPost(-12, -78); addLampPost(12, -78);
        addLampPost(-35, -55); addLampPost(35, -55);

        // Débris et ruines (petits éléments de couverture)
        for (let i = 0; i < 12; i++) {
            const dx = (Math.random() - 0.5) * 60;
            const dz = -35 - Math.random() * 60;
            const debris = new THREE.Mesh(
                new THREE.BoxGeometry(1.0 + Math.random() * 2, 0.5 + Math.random() * 1.0, 1.0 + Math.random() * 2),
                Math.random() > 0.5 ? concreteMat : brickMat
            );
            debris.position.set(dx, (0.5 + Math.random() * 1.0) / 2, dz);
            debris.rotation.y = Math.random() * Math.PI;
            debris.castShadow = true;
            scene.add(debris);
            registerBox(debris, false); // débris = mur seulement
        }

        // Sacs de sable (couverture tactique)
        const addSandbagWall = (sx, sz, sRot = 0) => {
            for (let row = 0; row < 3; row++) {
                for (let col = -1; col <= 1; col++) {
                    const bag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), militaryOliveMat);
                    bag.position.set(
                        sx + col * 1.15 * Math.cos(sRot),
                        0.2 + row * 0.38,
                        sz + col * 1.15 * Math.sin(sRot)
                    );
                    bag.rotation.y = sRot;
                    bag.castShadow = true;
                    scene.add(bag);
                    if (row === 0) registerWall(bag);
                }
            }
            const topBag = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 0.6), militaryOliveMat);
            topBag.position.set(sx, 0.2 + 3 * 0.38, sz);
            topBag.rotation.y = sRot;
            scene.add(topBag);
            registerWall(topBag);
        };
        addSandbagWall(-30, -48); addSandbagWall(30, -48);
        addSandbagWall(-45, -70, Math.PI / 2); addSandbagWall(45, -70, Math.PI / 2);
        addSandbagWall(0, -60);

        // Tour de guet / point d'observation surélevé
        addSolidPlatform(60, 0, -50, 8, 5.0, 8, concreteDarkMat);
        addSolidWall(60, 5.6, -54, 8, 1.2, 0.6, metalPlateMat);
        addSolidWall(60, 5.6, -46, 8, 1.2, 0.6, metalPlateMat);
        addSolidWall(56, 5.6, -50, 0.6, 1.2, 8, metalPlateMat);
        addSolidWall(64, 5.6, -50, 0.6, 1.2, 8, metalPlateMat);
        // Escalier vers la tour
        for (let ts = 0; ts < 12; ts++) {
            const tStep = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 1.0), metalPlateMat);
            tStep.position.set(56.5, ts * 0.42 + 0.21, -50 + ts * 0.6 - 3);
            tStep.castShadow = true;
            scene.add(tStep);
            registerGround(tStep);
        }

        // Tour de guet symétrique côté ouest
        addSolidPlatform(-60, 0, -80, 8, 5.0, 8, concreteDarkMat);
        addSolidWall(-60, 5.6, -84, 8, 1.2, 0.6, metalPlateMat);
        addSolidWall(-60, 5.6, -76, 8, 1.2, 0.6, metalPlateMat);
        addSolidWall(-64, 5.6, -80, 0.6, 1.2, 8, metalPlateMat);
        addSolidWall(-56, 5.6, -80, 0.6, 1.2, 8, metalPlateMat);
        for (let ts = 0; ts < 12; ts++) {
            const tStep = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.35, 1.0), metalPlateMat);
            tStep.position.set(-56.5, ts * 0.42 + 0.21, -80 + ts * 0.6 - 3);
            tStep.castShadow = true;
            scene.add(tStep);
            registerGround(tStep);
        }

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

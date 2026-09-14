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
    const [magAmmo, setMagAmmo] = useState(30);
    const [reserveAmmo, setReserveAmmo] = useState(90);
    const [isReloading, setIsReloading] = useState(false);
    const [savedStats, setSavedStats] = useState(() => SaveService.getSaveData());
    const [saveToast, setSaveToast] = useState(false);
    const [ammoToast, setAmmoToast] = useState(null);
    const [activeMessage, setActiveMessage] = useState('Cliquez pour verrouiller la vue et viser');

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
        camera.position.set(0, 1.7, 20);

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

        // --- 4. MATÉRIAUX & DÉCORS ---
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

        // Sol principal
        const floorGeo = new THREE.PlaneGeometry(70, 70);
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

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
        addWall(0, wallH / 2, -35, 70, wallH, 1.5);
        addWall(0, wallH / 2, 35, 70, wallH, 1.5);
        addWall(-35, wallH / 2, 0, 1.5, wallH, 70);
        addWall(35, wallH / 2, 0, 1.5, wallH, 70);

        // Marquages au sol
        const addGroundMark = (x, z, w, d, mat = neonCyanMat) => {
            const geo = new THREE.PlaneGeometry(w, d);
            const strip = new THREE.Mesh(geo, mat);
            strip.position.set(x, 0.015, z);
            strip.rotation.x = -Math.PI / 2;
            scene.add(strip);
        };
        addGroundMark(0, -10, 50, 0.25, neonCyanMat);
        addGroundMark(0, 10, 50, 0.25, neonCyanMat);
        addGroundMark(-18, 0, 0.25, 40, neonOrangeMat);
        addGroundMark(18, 0, 0.25, 40, neonOrangeMat);

        // Piliers
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
        addPlatform(-20, 0, -20, 8, 2.2, 8);
        addPlatform(20, 0, -20, 8, 2.6, 8);
        addPlatform(0, 0, -24, 10, 3.2, 6);

        // --- 5. CIBLES REALISTES DE TIR À L'ARC & STAND DE TIR (DIFFÉRENTS NIVEAUX) ---
        const targetObjects = [];

        // Constructeur de Cible Circulaire Classique à Anneaux (Tir à l'arc)
        const createArcheryTarget = (scoreVal, scale = 1.0, isSpecial = false) => {
            const targetGroup = new THREE.Group();

            // Trépied / Support en bois & acier
            const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.8 });
            const standL = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 2.6 * scale, 8), woodMat);
            standL.position.set(-0.5 * scale, 1.2 * scale, -0.2 * scale);
            standL.rotation.z = -0.15;
            standL.rotation.x = -0.1;
            targetGroup.add(standL);

            const standR = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 2.6 * scale, 8), woodMat);
            standR.position.set(0.5 * scale, 1.2 * scale, -0.2 * scale);
            standR.rotation.z = 0.15;
            standR.rotation.x = -0.1;
            targetGroup.add(standR);

            const standBack = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * scale, 0.035 * scale, 2.4 * scale, 8), woodMat);
            standBack.position.set(0, 1.1 * scale, -0.7 * scale);
            standBack.rotation.x = 0.35;
            targetGroup.add(standBack);

            // Disque cible principal (Paille compressée / Base)
            const baseGeo = new THREE.CylinderGeometry(0.9 * scale, 0.9 * scale, 0.12 * scale, 32);
            baseGeo.rotateX(Math.PI / 2);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.7 });
            const baseDisc = new THREE.Mesh(baseGeo, baseMat);
            baseDisc.position.set(0, 1.7 * scale, 0);
            baseDisc.castShadow = true;
            targetGroup.add(baseDisc);

            // Anneaux concentriques de couleur (Tir à l'arc officiel)
            const ringColors = isSpecial
                ? [0x1e1b4b, 0x4338ca, 0x6366f1, 0xa855f7, 0xfacc15] // Spécial Élite Violet/Or
                : [0xffffff, 0x1e293b, 0x0284c7, 0xdc2626, 0xfacc15]; // Classique Blanc/Noir/Bleu/Rouge/Jaune

            const rings = [0.85, 0.68, 0.50, 0.32, 0.15];
            rings.forEach((r, idx) => {
                const ringGeo = new THREE.CircleGeometry(r * scale, 32);
                const ringMaterial = new THREE.MeshBasicMaterial({ color: ringColors[idx], side: THREE.DoubleSide });
                const rMesh = new THREE.Mesh(ringGeo, ringMaterial);
                rMesh.position.set(0, 1.7 * scale, 0.065 * scale + idx * 0.001);
                targetGroup.add(rMesh);
            });

            // Bullseye central lumineux
            const bullseyeGeo = new THREE.SphereGeometry(0.08 * scale, 16, 16);
            const bullseyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
            const bullseye = new THREE.Mesh(bullseyeGeo, bullseyeMat);
            bullseye.position.set(0, 1.7 * scale, 0.08 * scale);
            targetGroup.add(bullseye);

            targetGroup.userData = {
                isTarget: true,
                scoreValue: scoreVal,
                baseDisc,
                bullseye,
                initialY: 0,
                isSpecial
            };

            return targetGroup;
        };

        // Constructeur de Cible Diamant / Losange Tactique (Niveau Moyen / Difficile)
        const createDiamondTarget = (scoreVal, scale = 1.0) => {
            const group = new THREE.Group();

            const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 2.2 * scale, 12), postMat);
            post.position.y = 1.1 * scale;
            group.add(post);

            // Losange / Diamant pivotant
            const diamondGeo = new THREE.BoxGeometry(0.9 * scale, 0.9 * scale, 0.08 * scale);
            const diamondMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 });
            const diamond = new THREE.Mesh(diamondGeo, diamondMat);
            diamond.position.set(0, 1.9 * scale, 0);
            diamond.rotation.z = Math.PI / 4;
            diamond.castShadow = true;
            group.add(diamond);

            // Bords néon cyan & cœur orange
            const innerGeo = new THREE.BoxGeometry(0.55 * scale, 0.55 * scale, 0.09 * scale);
            const innerMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
            const inner = new THREE.Mesh(innerGeo, innerMat);
            inner.position.set(0, 1.9 * scale, 0.005 * scale);
            inner.rotation.z = Math.PI / 4;
            group.add(inner);

            const centerGeo = new THREE.SphereGeometry(0.1 * scale, 16, 16);
            const centerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
            const center = new THREE.Mesh(centerGeo, centerMat);
            center.position.set(0, 1.9 * scale, 0.06 * scale);
            group.add(center);

            group.userData = {
                isTarget: true,
                scoreValue: scoreVal,
                diamond,
                center,
                initialY: 0,
                isDiamond: true
            };

            return group;
        };

        // Configuration des 10 cibles avec difficultés et emplacements variés
        const targetConfigs = [
            // 1 & 2 : Cibles Tir à l'arc Standard Proches (100 pts)
            { type: 'archery', pos: [-8, 0, -10], score: 100, scale: 1.1 },
            { type: 'archery', pos: [8, 0, -10], score: 100, scale: 1.1 },
            // 3 & 4 : Cibles Diamant Moyenne Portée (200 pts)
            { type: 'diamond', pos: [-16, 0, -18], score: 200, scale: 1.0 },
            { type: 'diamond', pos: [16, 0, -18], score: 200, scale: 1.0 },
            // 5 & 6 : Cibles Tir à l'arc sur Plateformes Hautes (300 pts)
            { type: 'archery', pos: [-20, 2.2, -20], score: 300, scale: 0.9 },
            { type: 'archery', pos: [20, 2.6, -20], score: 300, scale: 0.9 },
            // 7 : Cible Élite Spéciale Fond de Scène (500 pts)
            { type: 'archery_special', pos: [0, 3.2, -24], score: 500, scale: 1.2, isSpecial: true },
            // 8 & 9 : Cibles Latérales Flancs (150 pts)
            { type: 'diamond', pos: [-24, 0, 2], score: 150, scale: 0.95 },
            { type: 'diamond', pos: [24, 0, 2], score: 150, scale: 0.95 },
            // 10 : Cible Tir à l'arc Proche Entraînement (50 pts)
            { type: 'archery', pos: [0, 0, -6], score: 50, scale: 1.2 }
        ];

        targetConfigs.forEach((cfg, idx) => {
            let tGroup;
            if (cfg.type === 'diamond') {
                tGroup = createDiamondTarget(cfg.score, cfg.scale);
            } else {
                tGroup = createArcheryTarget(cfg.score, cfg.scale, cfg.isSpecial);
            }
            tGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
            tGroup.userData.index = idx;
            tGroup.userData.timeOffset = idx * 0.7;

            scene.add(tGroup);
            targetObjects.push(tGroup);
            registerBox(tGroup);
        });

        // --- 6. CAISSES DE MUNITIONS AU SOL (AMMO SUPPLY CRATES) ---
        const ammoCrates = [];
        const crateMat = new THREE.MeshStandardMaterial({ color: 0x2e4a2b, roughness: 0.5, metalness: 0.4 }); // Vert militaire
        const crateCornerMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.3, metalness: 0.8 });
        const iconGlowMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 }); // Icône dorée luminescente

        const crateLocations = [
            [-12, 0, 6],
            [12, 0, 6],
            [-22, 0, -8],
            [22, 0, -8],
            [0, 0, 10]
        ];

        const createAmmoCrate = (x, z) => {
            const crateGroup = new THREE.Group();
            crateGroup.position.set(x, 0, z);

            // Coffre principal
            const boxGeo = new THREE.BoxGeometry(1.2, 0.7, 0.8);
            const box = new THREE.Mesh(boxGeo, crateMat);
            box.position.y = 0.35;
            box.castShadow = true;
            box.receiveShadow = true;
            crateGroup.add(box);

            // Renforts métalliques d'angles
            const cornerGeo = new THREE.BoxGeometry(1.24, 0.12, 0.84);
            const cornerT = new THREE.Mesh(cornerGeo, crateCornerMat);
            cornerT.position.y = 0.65;
            crateGroup.add(cornerT);

            const cornerB = new THREE.Mesh(cornerGeo, crateCornerMat);
            cornerB.position.y = 0.08;
            crateGroup.add(cornerB);

            // Hologramme / Symbole de munitions au-dessus de la caisse
            const iconGroup = new THREE.Group();
            iconGroup.position.y = 1.3;

            // 3 balles holographiques en éventail
            for (let b = -1; b <= 1; b++) {
                const bulletIcon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.28, 8), iconGlowMat);
                bulletIcon.position.x = b * 0.15;
                bulletIcon.rotation.z = b * 0.2;
                iconGroup.add(bulletIcon);
            }
            crateGroup.add(iconGroup);

            crateGroup.userData = {
                isCrate: true,
                available: true,
                iconGroup,
                respawnTimer: 0,
                radius: 1.8
            };

            scene.add(crateGroup);
            ammoCrates.push(crateGroup);
            registerBox(box);
        };

        crateLocations.forEach(([x, z]) => createAmmoCrate(x, z));

        // --- 7. ARME TACTIQUE & VISEUR ---
        const weaponPivot = new THREE.Group();
        const weaponMeshGroup = new THREE.Group();

        const gunMetalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.85, roughness: 0.3 });
        const gunSteelMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, metalness: 0.9, roughness: 0.2 });
        const sightGlowMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        // Corps
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.6), gunMetalMat);
        body.position.set(0.24, -0.22, -0.45);
        body.castShadow = true;
        weaponMeshGroup.add(body);

        // Canon & Frein de bouche
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 16), gunSteelMat);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0.24, -0.18, -0.8);
        weaponMeshGroup.add(barrel);

        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.08), gunSteelMat);
        muzzle.position.set(0.24, -0.18, -1.06);
        weaponMeshGroup.add(muzzle);

        // Chargeur détachable
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.24, 0.12), gunSteelMat);
        mag.position.set(0.24, -0.36, -0.42);
        mag.rotation.x = Math.PI / 12;
        weaponMeshGroup.add(mag);

        // Poignée
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.22, 0.1), gunMetalMat);
        grip.position.set(0.24, -0.34, -0.26);
        grip.rotation.x = -Math.PI / 6;
        weaponMeshGroup.add(grip);

        // Viseur Holographique
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

        // --- 8. SYSTÈME DE VRAIES BALLES 3D PHYSIQUES ---
        const bullets = [];
        const bulletGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 8);
        bulletGeo.rotateX(Math.PI / 2);
        const bulletMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });

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

        const spawnBullet = () => {
            const muzzleWorldPos = new THREE.Vector3();
            muzzle.getWorldPosition(muzzleWorldPos);

            const bullet = new THREE.Mesh(bulletGeo, bulletMat);
            bullet.position.copy(muzzleWorldPos);

            const shootDir = new THREE.Vector3();
            camera.getWorldDirection(shootDir);
            bullet.quaternion.copy(camera.quaternion);

            scene.add(bullet);
            bullets.push({
                mesh: bullet,
                dir: shootDir.clone(),
                speed: 190.0,
                startPos: muzzleWorldPos.clone(),
                distTravelled: 0,
                maxDist: 200.0
            });
        };

        // --- 9. SYSTÈME DE MUNITIONS & RECHARGEMENT ---
        let currentMag = 30;
        let currentReserve = 90;
        let reloading = false;

        const executeReload = () => {
            if (reloading || currentMag >= maxMag || currentReserve <= 0) return;
            reloading = true;
            setIsReloading(true);
            sound.playReload();

            // Animation de rechargement (l'arme s'abaisse légèrement)
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

        // --- 10. CONTRÔLES & MOUVEMENTS ---
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
            if (e.code === 'KeyR') {
                executeReload();
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

        // Déclenchement du Tir
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
            spawnBullet();

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

        // --- 11. BOUCLE PRINCIPALE & PHYSIQUE ---
        let prevTime = performance.now();
        let bobTimer = 0;
        let animationFrameId;

        const animate = () => {
            animationFrameId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);
            prevTime = time;

            // Animation et oscillation des cibles
            targetObjects.forEach((t) => {
                if (t.userData.isDiamond) {
                    t.userData.diamond.rotation.z = Math.PI / 4 + Math.sin(time * 0.002 + t.userData.timeOffset) * 0.2;
                }
            });

            // Animation des caisses de munitions & ramassage
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

                    // Détection de proximité avec le joueur
                    const playerPos = new THREE.Vector2(camera.position.x, camera.position.z);
                    const cratePos = new THREE.Vector2(c.position.x, c.position.z);
                    if (playerPos.distanceTo(cratePos) < c.userData.radius) {
                        // Ramassage effectué !
                        c.userData.available = false;
                        c.userData.respawnTimer = 14.0; // Réapparition après 14s
                        c.visible = false;

                        sound.playAmmoPickup();
                        currentReserve += 60;
                        setReserveAmmo(currentReserve);

                        setAmmoToast('+60 MUNITIONS');
                        setTimeout(() => setAmmoToast(null), 2200);
                    }
                }
            });

            // Physique des balles 3D
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

                        let obj = hit.object;
                        while (obj.parent && !obj.userData?.isTarget && obj.parent !== scene) {
                            obj = obj.parent;
                        }

                        if (obj && obj.userData && obj.userData.isTarget) {
                            sound.playHitmarker();
                            setShotsHit((prev) => prev + 1);

                            const pointsEarned = obj.userData.scoreValue || 100;
                            setScore((prev) => {
                                const newScore = prev + pointsEarned;
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

                            // Effet de choc / tremblement sur la cible
                            obj.position.y -= 0.1;
                            setTimeout(() => { obj.position.y += 0.1; }, 150);
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

                // Collisions X
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

                // Collisions Z
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

                // Gravité et plateformes
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

                // Transition FOV et centrage ADS
                const targetFov = isAimingADS ? 44 : 75;
                camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, delta * 14);
                camera.updateProjectionMatrix();

                const targetPivotPos = isAimingADS ? adsPosition : hipPosition;
                weaponPivot.position.lerp(targetPivotPos, delta * 16);

                // Sway / Bobbing
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

        // --- 12. CLEANUP ---
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

            {/* Réticule de visée tactique */}
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

            {/* HUD Supérieur : Score, Précision & Record */}
            <div className="pointer-events-none absolute top-6 left-8 right-8 flex items-center justify-between text-white">
                <div className="flex items-center space-x-6 bg-slate-900/85 backdrop-blur border border-slate-700/70 px-5 py-3 rounded-lg shadow-xl">
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
                    <div className="w-px h-8 bg-slate-700"></div>
                    <div>
                        <div className="text-[10px] text-amber-400 uppercase tracking-widest font-semibold">Record</div>
                        <div className="text-xl font-bold text-amber-300">{savedStats?.highScore || 0} pts</div>
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {saveToast && (
                        <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide flex items-center space-x-1.5 animate-bounce shadow-lg">
                            <span>💾</span>
                            <span>Progression Sauvegardée</span>
                        </div>
                    )}

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

                    <div className="bg-slate-900/85 backdrop-blur border border-slate-700/70 px-4 py-2.5 rounded-lg text-xs tracking-wider text-slate-300">
                        STAND DE TIR • <span className="text-cyan-400 font-medium">GASHOOTER</span>
                    </div>
                </div>
            </div>

            {/* HUD Munitions (Chargeur + Réserve + Rechargement) */}
            <div className="pointer-events-none absolute bottom-24 right-8 flex flex-col items-end">
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
                        🔄 Rechargement en cours...
                    </div>
                )}

                {magAmmo === 0 && !isReloading && (
                    <div className="mt-2 bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest animate-bounce">
                        ⚠️ APPUYEZ SUR [R] POUR RECHARGER
                    </div>
                )}
            </div>

            {/* HUD Inférieur : Commandes & Aide */}
            <div className="pointer-events-none absolute bottom-6 left-8 right-8 flex items-end justify-between">
                <div className="bg-slate-900/85 backdrop-blur border border-slate-700/70 px-4 py-3 rounded-lg text-xs text-slate-300 space-y-1 shadow-xl">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Commandes</div>
                    <div><span className="text-cyan-400 font-semibold">[Z / Q / S / D]</span> : Se déplacer • <span className="text-cyan-400 font-semibold">[ESPACE]</span> : Sauter</div>
                    <div><span className="text-cyan-400 font-semibold">[CLIC GAUCHE]</span> : Tirer • <span className="text-cyan-400 font-semibold">[R]</span> : 🔄 Recharger • <span className="text-cyan-400 font-semibold">[CLIC DROIT]</span> : 🎯 Viser</div>
                    <div><span className="text-amber-400 font-semibold">[📦 CAISSES AU SOL]</span> : Marchez dessus pour ramasser +60 munitions</div>
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
                                Stand de Tir & Cibles
                            </h2>
                            <p className="text-xs text-slate-400 mt-2">
                                {activeMessage}
                            </p>
                        </div>

                        {/* Guide des Cibles */}
                        <div className="bg-slate-800/80 border border-slate-700/80 rounded-lg p-3 text-left text-xs space-y-2 text-slate-300">
                            <div className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Guide des Cibles & Points</div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                                    <span>Cible Tir à l'arc (Classique)</span>
                                </span>
                                <span className="font-bold text-cyan-400">100 - 300 pts</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rotate-45 bg-orange-500 inline-block"></span>
                                    <span>Cible Diamant (Moyenne Portée)</span>
                                </span>
                                <span className="font-bold text-orange-400">150 - 200 pts</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="flex items-center space-x-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                                    <span>Cible Élite (Longue Portée)</span>
                                </span>
                                <span className="font-bold text-purple-400">500 pts</span>
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

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export default function FirstPersonMap({ onExit }) {
    const mountRef = useRef(null);
    const [isLocked, setIsLocked] = useState(false);
    const [targetsHit, setTargetsHit] = useState(0);
    const [totalTargets, setTotalTargets] = useState(0);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        // 1. Scene & Camera & Renderer
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x0a0f1d);
        scene.fog = new THREE.FogExp2(0x0a0f1d, 0.015);

        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        camera.position.set(0, 1.7, 10); // Hauteur des yeux

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        // 2. Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(30, 50, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.near = 0.5;
        dirLight.shadow.camera.far = 150;
        dirLight.shadow.camera.left = -50;
        dirLight.shadow.camera.right = 50;
        dirLight.shadow.camera.top = 50;
        dirLight.shadow.camera.bottom = -50;
        scene.add(dirLight);

        // Lumière colorée d'ambiance
        const pointLight1 = new THREE.PointLight(0x00f0ff, 2, 40);
        pointLight1.position.set(-15, 6, -15);
        scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0x10b981, 2, 40);
        pointLight2.position.set(15, 6, 15);
        scene.add(pointLight2);

        // 3. Grid Floor (Sol quadrillé)
        const gridHelper = new THREE.GridHelper(100, 50, 0x10b981, 0x1e293b);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);

        const floorGeo = new THREE.PlaneGeometry(100, 100);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.8,
            metalness: 0.2
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        // 4. Murs d'enceinte de la map
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            roughness: 0.7,
            metalness: 0.3
        });

        const wallGeoH = new THREE.BoxGeometry(100, 6, 1);
        const wallNorth = new THREE.Mesh(wallGeoH, wallMat);
        wallNorth.position.set(0, 3, -50);
        wallNorth.castShadow = true;
        wallNorth.receiveShadow = true;
        scene.add(wallNorth);

        const wallSouth = new THREE.Mesh(wallGeoH, wallMat);
        wallSouth.position.set(0, 3, 50);
        wallSouth.castShadow = true;
        wallSouth.receiveShadow = true;
        scene.add(wallSouth);

        const wallGeoV = new THREE.BoxGeometry(1, 6, 100);
        const wallWest = new THREE.Mesh(wallGeoV, wallMat);
        wallWest.position.set(-50, 3, 0);
        wallWest.castShadow = true;
        wallWest.receiveShadow = true;
        scene.add(wallWest);

        const wallEast = new THREE.Mesh(wallGeoV, wallMat);
        wallEast.position.set(50, 3, 0);
        wallEast.castShadow = true;
        wallEast.receiveShadow = true;
        scene.add(wallEast);

        // 5. Blocs, Piliers & Obstacles
        const obstacleMat = new THREE.MeshStandardMaterial({
            color: 0x334155,
            roughness: 0.6,
            metalness: 0.4
        });
        const obstacles = [];

        const addBox = (x, y, z, w, h, d, color = 0x334155) => {
            const geo = new THREE.BoxGeometry(w, h, d);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, y + h / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            obstacles.push(mesh);
            return mesh;
        };

        // Piliers centraux
        addBox(-10, 0, -10, 3, 8, 3, 0x1e293b);
        addBox(10, 0, -10, 3, 8, 3, 0x1e293b);
        addBox(-10, 0, 10, 3, 8, 3, 0x1e293b);
        addBox(10, 0, 10, 3, 8, 3, 0x1e293b);

        // Caisses d'entraînement
        addBox(5, 0, -3, 2, 2, 2, 0x475569);
        addBox(5, 2, -3, 1.5, 1.5, 1.5, 0x64748b);
        addBox(-7, 0, 4, 3, 1.5, 4, 0x475569);
        addBox(14, 0, 0, 2, 3, 6, 0x334155);
        addBox(-14, 0, -2, 4, 2, 2, 0x334155);

        // Plateforme surélevée
        addBox(0, 0, -25, 16, 2, 12, 0x1e293b);
        addBox(-6, 2, -25, 2, 4, 2, 0x3b82f6);
        addBox(6, 2, -25, 2, 4, 2, 0x3b82f6);

        // 6. Cibles de test 3D (Sphères flottantes lumineuses)
        const targetObjects = [];
        const targetPositions = [
            [-10, 4, -10],
            [10, 4, -10],
            [0, 5, -25],
            [-15, 3, 15],
            [15, 3, 15],
            [-22, 2.5, -5],
            [22, 2.5, -5],
            [0, 3.5, 20]
        ];

        setTotalTargets(targetPositions.length);

        targetPositions.forEach((pos) => {
            const targetGeo = new THREE.SphereGeometry(0.8, 24, 24);
            const targetMat = new THREE.MeshStandardMaterial({
                color: 0xef4444,
                emissive: 0x7f1d1d,
                roughness: 0.3,
                metalness: 0.7
            });
            const target = new THREE.Mesh(targetGeo, targetMat);
            target.position.set(pos[0], pos[1], pos[2]);
            target.castShadow = true;
            target.userData = { isTarget: true, initialY: pos[1], offset: Math.random() * Math.PI };
            scene.add(target);
            targetObjects.push(target);
        });

        // 7. Modèle simple d'arme à la première personne attachée à la caméra
        const gunGroup = new THREE.Group();
        const gunBodyGeo = new THREE.BoxGeometry(0.12, 0.15, 0.6);
        const gunMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9, roughness: 0.2 });
        const gunBody = new THREE.Mesh(gunBodyGeo, gunMat);
        gunBody.position.set(0.22, -0.22, -0.45);
        gunGroup.add(gunBody);

        const gunBarrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16);
        gunBarrelGeo.rotateX(Math.PI / 2);
        const barrelMat = new THREE.MeshStandardMaterial({ color: 0x10b981, metalness: 0.8, roughness: 0.2 });
        const gunBarrel = new THREE.Mesh(gunBarrelGeo, barrelMat);
        gunBarrel.position.set(0.22, -0.19, -0.7);
        gunGroup.add(gunBarrel);

        camera.add(gunGroup);
        scene.add(camera);

        // 8. PointerLockControls
        const controls = new PointerLockControls(camera, renderer.domElement);

        controls.addEventListener('lock', () => setIsLocked(true));
        controls.addEventListener('unlock', () => setIsLocked(false));

        // 9. Clavier & Physique joueur
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
                    if (canJump && camera.position.y <= 1.75) {
                        velocity.y = 8.5;
                        canJump = false;
                    }
                    break;
                case 'Escape':
                    if (!controls.isLocked) {
                        onExit();
                    }
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

        // 10. Tirs Laser (Raycasting)
        const raycaster = new THREE.Raycaster();
        const lasers = [];

        const fireLaser = () => {
            if (!controls.isLocked) return;

            // Recul de l'arme
            gunGroup.position.z += 0.08;
            setTimeout(() => { gunGroup.position.z = 0; }, 60);

            // Raycast depuis le centre de la caméra
            raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
            const intersects = raycaster.intersectObjects(targetObjects, false);

            if (intersects.length > 0) {
                const hitTarget = intersects[0].object;
                if (hitTarget.userData.isTarget) {
                    // Cible touchée : flash blanc puis disparition / respawn
                    hitTarget.material.color.setHex(0xffffff);
                    hitTarget.material.emissive.setHex(0x10b981);
                    setTargetsHit((prev) => prev + 1);

                    setTimeout(() => {
                        hitTarget.position.x = (Math.random() - 0.5) * 60;
                        hitTarget.position.z = (Math.random() - 0.5) * 60;
                        hitTarget.material.color.setHex(0xef4444);
                        hitTarget.material.emissive.setHex(0x7f1d1d);
                    }, 250);
                }
            }

            // Visuel du tir laser
            const laserGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8);
            laserGeo.rotateX(Math.PI / 2);
            const laserMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
            const laserMesh = new THREE.Mesh(laserGeo, laserMat);

            // Part de l'arme
            const startPos = new THREE.Vector3(0.22, -0.19, -0.7);
            startPos.applyMatrix4(camera.matrixWorld);
            laserMesh.position.copy(startPos);

            const shootDir = new THREE.Vector3();
            camera.getWorldDirection(shootDir);
            laserMesh.quaternion.copy(camera.quaternion);

            scene.add(laserMesh);
            lasers.push({ mesh: laserMesh, dir: shootDir, distance: 0 });
        };

        window.addEventListener('mousedown', fireLaser);

        // 11. Redimensionnement
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // 12. Boucle de Rendu
        let prevTime = performance.now();
        let animId;

        const animate = () => {
            animId = requestAnimationFrame(animate);

            const time = performance.now();
            const delta = Math.min((time - prevTime) / 1000, 0.1);

            // Animation des cibles flottantes
            targetObjects.forEach((t) => {
                t.position.y = t.userData.initialY + Math.sin(time * 0.003 + t.userData.offset) * 0.4;
                t.rotation.y += 0.015;
            });

            // Déplacement des lasers
            for (let i = lasers.length - 1; i >= 0; i--) {
                const laser = lasers[i];
                laser.mesh.position.addScaledVector(laser.dir, 80 * delta);
                laser.distance += 80 * delta;
                if (laser.distance > 120) {
                    scene.remove(laser.mesh);
                    lasers.splice(i, 1);
                }
            }

            if (controls.isLocked) {
                // Frottements
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
                velocity.y -= 22.0 * delta; // Gravité

                direction.z = Number(moveState.forward) - Number(moveState.backward);
                direction.x = Number(moveState.right) - Number(moveState.left);
                direction.normalize();

                const baseSpeed = moveState.sprint ? 70.0 : 45.0;
                if (moveState.forward || moveState.backward) velocity.z -= direction.z * baseSpeed * delta;
                if (moveState.left || moveState.right) velocity.x -= direction.x * baseSpeed * delta;

                controls.moveRight(-velocity.x * delta);
                controls.moveForward(-velocity.z * delta);

                camera.position.y += velocity.y * delta;

                // Collision sol
                if (camera.position.y < 1.7) {
                    velocity.y = 0;
                    camera.position.y = 1.7;
                    canJump = true;
                }

                // Limites de la map
                camera.position.x = Math.max(-48, Math.min(48, camera.position.x));
                camera.position.z = Math.max(-48, Math.min(48, camera.position.z));
            }

            renderer.render(scene, camera);
            prevTime = time;
        };

        animate();

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('mousedown', fireLaser);
            cancelAnimationFrame(animId);
            if (container && renderer.domElement) {
                container.removeChild(renderer.domElement);
            }
            renderer.dispose();
        };
    }, [onExit]);

    return (
        <div className="relative w-full h-screen overflow-hidden bg-black select-none font-sans">
            {/* 3D Canvas Mount */}
            <div ref={mountRef} className="w-full h-full cursor-crosshair" />

            {/* Réticule de visée (Crosshair) */}
            {isLocked && (
                <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-20">
                    <div className="relative w-6 h-6">
                        <div className="absolute top-1/2 left-0 w-2 h-0.5 bg-emerald-400 -translate-y-1/2"></div>
                        <div className="absolute top-1/2 right-0 w-2 h-0.5 bg-emerald-400 -translate-y-1/2"></div>
                        <div className="absolute top-0 left-1/2 w-0.5 h-2 bg-emerald-400 -translate-x-1/2"></div>
                        <div className="absolute bottom-0 left-1/2 w-0.5 h-2 bg-emerald-400 -translate-x-1/2"></div>
                        <div className="absolute top-1/2 left-1/2 w-1 h-1 bg-emerald-300 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
                    </div>
                </div>
            )}

            {/* HUD Supérieur : Cibles & Score */}
            <div className="pointer-events-none absolute top-4 left-6 z-20 flex items-center gap-6 font-mono text-sm text-zinc-300">
                <div className="px-3 py-1.5 bg-slate-900/80 border border-zinc-700 rounded-lg backdrop-blur-sm">
                    MAP TEST 3D : <strong className="text-emerald-400">ZONE ALPHA</strong>
                </div>
                <div className="px-3 py-1.5 bg-slate-900/80 border border-zinc-700 rounded-lg backdrop-blur-sm">
                    CIBLES TOUCHÉES : <strong className="text-emerald-400">{targetsHit}</strong>
                </div>
            </div>

            {/* Bouton Quitter */}
            <div className="absolute top-4 right-6 z-30">
                <button
                    onClick={onExit}
                    className="px-4 py-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 text-xs font-semibold uppercase tracking-wider rounded-lg transition cursor-pointer backdrop-blur-sm"
                >
                    ✕ Quitter vers le Menu
                </button>
            </div>

            {/* Overlay Initial / Pause lorsque la souris n'est pas verrouillée */}
            {!isLocked && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm text-white">
                    <div className="max-w-md w-full mx-4 p-8 bg-zinc-900/95 border border-zinc-700 rounded-2xl shadow-2xl text-center">
                        <h2 className="text-2xl font-bold uppercase tracking-wider mb-2 text-white">
                            Map Test Première Personne
                        </h2>
                        <p className="text-xs text-zinc-400 mb-6">
                            Cliquez ci-dessous pour capturer la souris et vous déplacer librement en 3D.
                        </p>

                        <div className="space-y-2 mb-6 text-xs text-zinc-300 bg-zinc-800/80 p-4 rounded-xl border border-zinc-700 text-left">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Regarder :</span>
                                <strong className="text-zinc-200">Mouvement de la souris</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Déplacement :</span>
                                <strong className="text-zinc-200">Z, Q, S, D / Flèches</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Sauter :</span>
                                <strong className="text-zinc-200">Espace</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Sprint :</span>
                                <strong className="text-zinc-200">Maj (Shift)</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Tir Laser :</span>
                                <strong className="text-emerald-400">Clic Gauche</strong>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Libérer la souris :</span>
                                <strong className="text-zinc-200">Échap (ESC)</strong>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                const canvas = mountRef.current?.querySelector('canvas');
                                if (canvas) canvas.requestPointerLock();
                            }}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold uppercase tracking-wider rounded-xl transition text-sm cursor-pointer shadow-lg shadow-emerald-500/20"
                        >
                            ▶ Cliquer pour Jouer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

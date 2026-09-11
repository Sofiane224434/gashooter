import * as THREE from 'three';

// Constructeur de modèles 3D réalistes composés (Arbres, Voitures, Lampadaires, Bâtiments avec toits, Rochers organiques)
export class ModelBuilder {
    // 1. VRAI ARBRE 3D (Tronc organique, branches et feuillages volumétriques)
    static createOakTree(scale = 1) {
        const tree = new THREE.Group();

        // Écorce
        const trunkMat = new THREE.MeshStandardMaterial({
            color: 0x4a2810,
            roughness: 0.9,
            metalness: 0.05
        });

        // Tronc conique avec base évasée
        const trunkGeo = new THREE.CylinderGeometry(0.35 * scale, 0.6 * scale, 3.5 * scale, 12);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.75 * scale;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        // Branches
        const branchGeo = new THREE.CylinderGeometry(0.15 * scale, 0.25 * scale, 1.8 * scale, 8);
        const branch1 = new THREE.Mesh(branchGeo, trunkMat);
        branch1.position.set(0.4 * scale, 2.5 * scale, 0);
        branch1.rotation.z = -Math.PI / 4;
        branch1.castShadow = true;
        tree.add(branch1);

        const branch2 = new THREE.Mesh(branchGeo, trunkMat);
        branch2.position.set(-0.4 * scale, 2.2 * scale, 0.2 * scale);
        branch2.rotation.z = Math.PI / 4;
        branch2.rotation.y = Math.PI / 3;
        branch2.castShadow = true;
        tree.add(branch2);

        // Feuillages denses réalistes en grappes volumétriques
        const leavesMat = new THREE.MeshStandardMaterial({
            color: 0x2d6a2f,
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true
        });

        const addLeafCluster = (x, y, z, r) => {
            const clusterGeo = new THREE.DodecahedronGeometry(r * scale, 1);
            const cluster = new THREE.Mesh(clusterGeo, leavesMat);
            cluster.position.set(x * scale, y * scale, z * scale);
            cluster.castShadow = true;
            cluster.receiveShadow = true;
            tree.add(cluster);
        };

        addLeafCluster(0, 4.2, 0, 1.8);
        addLeafCluster(0.8, 3.8, 0.6, 1.3);
        addLeafCluster(-0.8, 3.6, -0.6, 1.4);
        addLeafCluster(-0.6, 4.0, 0.8, 1.2);
        addLeafCluster(0.6, 4.3, -0.7, 1.3);
        addLeafCluster(0, 5.2, 0, 1.2);

        return tree;
    }

    // 2. VRAI SAPIN DE FORÊT (Conifère à étages)
    static createPineTree(scale = 1) {
        const tree = new THREE.Group();

        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9 });
        const trunkGeo = new THREE.CylinderGeometry(0.25 * scale, 0.45 * scale, 2.5 * scale, 10);
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.25 * scale;
        trunk.castShadow = true;
        tree.add(trunk);

        const pineMat = new THREE.MeshStandardMaterial({
            color: 0x1e4620,
            roughness: 0.85,
            flatShading: true
        });

        // 4 étages coniques
        const layers = [
            { y: 2.2, r: 2.2, h: 2.0 },
            { y: 3.4, r: 1.8, h: 1.8 },
            { y: 4.5, r: 1.3, h: 1.6 },
            { y: 5.5, r: 0.8, h: 1.4 }
        ];

        layers.forEach(({ y, r, h }) => {
            const coneGeo = new THREE.ConeGeometry(r * scale, h * scale, 8);
            const cone = new THREE.Mesh(coneGeo, pineMat);
            cone.position.y = y * scale;
            cone.castShadow = true;
            cone.receiveShadow = true;
            tree.add(cone);
        });

        return tree;
    }

    // 3. VRAIE VOITURE URBAINE RÉALISTE (Châssis, habitacle, 4 roues, phares, pare-brise)
    static createCar(bodyColor = 0x2563eb) {
        const car = new THREE.Group();

        // Carrosserie inférieure
        const bodyMat = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.3,
            metalness: 0.8
        });

        const bodyGeo = new THREE.BoxGeometry(2.1, 0.65, 4.4);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.65;
        body.castShadow = true;
        body.receiveShadow = true;
        car.add(body);

        // Habitacle & Vitres
        const cabinMat = new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            roughness: 0.1,
            metalness: 0.9
        });
        const cabinGeo = new THREE.BoxGeometry(1.85, 0.7, 2.4);
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 1.25, -0.2);
        cabin.castShadow = true;
        car.add(cabin);

        // Pare-brise biseauté avant
        const windshieldGeo = new THREE.PlaneGeometry(1.8, 0.8);
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.7
        });
        const windshield = new THREE.Mesh(windshieldGeo, glassMat);
        windshield.position.set(0, 1.2, 1.05);
        windshield.rotation.x = Math.PI / 4;
        car.add(windshield);

        // 4 Roues en caoutchouc avec jantes
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.2 });

        const wheelPositions = [
            [-1.1, 0.4, 1.3],
            [1.1, 0.4, 1.3],
            [-1.1, 0.4, -1.3],
            [1.1, 0.4, -1.3]
        ];

        wheelPositions.forEach(([wx, wy, wz]) => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(wx, wy, wz);

            const tireGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
            tireGeo.rotateZ(Math.PI / 2);
            const tire = new THREE.Mesh(tireGeo, tireMat);
            tire.castShadow = true;
            wheelGroup.add(tire);

            const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 12);
            rimGeo.rotateZ(Math.PI / 2);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            wheelGroup.add(rim);

            car.add(wheelGroup);
        });

        // Phares avant (blancs/jaunes)
        const lightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
        const hlLeft = new THREE.Mesh(lightGeo, lightMat);
        hlLeft.position.set(-0.7, 0.7, 2.2);
        car.add(hlLeft);

        const hlRight = new THREE.Mesh(lightGeo, lightMat);
        hlRight.position.set(0.7, 0.7, 2.2);
        car.add(hlRight);

        // Feux arrière (rouges)
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
        const tlLeft = new THREE.Mesh(lightGeo, tailMat);
        tlLeft.position.set(-0.7, 0.7, -2.2);
        car.add(tlLeft);

        const tlRight = new THREE.Mesh(lightGeo, tailMat);
        tlRight.position.set(0.7, 0.7, -2.2);
        car.add(tlRight);

        return car;
    }

    // 4. VRAI LAMPADAIRE DE RUE URBAIN
    static createStreetLamp() {
        const lamp = new THREE.Group();

        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.85,
            roughness: 0.3
        });

        // Poteau vertical
        const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 5.5, 12);
        const pole = new THREE.Mesh(poleGeo, metalMat);
        pole.position.y = 2.75;
        pole.castShadow = true;
        lamp.add(pole);

        // Bras courbé
        const armGeo = new THREE.CylinderGeometry(0.08, 0.08, 1.4, 8);
        armGeo.rotateZ(Math.PI / 3);
        const arm = new THREE.Mesh(armGeo, metalMat);
        arm.position.set(0.5, 5.3, 0);
        lamp.add(arm);

        // Lanterne
        const lanternGeo = new THREE.ConeGeometry(0.35, 0.4, 8);
        lanternGeo.rotateX(Math.PI);
        const lantern = new THREE.Mesh(lanternGeo, metalMat);
        lantern.position.set(1.0, 5.4, 0);
        lamp.add(lantern);

        // Ampoule lumineuse
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xfef08a })
        );
        bulb.position.set(1.0, 5.2, 0);
        lamp.add(bulb);

        const spot = new THREE.PointLight(0xfef08a, 3.0, 18, 1.5);
        spot.position.set(1.0, 5.0, 0);
        lamp.add(spot);

        return lamp;
    }

    // 5. VRAIE MAISON / BÂTIMENT AVEC TOIT EN PENTE & PORTE
    static createHouse(w = 8, h = 5, d = 9, wallColor = 0xb91c1c, roofColor = 0x1c1917) {
        const house = new THREE.Group();

        // Corps du bâtiment
        const wallsMat = new THREE.MeshStandardMaterial({
            color: wallColor,
            roughness: 0.8,
            metalness: 0.1
        });
        const wallsGeo = new THREE.BoxGeometry(w, h, d);
        const walls = new THREE.Mesh(wallsGeo, wallsMat);
        walls.position.y = h / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        house.add(walls);

        // Toit à deux pans (Gable Roof)
        const roofMat = new THREE.MeshStandardMaterial({
            color: roofColor,
            roughness: 0.7,
            metalness: 0.2
        });
        const roofGeo = new THREE.ConeGeometry(Math.max(w, d) * 0.75, 3.2, 4);
        roofGeo.rotateY(Math.PI / 4);
        const roof = new THREE.Mesh(roofGeo, roofMat);
        roof.position.y = h + 1.6;
        roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
        roof.castShadow = true;
        house.add(roof);

        // Porte d'entrée
        const doorMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
        const doorGeo = new THREE.BoxGeometry(1.6, 2.6, 0.2);
        const door = new THREE.Mesh(doorGeo, doorMat);
        door.position.set(0, 1.3, d / 2 + 0.1);
        house.add(door);

        // Fenêtres
        const winMat = new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.1,
            metalness: 0.9
        });
        const winGeo = new THREE.BoxGeometry(1.4, 1.6, 0.15);

        const win1 = new THREE.Mesh(winGeo, winMat);
        win1.position.set(-w / 4, h * 0.65, d / 2 + 0.1);
        house.add(win1);

        const win2 = new THREE.Mesh(winGeo, winMat);
        win2.position.set(w / 4, h * 0.65, d / 2 + 0.1);
        house.add(win2);

        // Cheminée
        const chimMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });
        const chimGeo = new THREE.BoxGeometry(0.9, 2.5, 0.9);
        const chimney = new THREE.Mesh(chimGeo, chimMat);
        chimney.position.set(w / 3, h + 2.2, -d / 4);
        chimney.castShadow = true;
        house.add(chimney);

        return house;
    }

    // 6. VRAI ROCHER GÉOLOGIQUE NATUREL 3D (Forme facettée et irrégulière)
    static createNaturalRock(size = 3) {
        const geo = new THREE.DodecahedronGeometry(size, 1);
        // Déformation des sommets pour créer une roche naturelle asymétrique
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            pos.setXYZ(
                i,
                vx * (1 + (Math.sin(vx * 4) + Math.cos(vy * 3)) * 0.15),
                vy * (1 + (Math.sin(vy * 5) + Math.cos(vz * 2)) * 0.15),
                vz * (1 + (Math.cos(vz * 4) + Math.sin(vx * 3)) * 0.15)
            );
        }
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0x64748b,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true
        });

        const rock = new THREE.Mesh(geo, mat);
        rock.castShadow = true;
        rock.receiveShadow = true;
        return rock;
    }

    // 7. ROCHE VOLCANIQUE AVEC MAGMA INCANDESCENT (Plateforme de saut volcanique)
    static createVolcanicRock(size = 3) {
        const geo = new THREE.DodecahedronGeometry(size, 1);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            pos.setXYZ(
                i,
                vx * (1 + Math.sin(vx * 5) * 0.18),
                vy * 0.8, // aplati pour faire plateforme de saut
                vz * (1 + Math.cos(vz * 5) * 0.18)
            );
        }
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0x1c1917,
            roughness: 0.85,
            metalness: 0.2,
            flatShading: true,
            emissive: new THREE.Color(0xb91c1c),
            emissiveIntensity: 0.3
        });

        const vRock = new THREE.Mesh(geo, mat);
        vRock.castShadow = true;
        vRock.receiveShadow = true;
        return vRock;
    }
}

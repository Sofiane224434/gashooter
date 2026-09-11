import * as THREE from 'three';

// Constructeur d'armes 3D réalistes haute précision (Assault Rifle, Sniper, Shotgun, Pistol, Plasma Cannon)
export class WeaponBuilder {
    // 1. FUSIL D'ASSAUT TACTIQUE (M4 / AR-15 Style)
    static createAssaultRifle() {
        const gun = new THREE.Group();

        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.25, metalness: 0.9 });
        const gunMetal = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.35, metalness: 0.8 });
        const polymerMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.8, metalness: 0.1 });
        const sightGlow = new THREE.MeshBasicMaterial({ color: 0xef4444 });

        // Corps / Récepteur principal
        const receiverGeo = new THREE.BoxGeometry(0.12, 0.18, 0.65);
        const receiver = new THREE.Mesh(receiverGeo, darkMetal);
        receiver.position.set(0.24, -0.22, -0.45);
        gun.add(receiver);

        // Canon long rayé
        const barrelGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.6, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, darkMetal);
        barrel.position.set(0.24, -0.18, -0.85);
        gun.add(barrel);

        // Cache-flamme / Frein de bouche
        const muzzleGeo = new THREE.CylinderGeometry(0.035, 0.03, 0.1, 12);
        muzzleGeo.rotateX(Math.PI / 2);
        const muzzle = new THREE.Mesh(muzzleGeo, gunMetal);
        muzzle.position.set(0.24, -0.18, -1.18);
        gun.add(muzzle);

        // Garde-main texturé (Handguard)
        const guardGeo = new THREE.BoxGeometry(0.14, 0.15, 0.45);
        const guard = new THREE.Mesh(guardGeo, polymerMat);
        guard.position.set(0.24, -0.19, -0.72);
        gun.add(guard);

        // Chargeur courbé détachable (30 rounds magazine)
        const magGeo = new THREE.BoxGeometry(0.08, 0.38, 0.18);
        const mag = new THREE.Mesh(magGeo, gunMetal);
        mag.position.set(0.24, -0.42, -0.45);
        mag.rotation.x = Math.PI / 10;
        gun.add(mag);

        // Poignée pistolet ergonomique
        const gripGeo = new THREE.BoxGeometry(0.09, 0.28, 0.12);
        const grip = new THREE.Mesh(gripGeo, polymerMat);
        grip.position.set(0.24, -0.38, -0.25);
        grip.rotation.x = -Math.PI / 6;
        gun.add(grip);

        // Crosse télescopique arrière
        const stockGeo = new THREE.BoxGeometry(0.1, 0.22, 0.35);
        const stock = new THREE.Mesh(stockGeo, polymerMat);
        stock.position.set(0.24, -0.19, -0.05);
        gun.add(stock);

        // Viseur Holographique / Point Rouge (Red Dot Sight)
        const sightBaseGeo = new THREE.BoxGeometry(0.09, 0.08, 0.2);
        const sightBase = new THREE.Mesh(sightBaseGeo, darkMetal);
        sightBase.position.set(0.24, -0.09, -0.45);
        gun.add(sightBase);

        const sightLensGeo = new THREE.RingGeometry(0.02, 0.045, 16);
        const sightLens = new THREE.Mesh(sightLensGeo, sightGlow);
        sightLens.position.set(0.24, -0.05, -0.52);
        gun.add(sightLens);

        return gun;
    }

    // 2. FUSIL DE PRÉCISION / SNIPER À LUNETTE (AWM / Heavy Sniper)
    static createSniperRifle() {
        const gun = new THREE.Group();

        const oliveDrab = new THREE.MeshStandardMaterial({ color: 0x3f4f38, roughness: 0.6, metalness: 0.3 });
        const blackSteel = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.2, metalness: 0.95 });
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.8 });

        // Châssis principal lourd
        const bodyGeo = new THREE.BoxGeometry(0.14, 0.16, 0.85);
        const body = new THREE.Mesh(bodyGeo, oliveDrab);
        body.position.set(0.25, -0.22, -0.4);
        gun.add(body);

        // Très long canon de sniper lourd
        const barrelGeo = new THREE.CylinderGeometry(0.028, 0.035, 1.1, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, blackSteel);
        barrel.position.set(0.25, -0.17, -1.2);
        gun.add(barrel);

        // Frein de bouche massif
        const brakeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.16);
        const brake = new THREE.Mesh(brakeGeo, blackSteel);
        brake.position.set(0.25, -0.17, -1.78);
        gun.add(brake);

        // Grande Lunette Optique de Précision (High-Power Scope)
        const scopeGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.55, 16);
        scopeGeo.rotateX(Math.PI / 2);
        const scope = new THREE.Mesh(scopeGeo, blackSteel);
        scope.position.set(0.25, -0.06, -0.42);
        gun.add(scope);

        // Lentille de lunette
        const lensGeo = new THREE.CircleGeometry(0.048, 16);
        const lens = new THREE.Mesh(lensGeo, glassMat);
        lens.position.set(0.25, -0.06, -0.14);
        gun.add(lens);

        // Poignée & Crosse sniper avec appui-joue
        const stockGeo = new THREE.BoxGeometry(0.11, 0.26, 0.45);
        const stock = new THREE.Mesh(stockGeo, oliveDrab);
        stock.position.set(0.25, -0.19, 0.1);
        gun.add(stock);

        // Bipied pliable avant
        const bipodGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.35, 8);
        const leg1 = new THREE.Mesh(bipodGeo, blackSteel);
        leg1.position.set(0.16, -0.36, -0.95);
        leg1.rotation.z = Math.PI / 6;
        gun.add(leg1);

        const leg2 = new THREE.Mesh(bipodGeo, blackSteel);
        leg2.position.set(0.34, -0.36, -0.95);
        leg2.rotation.z = -Math.PI / 6;
        gun.add(leg2);

        return gun;
    }

    // 3. FUSIL À POMPE LOURD (Tactical Pump Shotgun)
    static createShotgun() {
        const gun = new THREE.Group();

        const matteSteel = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.4, metalness: 0.85 });
        const woodGrip = new THREE.MeshStandardMaterial({ color: 0x5c2b16, roughness: 0.7 });

        // Boîtier de culasse
        const bodyGeo = new THREE.BoxGeometry(0.15, 0.2, 0.55);
        const body = new THREE.Mesh(bodyGeo, matteSteel);
        body.position.set(0.24, -0.22, -0.45);
        gun.add(body);

        // Double canon superposé (Canon de tir + Tube magasin)
        const mainBarrelGeo = new THREE.CylinderGeometry(0.038, 0.038, 0.75, 16);
        mainBarrelGeo.rotateX(Math.PI / 2);
        const mainBarrel = new THREE.Mesh(mainBarrelGeo, matteSteel);
        mainBarrel.position.set(0.24, -0.16, -0.85);
        gun.add(mainBarrel);

        const tubeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.65, 16);
        tubeGeo.rotateX(Math.PI / 2);
        const tube = new THREE.Mesh(tubeGeo, matteSteel);
        tube.position.set(0.24, -0.24, -0.8);
        gun.add(tube);

        // Pompe avant mobile en bois/polymère (Pump action slide)
        const pumpGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.28, 16);
        pumpGeo.rotateX(Math.PI / 2);
        const pump = new THREE.Mesh(pumpGeo, woodGrip);
        pump.position.set(0.24, -0.24, -0.75);
        gun.add(pump);

        // Crosse arrière solide en bois
        const stockGeo = new THREE.BoxGeometry(0.11, 0.22, 0.45);
        const stock = new THREE.Mesh(stockGeo, woodGrip);
        stock.position.set(0.24, -0.24, -0.05);
        stock.rotation.x = -Math.PI / 18;
        gun.add(stock);

        return gun;
    }

    // 4. PISTOLET TACTIQUE SEMI-AUTO (Tactical Combat Pistol)
    static createPistol() {
        const gun = new THREE.Group();

        const slideSteel = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.2, metalness: 0.95 });
        const gripPolymer = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
        const greenTritium = new THREE.MeshBasicMaterial({ color: 0x10b981 });

        // Culasse mobile supérieure (Slide)
        const slideGeo = new THREE.BoxGeometry(0.1, 0.11, 0.42);
        const slide = new THREE.Mesh(slideGeo, slideSteel);
        slide.position.set(0.22, -0.18, -0.42);
        gun.add(slide);

        // Canon émergeant
        const barrelGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, slideSteel);
        barrel.position.set(0.22, -0.18, -0.66);
        gun.add(barrel);

        // Poignée avec grip texturé
        const gripGeo = new THREE.BoxGeometry(0.085, 0.28, 0.12);
        const grip = new THREE.Mesh(gripGeo, gripPolymer);
        grip.position.set(0.22, -0.32, -0.32);
        grip.rotation.x = -Math.PI / 7;
        gun.add(grip);

        // Pontet & Détente
        const guardGeo = new THREE.BoxGeometry(0.04, 0.1, 0.12);
        const guard = new THREE.Mesh(guardGeo, slideSteel);
        guard.position.set(0.22, -0.27, -0.42);
        gun.add(guard);

        // Viseur Tritium nocturne vert
        const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 8), greenTritium);
        sightDot.position.set(0.22, -0.12, -0.62);
        gun.add(sightDot);

        return gun;
    }

    // 5. LANCE-PLASMA LOURD (Heavy Sci-Fi Plasma Blaster)
    static createPlasmaCannon() {
        const gun = new THREE.Group();

        const titanMetal = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.9 });
        const plasmaCore = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
        const neonAccent = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

        // Corps lourd blindé
        const bodyGeo = new THREE.BoxGeometry(0.18, 0.22, 0.65);
        const body = new THREE.Mesh(bodyGeo, titanMetal);
        body.position.set(0.25, -0.22, -0.45);
        gun.add(body);

        // Chambre de confinement de plasma luminescente
        const chamberGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.3, 16);
        chamberGeo.rotateX(Math.PI / 2);
        const chamber = new THREE.Mesh(chamberGeo, plasmaCore);
        chamber.position.set(0.25, -0.17, -0.45);
        gun.add(chamber);

        // Double canon à impulsion
        const b1Geo = new THREE.CylinderGeometry(0.03, 0.03, 0.5, 12);
        b1Geo.rotateX(Math.PI / 2);
        const b1 = new THREE.Mesh(b1Geo, titanMetal);
        b1.position.set(0.21, -0.18, -0.85);
        gun.add(b1);

        const b2 = new THREE.Mesh(b1Geo, titanMetal);
        b2.position.set(0.29, -0.18, -0.85);
        gun.add(b2);

        // Anneaux d'accélération magnétique néon
        const ringGeo = new THREE.TorusGeometry(0.09, 0.018, 12, 24);
        const r1 = new THREE.Mesh(ringGeo, neonAccent);
        r1.position.set(0.25, -0.18, -0.85);
        gun.add(r1);

        const r2 = new THREE.Mesh(ringGeo, neonAccent);
        r2.position.set(0.25, -0.18, -1.02);
        gun.add(r2);

        return gun;
    }
}

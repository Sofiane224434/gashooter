import * as THREE from 'three';

// Générateur de textures PBR réalistes pour environnements du monde réel (Plaine, Volcan, Ville)
export class PBRTextureGenerator {
    // 1. PLAINE NATURELLE : Herbe verte avec terre, mousse et détails organiques
    static createGrassTerrainMaterial(repeatX = 18, repeatY = 18) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Fond terre / humus riche
        ctx.fillStyle = '#1e3a1e';
        ctx.fillRect(0, 0, size, size);

        // Brins d'herbe et variations de vert naturel réaliste
        for (let i = 0; i < 6000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 4 + 1;
            const greenShades = ['#2d5a27', '#3e7b32', '#4d933e', '#1f441b', '#5ba84a', '#84532b'];
            ctx.fillStyle = greenShades[Math.floor(Math.random() * greenShades.length)];
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        // Pâquerettes / petites fleurs sauvages blanches et jaunes discrètes
        for (let i = 0; i < 40; i++) {
            const fx = Math.random() * size;
            const fy = Math.random() * size;
            ctx.fillStyle = Math.random() > 0.3 ? '#f8fafc' : '#facc15';
            ctx.beginPath();
            ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.95,
            metalness: 0.05
        });
    }

    // 2. VOLCAN : Basalte noir craquelé avec magma incandescent en fusion
    static createVolcanoTerrainMaterial(repeatX = 16, repeatY = 16) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Roches volcaniques noires / charbon
        ctx.fillStyle = '#0f0f12';
        ctx.fillRect(0, 0, size, size);

        // Grains de cendre et d'obsidienne
        for (let i = 0; i < 3000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillStyle = Math.random() > 0.5 ? '#1c1917' : '#292524';
            ctx.fillRect(x, y, 3, 3);
        }

        // Fissures de lave incandescente
        const drawLavaCrack = (startX, startY, len) => {
            let cx = startX;
            let cy = startY;
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            for (let i = 0; i < len; i++) {
                cx += (Math.random() - 0.5) * 40;
                cy += (Math.random() - 0.5) * 40;
                ctx.lineTo(cx, cy);
            }
            ctx.stroke();

            // Cœur jaune éclatant de la lave
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        drawLavaCrack(60, 60, 6);
        drawLavaCrack(300, 150, 7);
        drawLavaCrack(180, 380, 8);
        drawLavaCrack(400, 350, 6);

        // Emissive Canvas pour faire briller la lave
        const emCanvas = document.createElement('canvas');
        emCanvas.width = size;
        emCanvas.height = size;
        const eCtx = emCanvas.getContext('2d');
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(0, 0, size, size);
        eCtx.drawImage(colorCanvas, 0, 0);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        const emTex = new THREE.CanvasTexture(emCanvas);

        [colorTex, emTex].forEach((tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX, repeatY);
        });

        colorTex.colorSpace = THREE.SRGBColorSpace;
        emTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.9,
            metalness: 0.1,
            emissiveMap: emTex,
            emissive: new THREE.Color(0xd97706),
            emissiveIntensity: 0.6
        });
    }

    // 3. VILLE : Asphalte réaliste de route avec marquages au sol blancs / jaunes
    static createCityAsphaltMaterial(repeatX = 14, repeatY = 14) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Goudron noir / gris foncé texturé
        ctx.fillStyle = '#27272a';
        ctx.fillRect(0, 0, size, size);

        // Granulats du bitume
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillStyle = Math.random() > 0.5 ? '#3f3f46' : '#18181b';
            ctx.fillRect(x, y, 2, 2);
        }

        // Lignes blanches de signalisation routière discontinue
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(size / 2 - 8, 40, 16, 120);
        ctx.fillRect(size / 2 - 8, 240, 16, 120);
        ctx.fillRect(size / 2 - 8, 440, 16, 120);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.85,
            metalness: 0.1
        });
    }

    // 4. Bâtiments urbains réalistes : Murs de briques rouges & béton
    static createCityBuildingMaterial(repeatX = 4, repeatY = 4) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#7f1d1d'; // Fond brique rouge sombre
        ctx.fillRect(0, 0, size, size);

        // Joints de ciment et briques
        const brickH = 24;
        const brickW = 48;
        let row = 0;
        for (let y = 0; y < size; y += brickH) {
            const offsetX = (row % 2 === 0) ? 0 : brickW / 2;
            for (let x = -brickW; x < size + brickW; x += brickW) {
                ctx.fillStyle = (Math.random() > 0.4) ? '#991b1b' : '#b91c1c';
                ctx.fillRect(x + offsetX + 2, y + 2, brickW - 4, brickH - 4);
            }
            row++;
        }

        // Fenêtres de ville réalistes
        ctx.fillStyle = '#0f172a';
        for (let wy = 40; wy < size - 40; wy += 90) {
            for (let wx = 40; wx < size - 40; wx += 80) {
                ctx.fillRect(wx, wy, 36, 48);
                // Reflet vitré bleu ciel
                ctx.fillStyle = '#38bdf8';
                ctx.fillRect(wx + 4, wy + 4, 12, 18);
                ctx.fillStyle = '#0f172a';
            }
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.8,
            metalness: 0.15
        });
    }

    // 5. Rochers naturels & Pierres de montagne
    static createNaturalRockMaterial() {
        const size = 256;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#52525b';
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 2000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillStyle = Math.random() > 0.5 ? '#71717a' : '#3f3f46';
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 4 + 1, 0, Math.PI * 2);
            ctx.fill();
        }

        // Mousse verte sur les rochers
        ctx.fillStyle = '#365314';
        for (let i = 0; i < 300; i++) {
            ctx.fillRect(Math.random() * size, Math.random() * (size / 3), 4, 4);
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.9,
            metalness: 0.1
        });
    }

    // 6. Bois naturel / Troncs d'arbres
    static createWoodMaterial() {
        const size = 256;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#78350f'; // Écorce brune
        ctx.fillRect(0, 0, size, size);

        // Rainures du bois
        ctx.fillStyle = '#451a03';
        for (let y = 0; y < size; y += 6) {
            ctx.fillRect(0, y, size, 2);
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.85,
            metalness: 0.05
        });
    }
}

import * as THREE from 'three';

// Générateur de textures PBR procédurales seamless haute définition (sans aucun temps de chargement réseau)
export class PBRTextureGenerator {
    static createSciFiFloorMaterial(repeatX = 25, repeatY = 25) {
        const size = 512;
        
        // 1. Color Canvas
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Fond métal sombre
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size, size);

        // Dalles métalliques
        const tileSize = size / 4;
        for (let x = 0; x < size; x += tileSize) {
            for (let y = 0; y < size; y += tileSize) {
                // Plaque
                ctx.fillStyle = ( (x / tileSize + y / tileSize) % 2 === 0 ) ? '#172033' : '#131b2e';
                ctx.fillRect(x + 4, y + 4, tileSize - 8, tileSize - 8);

                // Bordure biseautée
                ctx.strokeStyle = '#334155';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 5, y + 5, tileSize - 10, tileSize - 10);

                // Rivets aux 4 coins
                ctx.fillStyle = '#64748b';
                const rivets = [
                    [x + 12, y + 12],
                    [x + tileSize - 12, y + 12],
                    [x + 12, y + tileSize - 12],
                    [x + tileSize - 12, y + tileSize - 12]
                ];
                rivets.forEach(([rx, ry]) => {
                    ctx.beginPath();
                    ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
                    ctx.fill();
                });
            }
        }

        // Conduits d'énergie néon
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, size / 2);
        ctx.lineTo(size, size / 2);
        ctx.moveTo(size / 2, 0);
        ctx.lineTo(size / 2, size);
        ctx.stroke();

        // 2. Normal Canvas (Calcul de relief PBR)
        const normalCanvas = document.createElement('canvas');
        normalCanvas.width = size;
        normalCanvas.height = size;
        const nCtx = normalCanvas.getContext('2d');
        nCtx.fillStyle = 'rgb(128, 128, 255)'; // Normal plane
        nCtx.fillRect(0, 0, size, size);

        for (let x = 0; x < size; x += tileSize) {
            for (let y = 0; y < size; y += tileSize) {
                // Reliefs des bords de dalles
                nCtx.fillStyle = 'rgb(160, 128, 240)'; // Pente gauche
                nCtx.fillRect(x + 4, y + 4, 3, tileSize - 8);
                nCtx.fillStyle = 'rgb(96, 128, 240)'; // Pente droite
                nCtx.fillRect(x + tileSize - 7, y + 4, 3, tileSize - 8);
                nCtx.fillStyle = 'rgb(128, 160, 240)'; // Pente haut
                nCtx.fillRect(x + 4, y + 4, tileSize - 8, 3);
                nCtx.fillStyle = 'rgb(128, 96, 240)'; // Pente bas
                nCtx.fillRect(x + 4, y + tileSize - 7, tileSize - 8, 3);
            }
        }

        // 3. Roughness Canvas
        const roughCanvas = document.createElement('canvas');
        roughCanvas.width = size;
        roughCanvas.height = size;
        const rCtx = roughCanvas.getContext('2d');
        rCtx.fillStyle = '#666666'; // Métal semi-brillant
        rCtx.fillRect(0, 0, size, size);
        // Rainures plus mates
        rCtx.fillStyle = '#111111';
        for (let x = 0; x < size; x += tileSize) {
            rCtx.fillRect(x, 0, 4, size);
        }
        for (let y = 0; y < size; y += tileSize) {
            rCtx.fillRect(0, y, size, 4);
        }

        // 4. Emissive Canvas (Lueur des néons au sol)
        const emCanvas = document.createElement('canvas');
        emCanvas.width = size;
        emCanvas.height = size;
        const eCtx = emCanvas.getContext('2d');
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(0, 0, size, size);
        eCtx.strokeStyle = '#10b981';
        eCtx.lineWidth = 3;
        eCtx.beginPath();
        eCtx.moveTo(0, size / 2);
        eCtx.lineTo(size, size / 2);
        eCtx.moveTo(size / 2, 0);
        eCtx.lineTo(size / 2, size);
        eCtx.stroke();

        // Conversion en Textures Three.js
        const colorTex = new THREE.CanvasTexture(colorCanvas);
        const normalTex = new THREE.CanvasTexture(normalCanvas);
        const roughTex = new THREE.CanvasTexture(roughCanvas);
        const emTex = new THREE.CanvasTexture(emCanvas);

        [colorTex, normalTex, roughTex, emTex].forEach((tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(repeatX, repeatY);
        });

        colorTex.colorSpace = THREE.SRGBColorSpace;
        emTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            normalMap: normalTex,
            normalScale: new THREE.Vector2(1.2, 1.2),
            roughnessMap: roughTex,
            roughness: 0.4,
            metalness: 0.6,
            emissiveMap: emTex,
            emissive: new THREE.Color(0x10b981),
            emissiveIntensity: 0.8
        });
    }

    static createWallMaterial(repeatX = 10, repeatY = 2) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Panneau composite de bunker
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, size, size);

        // Plaques verticales de blindage
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(16, 16, size - 32, size - 32);

        // Lignes de ventilation sci-fi
        ctx.fillStyle = '#020617';
        for (let y = 60; y < size - 60; y += 24) {
            ctx.fillRect(40, y, size - 80, 10);
        }

        // Bande de signalisation de sécurité
        ctx.fillStyle = '#eab308';
        ctx.fillRect(0, size - 24, size, 24);
        ctx.fillStyle = '#000000';
        for (let x = -20; x < size + 40; x += 30) {
            ctx.beginPath();
            ctx.moveTo(x, size);
            ctx.lineTo(x + 15, size);
            ctx.lineTo(x + 30, size - 24);
            ctx.lineTo(x + 15, size - 24);
            ctx.fill();
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.5,
            metalness: 0.4
        });
    }

    static createCrateMaterial() {
        const size = 256;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        // Caisse métallique militaire sci-fi
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, 0, size, size);

        // Centre renforcé
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(16, 16, size - 32, size - 32);

        // Logo toxique / Gas
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.strokeRect(32, 32, size - 64, size - 64);

        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('GAS-X7', size / 2, size / 2);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.35,
            metalness: 0.7
        });
    }
}

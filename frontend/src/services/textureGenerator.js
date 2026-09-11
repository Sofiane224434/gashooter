import * as THREE from 'three';

// Générateur de textures PBR avancées pour les différentes zones thématiques
export class PBRTextureGenerator {
    // 1. Sol Hangar Militaire / Industriel (Dalles d'acier avec grille et rivets)
    static createIndustrialMetalMaterial(repeatX = 20, repeatY = 20) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, size, size);

        // Motifs de tôles larmées / dalles industrielles
        const tileSize = size / 4;
        for (let x = 0; x < size; x += tileSize) {
            for (let y = 0; y < size; y += tileSize) {
                ctx.fillStyle = ( (x/tileSize + y/tileSize) % 2 === 0 ) ? '#334155' : '#273549';
                ctx.fillRect(x + 3, y + 3, tileSize - 6, tileSize - 6);
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 4, y + 4, tileSize - 8, tileSize - 8);

                // Grips métalliques
                ctx.fillStyle = '#64748b';
                for (let gx = x + 16; gx < x + tileSize - 16; gx += 20) {
                    for (let gy = y + 16; gy < y + tileSize - 16; gy += 20) {
                        ctx.fillRect(gx, gy, 8, 3);
                    }
                }
            }
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.45,
            metalness: 0.65
        });
    }

    // 2. Sol Laboratoire & Réacteur Toxique (Hexagones carbones + conduits verts)
    static createToxicFloorMaterial(repeatX = 15, repeatY = 15) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, size, size);

        // Trame hexagonale
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        for (let x = 0; x < size; x += 64) {
            for (let y = 0; y < size; y += 64) {
                ctx.strokeRect(x, y, 60, 60);
            }
        }

        // Conduits de gaz bio-luminescents
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 120, 0, Math.PI * 2);
        ctx.moveTo(0, size / 2);
        ctx.lineTo(size, size / 2);
        ctx.stroke();

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.25,
            metalness: 0.8,
            emissive: new THREE.Color(0x059669),
            emissiveIntensity: 0.3
        });
    }

    // 3. Sol Surface Lunaire / Canyon Extérieur (Roches sombres)
    static createLunarRockMaterial(repeatX = 25, repeatY = 25) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, size, size);

        // Bruit procédural de roche
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const r = Math.random() * 3 + 1;
            ctx.fillStyle = Math.random() > 0.5 ? '#27272a' : '#09090b';
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.wrapS = THREE.RepeatWrapping;
        colorTex.wrapT = THREE.RepeatWrapping;
        colorTex.repeat.set(repeatX, repeatY);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.9,
            metalness: 0.1
        });
    }

    // 4. Plateformes d'énergie & Caillebotis métallique (Parkour / Saut)
    static createPlatformGrateMaterial() {
        const size = 256;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, size, size);

        // Grille jaune et noire avec bordure lumineuse cyan
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 6;
        ctx.strokeRect(4, 4, size - 8, size - 8);

        // Flèches d'impulsion de saut
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(size / 2, 40);
        ctx.lineTo(size / 2 + 40, 100);
        ctx.lineTo(size / 2 - 40, 100);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(size / 2, 110);
        ctx.lineTo(size / 2 + 40, 170);
        ctx.lineTo(size / 2 - 40, 170);
        ctx.closePath();
        ctx.fill();

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.3,
            metalness: 0.7,
            emissive: new THREE.Color(0x0284c7),
            emissiveIntensity: 0.4
        });
    }

    // 5. Conteneur Maritime Sci-Fi (Grand conteneur de transport)
    static createContainerMaterial(color = '#0284c7', label = 'CARGO-01') {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);

        // Ondulations du conteneur
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        for (let x = 0; x < size; x += 32) {
            ctx.fillRect(x, 0, 14, size);
        }

        // Bordure métallique sombre
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 12;
        ctx.strokeRect(6, 6, size - 12, size - 12);

        // Texte / Numéro
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, size / 2, size / 2);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.5,
            metalness: 0.5
        });
    }

    // 6. Cuve & Réservoir de Gaz Bio-chimique
    static createBioTankMaterial() {
        const size = 256;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#10b981';
        ctx.fillRect(0, 0, size, size);

        // Indicateurs de niveau
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, size, 40);
        ctx.fillRect(0, size - 40, size, 40);

        ctx.fillStyle = '#a7f3d0';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ TOXIC BIO-GAS ⚡', size / 2, size / 2);

        const colorTex = new THREE.CanvasTexture(colorCanvas);
        colorTex.colorSpace = THREE.SRGBColorSpace;

        return new THREE.MeshStandardMaterial({
            map: colorTex,
            roughness: 0.2,
            metalness: 0.8,
            emissive: new THREE.Color(0x10b981),
            emissiveIntensity: 0.5
        });
    }

    // 7. Mur Général de la Station
    static createWallMaterial(repeatX = 10, repeatY = 2) {
        const size = 512;
        const colorCanvas = document.createElement('canvas');
        colorCanvas.width = size;
        colorCanvas.height = size;
        const ctx = colorCanvas.getContext('2d');

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = '#0f172a';
        ctx.fillRect(16, 16, size - 32, size - 32);

        // Grilles d'aération
        ctx.fillStyle = '#020617';
        for (let y = 60; y < size - 60; y += 24) {
            ctx.fillRect(40, y, size - 80, 10);
        }

        // Liseré jaune sécurité
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
}

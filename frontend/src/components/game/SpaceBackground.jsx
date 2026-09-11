import { useEffect, useRef } from 'react';

export default function SpaceBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        // 1. Étoiles multi-plans
        const STAR_COUNT = 180;
        const stars = Array.from({ length: STAR_COUNT }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            size: Math.random() * 2 + 0.5,
            speed: Math.random() * 1.5 + 0.2,
            brightness: Math.random() * 0.8 + 0.2,
            twinkleSpeed: Math.random() * 0.03 + 0.01,
            color: Math.random() > 0.4 ? '#00ffcc' : Math.random() > 0.5 ? '#39ff14' : '#ffffff'
        }));

        // 2. Particules de gaz toxique flottantes
        const GAS_COUNT = 25;
        const gasParticles = Array.from({ length: GAS_COUNT }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: Math.random() * 90 + 40,
            vx: (Math.random() - 0.5) * 0.4,
            vy: Math.random() * 0.3 + 0.1,
            alpha: Math.random() * 0.12 + 0.04,
            hue: Math.random() > 0.5 ? 140 : 180 // Vert toxique / Cyan
        }));

        // 3. Vaisseaux d'ambiance ou lasers d'arrière-plan
        let laserTimer = 0;
        const lasers = [];

        // Boucle de rendu
        let frame = 0;
        const render = () => {
            frame++;
            ctx.fillStyle = '#05070e';
            ctx.fillRect(0, 0, width, height);

            // A. Rendu des nuages de gaz
            gasParticles.forEach((p) => {
                p.x += p.vx;
                p.y += p.vy;

                if (p.y - p.radius > height) p.y = -p.radius;
                if (p.x - p.radius > width) p.x = -p.radius;
                if (p.x + p.radius < 0) p.x = width + p.radius;

                const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
                grad.addColorStop(0, `hsla(${p.hue}, 100%, 50%, ${p.alpha})`);
                grad.addColorStop(1, 'transparent');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            });

            // B. Rendu de la grille perspective rétro au sol
            ctx.save();
            const gridHorizon = height * 0.68;
            const gridGrad = ctx.createLinearGradient(0, gridHorizon, 0, height);
            gridGrad.addColorStop(0, 'rgba(0, 255, 170, 0)');
            gridGrad.addColorStop(1, 'rgba(0, 255, 170, 0.18)');

            ctx.fillStyle = gridGrad;
            ctx.fillRect(0, gridHorizon, width, height - gridHorizon);

            ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)';
            ctx.lineWidth = 1;

            // Lignes verticales en fuite
            const fovLines = 28;
            for (let i = 0; i <= fovLines; i++) {
                const startX = width * 0.5;
                const endX = (i / fovLines) * (width * 1.8) - width * 0.4;
                ctx.beginPath();
                ctx.moveTo(startX, gridHorizon);
                ctx.lineTo(endX, height);
                ctx.stroke();
            }

            // Lignes horizontales défilantes
            const speedOffset = (frame * 1.2) % 35;
            for (let y = gridHorizon; y < height; y += 18 + (y - gridHorizon) * 0.35) {
                const currentY = y + speedOffset * ((y - gridHorizon) / (height - gridHorizon));
                if (currentY <= height) {
                    ctx.beginPath();
                    ctx.moveTo(0, currentY);
                    ctx.lineTo(width, currentY);
                    ctx.stroke();
                }
            }
            ctx.restore();

            // C. Rendu des étoiles
            stars.forEach((s) => {
                s.y += s.speed;
                if (s.y > height) {
                    s.y = 0;
                    s.x = Math.random() * width;
                }

                s.brightness += Math.sin(frame * s.twinkleSpeed) * 0.05;
                const alpha = Math.max(0.2, Math.min(1, s.brightness));

                ctx.fillStyle = s.color;
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;

            // D. Lasers d'ambiance
            laserTimer++;
            if (laserTimer > 90 && Math.random() > 0.6) {
                laserTimer = 0;
                lasers.push({
                    x: Math.random() * width,
                    y: -40,
                    vy: Math.random() * 12 + 15,
                    length: Math.random() * 40 + 30,
                    color: Math.random() > 0.5 ? '#39ff14' : '#ff0055'
                });
            }

            for (let i = lasers.length - 1; i >= 0; i--) {
                const l = lasers[i];
                l.y += l.vy;
                ctx.strokeStyle = l.color;
                ctx.lineWidth = 2.5;
                ctx.shadowColor = l.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(l.x, l.y);
                ctx.lineTo(l.x, l.y + l.length);
                ctx.stroke();
                ctx.shadowBlur = 0;

                if (l.y > height + 50) {
                    lasers.splice(i, 1);
                }
            }

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', handleResize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ width: '100%', height: '100%' }}
        />
    );
}

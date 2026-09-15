import { useEffect, useRef } from 'react';

export default function SpaceBackground() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let animationFrameId;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        // Étoiles scintillantes
        const stars = Array.from({ length: 120 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.8 + 0.4,
            alpha: Math.random() * 0.7 + 0.3,
            fadeSpeed: (Math.random() * 0.015 + 0.005) * (Math.random() > 0.5 ? 1 : -1)
        }));

        // Étoiles filantes / traînées cosmiques
        const shootingStars = [];
        const spawnShootingStar = () => {
            shootingStars.push({
                x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
                y: Math.random() * canvas.height * 0.5,
                len: Math.random() * 120 + 60,
                speed: Math.random() * 9 + 7,
                angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.012
            });
        };

        let lastShootTime = 0;

        const render = (time) => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Scintillement des étoiles
            stars.forEach((star) => {
                star.alpha += star.fadeSpeed;
                if (star.alpha > 0.95 || star.alpha < 0.2) {
                    star.fadeSpeed = -star.fadeSpeed;
                }

                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.15, star.alpha)})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // Déclenchement périodique d'étoiles filantes
            if (time - lastShootTime > 2400 + Math.random() * 2000) {
                lastShootTime = time;
                spawnShootingStar();
            }

            // Rendu des étoiles filantes
            for (let i = shootingStars.length - 1; i >= 0; i--) {
                const s = shootingStars[i];
                s.life -= s.decay;
                s.x += Math.cos(s.angle) * s.speed;
                s.y += Math.sin(s.angle) * s.speed;

                if (s.life <= 0) {
                    shootingStars.splice(i, 1);
                    continue;
                }

                const tailX = s.x - Math.cos(s.angle) * s.len;
                const tailY = s.y - Math.sin(s.angle) * s.len;

                const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
                grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
                grad.addColorStop(0.7, `rgba(6, 182, 212, ${s.life * 0.7})`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${s.life})`);

                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(tailX, tailY);
                ctx.lineTo(s.x, s.y);
                ctx.stroke();
            }

            animationFrameId = requestAnimationFrame(render);
        };

        animationFrameId = requestAnimationFrame(render);

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
            {/* Image de fond nébuleuse cosmique avec planète et station spatiale */}
            <div
                className="absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-1000"
                style={{
                    backgroundImage: "url('/assets/img/space_menu_bg.jpg')",
                    backgroundColor: '#070a12'
                }}
            />
            {/* Overlay subtil de vignettage et profondeur */}
            <div className="absolute inset-0 bg-radial from-transparent via-slate-950/20 to-slate-950/70" />

            {/* Canvas pour les étoiles animées et étoiles filantes */}
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
            />
        </div>
    );
}

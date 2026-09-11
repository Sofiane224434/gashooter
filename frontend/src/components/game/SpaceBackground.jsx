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

        // Particules étoiles calmes et subtiles
        const stars = Array.from({ length: 90 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 1.5 + 0.5,
            speed: Math.random() * 0.25 + 0.05,
            alpha: Math.random() * 0.7 + 0.3,
            fadeSpeed: (Math.random() * 0.01 + 0.003) * (Math.random() > 0.5 ? 1 : -1)
        }));

        const render = () => {
            ctx.fillStyle = '#090b10';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Dégradé d'ambiance sombre au centre
            const gradient = ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height / 2,
                50,
                canvas.width / 2,
                canvas.height / 2,
                Math.max(canvas.width, canvas.height) / 1.2
            );
            gradient.addColorStop(0, 'rgba(15, 23, 42, 0.6)');
            gradient.addColorStop(1, 'rgba(5, 7, 10, 0.95)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Dessin des étoiles douces
            stars.forEach((star) => {
                star.y -= star.speed;
                if (star.y < 0) {
                    star.y = canvas.height;
                    star.x = Math.random() * canvas.width;
                }

                star.alpha += star.fadeSpeed;
                if (star.alpha > 0.9 || star.alpha < 0.2) {
                    star.fadeSpeed = -star.fadeSpeed;
                }

                ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, star.alpha)})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none z-0"
        />
    );
}

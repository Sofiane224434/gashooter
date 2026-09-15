import { useState, useEffect } from 'react';
import SpaceBackground from '../components/game/SpaceBackground.jsx';
import SettingsModal from '../components/game/SettingsModal.jsx';
import CreditsModal from '../components/game/CreditsModal.jsx';
import FirstPersonMap from '../components/game/FirstPersonMap.jsx';

export default function GameMenu() {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeModal, setActiveModal] = useState(null); // 'settings', 'credits', 'newgame', 'continue', 'quit'
    const [gameStarted, setGameStarted] = useState(false);
    const [gameMode, setGameMode] = useState('multiplayer'); // 'multiplayer' | 'training'

    const menuItems = [
        {
            id: 'new_game',
            label: 'NOUVELLE PARTIE',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
                    <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                    <path d="M12 9V4s3.03.55 4 2c1.08 1.62 0 5 0 5"/>
                </svg>
            ),
            action: () => setActiveModal('newgame')
        },
        {
            id: 'continue',
            label: 'CONTINUER',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
            ),
            action: () => setActiveModal('continue')
        },
        {
            id: 'settings',
            label: 'OPTIONS',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
            ),
            action: () => setActiveModal('settings')
        },
        {
            id: 'credits',
            label: 'CRÉDITS',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
            ),
            action: () => setActiveModal('credits')
        },
        {
            id: 'quit',
            label: 'QUITTER',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            ),
            action: () => setActiveModal('quit')
        }
    ];

    // Navigation Clavier fluide
    useEffect(() => {
        if (gameStarted) return;

        const handleKeyDown = (e) => {
            if (activeModal) {
                if (e.key === 'Escape') {
                    setActiveModal(null);
                }
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % menuItems.length);
            } else if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                menuItems[selectedIndex].action();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal, selectedIndex, gameStarted]);

    if (gameStarted) {
        return <FirstPersonMap initialMode={gameMode} onExit={() => setGameStarted(false)} />;
    }

    return (
        <div className="relative min-h-screen w-full bg-[#050811] text-zinc-100 flex flex-col justify-between select-none overflow-hidden font-rajdhani">
            {/* Arrière-plan spatial cosmique avec nébuleuse, planète à anneaux et station orbitale */}
            <SpaceBackground />

            {/* Haut de page (Header HUD) */}
            <header className="relative z-10 w-full px-8 sm:px-12 py-5 flex items-center justify-between text-xs sm:text-sm text-slate-400 font-semibold tracking-widest uppercase">
                <span className="hover:text-cyan-300 transition-colors cursor-default">GASHOOTER</span>
                <span className="text-slate-400/90 tracking-widest">V1.2.0 • MULTIJOUEUR 4 JOUEURS</span>
            </header>

            {/* Centre de l'écran : Cadre Principal Sci-Fi HUD */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-2">
                <div className="relative w-full max-w-[620px] sm:max-w-[660px] md:max-w-[700px]">

                    {/* Cadre futuriste avec scanlines et coins néon */}
                    <div className="relative rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 hud-scanlines p-6 sm:p-10 pt-10 pb-8 shadow-[0_0_50px_rgba(6,182,212,0.12)]">

                        {/* Éléments de structure HUD et crochets d'angle néon */}
                        {/* Coin Supérieur Gauche */}
                        <div className="absolute -top-[2px] -left-[2px] w-8 h-8 pointer-events-none">
                            <div className="w-full h-full border-t-2 border-l-2 border-cyan-400 rounded-tl-3xl shadow-[0_0_10px_#22d3ee]"></div>
                        </div>
                        {/* Coin Supérieur Droit */}
                        <div className="absolute -top-[2px] -right-[2px] w-8 h-8 pointer-events-none">
                            <div className="w-full h-full border-t-2 border-r-2 border-cyan-400 rounded-tr-3xl shadow-[0_0_10px_#22d3ee]"></div>
                        </div>
                        {/* Coin Inférieur Gauche */}
                        <div className="absolute -bottom-[2px] -left-[2px] w-8 h-8 pointer-events-none">
                            <div className="w-full h-full border-b-2 border-l-2 border-cyan-400 rounded-bl-3xl shadow-[0_0_10px_#22d3ee]"></div>
                        </div>
                        {/* Coin Inférieur Droit */}
                        <div className="absolute -bottom-[2px] -right-[2px] w-8 h-8 pointer-events-none">
                            <div className="w-full h-full border-b-2 border-r-2 border-cyan-400 rounded-br-3xl shadow-[0_0_10px_#22d3ee]"></div>
                        </div>

                        {/* Encoches latérales tech */}
                        <div className="absolute -left-[5px] top-16 w-1 h-8 bg-cyan-400/80 rounded-full shadow-[0_0_8px_#22d3ee]"></div>
                        <div className="absolute -right-[5px] top-16 w-1 h-8 bg-cyan-400/80 rounded-full shadow-[0_0_8px_#22d3ee]"></div>

                        {/* Barre d'accentuation néon en bas */}
                        <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-28 sm:w-36 h-[3px] bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee]"></div>

                        {/* Titre Principal GASHOOTER avec lueur double Cyan & Magenta */}
                        <div className="relative text-center mb-6">
                            {/* Auras d'arrière-plan Cyan (gauche) et Magenta (droite) */}
                            <div className="absolute inset-0 flex justify-center items-center pointer-events-none -z-10">
                                <div className="w-48 h-16 bg-cyan-500/35 blur-2xl rounded-full -translate-x-20"></div>
                                <div className="w-48 h-16 bg-fuchsia-500/35 blur-2xl rounded-full translate-x-20"></div>
                            </div>

                            <h1 className="relative font-orbitron text-5xl sm:text-6xl md:text-7xl font-black tracking-wider uppercase select-none text-white neon-title-dual"
                                style={{
                                    WebkitTextStroke: '2px rgba(15, 23, 42, 0.95)',
                                    letterSpacing: '0.08em'
                                }}
                            >
                                GASHOOTER
                            </h1>

                            {/* Ligne d'énergie scintillante cyan / jaune / magenta */}
                            <div className="relative flex justify-center items-center mt-2">
                                <svg className="w-56 sm:w-72 h-5" viewBox="0 0 280 20" fill="none">
                                    <defs>
                                        <linearGradient id="neonDividerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                                            <stop offset="20%" stopColor="#06b6d4" stopOpacity="0.9" />
                                            <stop offset="48%" stopColor="#fef08a" stopOpacity="1" />
                                            <stop offset="52%" stopColor="#fef08a" stopOpacity="1" />
                                            <stop offset="80%" stopColor="#ec4899" stopOpacity="0.9" />
                                            <stop offset="100%" stopColor="#ec4899" stopOpacity="0" />
                                        </linearGradient>
                                        <filter id="neonBlur" x="-20%" y="-50%" width="140%" height="200%">
                                            <feGaussianBlur stdDeviation="2.5" result="blur" />
                                            <feMerge>
                                                <feMergeNode in="blur" />
                                                <feMergeNode in="SourceGraphic" />
                                            </feMerge>
                                        </filter>
                                    </defs>
                                    {/* Ligne principale éclatante */}
                                    <line x1="25" y1="10" x2="255" y2="10" stroke="url(#neonDividerGrad)" strokeWidth="2.5" filter="url(#neonBlur)" strokeLinecap="round" />
                                    {/* Traînées énergétiques stylisées */}
                                    <path d="M 50 10 Q 100 4, 140 10 T 230 10" stroke="url(#neonDividerGrad)" strokeWidth="1.2" opacity="0.85" filter="url(#neonBlur)" fill="none" />
                                    <path d="M 60 10 Q 110 16, 140 10 T 220 10" stroke="url(#neonDividerGrad)" strokeWidth="1.2" opacity="0.85" filter="url(#neonBlur)" fill="none" />
                                    {/* Éclat central */}
                                    <circle cx="140" cy="10" r="2.5" fill="#ffffff" filter="url(#neonBlur)" />
                                </svg>
                            </div>
                        </div>

                        {/* Boîte intérieure pour les boutons */}
                        <div className="w-full max-w-[460px] mx-auto bg-slate-950/50 backdrop-blur-md rounded-2xl border border-white/10 p-5 sm:p-6 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]">
                            <div className="flex flex-col space-y-3 sm:space-y-3.5">
                                {menuItems.map((item, index) => {
                                    const isSelected = selectedIndex === index;
                                    return (
                                        <button
                                            key={item.id}
                                            onMouseEnter={() => setSelectedIndex(index)}
                                            onClick={() => item.action()}
                                            className={`w-full h-12 sm:h-13 px-5 rounded-xl flex items-center transition-all duration-150 cursor-pointer select-none font-rajdhani text-lg sm:text-xl font-bold tracking-widest uppercase ${
                                                isSelected
                                                    ? 'border-2 border-cyan-400 bg-gradient-to-r from-cyan-950/80 via-cyan-900/50 to-slate-900/80 text-white btn-glow-cyan transform scale-[1.01]'
                                                    : 'border border-white/10 bg-slate-800/40 hover:bg-slate-800/60 text-slate-300 hover:text-white'
                                            }`}
                                        >
                                            {/* Icône du bouton */}
                                            <div className={`w-8 flex items-center justify-start transition-colors ${isSelected ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'text-slate-400'}`}>
                                                {item.icon}
                                            </div>

                                            {/* Texte centré */}
                                            <div className="flex-1 text-center pr-8">
                                                {item.label}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Indication des touches de navigation */}
                        <div className="mt-5 text-center text-xs sm:text-sm text-cyan-200/60 tracking-wider font-medium">
                            Utilisez les flèches [ ↑ / ↓ ] et [Entrée] pour naviguer
                        </div>
                    </div>
                </div>
            </main>

            {/* Bas de page (Footer Copyright) */}
            <footer className="relative z-10 w-full px-8 py-5 text-center text-xs sm:text-sm text-slate-400/70 tracking-widest uppercase">
                © {new Date().getFullYear()} Sofiane Kherarfa - Tous droits réservés
            </footer>

            {/* Modals */}
            <SettingsModal
                isOpen={activeModal === 'settings'}
                onClose={() => setActiveModal(null)}
            />

            <CreditsModal
                isOpen={activeModal === 'credits'}
                onClose={() => setActiveModal(null)}
            />

            {/* Modal Sélection de Mode de Jeu */}
            {activeModal === 'newgame' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="relative w-full max-w-lg bg-slate-950/90 border border-cyan-500/40 rounded-2xl p-7 text-zinc-100 shadow-[0_0_40px_rgba(6,182,212,0.2)]">
                        {/* Coin d'angle HUD */}
                        <div className="absolute -top-[2px] -left-[2px] w-6 h-6 border-t-2 border-l-2 border-cyan-400 rounded-tl-xl"></div>
                        <div className="absolute -top-[2px] -right-[2px] w-6 h-6 border-t-2 border-r-2 border-cyan-400 rounded-tr-xl"></div>

                        <div className="text-center mb-6">
                            <span className="text-3xl inline-block mb-2">🎯</span>
                            <h3 className="font-orbitron text-2xl font-bold uppercase tracking-wider text-cyan-300">
                                Sélection du Mode de Jeu
                            </h3>
                            <p className="text-sm text-slate-400 mt-1">
                                Choisissez votre expérience de combat spatial
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 mb-6 font-rajdhani">
                            {/* Mode Multijoueur Arène 4 Joueurs */}
                            <button
                                onClick={() => {
                                    setGameMode('multiplayer');
                                    setActiveModal(null);
                                    setGameStarted(true);
                                }}
                                className="group p-5 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-slate-900/90 border border-cyan-500/40 hover:border-cyan-300 rounded-xl text-left transition-all hover:scale-[1.02] shadow-lg cursor-pointer hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-bold text-cyan-300 text-xl flex items-center space-x-2">
                                        <span>⚔️</span>
                                        <span>Arène Multijoueur (4 Joueurs)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase rounded-full border border-cyan-500/40">
                                        Recommandé
                                    </span>
                                </div>
                                <p className="text-sm text-slate-300 leading-relaxed font-sans">
                                    Affrontez jusqu'à 4 combattants avec <strong className="text-amber-300">Têtes de Cibles</strong>. Plus vous tirez proche du <strong className="text-red-400">Bullseye</strong>, plus vous infligez de dégâts (One-Shot Kill au centre) !
                                </p>
                            </button>

                            {/* Mode Stand de Tir Entraînement */}
                            <button
                                onClick={() => {
                                    setGameMode('training');
                                    setActiveModal(null);
                                    setGameStarted(true);
                                }}
                                className="group p-4 bg-slate-900/60 border border-slate-700 hover:border-cyan-500/50 rounded-xl text-left transition-all hover:scale-[1.01] cursor-pointer"
                            >
                                <div className="font-bold text-slate-200 text-lg flex items-center space-x-2 mb-1">
                                    <span>🎯</span>
                                    <span>Stand de Tir Solo (Entraînement)</span>
                                </div>
                                <p className="text-sm text-slate-400 font-sans">
                                    Cibles fixes et mobiles de tir à l'arc à points pour vous entraîner et battre vos records.
                                </p>
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sm font-semibold uppercase tracking-wider transition cursor-pointer"
                            >
                                Retour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Continuer */}
            {activeModal === 'continue' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="relative w-full max-w-sm bg-slate-950/90 border border-cyan-500/40 rounded-xl p-6 text-center text-zinc-100 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                        <h3 className="font-orbitron text-xl font-bold uppercase tracking-wide text-cyan-300 mb-3">Continuer</h3>
                        <p className="text-sm text-slate-300 mb-6 font-sans">
                            Reprendre votre dernière session sauvegardée ?
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-semibold transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    setGameMode('multiplayer');
                                    setActiveModal(null);
                                    setGameStarted(true);
                                }}
                                className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-sm transition shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                            >
                                Reprendre
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Quitter */}
            {activeModal === 'quit' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="relative w-full max-w-sm bg-slate-950/90 border border-cyan-500/40 rounded-xl p-6 text-center text-zinc-100 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                        <h3 className="font-orbitron text-xl font-bold uppercase tracking-wide text-cyan-300 mb-3">Quitter</h3>
                        <p className="text-sm text-slate-300 mb-6 font-sans">
                            Vous pouvez fermer cet onglet pour quitter le jeu.
                        </p>
                        <button
                            onClick={() => setActiveModal(null)}
                            className="px-6 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 rounded-lg text-sm font-semibold uppercase tracking-wider text-cyan-300 transition"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

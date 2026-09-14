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
        { id: 'new_game', label: 'Nouvelle Partie', action: () => setActiveModal('newgame') },
        { id: 'continue', label: 'Continuer', action: () => setActiveModal('continue') },
        { id: 'settings', label: 'Options', action: () => setActiveModal('settings') },
        { id: 'credits', label: 'Crédits', action: () => setActiveModal('credits') },
        { id: 'quit', label: 'Quitter', action: () => setActiveModal('quit') }
    ];

    // Navigation Clavier classique
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
        <div className="relative min-h-screen w-full bg-[#0a0c10] text-zinc-100 flex flex-col justify-between select-none overflow-hidden font-sans">
            <SpaceBackground />

            {/* Haut de page */}
            <header className="relative z-10 w-full px-8 py-6 flex items-center justify-between text-xs text-zinc-500 tracking-wider uppercase">
                <span>GASHOOTER</span>
                <span>v1.2.0 • MULTIJOUEUR 4 JOUEURS</span>
            </header>

            {/* Centre de l'écran : Menu Principal */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-8">
                <div className="mb-14 text-center">
                    <h1 className="text-5xl sm:text-7xl font-extrabold tracking-widest text-white uppercase drop-shadow-md">
                        GASHOOTER
                    </h1>
                    <div className="h-0.5 w-28 bg-gradient-to-r from-cyan-500 to-amber-500 mx-auto mt-4 rounded-full"></div>
                </div>

                <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
                    {menuItems.map((item, index) => {
                        const isSelected = selectedIndex === index;
                        return (
                            <button
                                key={item.id}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => item.action()}
                                className={`w-full py-2.5 px-6 text-center text-lg sm:text-xl font-medium tracking-wide uppercase transition-all duration-150 rounded cursor-pointer ${
                                    isSelected
                                        ? 'text-white bg-zinc-800/80 shadow-sm translate-x-1 font-semibold'
                                        : 'text-zinc-400 hover:text-zinc-200'
                                }`}
                            >
                                <span className={`inline-block mr-2 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0'}`}>
                                    ›
                                </span>
                                {item.label}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-12 text-xs text-zinc-600 tracking-wider">
                    Utilisez les flèches [ ↑ / ↓ ] et [ Entrée ]
                </div>
            </main>

            {/* Bas de page */}
            <footer className="relative z-10 w-full px-8 py-6 text-center text-xs text-zinc-600">
                © {new Date().getFullYear()} Sofiane Kherarfa • Tous droits réservés
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

            {/* Sélection de Mode de Jeu */}
            {activeModal === 'newgame' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
                    <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-2xl p-7 text-zinc-100 shadow-2xl">
                        <div className="text-center mb-6">
                            <span className="text-3xl inline-block mb-2">🎯</span>
                            <h3 className="text-2xl font-black uppercase tracking-wide">Sélection du Mode de Jeu</h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                Choisissez votre expérience de combat
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-4 mb-6">
                            {/* Mode Multijoueur Arène 4 Joueurs */}
                            <button
                                onClick={() => {
                                    setGameMode('multiplayer');
                                    setActiveModal(null);
                                    setGameStarted(true);
                                }}
                                className="group p-5 bg-gradient-to-br from-cyan-950/60 to-slate-900 border border-cyan-500/40 hover:border-cyan-400 rounded-xl text-left transition-all hover:scale-[1.02] shadow-lg cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="font-extrabold text-cyan-400 text-lg flex items-center space-x-2">
                                        <span>⚔️</span>
                                        <span>Arène Multijoueur (4 Joueurs)</span>
                                    </div>
                                    <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-[10px] font-bold uppercase rounded-full border border-cyan-500/30">
                                        Recommandé
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-300 leading-relaxed">
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
                                className="group p-4 bg-zinc-800/60 border border-zinc-700 hover:border-zinc-500 rounded-xl text-left transition-all hover:scale-[1.01] cursor-pointer"
                            >
                                <div className="font-bold text-zinc-200 text-base flex items-center space-x-2 mb-1">
                                    <span>🎯</span>
                                    <span>Stand de Tir Solo (Entraînement)</span>
                                </div>
                                <p className="text-xs text-zinc-400">
                                    Cibles fixes et mobiles de tir à l'arc à points pour vous entraîner et battre vos records.
                                </p>
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs font-semibold uppercase tracking-wider transition cursor-pointer"
                            >
                                Retour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Continuer */}
            {activeModal === 'continue' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center text-zinc-100 shadow-2xl">
                        <h3 className="text-xl font-bold uppercase tracking-wide mb-3">Continuer</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Reprendre votre dernière session sauvegardée ?
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={() => setActiveModal(null)}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-semibold transition"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={() => {
                                    setGameMode('multiplayer');
                                    setActiveModal(null);
                                    setGameStarted(true);
                                }}
                                className="px-5 py-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded text-sm font-bold transition"
                            >
                                Reprendre
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Quitter */}
            {activeModal === 'quit' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center text-zinc-100 shadow-2xl">
                        <h3 className="text-xl font-bold uppercase tracking-wide mb-3">Quitter</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Vous pouvez fermer cet onglet pour quitter le jeu.
                        </p>
                        <button
                            onClick={() => setActiveModal(null)}
                            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-semibold transition"
                        >
                            Fermer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

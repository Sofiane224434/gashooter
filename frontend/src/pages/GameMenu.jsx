import { useState, useEffect } from 'react';
import SpaceBackground from '../components/game/SpaceBackground.jsx';
import SettingsModal from '../components/game/SettingsModal.jsx';
import CreditsModal from '../components/game/CreditsModal.jsx';

export default function GameMenu() {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [activeModal, setActiveModal] = useState(null); // 'settings', 'credits', 'newgame'
    const [gameStarted, setGameStarted] = useState(false);

    const menuItems = [
        { id: 'new_game', label: 'Nouvelle Partie', action: () => setActiveModal('newgame') },
        { id: 'continue', label: 'Continuer', action: () => setActiveModal('continue') },
        { id: 'settings', label: 'Options', action: () => setActiveModal('settings') },
        { id: 'credits', label: 'Crédits', action: () => setActiveModal('credits') },
        { id: 'quit', label: 'Quitter', action: () => setActiveModal('quit') }
    ];

    // Navigation Clavier classique (Haut, Bas, Entrée, Échap)
    useEffect(() => {
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
    }, [activeModal, selectedIndex]);

    return (
        <div className="relative min-h-screen w-full bg-[#0a0c10] text-zinc-100 flex flex-col justify-between select-none overflow-hidden font-sans">
            {/* Arrière-plan spatial sobre */}
            <SpaceBackground />

            {/* Haut de page minimaliste */}
            <header className="relative z-10 w-full px-8 py-6 flex items-center justify-between text-xs text-zinc-500 tracking-wider uppercase">
                <span>GASHOOTER</span>
                <span>v1.0.0</span>
            </header>

            {/* Centre de l'écran : Titre & Menu classique */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 -mt-8">
                {/* Titre du jeu */}
                <div className="mb-14 text-center">
                    <h1 className="text-5xl sm:text-7xl font-extrabold tracking-widest text-white uppercase drop-shadow-md">
                        GASHOOTER
                    </h1>
                    <div className="h-0.5 w-24 bg-zinc-600 mx-auto mt-4 rounded-full"></div>
                </div>

                {/* Liste des choix du menu */}
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

                {/* Astuce de navigation */}
                <div className="mt-12 text-xs text-zinc-600 tracking-wider">
                    Utilisez les flèches [ ↑ / ↓ ] et [ Entrée ]
                </div>
            </main>

            {/* Bas de page minimaliste */}
            <footer className="relative z-10 w-full px-8 py-6 text-center text-xs text-zinc-600">
                © {new Date().getFullYear()} Sofiane Kherarfa • Tous droits réservés
            </footer>

            {/* Modals & Dialogues épurés */}
            <SettingsModal
                isOpen={activeModal === 'settings'}
                onClose={() => setActiveModal(null)}
            />

            <CreditsModal
                isOpen={activeModal === 'credits'}
                onClose={() => setActiveModal(null)}
            />

            {/* Dialogue Nouvelle Partie */}
            {activeModal === 'newgame' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center text-zinc-100 shadow-2xl">
                        <h3 className="text-xl font-bold uppercase tracking-wide mb-3">Nouvelle Partie</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Voulez-vous lancer une nouvelle aventure ?
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
                                    setActiveModal(null);
                                    setGameStarted(true);
                                }}
                                className="px-5 py-2 bg-white text-zinc-950 hover:bg-zinc-200 rounded text-sm font-bold transition"
                            >
                                Commencer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Dialogue Continuer */}
            {activeModal === 'continue' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 text-center text-zinc-100 shadow-2xl">
                        <h3 className="text-xl font-bold uppercase tracking-wide mb-3">Continuer</h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Aucune sauvegarde existante trouvée.
                        </p>
                        <button
                            onClick={() => setActiveModal(null)}
                            className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm font-semibold transition"
                        >
                            Retour
                        </button>
                    </div>
                </div>
            )}

            {/* Dialogue Quitter */}
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
                            Fermer la fenêtre
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

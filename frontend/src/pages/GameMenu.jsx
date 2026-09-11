import { useState, useEffect } from 'react';
import SpaceBackground from '../components/game/SpaceBackground.jsx';
import ModesModal from '../components/game/ModesModal.jsx';
import HangarModal from '../components/game/HangarModal.jsx';
import LeaderboardModal from '../components/game/LeaderboardModal.jsx';
import SettingsModal from '../components/game/SettingsModal.jsx';
import MissionLaunchModal from '../components/game/MissionLaunchModal.jsx';
import CreditsModal from '../components/game/CreditsModal.jsx';
import { sound } from '../services/sound.js';

export default function GameMenu() {
    const [selectedMenuIndex, setSelectedMenuIndex] = useState(0);
    const [activeModal, setActiveModal] = useState(null); // 'modes', 'hangar', 'leaderboard', 'settings', 'launch', 'credits'
    const [selectedMode, setSelectedMode] = useState('campaign');
    const [crtEnabled, setCrtEnabled] = useState(true);
    const [audioStarted, setAudioStarted] = useState(false);

    const menuItems = [
        { id: 'play', label: 'JOUER // DÉPLOIEMENT RAPIDE', icon: '🚀', action: () => setActiveModal('launch'), color: 'emerald' },
        { id: 'modes', label: 'MODES DE COMBAT', icon: '🌌', action: () => setActiveModal('modes'), color: 'cyan' },
        { id: 'hangar', label: 'HANGAR & VAISSEAUX', icon: '🛠️', action: () => setActiveModal('hangar'), color: 'cyan' },
        { id: 'leaderboard', label: 'CLASSEMENT MONDIAL', icon: '🏆', action: () => setActiveModal('leaderboard'), color: 'amber' },
        { id: 'settings', label: 'CONFIGURATION & AUDIO', icon: '⚙️', action: () => setActiveModal('settings'), color: 'purple' },
        { id: 'credits', label: 'CRÉDITS & ÉQUIPE', icon: '📜', action: () => setActiveModal('credits'), color: 'purple' }
    ];

    // Navigation clavier (Flèches, Z/S, Entrée, Echap)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (activeModal) {
                if (e.key === 'Escape') {
                    sound.playBack();
                    setActiveModal(null);
                }
                return;
            }

            if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                sound.playHover();
                setSelectedMenuIndex((prev) => (prev + 1) % menuItems.length);
            } else if (e.key === 'ArrowUp' || e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                sound.playHover();
                setSelectedMenuIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                sound.playSelect();
                menuItems[selectedMenuIndex].action();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [activeModal, selectedMenuIndex]);

    const handleUserInteraction = () => {
        if (!audioStarted) {
            sound.init();
            setAudioStarted(true);
        }
    };

    return (
        <div
            onClick={handleUserInteraction}
            className={`relative min-h-screen w-full bg-slate-950 text-white font-sans flex flex-col justify-between select-none overflow-hidden ${
                crtEnabled ? 'crt-scanlines' : ''
            }`}
        >
            {/* 1. Arrière-plan Canvas animé Space / Gas */}
            <SpaceBackground />

            {/* 2. HUD Supérieur */}
            <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-white/10 bg-slate-950/40 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span className="font-mono text-xs text-emerald-400 font-bold tracking-widest uppercase">
                        SERVEUR ONLINE // SECTEUR AZIM-VPS
                    </span>
                </div>

                <div className="flex items-center gap-4 font-mono text-xs text-gray-400">
                    <span className="hidden sm:inline-block">PING : <strong className="text-emerald-400">14 MS</strong></span>
                    <span>VERSION : <strong className="text-cyan-400">v1.0.4-PROD</strong></span>
                    <button
                        onClick={() => {
                            sound.playSelect();
                            setCrtEnabled(!crtEnabled);
                        }}
                        onMouseEnter={() => sound.playHover()}
                        className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-emerald-400 text-xs font-mono transition-colors cursor-pointer"
                        title="Activer/Désactiver l'effet borne d'arcade CRT"
                    >
                        CRT : {crtEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
            </header>

            {/* 3. Contenu Central & Écran Titre */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8 text-center max-w-4xl mx-auto w-full">
                {/* Logo & Titre */}
                <div className="mb-8 sm:mb-12 relative animate-fadeIn">
                    <div className="text-xs sm:text-sm font-mono tracking-[0.35em] text-emerald-400 mb-2 uppercase font-bold text-shadow-glow">
                        ⚡ ARCADE SPACE INTERCEPTOR ⚡
                    </div>
                    <h1 className="text-5xl sm:text-7xl md:text-8xl font-black font-mono tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-emerald-300 to-emerald-600 drop-shadow-[0_0_40px_rgba(16,185,129,0.7)] animate-pulse">
                        GASHOOTER
                    </h1>
                    <div className="text-xs sm:text-base font-mono text-cyan-300 tracking-[0.4em] uppercase mt-2 opacity-90">
                        N E B U L A // W A R F A R E
                    </div>
                </div>

                {/* Menu Buttons List */}
                <div className="w-full max-w-md space-y-3">
                    {menuItems.map((item, index) => {
                        const isSelected = selectedMenuIndex === index;
                        return (
                            <button
                                key={item.id}
                                onMouseEnter={() => {
                                    sound.playHover();
                                    setSelectedMenuIndex(index);
                                }}
                                onClick={() => {
                                    sound.playSelect();
                                    item.action();
                                }}
                                className={`group relative w-full px-6 py-3.5 rounded-xl font-mono text-sm sm:text-base font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer flex items-center justify-between border ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-emerald-500/30 via-cyan-500/20 to-transparent border-emerald-400 text-white shadow-[0_0_30px_rgba(16,185,129,0.4)] translate-x-2'
                                        : 'bg-slate-950/60 border-white/10 text-gray-400 hover:text-gray-200 hover:border-white/30'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{item.icon}</span>
                                    <span className={isSelected ? 'text-emerald-300 font-black' : ''}>
                                        {item.label}
                                    </span>
                                </div>
                                <span
                                    className={`text-xs transition-transform duration-200 ${
                                        isSelected ? 'text-emerald-400 translate-x-1 font-black opacity-100' : 'opacity-0'
                                    }`}
                                >
                                    ►►
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Instructions Touches */}
                <div className="mt-8 text-xs font-mono text-gray-400 tracking-wider flex items-center justify-center gap-4">
                    <span>[ ↑ / ↓ ] Naviguer</span>
                    <span>•</span>
                    <span>[ ENTRÉE ] Valider</span>
                    <span>•</span>
                    <span>[ ÉCHAP ] Retour</span>
                </div>
            </main>

            {/* 4. Footer HUD */}
            <footer className="relative z-10 w-full px-6 py-4 border-t border-white/10 bg-slate-950/40 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-gray-500">
                <div>
                    DÉVELOPPÉ PAR <strong className="text-emerald-400">SOFIANE KHERARFA</strong>
                </div>
                <div className="mt-2 sm:mt-0 flex items-center gap-3">
                    <span>INFRASTRUCTURE : <strong>AZIM404.COM</strong></span>
                    <span>•</span>
                    <span className="text-emerald-400">HTTPS SÉCURISÉ</span>
                </div>
            </footer>

            {/* 5. Modals Interposées */}
            <ModesModal
                isOpen={activeModal === 'modes'}
                onClose={() => setActiveModal(null)}
                onSelectMode={(mode) => {
                    setSelectedMode(mode);
                    setActiveModal('launch');
                }}
            />

            <HangarModal
                isOpen={activeModal === 'hangar'}
                onClose={() => setActiveModal(null)}
            />

            <LeaderboardModal
                isOpen={activeModal === 'leaderboard'}
                onClose={() => setActiveModal(null)}
            />

            <SettingsModal
                isOpen={activeModal === 'settings'}
                onClose={() => setActiveModal(null)}
                crtEnabled={crtEnabled}
                onToggleCrt={() => setCrtEnabled(!crtEnabled)}
            />

            <MissionLaunchModal
                isOpen={activeModal === 'launch'}
                onClose={() => setActiveModal(null)}
                mode={selectedMode}
            />

            <CreditsModal
                isOpen={activeModal === 'credits'}
                onClose={() => setActiveModal(null)}
            />
        </div>
    );
}

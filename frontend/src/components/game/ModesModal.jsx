import { sound } from '../../services/sound.js';

export default function ModesModal({ isOpen, onClose, onSelectMode }) {
    if (!isOpen) return null;

    const modes = [
        {
            id: 'campaign',
            name: 'CAMPAGNE GALACTIQUE',
            desc: '12 missions scénarisées à travers les nébuleuses toxiques pour anéantir le Syndicat du Gaz.',
            difficulty: 'Normal',
            reward: '+1000 XP',
            badge: 'HISTOIRE',
            color: 'from-cyan-950/70 via-slate-900 to-slate-950 border-cyan-500/40 hover:border-cyan-400'
        },
        {
            id: 'survival',
            name: 'SURVIE INFINIE',
            desc: 'Affrontez des vagues incessantes de chasseurs ennemis. Jusqu’où tiendront vos boucliers ?',
            difficulty: 'Difficile',
            reward: 'Multiplicateur x2',
            badge: 'ARCADE',
            color: 'from-blue-950/70 via-slate-900 to-slate-950 border-blue-500/40 hover:border-blue-400'
        },
        {
            id: 'boss_rush',
            name: 'BOSS RUSH',
            desc: 'Enchaînez sans répit les 5 Léviathans interstellaires lourdement blindés.',
            difficulty: 'Extrême',
            reward: 'Vaisseau Légendaire',
            badge: 'DÉFI',
            color: 'from-fuchsia-950/70 via-slate-900 to-slate-950 border-fuchsia-500/40 hover:border-fuchsia-400'
        },
        {
            id: 'pvp',
            name: 'ARÈNE MULTIJOUEUR',
            desc: 'Duels en temps réel à grande vitesse en 1v1 ou 2v2 dans des champs d’astéroïdes.',
            difficulty: 'Compétitif',
            reward: 'Rang Galactique',
            badge: 'BÊTA',
            color: 'from-amber-950/70 via-slate-900 to-slate-950 border-amber-500/40 hover:border-amber-400'
        }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-rajdhani">
            <div className="relative w-full max-w-4xl rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hud-scanlines p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-white overflow-hidden">
                {/* Crochets d'angle HUD */}
                <div className="absolute -top-[2px] -left-[2px] w-7 h-7 border-t-2 border-l-2 border-cyan-400 rounded-tl-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -top-[2px] -right-[2px] w-7 h-7 border-t-2 border-r-2 border-cyan-400 rounded-tr-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] -left-[2px] w-7 h-7 border-b-2 border-l-2 border-cyan-400 rounded-bl-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] -right-[2px] w-7 h-7 border-b-2 border-r-2 border-cyan-400 rounded-br-3xl shadow-[0_0_10px_#22d3ee] pointer-events-none"></div>
                <div className="absolute -bottom-[2px] left-1/2 -translate-x-1/2 w-32 h-[3px] bg-cyan-400 rounded-full shadow-[0_0_12px_#22d3ee]"></div>

                {/* Header */}
                <div className="flex items-center justify-between border-b border-cyan-500/30 pb-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-wider text-cyan-300 font-orbitron uppercase">
                            Sélection du Mode
                        </h2>
                    </div>
                    <button
                        onClick={() => {
                            sound.playBack();
                            onClose();
                        }}
                        onMouseEnter={() => sound.playHover()}
                        className="px-4 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded-xl text-xs font-bold tracking-wider transition-all cursor-pointer"
                    >
                        FERMER [ÉCHAP]
                    </button>
                </div>

                {/* Grid of modes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {modes.map((mode) => (
                        <div
                            key={mode.id}
                            onMouseEnter={() => sound.playHover()}
                            onClick={() => {
                                sound.playLaunch();
                                onSelectMode(mode.id);
                            }}
                            className={`group relative p-5 rounded-2xl border bg-gradient-to-br ${mode.color} transition-all duration-200 hover:scale-[1.02] cursor-pointer hover:shadow-[0_0_25px_rgba(6,182,212,0.3)] flex flex-col justify-between`}
                        >
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-bold uppercase tracking-wider">
                                        {mode.badge}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                        Difficulté: <span className="text-white font-bold">{mode.difficulty}</span>
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold font-orbitron tracking-wide text-white group-hover:text-cyan-300 transition-colors">
                                    {mode.name}
                                </h3>
                                <p className="text-sm text-slate-300 mt-2 font-sans line-clamp-2">
                                    {mode.desc}
                                </p>
                            </div>

                            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                                <span className="text-xs font-bold text-cyan-400 tracking-wider">
                                    Récompense : {mode.reward}
                                </span>
                                <span className="text-sm text-cyan-300 font-bold group-hover:translate-x-1 transition-transform tracking-wider">
                                    DÉPLOYER →
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

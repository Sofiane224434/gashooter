import { sound } from '../../services/sound.js';

export default function LeaderboardModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const scores = [
        { rank: 1, name: 'NOVA_VIPER', score: '1,450,200', wave: 'Vague 48', badge: '👑 LÉGENDE' },
        { rank: 2, name: 'CYBER_KHERARFA', score: '1,280,950', wave: 'Vague 42', badge: '🥈 MAÎTRE' },
        { rank: 3, name: 'AZIM_404', score: '994,100', wave: 'Vague 35', badge: '🥉 ÉLITE' },
        { rank: 4, name: 'GAS_DESTROYER', score: '840,300', wave: 'Vague 29', badge: 'DIAMANT' },
        { rank: 5, name: 'NEBULA_PILOT', score: '720,000', wave: 'Vague 25', badge: 'PLATINE' },
        { rank: 6, name: 'STAR_STRIKER', score: '610,500', wave: 'Vague 21', badge: 'OR' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-rajdhani">
            <div className="relative w-full max-w-3xl rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hud-scanlines p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.2)] text-white">
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
                            Classement Galactique
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

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm sm:text-base">
                        <thead>
                            <tr className="border-b border-white/10 text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <th className="pb-3">RANG</th>
                                <th className="pb-3">PILOTE</th>
                                <th className="pb-3">SCORE</th>
                                <th className="pb-3">PERFORMANCE</th>
                                <th className="pb-3 text-right">DISTINCTION</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {scores.map((s) => (
                                <tr key={s.rank} className="hover:bg-cyan-500/10 transition-colors">
                                    <td className="py-3 font-bold text-cyan-400">
                                        #{s.rank}
                                    </td>
                                    <td className="py-3 font-bold text-white flex items-center gap-2">
                                        {s.name}
                                    </td>
                                    <td className="py-3 text-emerald-400 font-black">
                                        {s.score} PTS
                                    </td>
                                    <td className="py-3 text-slate-300">
                                        {s.wave}
                                    </td>
                                    <td className="py-3 text-right">
                                        <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                                            {s.badge}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-6 pt-4 border-t border-white/10 text-center text-xs text-slate-400 tracking-wider">
                    Saison 1 en cours • Réinitialisation du classement dans 14 jours
                </div>
            </div>
        </div>
    );
}

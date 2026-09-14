// Service de Sauvegarde locale et de suivi de carrière du joueur
const SAVE_KEY = 'gashooter_player_save_v1';

const defaultSave = {
    highScore: 0,
    totalShotsFired: 0,
    totalShotsHit: 0,
    totalTargetsDestroyed: 0,
    bestStreak: 0,
    gamesPlayed: 0,
    lastSaved: null,
    settings: {
        mouseSensitivity: 1.0,
        volume: 0.8,
        crosshairColor: '#06b6d4'
    }
};

export class SaveService {
    static getSaveData() {
        try {
            const raw = localStorage.getItem(SAVE_KEY);
            if (!raw) return { ...defaultSave, lastSaved: new Date().toISOString() };
            const parsed = JSON.parse(raw);
            return { ...defaultSave, ...parsed, settings: { ...defaultSave.settings, ...(parsed.settings || {}) } };
        } catch (e) {
            console.warn('[SaveService] Erreur lecture sauvegarde:', e);
            return { ...defaultSave };
        }
    }

    static saveGameSession({ score, shotsFired, shotsHit, targetsDestroyed }) {
        try {
            const current = this.getSaveData();
            const updated = {
                ...current,
                highScore: Math.max(current.highScore || 0, score || 0),
                totalShotsFired: (current.totalShotsFired || 0) + (shotsFired || 0),
                totalShotsHit: (current.totalShotsHit || 0) + (shotsHit || 0),
                totalTargetsDestroyed: (current.totalTargetsDestroyed || 0) + (targetsDestroyed || 0),
                gamesPlayed: (current.gamesPlayed || 0) + 1,
                lastSaved: new Date().toISOString()
            };

            localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.error('[SaveService] Erreur écriture sauvegarde:', e);
            return null;
        }
    }

    static updateSettings(newSettings) {
        try {
            const current = this.getSaveData();
            const updated = {
                ...current,
                settings: { ...current.settings, ...newSettings },
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem(SAVE_KEY, JSON.stringify(updated));
            return updated;
        } catch (e) {
            console.error('[SaveService] Erreur mise à jour paramètres:', e);
            return null;
        }
    }

    static resetProgress() {
        try {
            localStorage.removeItem(SAVE_KEY);
            return { ...defaultSave };
        } catch (e) {
            return { ...defaultSave };
        }
    }
}

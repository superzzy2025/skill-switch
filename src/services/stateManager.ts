import * as path from 'path';
import * as os from 'os';
import { AppConfig, AppState, LegacyAppConfig } from '../types';
import { readJsonFile, writeJsonFile, ensureDir } from '../utils/fileUtils';
import { detectCurrentIde, getIdeDisplayName } from '../utils/ideDetector';

const DEFAULT_CONFIG: AppConfig = {
    targetPaths: {},
    storagePath: path.join(os.homedir(), '.skill-switch'),
    language: 'en',
};

const DEFAULT_STATE: AppState = {
    activeProfile: '',
    disabledProfileSkills: {},
    enabledExtras: [],
    sidebarCollapsed: {},
};

export class StateManager {
    private config: AppConfig = { ...DEFAULT_CONFIG, targetPaths: {} };
    private state: AppState = { ...DEFAULT_STATE };
    private currentIdeKey: string = 'unknown';

    /** Initialize: load or create config and state */
    async initialize(appName?: string): Promise<void> {
        // Detect current IDE
        this.currentIdeKey = appName ? detectCurrentIde(appName) : 'unknown';

        // Load config from fixed default location
        const configPath = this.getConfigPath();
        const rawConfig = await readJsonFile<Record<string, unknown>>(configPath);

        if (rawConfig) {
            // Check for legacy config with targetPath (string) instead of targetPaths (object)
            if (typeof (rawConfig as any).targetPath === 'string' && !(rawConfig as any).targetPaths) {
                // Migrate from legacy format: assign old targetPath to current IDE
                const legacy = rawConfig as unknown as LegacyAppConfig;
                this.config = {
                    targetPaths: { [this.currentIdeKey]: legacy.targetPath },
                    storagePath: legacy.storagePath,
                    language: legacy.language,
                };
            } else {
                this.config = {
                    targetPaths: (rawConfig as any).targetPaths ?? {},
                    storagePath: (rawConfig as any).storagePath ?? DEFAULT_CONFIG.storagePath,
                    language: (rawConfig as any).language ?? DEFAULT_CONFIG.language,
                };
            }
        } else {
            this.config = { ...DEFAULT_CONFIG, targetPaths: {} };
        }

        // Ensure directories exist (profiles/extras/design-docs go to configured storagePath)
        await ensureDir(this.getStoragePath());
        await ensureDir(this.getProfilesPath());
        await ensureDir(this.getExtrasPath());
        await ensureDir(this.getDesignDocsPath());

        // Load state from the configured storagePath
        const statePath = this.getStatePath();
        const loadedState = await readJsonFile<AppState>(statePath);
        this.state = loadedState ?? { ...DEFAULT_STATE };

        // Persist defaults if they didn't exist
        await this.saveConfig();
        await this.saveState();
    }

    /** Get the current IDE key */
    getCurrentIdeKey(): string {
        return this.currentIdeKey;
    }

    /** Get the current IDE display name */
    getCurrentIdeName(): string {
        return getIdeDisplayName(this.currentIdeKey);
    }

    /** Check if the current IDE has a target path configured */
    hasTargetPath(): boolean {
        return !!this.config.targetPaths[this.currentIdeKey]?.trim();
    }

    // --- Config getters ---

    getConfig(): AppConfig {
        return this.config;
    }

    /** Get the target path for the current IDE. Returns empty string if not configured. */
    getTargetPath(): string {
        return this.config.targetPaths[this.currentIdeKey] ?? '';
    }

    /** Set the target path for the current IDE */
    async setTargetPath(targetPath: string): Promise<void> {
        this.config.targetPaths[this.currentIdeKey] = targetPath;
        await this.saveConfig();
    }

    /** Update config fields and persist */
    async updateConfig(partial: Partial<AppConfig>): Promise<void> {
        this.config = { ...this.config, ...partial };
        await this.saveConfig();
        await ensureDir(this.getStoragePath());
        await ensureDir(this.getProfilesPath());
        await ensureDir(this.getExtrasPath());
        await ensureDir(this.getDesignDocsPath());
    }

    getStoragePath(): string {
        return this.config.storagePath;
    }

    getProfilesPath(): string {
        return path.join(this.config.storagePath, 'profiles');
    }

    getExtrasPath(): string {
        return path.join(this.config.storagePath, 'extras');
    }

    getDesignDocsPath(): string {
        return path.join(this.config.storagePath, 'design-docs');
    }

    private getStatePath(): string {
        return path.join(this.config.storagePath, 'state.json');
    }

    /** Config is always stored in the default location, separate from user data */
    private getConfigPath(): string {
        return path.join(DEFAULT_CONFIG.storagePath, 'config.json');
    }

    // --- State getters ---

    getState(): AppState {
        return this.state;
    }

    getActiveProfile(): string {
        return this.state.activeProfile;
    }

    getDisabledProfileSkills(profileId: string): string[] {
        return this.state.disabledProfileSkills[profileId] ?? [];
    }

    getEnabledExtras(): string[] {
        return this.state.enabledExtras;
    }

    isProfileCollapsed(profileId: string): boolean {
        return this.state.sidebarCollapsed[profileId] ?? true;
    }

    // --- State mutations ---

    async setActiveProfile(profileId: string): Promise<void> {
        this.state.activeProfile = profileId;
        // Collapse all, expand the new active
        for (const key of Object.keys(this.state.sidebarCollapsed)) {
            this.state.sidebarCollapsed[key] = key !== profileId;
        }
        this.state.sidebarCollapsed[profileId] = false;
        await this.saveState();
    }

    async setDisabledProfileSkills(profileId: string, skills: string[]): Promise<void> {
        this.state.disabledProfileSkills[profileId] = skills;
        await this.saveState();
    }

    async setEnabledExtras(extras: string[]): Promise<void> {
        this.state.enabledExtras = extras;
        await this.saveState();
    }

    async toggleProfileSkill(profileId: string, skillFile: string, enabled: boolean): Promise<void> {
        const disabled = this.state.disabledProfileSkills[profileId] ?? [];
        if (enabled) {
            this.state.disabledProfileSkills[profileId] = disabled.filter(
                s => s !== skillFile
            );
        } else {
            if (!disabled.includes(skillFile)) {
                disabled.push(skillFile);
            }
            this.state.disabledProfileSkills[profileId] = disabled;
        }
        await this.saveState();
    }

    async toggleExtra(skillFile: string, enabled: boolean): Promise<void> {
        if (enabled) {
            if (!this.state.enabledExtras.includes(skillFile)) {
                this.state.enabledExtras.push(skillFile);
            }
        } else {
            this.state.enabledExtras = this.state.enabledExtras.filter(s => s !== skillFile);
        }
        await this.saveState();
    }

    async setProfileCollapsed(profileId: string, collapsed: boolean): Promise<void> {
        this.state.sidebarCollapsed[profileId] = collapsed;
        await this.saveState();
    }

    // --- Persistence ---

    private async saveConfig(): Promise<void> {
        await writeJsonFile(this.getConfigPath(), this.config);
    }

    async saveState(): Promise<void> {
        await writeJsonFile(this.getStatePath(), this.state);
    }
}

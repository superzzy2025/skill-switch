import * as path from 'path';
import * as os from 'os';
import { GlobalConfig, IdeConfig, AppState, LegacyGlobalConfig, LegacyAppState } from '../types';
import { readJsonFile, writeJsonFile, ensureDir, pathExists } from '../utils/fileUtils';
import { detectCurrentIde, getIdeDisplayName } from '../utils/ideDetector';

const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
    storagePath: path.join(os.homedir(), '.skill-switch'),
    language: 'en',
};

const DEFAULT_IDE_CONFIG: IdeConfig = {
    targetPath: '',
};

function createDefaultState(): AppState {
    return {
        activeProfile: '',
        disabledProfileSkills: {},
        enabledExtras: [],
        sidebarCollapsed: {},
    };
}

export class StateManager {
    private globalConfig: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG };
    private ideConfig: IdeConfig = { ...DEFAULT_IDE_CONFIG };
    private state: AppState = createDefaultState();
    private currentIdeKey: string = 'unknown';

    /** Initialize: load or create config and state */
    async initialize(appName?: string): Promise<void> {
        // Detect current IDE
        this.currentIdeKey = appName ? detectCurrentIde(appName) : 'unknown';

        // 1. Load global config from fixed default location
        const globalConfigPath = this.getGlobalConfigPath();
        const rawGlobalConfig = await readJsonFile<Record<string, unknown>>(globalConfigPath);

        if (rawGlobalConfig) {
            this.globalConfig = {
                storagePath: (rawGlobalConfig as any).storagePath ?? DEFAULT_GLOBAL_CONFIG.storagePath,
                language: (rawGlobalConfig as any).language ?? DEFAULT_GLOBAL_CONFIG.language,
            };
        } else {
            this.globalConfig = { ...DEFAULT_GLOBAL_CONFIG };
        }

        // 2. Migrate legacy data if needed
        await this.migrateLegacyDataIfNeeded(rawGlobalConfig);

        // 3. Ensure global directories exist
        await ensureDir(this.getStoragePath());
        await ensureDir(this.getProfilesPath());
        await ensureDir(this.getExtrasPath());
        await ensureDir(this.getDesignDocsPath());

        // 4. Ensure IDE-specific directory exists
        await ensureDir(this.getIdeDirPath());

        // 5. Load IDE-specific config
        const ideConfigPath = this.getIdeConfigPath();
        const rawIdeConfig = await readJsonFile<IdeConfig>(ideConfigPath);
        if (rawIdeConfig) {
            this.ideConfig = rawIdeConfig;
        } else {
            this.ideConfig = { ...DEFAULT_IDE_CONFIG };
        }

        // 6. Load IDE-specific state
        const statePath = this.getIdeStatePath();
        const stateFileExists = await pathExists(statePath);
        const rawState = await readJsonFile<AppState>(statePath);

        let needsStateSave = false;

        if (rawState) {
            this.state = rawState;
        } else if (!stateFileExists) {
            this.state = createDefaultState();
            needsStateSave = true;
        } else {
            // State file exists but could not be read — don't overwrite
            console.error(`[skill-switch] CRITICAL: State file exists but could not be read: ${statePath}`);
            console.error('[skill-switch] Using default state in memory without overwriting the file.');
            this.state = createDefaultState();
        }

        // 7. Persist configs and state if needed
        await this.saveGlobalConfig();
        await this.saveIdeConfig();

        if (needsStateSave) {
            await this.saveState();
        }
    }

    /**
     * Migrate legacy data from old global format to new per-IDE format.
     * Old format: single config.json with targetPaths/targetPath, single state.json
     * New format: global config.json + per-IDE ide/{ideKey}/config.json + ide/{ideKey}/state.json
     */
    private async migrateLegacyDataIfNeeded(rawGlobalConfig: Record<string, unknown> | null): Promise<void> {
        if (!rawGlobalConfig) {
            return;
        }

        // Check for legacy targetPath (single string) in global config
        const legacyTargetPath = (rawGlobalConfig as any).targetPath as string | undefined;
        const legacyTargetPaths = (rawGlobalConfig as any).targetPaths as Record<string, string> | undefined;

        // Check if old global state.json exists
        const oldStatePath = path.join(this.getStoragePath(), 'state.json');
        const oldStateExists = await pathExists(oldStatePath);

        // If no legacy data, nothing to migrate
        if (!legacyTargetPath && !legacyTargetPaths && !oldStateExists) {
            return;
        }

        // Migrate targetPath(s) to per-IDE config files
        if (legacyTargetPaths && Object.keys(legacyTargetPaths).length > 0) {
            // Multiple IDE target paths — create per-IDE config for each
            for (const [ideKey, targetPath] of Object.entries(legacyTargetPaths)) {
                const ideDir = path.join(this.getStoragePath(), 'ide', ideKey);
                await ensureDir(ideDir);
                const ideConfigPath = path.join(ideDir, 'config.json');
                const existingIdeConfig = await readJsonFile<IdeConfig>(ideConfigPath);
                if (!existingIdeConfig) {
                    await writeJsonFile(ideConfigPath, { targetPath });
                }
            }
        } else if (legacyTargetPath) {
            // Single targetPath — assign to current IDE
            const ideDir = path.join(this.getStoragePath(), 'ide', this.currentIdeKey);
            await ensureDir(ideDir);
            const ideConfigPath = path.join(ideDir, 'config.json');
            const existingIdeConfig = await readJsonFile<IdeConfig>(ideConfigPath);
            if (!existingIdeConfig) {
                await writeJsonFile(ideConfigPath, { targetPath: legacyTargetPath });
            }
        }

        // Migrate old global state.json to per-IDE state files
        if (oldStateExists) {
            const rawOldState = await readJsonFile<Record<string, unknown>>(oldStatePath);
            if (rawOldState) {
                // Determine which IDEs need state files
                const ideKeys = new Set<string>();

                // Always include current IDE
                ideKeys.add(this.currentIdeKey);

                // If old state has per-IDE structure (from intermediate format), extract IDE keys
                if ((rawOldState as any).disabledProfileSkills && typeof (rawOldState as any).disabledProfileSkills === 'object') {
                    const dpks = (rawOldState as any).disabledProfileSkills;
                    for (const key of Object.keys(dpks)) {
                        // Check if value is a nested Record (per-IDE format) or array (legacy format)
                        if (typeof dpks[key] === 'object' && !Array.isArray(dpks[key])) {
                            // Per-IDE format: key is an IDE key
                            ideKeys.add(key);
                        }
                    }
                }

                if ((rawOldState as any).enabledExtras && typeof (rawOldState as any).enabledExtras === 'object' && !Array.isArray((rawOldState as any).enabledExtras)) {
                    for (const key of Object.keys((rawOldState as any).enabledExtras)) {
                        ideKeys.add(key);
                    }
                }

                // For each IDE, create its state file
                for (const ideKey of ideKeys) {
                    const ideDir = path.join(this.getStoragePath(), 'ide', ideKey);
                    await ensureDir(ideDir);
                    const ideStatePath = path.join(ideDir, 'state.json');
                    const existingIdeState = await readJsonFile<AppState>(ideStatePath);

                    if (!existingIdeState) {
                        const ideState = this.extractIdeState(rawOldState, ideKey);
                        await writeJsonFile(ideStatePath, ideState);
                    }
                }

                // Rename old state file to mark as migrated
                const migratedPath = oldStatePath + '.migrated';
                const { rename } = await import('fs/promises');
                try {
                    await rename(oldStatePath, migratedPath);
                } catch {
                    // If rename fails, just leave the old file
                }
            }
        }

        // Clean up global config: remove targetPath/targetPaths fields
        const needsConfigCleanup = legacyTargetPath || legacyTargetPaths;
        if (needsConfigCleanup) {
            const cleanConfig: GlobalConfig = {
                storagePath: this.globalConfig.storagePath,
                language: this.globalConfig.language,
            };
            await writeJsonFile(this.getGlobalConfigPath(), cleanConfig);
        }
    }

    /**
     * Extract per-IDE state from old global/intermediate state format
     */
    private extractIdeState(rawOldState: Record<string, unknown>, ideKey: string): AppState {
        const legacy = rawOldState as any;

        // Determine if disabledProfileSkills is per-IDE (Record<ideKey, Record<profileId, string[]>>)
        // or legacy (Record<profileId, string[]>)
        let disabledProfileSkills: Record<string, string[]>;
        const dpks = legacy.disabledProfileSkills;
        if (dpks && typeof dpks === 'object') {
            const firstValue = Object.values(dpks)[0];
            if (Array.isArray(firstValue)) {
                // Legacy format: dpks = { profileId: string[] }
                // This data belongs to the current IDE
                if (ideKey === this.currentIdeKey) {
                    disabledProfileSkills = dpks as Record<string, string[]>;
                } else {
                    disabledProfileSkills = {};
                }
            } else if (typeof firstValue === 'object' && firstValue !== null) {
                // Per-IDE format: dpks = { ideKey: { profileId: string[] } }
                disabledProfileSkills = dpks[ideKey] ?? {};
            } else {
                disabledProfileSkills = {};
            }
        } else {
            disabledProfileSkills = {};
        }

        // Determine if enabledExtras is per-IDE (Record<ideKey, string[]>) or legacy (string[])
        let enabledExtras: string[];
        const ee = legacy.enabledExtras;
        if (Array.isArray(ee)) {
            // Legacy format: ee = string[]
            if (ideKey === this.currentIdeKey) {
                enabledExtras = ee;
            } else {
                enabledExtras = [];
            }
        } else if (ee && typeof ee === 'object') {
            // Per-IDE format: ee = { ideKey: string[] }
            enabledExtras = ee[ideKey] ?? [];
        } else {
            enabledExtras = [];
        }

        return {
            activeProfile: legacy.activeProfile ?? '',
            disabledProfileSkills,
            enabledExtras,
            sidebarCollapsed: legacy.sidebarCollapsed ?? {},
        };
    }

    // --- IDE Info ---

    getCurrentIdeKey(): string {
        return this.currentIdeKey;
    }

    getCurrentIdeName(): string {
        return getIdeDisplayName(this.currentIdeKey);
    }

    hasTargetPath(): boolean {
        return !!this.ideConfig.targetPath?.trim();
    }

    // --- Global Config ---

    getGlobalConfig(): GlobalConfig {
        return this.globalConfig;
    }

    /** Update global config fields and persist */
    async updateGlobalConfig(partial: Partial<GlobalConfig>): Promise<void> {
        this.globalConfig = { ...this.globalConfig, ...partial };
        await this.saveGlobalConfig();
        await ensureDir(this.getStoragePath());
        await ensureDir(this.getProfilesPath());
        await ensureDir(this.getExtrasPath());
        await ensureDir(this.getDesignDocsPath());
        await ensureDir(this.getIdeDirPath());
    }

    getStoragePath(): string {
        return this.globalConfig.storagePath;
    }

    getProfilesPath(): string {
        return path.join(this.globalConfig.storagePath, 'profiles');
    }

    getExtrasPath(): string {
        return path.join(this.globalConfig.storagePath, 'extras');
    }

    getDesignDocsPath(): string {
        return path.join(this.globalConfig.storagePath, 'design-docs');
    }

    // --- IDE Config ---

    getIdeConfig(): IdeConfig {
        return this.ideConfig;
    }

    /** Get the target path for the current IDE. Returns empty string if not configured. */
    getTargetPath(): string {
        return this.ideConfig.targetPath ?? '';
    }

    /** Set the target path for the current IDE */
    async setTargetPath(targetPath: string): Promise<void> {
        this.ideConfig.targetPath = targetPath;
        await this.saveIdeConfig();
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
            this.state.disabledProfileSkills[profileId] = disabled.filter(s => s !== skillFile);
        } else {
            if (!disabled.includes(skillFile)) {
                this.state.disabledProfileSkills[profileId] = [...disabled, skillFile];
            }
        }
        await this.saveState();
    }

    async toggleExtra(skillFile: string, enabled: boolean): Promise<void> {
        const currentExtras = this.state.enabledExtras;
        if (enabled) {
            if (!currentExtras.includes(skillFile)) {
                this.state.enabledExtras = [...currentExtras, skillFile];
            }
        } else {
            this.state.enabledExtras = currentExtras.filter(s => s !== skillFile);
        }
        await this.saveState();
    }

    async setProfileCollapsed(profileId: string, collapsed: boolean): Promise<void> {
        this.state.sidebarCollapsed[profileId] = collapsed;
        await this.saveState();
    }

    // --- Path helpers ---

    private getIdeDirPath(): string {
        return path.join(this.globalConfig.storagePath, 'ide', this.currentIdeKey);
    }

    private getIdeConfigPath(): string {
        return path.join(this.getIdeDirPath(), 'config.json');
    }

    private getIdeStatePath(): string {
        return path.join(this.getIdeDirPath(), 'state.json');
    }

    private getGlobalConfigPath(): string {
        return path.join(DEFAULT_GLOBAL_CONFIG.storagePath, 'config.json');
    }

    // --- Persistence ---

    private async saveGlobalConfig(): Promise<void> {
        await writeJsonFile(this.getGlobalConfigPath(), this.globalConfig);
    }

    private async saveIdeConfig(): Promise<void> {
        await ensureDir(this.getIdeDirPath());
        await writeJsonFile(this.getIdeConfigPath(), this.ideConfig);
    }

    async saveState(): Promise<void> {
        await ensureDir(this.getIdeDirPath());
        await writeJsonFile(this.getIdeStatePath(), this.state);
    }
}

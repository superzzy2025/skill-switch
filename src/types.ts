/** Profile metadata stored in _meta.json */
export interface ProfileMeta {
    id: string;
    name: string;
    description: string;
    createdAt: string;
    updatedAt: string;
    isBackup?: boolean;
    backupOf?: string;  // original profile id
}

/** Extra skill entry in extras/_meta.json */
export interface ExtraSkillMeta {
    name: string;
    description: string;
}

/** The extras/_meta.json structure */
export interface ExtrasMeta {
    skills: Record<string, ExtraSkillMeta>;  // key = filename
}

/** Runtime state stored in state.json */
export interface AppState {
    activeProfile: string;
    /** Per-profile disabled skill list. Key = profileId, Value = array of disabled skill filenames */
    disabledProfileSkills: Record<string, string[]>;
    enabledExtras: string[];
    sidebarCollapsed: Record<string, boolean>;
}

/** Supported display languages */
export type Language = 'en' | 'zh';

/** Global config stored in config.json */
export interface AppConfig {
    /** Per-IDE target paths: ideKey → absolute skill sync path */
    targetPaths: Record<string, string>;
    storagePath: string;
    language: Language;
}

/** Legacy config format (for migration) */
export interface LegacyAppConfig {
    targetPath: string;
    storagePath: string;
    language: Language;
}

/** A fully resolved profile with its meta and skill files */
export interface ResolvedProfile {
    meta: ProfileMeta;
    skillFiles: string[];  // skill directory names, e.g. "react-patterns"
}

/** Full app data for the tree to render */
export interface AppData {
    profiles: ResolvedProfile[];
    backups: ResolvedProfile[];
    extras: { filename: string; meta: ExtraSkillMeta }[];
    designDocs: { dirname: string; meta: import('./services/designDocManager').DesignDocMeta }[];
    state: AppState;
}

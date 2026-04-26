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

/** Runtime state stored in ide/{ideKey}/state.json — fully per-IDE */
export interface AppState {
    activeProfile: string;
    /** Per-profile disabled skill list. Key = profileId, Value = array of disabled skill filenames */
    disabledProfileSkills: Record<string, string[]>;
    /** Enabled extra skill filenames */
    enabledExtras: string[];
    /** Sidebar collapse state. Key = profileId, Value = collapsed */
    sidebarCollapsed: Record<string, boolean>;
}

/** Supported display languages */
export type Language = 'en' | 'zh';

/** Global config stored in config.json — shared across all IDEs */
export interface GlobalConfig {
    storagePath: string;
    language: Language;
}

/** Per-IDE config stored in ide/{ideKey}/config.json */
export interface IdeConfig {
    /** Target path for skill sync */
    targetPath: string;
}

/** Legacy global config format (for migration) */
export interface LegacyGlobalConfig {
    targetPath?: string;
    targetPaths?: Record<string, string>;
    storagePath: string;
    language: Language;
}

/** Legacy state format (for migration from old global state.json) */
export interface LegacyAppState {
    activeProfile: string;
    disabledProfileSkills: Record<string, string[]>;
    enabledExtras: string[];
    sidebarCollapsed: Record<string, boolean>;
}

/** A skill entry with its directory name and display metadata */
export interface ResolvedSkill {
    /** Directory name, e.g. "react-patterns" */
    fileName: string;
    /** Display name from SKILL.md frontmatter, falls back to fileName */
    name: string;
    /** Description from SKILL.md frontmatter */
    description: string;
}

/** A fully resolved profile with its meta and skill files */
export interface ResolvedProfile {
    meta: ProfileMeta;
    skillFiles: ResolvedSkill[];
}

/** Full app data for the tree to render */
export interface AppData {
    profiles: ResolvedProfile[];
    backups: ResolvedProfile[];
    extras: { filename: string; meta: ExtraSkillMeta }[];
    designDocs: { dirname: string; meta: import('./services/designDocManager').DesignDocMeta }[];
    state: AppState;
}

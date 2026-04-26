import { Language } from '../types';

type TranslationKey = keyof typeof enUS;

const enUS = {
    // Sidebar
    sidebarTitle: 'SKILL SWITCH',
    sectionBaseProfile: 'BASE PROFILE',
    sectionPermanentSkills: 'PERMANENT SKILLS',
    permanentSkillsDesc: 'Always available across all profiles',
    sectionBackups: 'BACKUPS',
    backupsDesc: 'Profile backups stored in the system',
    sectionDesignDocs: 'DESIGN DOCS',
    designDocsDesc: 'Design documents and references',
    activeBadge: 'ACTIVE',
    switchBtn: 'SWITCH',
    onTag: 'ON',
    offTag: 'OFF',
    editBtn: 'Edit',
    openBtn: 'Open',
    addSkillBtn: 'Add Skill',
    addPermanentBtn: 'Add Permanent Skill',
    skillCountLabel: 'skills',
    fileCountLabel: 'files',

    // Settings Panel
    settingsTitle: 'Settings',
    pathConfigTitle: 'Path Configuration',
    pathConfigDesc: 'Configure where skill files are stored and synced to',
    targetPathLabel: 'Target Path',
    targetPathHint: 'Absolute path where skill files are synced (e.g. C:\\Users\\you\\.claude\\skills)',
    storagePathLabel: 'Storage Path',
    storagePathHint: 'Where profile and permanent skill data are stored locally',
    browseBtn: 'Browse',
    languageTitle: 'Language / 语言',
    languageDesc: 'Choose the display language for the extension interface (支持中文和英文)',
    displayLanguageLabel: 'Display Language',
    languageHint: 'Restart the extension after changing language',
    cancelBtn: 'Cancel',
    saveBtn: 'Save Settings',

    // Messages
    msgTargetPathUpdated: 'Target path updated to',
    msgStoragePathUpdated: 'Storage path updated to',
    msgLanguageUpdated: 'Language updated. Please reload the window to apply changes.',
    msgSettingsSaved: 'Settings saved successfully',
    msgProfileNamePrompt: 'Profile name',
    msgProfileNamePlaceholder: 'e.g. Frontend Dev',
    msgProfileDescPrompt: 'Profile description (optional)',
    msgProfileDescPlaceholder: 'e.g. React + TypeScript development environment',
    msgCopyFrom: 'Copy from',
    msgHowToPopulate: 'How to populate the new profile?',
    msgEmpty: '(Empty)',
    msgEmptyDesc: 'Create an empty profile with no skills',
    msgCreateNew: 'Create new skill',
    msgImportFromTarget: 'Import from target path',
    msgImportFromTargetDesc: 'Import skills from the configured target path',
    msgImportFromDir: 'Import from directory...',
    msgImportFromDirDesc: 'Import skills from a folder on your computer',
    msgImportFromFile: 'Import from file...',
    msgSelectSkillDir: 'Select a skill directory (containing SKILL.md)',
    msgSelectSkillRootDir: 'Select a folder containing skill directories',
    msgHowToAddSkill: 'How to add a skill?',
    msgHowToAddExtra: 'How to add a permanent skill?',
    msgHowToAddDesignDoc: 'How to add a design document?',
    msgSkillNamePrompt: 'Skill name',
    msgSkillNamePlaceholder: 'e.g. react-patterns',
    msgSkillDescPrompt: 'Skill description (optional)',
    msgDeleteConfirm: 'Delete profile "{0}" and all its skill files?',
    msgRemoveConfirm: 'Remove skill "{0}" from profile?',
    msgRemoveExtraConfirm: 'Remove permanent skill "{0}"?',
    msgDelete: 'Delete',
    msgRemove: 'Remove',
    msgNoProfileActive: 'No profile active',
    msgWelcome: 'Skill Switch: Welcome! Configure your skill paths and create your first profile.',
    msgOpenSettings: 'Open Settings',
    msgCreateProfile: 'Create Profile',
    msgDefaultProfileName: 'Default',

    // Language names
    langEn: 'English',
    langZh: '中文 (Chinese)',

    // Sync messages
    msgSwitchedTo: 'Switched to {0} ({1} skills{2})',
    msgSyncFailed: 'Sync failed — {0}',

    // Import messages
    msgImportSuccess: 'Imported {0} skills from target path into profile "{1}"',
    msgImportNoSkills: 'No skill directories (with SKILL.md) found in target path: {0}',
    msgImportNoWorkspace: 'Please open a workspace first',
    msgImportTargetNotFound: 'Target path not found: {0}',
    msgImportProfileName: 'Profile name for imported skills',
    msgImportProfileNamePlaceholder: 'e.g. Imported Skills',
    msgImportAddedToExisting: 'Added {0} skills to profile "{1}"',
    msgImportChooseProfile: 'Choose a profile to add skills to, or create a new one',
    msgImportNewProfile: 'Create new profile',
    msgImportNewProfileDesc: 'Create a new profile for imported skills',
    msgImportChooseSource: 'Choose where to import skills from',
    msgImportDone: 'Import complete: {0} skills',
    msgImportSkipped: '{0} duplicates skipped',
    msgSkillAlreadyExists: 'Skill "{0}" already exists',

    // Refresh & sync
    msgRefreshSynced: 'Synced "{0}" to target path',

    // Backup & Restore
    msgBackupTag: 'Backup',
    msgBackupOf: 'Backup of {0}',
    msgBackupSuccess: 'Profile "{0}" backed up as "{1}"',
    msgNoBackups: 'No backups available',
    msgRestoreChooseBackup: 'Choose a backup to restore',
    msgRestoreProfileName: 'Profile name for restored skills',
    msgRestoreProfileNamePlaceholder: 'e.g. Restored Profile',
    msgRestoreSuccess: 'Profile "{0}" restored with {1} skills',
    msgOverwrite: 'Overwrite',
    msgCancel: 'Cancel',

    // Move to permanent
    msgMovedToPermanent: 'Skill "{0}" moved to permanent skills',
    msgUndoMoveToPermanent: 'Undo',
    msgMoveToPermanentUndone: 'Skill "{0}" moved back to profile',
    msgRemovedSkill: 'Skill "{0}" removed',
    msgUndoRemove: 'Undo',
    msgRemoveUndone: 'Skill "{0}" restored',
    msgRemovedExtra: 'Permanent skill "{0}" removed',
    msgUndoRemoveExtra: 'Undo',
    msgRemoveExtraUndone: 'Permanent skill "{0}" restored',
    msgMovedExtraToProfile: 'Permanent skill "{0}" moved to profile "{1}"',
    msgCopiedExtraToProfile: 'Permanent skill "{0}" copied to profile "{1}"',
    msgChooseTargetProfile: 'Choose a target profile',
    msgMoveToProfile: 'Move to profile...',
    msgCopyToProfile: 'Copy to profile...',
    msgClose: 'Close',

    // Design Docs
    msgSelectDesignDoc: 'Select a design document file',
    msgSelectDesignDocDir: 'Select a design document directory',
    msgDesignDocNamePrompt: 'Design document name',
    msgDesignDocNamePlaceholder: 'e.g. system-architecture',
    msgDesignDocDescPrompt: 'Design document description (optional)',
    msgDesignDocDescPlaceholder: 'e.g. System architecture diagram',
    msgDesignDocAlreadyExists: 'Design document "{0}" already exists',
    msgDesignDocAdded: 'Design document "{0}" added',
    msgRemoveDesignDocConfirm: 'Remove design document "{0}"?',
    msgDeleteFolderConfirm: 'Delete folder "{0}"?',
    msgNewFilePrompt: 'New file name',
    msgNewFilePlaceholder: 'e.g. README.md',
    msgNewFolderPrompt: 'New folder name',
    msgNewFolderPlaceholder: 'e.g. assets',
    docFileFilterLabel: 'Design Documents',
};

const zhCN: Record<TranslationKey, string> = {
    // Sidebar
    sidebarTitle: 'SKILL SWITCH',
    sectionBaseProfile: '基础配置',
    sectionPermanentSkills: '常驻技能',
    permanentSkillsDesc: '在所有配置中始终可用',
    sectionBackups: '备份',
    backupsDesc: '存储在系统中的配置备份',
    sectionDesignDocs: '设计文档',
    designDocsDesc: '设计文档和参考资料',
    activeBadge: '激活',
    switchBtn: '切换',
    onTag: '开',
    offTag: '关',
    editBtn: '编辑',
    openBtn: '打开',
    addSkillBtn: '添加技能',
    addPermanentBtn: '添加常驻技能',
    skillCountLabel: '个技能',
    fileCountLabel: '个文件',

    // Settings Panel
    settingsTitle: '设置',
    pathConfigTitle: '路径配置',
    pathConfigDesc: '配置技能文件的存储和同步位置',
    targetPathLabel: '目标路径',
    targetPathHint: '技能文件同步的绝对路径（如 C:\\Users\\you\\.claude\\skills）',
    storagePathLabel: '存储路径',
    storagePathHint: '本地存储配置和常驻技能数据的路径',
    browseBtn: '浏览',
    languageTitle: '语言 / Language',
    languageDesc: '选择扩展界面的显示语言 (Supports Chinese and English)',
    displayLanguageLabel: '显示语言',
    languageHint: '更改语言后请重启扩展以生效',
    cancelBtn: '取消',
    saveBtn: '保存设置',

    // Messages
    msgTargetPathUpdated: '目标路径已更新为',
    msgStoragePathUpdated: '存储路径已更新为',
    msgLanguageUpdated: '语言已更新，请重新加载窗口以应用更改。',
    msgSettingsSaved: '设置已成功保存',
    msgProfileNamePrompt: '配置名称',
    msgProfileNamePlaceholder: '例如：前端开发',
    msgProfileDescPrompt: '配置描述（可选）',
    msgProfileDescPlaceholder: '例如：React + TypeScript 开发环境',
    msgCopyFrom: '复制自',
    msgHowToPopulate: '如何填充新配置？',
    msgEmpty: '（空）',
    msgEmptyDesc: '创建一个不含技能的空配置',
    msgCreateNew: '创建新技能',
    msgImportFromTarget: '从目标路径导入',
    msgImportFromTargetDesc: '从已配置的目标路径导入技能',
    msgImportFromDir: '从目录导入...',
    msgImportFromDirDesc: '从电脑上的文件夹导入技能',
    msgImportFromFile: '从文件导入...',
    msgSelectSkillDir: '选择一个技能目录（包含 SKILL.md）',
    msgSelectSkillRootDir: '选择包含技能目录的文件夹',
    msgHowToAddSkill: '如何添加技能？',
    msgHowToAddExtra: '如何添加常驻技能？',
    msgHowToAddDesignDoc: '如何添加设计文档？',
    msgSkillNamePrompt: '技能名称',
    msgSkillNamePlaceholder: '例如：react-patterns',
    msgSkillDescPrompt: '技能描述（可选）',
    msgDeleteConfirm: '删除配置 "{0}" 及其所有技能文件？',
    msgRemoveConfirm: '从配置中移除技能 "{0}"？',
    msgRemoveExtraConfirm: '移除常驻技能 "{0}"？',
    msgDelete: '删除',
    msgRemove: '移除',
    msgNoProfileActive: '无激活配置',
    msgWelcome: 'Skill Switch：欢迎！请配置技能路径并创建你的第一个配置。',
    msgOpenSettings: '打开设置',
    msgCreateProfile: '创建配置',
    msgDefaultProfileName: '默认配置',

    // Language names
    langEn: 'English',
    langZh: '中文 (Chinese)',

    // Sync messages
    msgSwitchedTo: '已切换到 {0}（{1} 个技能{2}）',
    msgSyncFailed: '同步失败 — {0}',

    // Import messages
    msgImportSuccess: '从目标路径导入了 {0} 个技能到配置 "{1}"',
    msgImportNoSkills: '目标路径中未找到技能目录（含 SKILL.md）：{0}',
    msgImportNoWorkspace: '请先打开一个工作区',
    msgImportTargetNotFound: '目标路径不存在：{0}',
    msgImportProfileName: '导入技能的配置名称',
    msgImportProfileNamePlaceholder: '例如：已导入技能',
    msgImportAddedToExisting: '已添加 {0} 个技能到配置 "{1}"',
    msgImportChooseProfile: '选择要添加技能的配置，或创建新配置',
    msgImportNewProfile: '创建新配置',
    msgImportNewProfileDesc: '为导入的技能创建新配置',
    msgImportChooseSource: '选择从何处导入技能',
    msgImportDone: '导入完成：{0} 个技能',
    msgImportSkipped: '{0} 个重复已跳过',
    msgSkillAlreadyExists: '技能 "{0}" 已存在',

    // Refresh & sync
    msgRefreshSynced: '已将 "{0}" 同步到目标路径',

    // Backup & Restore
    msgBackupTag: '备份',
    msgBackupOf: '{0} 的备份',
    msgBackupSuccess: '配置 "{0}" 已备份为 "{1}"',
    msgNoBackups: '暂无可用备份',
    msgRestoreChooseBackup: '选择要恢复的备份',
    msgRestoreProfileName: '恢复技能的配置名称',
    msgRestoreProfileNamePlaceholder: '例如：已恢复配置',
    msgRestoreSuccess: '配置 "{0}" 已恢复，包含 {1} 个技能',
    msgOverwrite: '覆盖',
    msgCancel: '取消',

    // Move to permanent
    msgMovedToPermanent: '技能 "{0}" 已移至常驻技能',
    msgUndoMoveToPermanent: '撤回',
    msgMoveToPermanentUndone: '技能 "{0}" 已移回配置',
    msgRemovedSkill: '技能 "{0}" 已移除',
    msgUndoRemove: '撤回',
    msgRemoveUndone: '技能 "{0}" 已恢复',
    msgRemovedExtra: '常驻技能 "{0}" 已移除',
    msgUndoRemoveExtra: '撤回',
    msgRemoveExtraUndone: '常驻技能 "{0}" 已恢复',
    msgMovedExtraToProfile: '常驻技能 "{0}" 已移动到配置 "{1}"',
    msgCopiedExtraToProfile: '常驻技能 "{0}" 已复制到配置 "{1}"',
    msgChooseTargetProfile: '选择目标配置',
    msgMoveToProfile: '移动至配置...',
    msgCopyToProfile: '复制至配置...',
    msgClose: '关闭',

    // Design Docs
    msgSelectDesignDoc: '选择一个设计文档文件',
    msgSelectDesignDocDir: '选择一个设计文档目录',
    msgDesignDocNamePrompt: '设计文档名称',
    msgDesignDocNamePlaceholder: '例如：系统架构',
    msgDesignDocDescPrompt: '设计文档描述（可选）',
    msgDesignDocDescPlaceholder: '例如：系统架构图',
    msgDesignDocAlreadyExists: '设计文档 "{0}" 已存在',
    msgDesignDocAdded: '设计文档 "{0}" 已添加',
    msgRemoveDesignDocConfirm: '移除设计文档 "{0}"？',
    msgDeleteFolderConfirm: '删除文件夹 "{0}"？',
    msgNewFilePrompt: '新文件名称',
    msgNewFilePlaceholder: '例如：README.md',
    msgNewFolderPrompt: '新文件夹名称',
    msgNewFolderPlaceholder: '例如：assets',
    docFileFilterLabel: '设计文档',
};

const translations: Record<Language, Record<TranslationKey, string>> = {
    en: enUS,
    zh: zhCN,
};

let currentLanguage: Language = 'en';

/** Initialize the i18n module with the configured language */
export function initI18n(language: Language): void {
    currentLanguage = language;
}

/** Get the current language */
export function getCurrentLanguage(): Language {
    return currentLanguage;
}

/** Set the current language at runtime */
export function setLanguage(language: Language): void {
    currentLanguage = language;
}

/** Get a translated string by key, with optional interpolation */
export function t(key: TranslationKey, ...args: string[]): string {
    let text = translations[currentLanguage]?.[key] ?? enUS[key] ?? key;
    args.forEach((arg, i) => {
        text = text.replace(`{${i}}`, arg);
    });
    return text;
}

/** Get all translation keys (type-safe) */
export type { TranslationKey };

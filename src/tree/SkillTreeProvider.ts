import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { AppData, ExtraSkillMeta } from '../types';
import { DesignDocMeta } from '../services/designDocManager';
import { t } from '../i18n';

type ProviderResult<T> = vscode.ProviderResult<T>;

// --- Tree Item Classes ---

export class ProfileItem extends vscode.TreeItem {
    constructor(
        public readonly profileId: string,
        name: string,
        description: string,
        isActive: boolean,
        skillCount: number
    ) {
        super(
            name,
            isActive
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed
        );
        this.description = isActive ? t('activeBadge') : '';
        this.tooltip = description || name;
        this.contextValue = isActive ? 'profile-active' : 'profile-inactive';
        this.iconPath = new vscode.ThemeIcon(
            isActive ? 'folder-opened' : 'folder',
            isActive ? new vscode.ThemeColor('charts.green') : undefined
        );
    }
}

export class ProfileSkillItem extends vscode.TreeItem {
    constructor(
        public readonly profileId: string,
        public readonly fileName: string,
        skillName: string,
        skillDesc: string,
        enabled: boolean
    ) {
        super(skillName || fileName, vscode.TreeItemCollapsibleState.None);
        this.description = enabled ? (skillDesc ? '' : '') : t('offTag');
        this.tooltip = skillDesc || skillName || fileName;
        this.contextValue = enabled ? 'skill-enabled' : 'skill-disabled';
        this.iconPath = new vscode.ThemeIcon(
            enabled ? 'folder-opened' : 'folder',
            enabled ? undefined : new vscode.ThemeColor('disabledForeground')
        );
        this.checkboxState = enabled
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;
        this.command = {
            command: 'skillSwitch.editSkill',
            title: t('editBtn'),
            arguments: [this],
        };
    }
}

export class BackupsHeaderItem extends vscode.TreeItem {
    constructor(backupCount: number) {
        super(t('sectionBackups'), vscode.TreeItemCollapsibleState.Collapsed);
        this.description = `${backupCount}`;
        this.tooltip = t('backupsDesc');
        this.contextValue = 'backups-header';
        this.iconPath = new vscode.ThemeIcon('archive');
    }
}

export class BackupProfileItem extends vscode.TreeItem {
    constructor(
        public readonly profileId: string,
        name: string,
        description: string,
        skillCount: number
    ) {
        super(name, vscode.TreeItemCollapsibleState.Collapsed);
        this.description = `${skillCount} ${t('skillCountLabel')}`;
        this.tooltip = description || name;
        this.contextValue = 'backup-profile';
        this.iconPath = new vscode.ThemeIcon('folder');
    }
}

export class PermanentHeaderItem extends vscode.TreeItem {
    constructor(extraCount: number) {
        super(t('sectionPermanentSkills'), vscode.TreeItemCollapsibleState.Expanded);
        this.description = `${extraCount}`;
        this.tooltip = t('permanentSkillsDesc');
        this.contextValue = 'permanent-header';
        this.iconPath = new vscode.ThemeIcon('layers');
    }
}

export class PermanentSkillItem extends vscode.TreeItem {
    constructor(
        public readonly fileName: string,
        meta: ExtraSkillMeta,
        enabled: boolean
    ) {
        super(meta.name || fileName, vscode.TreeItemCollapsibleState.None);
        this.description = enabled ? t('onTag') : t('offTag');
        this.tooltip = meta.description || fileName;
        this.contextValue = enabled ? 'permanent-skill-enabled' : 'permanent-skill-disabled';
        this.iconPath = new vscode.ThemeIcon(
            enabled ? 'folder-opened' : 'folder',
            enabled ? new vscode.ThemeColor('charts.purple') : undefined
        );
        this.checkboxState = enabled
            ? vscode.TreeItemCheckboxState.Checked
            : vscode.TreeItemCheckboxState.Unchecked;
        this.command = {
            command: 'skillSwitch.editExtra',
            title: t('editBtn'),
            arguments: [this],
        };
    }
}

export class DesignDocHeaderItem extends vscode.TreeItem {
    constructor(docCount: number) {
        super(t('sectionDesignDocs'), vscode.TreeItemCollapsibleState.Collapsed);
        this.description = `${docCount}`;
        this.tooltip = t('designDocsDesc');
        this.contextValue = 'designdoc-header';
        this.iconPath = new vscode.ThemeIcon('file-media');
    }
}

export class DesignDocItem extends vscode.TreeItem {
    constructor(
        public readonly docName: string,
        meta: DesignDocMeta,
        childCount: number
    ) {
        super(meta.name || docName, childCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.description = meta.description || (childCount > 0 ? `${childCount} ${t('fileCountLabel')}` : '');
        this.tooltip = meta.description || meta.name || docName;
        this.contextValue = 'designdoc-item';
        this.iconPath = new vscode.ThemeIcon('file');
    }
}

export class DesignDocFolderItem extends vscode.TreeItem {
    constructor(
        public readonly docName: string,
        public readonly folderPath: string,
        folderName: string,
        childCount: number
    ) {
        super(folderName, childCount > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.contextValue = 'designdoc-folder';
        this.iconPath = vscode.ThemeIcon.Folder;
    }
}

export class DesignDocFileItem extends vscode.TreeItem {
    constructor(
        public readonly docName: string,
        public readonly fileName: string,
        filePath: string
    ) {
        super(fileName, vscode.TreeItemCollapsibleState.None);
        this.tooltip = filePath;
        this.contextValue = 'designdoc-file';
        this.iconPath = new vscode.ThemeIcon('file');
        this.command = {
            command: 'vscode.open',
            title: t('openBtn'),
            arguments: [vscode.Uri.file(filePath)],
        };
    }
}

// --- Tree Data Provider ---

type SkillTreeItem = ProfileItem | ProfileSkillItem | BackupsHeaderItem | BackupProfileItem | PermanentHeaderItem | PermanentSkillItem | DesignDocHeaderItem | DesignDocItem | DesignDocFolderItem | DesignDocFileItem;

export class SkillTreeProvider implements vscode.TreeDataProvider<SkillTreeItem> {
    private _onDidChangeTreeData = new vscode.EventEmitter<SkillTreeItem | undefined | null>();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private data: AppData | null = null;
    private designDocsPath: string = '';

    setDesignDocsPath(p: string): void {
        this.designDocsPath = p;
    }

    refresh(data?: AppData): void {
        if (data) {
            this.data = data;
        }
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: SkillTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SkillTreeItem): Promise<SkillTreeItem[]> {
        if (!this.data) {
            return [];
        }

        if (!element) {
            // Root level: profiles (active first) + backups header + permanent header + design docs header
            const items: SkillTreeItem[] = [];
            // Sort profiles: active profile first, then others by name
            const sortedProfiles = [...this.data.profiles].sort((a, b) => {
                const aActive = a.meta.id === this.data!.state.activeProfile ? 0 : 1;
                const bActive = b.meta.id === this.data!.state.activeProfile ? 0 : 1;
                if (aActive !== bActive) { return aActive - bActive; }
                return a.meta.name.localeCompare(b.meta.name);
            });
            for (const profile of sortedProfiles) {
                const isActive = profile.meta.id === this.data.state.activeProfile;
                items.push(new ProfileItem(
                    profile.meta.id,
                    profile.meta.name,
                    profile.meta.description,
                    isActive,
                    profile.skillFiles.length
                ));
            }
            // Add backups section
            if (this.data.backups.length > 0) {
                items.push(new BackupsHeaderItem(this.data.backups.length));
            }
            // Add permanent skills section
            items.push(new PermanentHeaderItem(this.data.extras.length));
            // Add design docs section
            items.push(new DesignDocHeaderItem(this.data.designDocs.length));
            return items;
        }

        if (element instanceof ProfileItem) {
            const profile = this.data.profiles.find(
                p => p.meta.id === element.profileId
            );
            if (!profile) {
                return [];
            }
            const disabledSkills = this.data.state.disabledProfileSkills[element.profileId] ?? [];
            return profile.skillFiles.map(skill => new ProfileSkillItem(
                element.profileId,
                skill.fileName,
                skill.name,
                skill.description,
                !disabledSkills.includes(skill.fileName)
            ));
        }

        if (element instanceof BackupsHeaderItem) {
            return this.data.backups.map(backup => new BackupProfileItem(
                backup.meta.id,
                backup.meta.name,
                backup.meta.description,
                backup.skillFiles.length
            ));
        }

        if (element instanceof BackupProfileItem) {
            const backup = this.data.backups.find(
                b => b.meta.id === element.profileId
            );
            if (!backup) {
                return [];
            }
            return backup.skillFiles.map(skill => new ProfileSkillItem(
                element.profileId,
                skill.fileName,
                skill.name,
                skill.description,
                true  // backup skills are always shown as enabled (read-only)
            ));
        }

        if (element instanceof PermanentHeaderItem) {
            return this.data.extras.map(({ filename, meta }) => new PermanentSkillItem(
                filename,
                meta,
                this.data!.state.enabledExtras.includes(filename)
            ));
        }

        if (element instanceof DesignDocHeaderItem) {
            return await this.buildDesignDocItems();
        }

        if (element instanceof DesignDocItem) {
            const docDir = path.join(this.designDocsPath, element.docName);
            return await this.getDirChildren(element.docName, docDir);
        }

        if (element instanceof DesignDocFolderItem) {
            return await this.getDirChildren(element.docName, element.folderPath);
        }

        return [];
    }

    /** Build DesignDocItem array with async child counting */
    private async buildDesignDocItems(): Promise<DesignDocItem[]> {
        if (!this.data) { return []; }
        const items: DesignDocItem[] = [];
        for (const { dirname, meta } of this.data.designDocs) {
            const docDir = path.join(this.designDocsPath, dirname);
            const childCount = await this.countChildren(docDir);
            items.push(new DesignDocItem(dirname, meta, childCount));
        }
        return items;
    }

    /** Count children (files + directories) in a directory, excluding hidden files and _meta.json */
    private async countChildren(dirPath: string): Promise<number> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            return entries.filter(e => !e.name.startsWith('.') && e.name !== '_meta.json').length;
        } catch {
            return 0;
        }
    }

    /** Get children (files and subdirectories) for a design document directory */
    private async getDirChildren(docName: string, dirPath: string): Promise<(DesignDocFolderItem | DesignDocFileItem)[]> {
        try {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const items: (DesignDocFolderItem | DesignDocFileItem)[] = [];
            // Sort: directories first, then files, both alphabetically
            const sortedEntries = entries
                .filter(e => !e.name.startsWith('.') && e.name !== '_meta.json')
                .sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory()) { return -1; }
                    if (!a.isDirectory() && b.isDirectory()) { return 1; }
                    return a.name.localeCompare(b.name);
                });
            for (const entry of sortedEntries) {
                const entryPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    const childCount = await this.countChildren(entryPath);
                    items.push(new DesignDocFolderItem(docName, entryPath, entry.name, childCount));
                } else {
                    items.push(new DesignDocFileItem(docName, entry.name, entryPath));
                }
            }
            return items;
        } catch {
            return [];
        }
    }
}

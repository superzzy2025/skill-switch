import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as vscode from 'vscode';
import { StateManager } from '../services/stateManager';
import { ProfileManager } from '../services/profileManager';
import { ExtraManager } from '../services/extraManager';
import { DesignDocManager } from '../services/designDocManager';
import { SyncService } from '../services/syncService';
import { SkillTreeProvider, ProfileItem, ProfileSkillItem, PermanentSkillItem, BackupProfileItem, DesignDocItem, DesignDocFolderItem } from '../tree/SkillTreeProvider';
import { AppData, Language } from '../types';
import { SettingsWebviewPanel } from '../webview/SettingsWebviewPanel';
import { t, setLanguage } from '../i18n';
import { pathExists, listSkillDirectories, copyDirRecursive, ensureDir, removeDir } from '../utils/fileUtils';

export class CommandRegistry {
    constructor(
        private stateManager: StateManager,
        private profileManager: ProfileManager,
        private extraManager: ExtraManager,
        private designDocManager: DesignDocManager,
        private syncService: SyncService,
        private treeProvider: SkillTreeProvider,
        private statusBarItem: vscode.StatusBarItem,
        private extensionUri: vscode.Uri,
    ) {}

    /** Show a brief status bar message that auto-dismisses after 1 second */
    private showBriefMessage(message: string): void {
        vscode.window.setStatusBarMessage(message, 1000);
    }

    /** Show an information message with undo and close buttons */
    private async showUndoMessage(message: string, undoLabel: string, onUndo: () => Promise<void>): Promise<void> {
        const close = t('msgClose');
        const result = await vscode.window.showInformationMessage(message, undoLabel, close);
        if (result === undoLabel) {
            await onUndo();
        }
    }

    /** Register all commands */
    register(context: vscode.ExtensionContext): void {
        const disposables = [
            // Profile commands
            vscode.commands.registerCommand('skillSwitch.createProfile', () => this.createProfile()),
            vscode.commands.registerCommand('skillSwitch.deleteProfile', (item: ProfileItem | BackupProfileItem) => this.deleteProfile(item)),
            vscode.commands.registerCommand('skillSwitch.editProfile', (item: ProfileItem) => this.editProfile(item)),
            vscode.commands.registerCommand('skillSwitch.switchProfile', (item: ProfileItem) => this.switchProfile(item)),

            // Profile skill commands
            vscode.commands.registerCommand('skillSwitch.addSkillToProfile', (item: ProfileItem) => this.addSkillToProfile(item)),
            vscode.commands.registerCommand('skillSwitch.removeSkillFromProfile', (item: ProfileSkillItem) => this.removeSkillFromProfile(item)),
            vscode.commands.registerCommand('skillSwitch.editSkill', (...args: unknown[]) => this.editSkill(args)),

            // Extra skill commands
            vscode.commands.registerCommand('skillSwitch.addExtra', () => this.addExtra()),
            vscode.commands.registerCommand('skillSwitch.removeExtra', (item: PermanentSkillItem) => this.removeExtra(item)),
            vscode.commands.registerCommand('skillSwitch.editExtra', (...args: unknown[]) => this.editExtra(args)),
            vscode.commands.registerCommand('skillSwitch.moveToPermanent', (item: ProfileSkillItem) => this.moveToPermanent(item)),
            vscode.commands.registerCommand('skillSwitch.moveExtraToProfile', (item: PermanentSkillItem) => this.moveExtraToProfile(item)),
            vscode.commands.registerCommand('skillSwitch.copyExtraToProfile', (item: PermanentSkillItem) => this.copyExtraToProfile(item)),

            // Design doc commands
            vscode.commands.registerCommand('skillSwitch.addDesignDoc', () => this.addDesignDoc()),
            vscode.commands.registerCommand('skillSwitch.removeDesignDoc', (item: DesignDocItem) => this.removeDesignDoc(item)),
            vscode.commands.registerCommand('skillSwitch.openDesignDoc', (item: DesignDocItem) => this.openDesignDoc(item)),
            vscode.commands.registerCommand('skillSwitch.editDesignDocMeta', (item: DesignDocItem) => this.editDesignDocMeta(item)),
            vscode.commands.registerCommand('skillSwitch.openInExplorer', (item: DesignDocItem | DesignDocFolderItem) => this.openInExplorer(item)),
            vscode.commands.registerCommand('skillSwitch.deleteDesignDocFolder', (item: DesignDocFolderItem) => this.deleteDesignDocFolder(item)),
            vscode.commands.registerCommand('skillSwitch.newFile', (item: DesignDocItem | DesignDocFolderItem) => this.newFile(item)),
            vscode.commands.registerCommand('skillSwitch.newFolder', (item: DesignDocItem | DesignDocFolderItem) => this.newFolder(item)),

            // Settings
            vscode.commands.registerCommand('skillSwitch.openSettings', () => this.openSettings()),

            // Refresh
            vscode.commands.registerCommand('skillSwitch.refresh', () => this.refresh()),

            // Import from target path
            vscode.commands.registerCommand('skillSwitch.importFromTarget', () => this.importFromTarget()),

            // Backup & Restore
            vscode.commands.registerCommand('skillSwitch.backupProfile', (item: ProfileItem) => this.backupProfile(item)),
            vscode.commands.registerCommand('skillSwitch.restoreProfile', () => this.restoreProfile()),
        ];

        context.subscriptions.push(...disposables);
    }

    /** Load full app data for the tree */
    private async loadAppData(): Promise<AppData> {
        const allProfiles = await this.profileManager.listProfiles();
        const profiles = allProfiles.filter(p => !p.meta.isBackup);
        const backups = allProfiles.filter(p => p.meta.isBackup === true);
        const extras = await this.extraManager.listExtras();
        const designDocs = await this.designDocManager.listDesignDocs();
        const state = this.stateManager.getState();
        return { profiles, backups, extras, designDocs, state };
    }

    /** Refresh tree and status bar, also re-sync active profile to target */
    private async refresh(): Promise<void> {
        // Re-sync active profile to target path
        const state = this.stateManager.getState();
        if (state.activeProfile && this.stateManager.hasTargetPath()) {
            try {
                const profiles = await this.profileManager.listProfiles();
                const activeProfile = profiles.find(p => p.meta.id === state.activeProfile);
                const profileName = activeProfile?.meta.name ?? t('msgNoProfileActive');
                await this.syncService.sync(
                    this.stateManager.getProfilesPath(),
                    this.stateManager.getExtrasPath(),
                    this.stateManager.getTargetPath(),
                    state
                );
                this.showBriefMessage(t('msgRefreshSynced', profileName));
            } catch {
                // sync failed silently during refresh, tree still updates
            }
        }

        const data = await this.loadAppData();
        this.treeProvider.refresh(data);
        this.updateStatusBar(data);
    }

    /** Update status bar text */
    private updateStatusBar(data: AppData): void {
        const active = data.profiles.find(p => p.meta.id === data.state.activeProfile);
        if (active) {
            const disabledSkills = data.state.disabledProfileSkills[active.meta.id] ?? [];
            const enabledSkillCount = active.skillFiles.length - disabledSkills.length;
            const extraCount = data.state.enabledExtras.length;
            const extraPart = extraCount > 0 ? ` + ${extraCount} ${t('sectionPermanentSkills').toLowerCase()}` : '';
            this.statusBarItem.text = `$(sparkle) ${active.meta.name} | ${enabledSkillCount}${extraPart}`;
        } else {
            this.statusBarItem.text = `$(sparkle) ${t('msgNoProfileActive')}`;
        }
        this.statusBarItem.tooltip = t('sidebarTitle');
    }

    // --- Profile Commands ---

    private async createProfile(): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: t('msgProfileNamePrompt'),
            placeHolder: t('msgProfileNamePlaceholder'),
        });
        if (!name) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: t('msgProfileDescPrompt'),
            placeHolder: t('msgProfileDescPlaceholder'),
        });

        // Step 1: Create the empty profile first
        const id = await this.profileManager.generateUniqueId(name);
        await this.profileManager.createProfile(id, name, description ?? '', undefined);

        // Step 2: Ask how to populate the new profile
        type SourceType = 'empty' | 'copy' | 'import-target' | 'import-dir';
        const profiles = await this.profileManager.listProfiles();
        const otherProfiles = profiles.filter(p => p.meta.id !== id);
        const items: { label: string; description: string; sourceType: SourceType; sourceId?: string }[] = [
            { label: t('msgEmpty'), description: t('msgEmptyDesc'), sourceType: 'empty' },
            { label: t('msgImportFromTarget'), description: t('msgImportFromTargetDesc'), sourceType: 'import-target' },
            { label: t('msgImportFromDir'), description: t('msgImportFromDirDesc'), sourceType: 'import-dir' },
            ...otherProfiles.map(p => ({
                label: `${t('msgCopyFrom')} ${p.meta.name}`,
                description: `${p.skillFiles.length} ${t('skillCountLabel')}`,
                sourceType: 'copy' as SourceType,
                sourceId: p.meta.id,
            })),
        ];
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: t('msgHowToPopulate'),
        });
        if (!selected || selected.sourceType === 'empty') {
            // Profile already created as empty
        } else if (selected.sourceType === 'import-target') {
            // Import from the configured target path
            const targetPath = this.stateManager.getTargetPath();
            if (await pathExists(targetPath)) {
                const skills = await listSkillDirectories(targetPath);
                let addedCount = 0;
                for (const skillName of skills) {
                    if (!(await this.profileManager.skillExists(id, skillName))) {
                        await this.profileManager.addSkill(id, skillName, path.join(targetPath, skillName));
                        addedCount++;
                    }
                }
                this.showBriefMessage(
                    t('msgImportSuccess', String(addedCount), name)
                );
            } else {
                vscode.window.showWarningMessage(t('msgImportTargetNotFound', targetPath));
            }
        } else if (selected.sourceType === 'import-dir') {
            // Import from a directory selected by user
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                title: t('msgSelectSkillRootDir'),
            });
            if (uris && uris.length > 0) {
                const importPath = uris[0].fsPath;
                const skills = await listSkillDirectories(importPath);
                let addedCount = 0;
                for (const skillName of skills) {
                    if (!(await this.profileManager.skillExists(id, skillName))) {
                        await this.profileManager.addSkill(id, skillName, path.join(importPath, skillName));
                        addedCount++;
                    }
                }
                this.showBriefMessage(
                    t('msgImportSuccess', String(addedCount), name)
                );
            }
        } else if (selected.sourceType === 'copy') {
            // Copy from existing profile
            const sourceProfile = otherProfiles.find(p => p.meta.id === selected.sourceId);
            if (sourceProfile) {
                // Delete the empty profile and recreate with copy
                await this.profileManager.deleteProfile(id);
                await this.profileManager.createProfile(id, name, description ?? '', selected.sourceId);
            }
        }

        // Auto-activate if no active profile
        if (!this.stateManager.getActiveProfile()) {
            await this.stateManager.setActiveProfile(id);
            await this.doSync();
        }

        await this.refresh();
    }

    private async deleteProfile(item: ProfileItem | BackupProfileItem): Promise<void> {
        const confirmed = await vscode.window.showWarningMessage(
            t('msgDeleteConfirm', item.profileId),
            { modal: true },
            t('msgDelete')
        );
        if (confirmed !== t('msgDelete')) {
            return;
        }

        await this.profileManager.deleteProfile(item.profileId);

        // If deleted the active profile, clear it
        if (this.stateManager.getActiveProfile() === item.profileId) {
            await this.stateManager.setActiveProfile('');
            await this.doSync();
        }

        await this.refresh();
    }

    private async editProfile(item: ProfileItem): Promise<void> {
        const meta = await this.profileManager.getProfileMeta(item.profileId);
        if (!meta) {
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: t('msgProfileNamePrompt'),
            value: meta.name,
        });
        if (!name) {
            return;
        }

        const description = await vscode.window.showInputBox({
            prompt: t('msgProfileDescPrompt'),
            value: meta.description,
        });

        await this.profileManager.updateProfile(item.profileId, {
            name,
            description: description ?? '',
        });

        await this.refresh();
    }

    private async switchProfile(item: ProfileItem): Promise<void> {
        await this.stateManager.setActiveProfile(item.profileId);
        await this.doSync();
        await this.refresh();
    }

    // --- Profile Skill Commands ---

    private async addSkillToProfile(item: ProfileItem): Promise<void> {
        const choice = await vscode.window.showQuickPick(
            [t('msgCreateNew'), t('msgImportFromDir')],
            { placeHolder: t('msgHowToAddSkill') }
        );
        if (!choice) {
            return;
        }

        let skillName: string;
        let sourceDirPath: string | undefined;

        if (choice === t('msgImportFromDir')) {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                title: t('msgSelectSkillDir'),
            });
            if (!uris || uris.length === 0) {
                return;
            }
            sourceDirPath = uris[0].fsPath;
            skillName = path.basename(sourceDirPath);
        } else {
            const input = await vscode.window.showInputBox({
                prompt: t('msgSkillNamePrompt'),
                placeHolder: t('msgSkillNamePlaceholder'),
            });
            if (!input) {
                return;
            }
            skillName = input;
        }

        if (await this.profileManager.skillExists(item.profileId, skillName)) {
            vscode.window.showWarningMessage(t('msgSkillAlreadyExists', skillName));
            return;
        }

        await this.profileManager.addSkill(item.profileId, skillName, sourceDirPath);

        // If adding to active profile, re-sync
        if (this.stateManager.getActiveProfile() === item.profileId) {
            await this.doSync();
        }

        await this.refresh();
    }

    private async removeSkillFromProfile(item: ProfileSkillItem): Promise<void> {
        // Backup skill data for undo (copy to temp)
        const skillDir = this.profileManager.getSkillDirPath(item.profileId, item.fileName);
        const tempBackupDir = path.join(os.tmpdir(), 'skill-switch-undo', `${item.profileId}-${item.fileName}`);
        await ensureDir(path.dirname(tempBackupDir));
        await copyDirRecursive(skillDir, tempBackupDir);
        const wasEnabled = !(this.stateManager.getState().disabledProfileSkills[item.profileId] ?? []).includes(item.fileName);

        await this.profileManager.removeSkill(item.profileId, item.fileName);

        // Also remove from disabled list if present
        const state = this.stateManager.getState();
        const disabled = state.disabledProfileSkills[item.profileId] ?? [];
        await this.stateManager.setDisabledProfileSkills(
            item.profileId,
            disabled.filter(s => s !== item.fileName)
        );

        // If removing from active profile, re-sync
        if (this.stateManager.getActiveProfile() === item.profileId) {
            await this.doSync();
        }

        await this.refresh();

        // Show undo notification (5s with undo + close)
        const tempBackupDirRef = tempBackupDir;
        const profileIdRef = item.profileId;
        const fileNameRef = item.fileName;
        const wasEnabledRef = wasEnabled;
        await this.showUndoMessage(
            t('msgRemovedSkill', item.fileName),
            t('msgUndoRemove'),
            async () => {
                // Undo: re-add the skill from temp backup
                await this.profileManager.addSkill(profileIdRef, fileNameRef, tempBackupDirRef);
                // Restore enabled/disabled state
                if (!wasEnabledRef) {
                    const currentDisabled = this.stateManager.getState().disabledProfileSkills[profileIdRef] ?? [];
                    if (!currentDisabled.includes(fileNameRef)) {
                        currentDisabled.push(fileNameRef);
                        await this.stateManager.setDisabledProfileSkills(profileIdRef, currentDisabled);
                    }
                }
                if (this.stateManager.getActiveProfile() === profileIdRef) {
                    await this.doSync();
                }
                await this.refresh();
                this.showBriefMessage(t('msgRemoveUndone', fileNameRef));
            }
        );
        // Clean up temp backup
        await removeDir(tempBackupDir);
    }

    private async editSkill(args: unknown[]): Promise<void> {
        let profileId: string;
        let fileName: string;
        if (args[0] instanceof ProfileSkillItem) {
            profileId = args[0].profileId;
            fileName = args[0].fileName;
        } else {
            profileId = args[0] as string;
            fileName = args[1] as string;
        }
        const filePath = this.profileManager.getSkillFilePath(profileId, fileName);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(doc);
    }

    // --- Extra Skill Commands ---

    private async addExtra(): Promise<void> {
        const choice = await vscode.window.showQuickPick(
            [t('msgCreateNew'), t('msgImportFromDir')],
            { placeHolder: t('msgHowToAddExtra') }
        );
        if (!choice) {
            return;
        }

        let skillName: string;
        let sourceDirPath: string | undefined;

        if (choice === t('msgImportFromDir')) {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                title: t('msgSelectSkillDir'),
            });
            if (!uris || uris.length === 0) {
                return;
            }
            sourceDirPath = uris[0].fsPath;
            skillName = path.basename(sourceDirPath);
        } else {
            const input = await vscode.window.showInputBox({
                prompt: t('msgSkillNamePrompt'),
                placeHolder: t('msgSkillNamePlaceholder'),
            });
            if (!input) {
                return;
            }
            skillName = input;
        }

        if (await this.extraManager.extraExists(skillName)) {
            vscode.window.showWarningMessage(t('msgSkillAlreadyExists', skillName));
            return;
        }

        await this.extraManager.addExtra(skillName, sourceDirPath);
        await this.refresh();
    }

    private async removeExtra(item: PermanentSkillItem): Promise<void> {
        // Backup extra data for undo
        const extraDir = this.extraManager.getExtraDirPath(item.fileName);
        const tempBackupDir = path.join(os.tmpdir(), 'skill-switch-undo-extra', item.fileName);
        await ensureDir(path.dirname(tempBackupDir));
        await copyDirRecursive(extraDir, tempBackupDir);
        const wasEnabled = this.stateManager.getState().enabledExtras.includes(item.fileName);

        await this.extraManager.removeExtra(item.fileName);

        // Disable if currently enabled
        await this.stateManager.toggleExtra(item.fileName, false);

        await this.doSync();
        await this.refresh();

        // Show undo notification (5s with undo + close)
        const tempBackupDirRef = tempBackupDir;
        const fileNameRef = item.fileName;
        const wasEnabledRef = wasEnabled;
        await this.showUndoMessage(
            t('msgRemovedExtra', item.fileName),
            t('msgUndoRemoveExtra'),
            async () => {
                // Undo: re-add the extra from temp backup
                await this.extraManager.addExtra(fileNameRef, tempBackupDirRef);
                // Restore enabled state
                if (wasEnabledRef) {
                    await this.stateManager.toggleExtra(fileNameRef, true);
                }
                await this.doSync();
                await this.refresh();
                this.showBriefMessage(t('msgRemoveExtraUndone', fileNameRef));
            }
        );
        // Clean up temp backup
        await removeDir(tempBackupDir);
    }

    private async editExtra(args: unknown[]): Promise<void> {
        let fileName: string;
        if (args[0] instanceof PermanentSkillItem) {
            fileName = args[0].fileName;
        } else {
            fileName = args[0] as string;
        }
        const filePath = this.extraManager.getExtraFilePath(fileName);
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
        await vscode.window.showTextDocument(doc);
    }

    /** Move a skill from its profile to permanent skills */
    private async moveToPermanent(item: ProfileSkillItem): Promise<void> {
        const skillDir = this.profileManager.getSkillDirPath(item.profileId, item.fileName);
        const skillMeta = await this.profileManager.readSkillMdMeta(skillDir);

        if (await this.extraManager.extraExists(item.fileName)) {
            vscode.window.showWarningMessage(t('msgSkillAlreadyExists', item.fileName));
            return;
        }

        const wasEnabled = !(this.stateManager.getState().disabledProfileSkills[item.profileId] ?? []).includes(item.fileName);

        await this.extraManager.addExtra(item.fileName, skillDir);
        await this.profileManager.removeSkill(item.profileId, item.fileName);

        // Also remove from disabled list if present
        const state = this.stateManager.getState();
        const disabled = state.disabledProfileSkills[item.profileId] ?? [];
        await this.stateManager.setDisabledProfileSkills(
            item.profileId,
            disabled.filter(s => s !== item.fileName)
        );

        // Update extra meta with the skill's name/description
        await this.extraManager.updateExtraMeta(item.fileName, {
            name: skillMeta.name || item.fileName,
            description: skillMeta.description || '',
        });

        // If removing from active profile, re-sync
        if (this.stateManager.getActiveProfile() === item.profileId) {
            await this.doSync();
        }

        await this.refresh();

        // Show undo notification (5s with undo + close)
        const profileIdRef = item.profileId;
        const fileNameRef = item.fileName;
        const wasEnabledRef = wasEnabled;
        await this.showUndoMessage(
            t('msgMovedToPermanent', item.fileName),
            t('msgUndoMoveToPermanent'),
            async () => {
                // Undo: move back from permanent to profile
                const extraDir = this.extraManager.getExtraDirPath(fileNameRef);
                await this.profileManager.addSkill(profileIdRef, fileNameRef, extraDir);
                await this.extraManager.removeExtra(fileNameRef);
                await this.stateManager.toggleExtra(fileNameRef, false);
                // Restore enabled/disabled state
                if (!wasEnabledRef) {
                    const currentDisabled = this.stateManager.getState().disabledProfileSkills[profileIdRef] ?? [];
                    if (!currentDisabled.includes(fileNameRef)) {
                        currentDisabled.push(fileNameRef);
                        await this.stateManager.setDisabledProfileSkills(profileIdRef, currentDisabled);
                    }
                }
                if (this.stateManager.getActiveProfile() === profileIdRef) {
                    await this.doSync();
                }
                await this.refresh();
                this.showBriefMessage(t('msgMoveToPermanentUndone', fileNameRef));
            }
        );
    }

    /** Move a permanent skill to a user-chosen profile */
    private async moveExtraToProfile(item: PermanentSkillItem): Promise<void> {
        const profiles = await this.profileManager.listProfiles();
        const nonBackupProfiles = profiles.filter(p => !p.meta.isBackup);
        if (nonBackupProfiles.length === 0) {
            vscode.window.showWarningMessage(t('msgNoProfileActive'));
            return;
        }

        const items = nonBackupProfiles.map(p => ({
            label: p.meta.name,
            description: `${p.skillFiles.length} ${t('skillCountLabel')}`,
            profileId: p.meta.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: t('msgChooseTargetProfile'),
        });
        if (!selected) {
            return;
        }

        if (await this.profileManager.skillExists(selected.profileId, item.fileName)) {
            vscode.window.showWarningMessage(t('msgSkillAlreadyExists', item.fileName));
            return;
        }

        const extraDir = this.extraManager.getExtraDirPath(item.fileName);
        await this.profileManager.addSkill(selected.profileId, item.fileName, extraDir);
        await this.extraManager.removeExtra(item.fileName);
        await this.stateManager.toggleExtra(item.fileName, false);

        await this.doSync();
        await this.refresh();

        this.showBriefMessage(t('msgMovedExtraToProfile', item.fileName, selected.label));
    }

    /** Copy a permanent skill to a user-chosen profile */
    private async copyExtraToProfile(item: PermanentSkillItem): Promise<void> {
        const profiles = await this.profileManager.listProfiles();
        const nonBackupProfiles = profiles.filter(p => !p.meta.isBackup);
        if (nonBackupProfiles.length === 0) {
            vscode.window.showWarningMessage(t('msgNoProfileActive'));
            return;
        }

        const items = nonBackupProfiles.map(p => ({
            label: p.meta.name,
            description: `${p.skillFiles.length} ${t('skillCountLabel')}`,
            profileId: p.meta.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: t('msgChooseTargetProfile'),
        });
        if (!selected) {
            return;
        }

        if (await this.profileManager.skillExists(selected.profileId, item.fileName)) {
            vscode.window.showWarningMessage(t('msgSkillAlreadyExists', item.fileName));
            return;
        }

        const extraDir = this.extraManager.getExtraDirPath(item.fileName);
        await this.profileManager.addSkill(selected.profileId, item.fileName, extraDir);

        // If adding to active profile, re-sync
        if (this.stateManager.getActiveProfile() === selected.profileId) {
            await this.doSync();
        }

        await this.refresh();

        this.showBriefMessage(t('msgCopiedExtraToProfile', item.fileName, selected.label));
    }

    // --- Design Doc Commands ---

    private async addDesignDoc(): Promise<void> {
        const choice = await vscode.window.showQuickPick(
            [t('msgImportFromFile'), t('msgImportFromDir'), t('msgCreateNew')],
            { placeHolder: t('msgHowToAddDesignDoc') }
        );
        if (!choice) {
            return;
        }

        let docName: string;
        let sourcePath: string | undefined;

        if (choice === t('msgImportFromFile')) {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: true,
                canSelectFolders: false,
                title: t('msgSelectDesignDoc'),
                filters: {
                    [t('docFileFilterLabel')]: ['pen', 'md', 'png', 'jpg', 'jpeg', 'svg', 'pdf', 'html', 'json'],
                },
            });
            if (!uris || uris.length === 0) {
                return;
            }
            sourcePath = uris[0].fsPath;
            docName = path.basename(sourcePath, path.extname(sourcePath));
        } else if (choice === t('msgImportFromDir')) {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                title: t('msgSelectDesignDocDir'),
            });
            if (!uris || uris.length === 0) {
                return;
            }
            sourcePath = uris[0].fsPath;
            docName = path.basename(sourcePath);
        } else {
            const input = await vscode.window.showInputBox({
                prompt: t('msgDesignDocNamePrompt'),
                placeHolder: t('msgDesignDocNamePlaceholder'),
            });
            if (!input) {
                return;
            }
            docName = input;
        }

        if (await this.designDocManager.designDocExists(docName)) {
            vscode.window.showWarningMessage(t('msgDesignDocAlreadyExists', docName));
            return;
        }

        await this.designDocManager.addDesignDoc(docName, sourcePath);

        // Ask for description
        const description = await vscode.window.showInputBox({
            prompt: t('msgDesignDocDescPrompt'),
            placeHolder: t('msgDesignDocDescPlaceholder'),
        });
        if (description) {
            await this.designDocManager.updateDesignDocMeta(docName, { description });
        }

        this.showBriefMessage(t('msgDesignDocAdded', docName));
        await this.refresh();
    }

    private async removeDesignDoc(item: DesignDocItem): Promise<void> {
        const confirmed = await vscode.window.showWarningMessage(
            t('msgRemoveDesignDocConfirm', item.docName),
            t('msgRemove')
        );
        if (confirmed !== t('msgRemove')) {
            return;
        }

        await this.designDocManager.removeDesignDoc(item.docName);
        await this.refresh();
    }

    private async openDesignDoc(item: DesignDocItem): Promise<void> {
        const docDir = this.designDocManager.getDesignDocDirPath(item.docName);
        // Try to find a file to open in the document directory
        try {
            const entries = await fs.promises.readdir(docDir, { withFileTypes: true });
            // Prefer .pen, .md, .html files, then first file found
            const priorityExts = ['.pen', '.md', '.html'];
            let targetFile: string | undefined;
            for (const ext of priorityExts) {
                const found = entries.find(e => e.isFile() && e.name.endsWith(ext));
                if (found) {
                    targetFile = path.join(docDir, found.name);
                    break;
                }
            }
            if (!targetFile) {
                const firstFile = entries.find(e => e.isFile());
                if (firstFile) {
                    targetFile = path.join(docDir, firstFile.name);
                }
            }
            if (targetFile) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(targetFile));
                await vscode.window.showTextDocument(doc);
            } else {
                // Open the directory in explorer
                await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(docDir));
            }
        } catch {
            await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(docDir));
        }
    }

    private async editDesignDocMeta(item: DesignDocItem): Promise<void> {
        const name = await vscode.window.showInputBox({
            prompt: t('msgDesignDocNamePrompt'),
            value: item.label as string,
        });
        if (!name) {
            return;
        }

        const currentDesc = typeof item.description === 'string' ? item.description : '';
        const description = await vscode.window.showInputBox({
            prompt: t('msgDesignDocDescPrompt'),
            value: currentDesc,
        });

        await this.designDocManager.updateDesignDocMeta(item.docName, {
            name,
            description: description ?? '',
        });

        await this.refresh();
    }

    private async openInExplorer(item: DesignDocItem | DesignDocFolderItem): Promise<void> {
        const targetPath = item instanceof DesignDocFolderItem
            ? item.folderPath
            : this.designDocManager.getDesignDocDirPath(item.docName);
        await vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(targetPath));
    }

    private async deleteDesignDocFolder(item: DesignDocFolderItem): Promise<void> {
        const confirmed = await vscode.window.showWarningMessage(
            t('msgDeleteFolderConfirm', path.basename(item.folderPath)),
            { modal: true },
            t('msgDelete')
        );
        if (confirmed !== t('msgDelete')) {
            return;
        }

        await removeDir(item.folderPath);
        await this.refresh();
    }

    private async newFile(item: DesignDocItem | DesignDocFolderItem): Promise<void> {
        const targetDir = item instanceof DesignDocFolderItem
            ? item.folderPath
            : this.designDocManager.getDesignDocDirPath(item.docName);

        const fileName = await vscode.window.showInputBox({
            prompt: t('msgNewFilePrompt'),
            placeHolder: t('msgNewFilePlaceholder'),
        });
        if (!fileName) {
            return;
        }

        const filePath = path.join(targetDir, fileName);
        await ensureDir(path.dirname(filePath));
        await fs.promises.writeFile(filePath, '', 'utf-8');
        await this.refresh();
    }

    private async newFolder(item: DesignDocItem | DesignDocFolderItem): Promise<void> {
        const targetDir = item instanceof DesignDocFolderItem
            ? item.folderPath
            : this.designDocManager.getDesignDocDirPath(item.docName);

        const folderName = await vscode.window.showInputBox({
            prompt: t('msgNewFolderPrompt'),
            placeHolder: t('msgNewFolderPlaceholder'),
        });
        if (!folderName) {
            return;
        }

        const folderPath = path.join(targetDir, folderName);
        await ensureDir(folderPath);
        await this.refresh();
    }

    // --- Settings ---

    private async openSettings(): Promise<void> {
        const config = this.stateManager.getConfig();
        const currentIdeKey = this.stateManager.getCurrentIdeKey();
        const currentIdeName = this.stateManager.getCurrentIdeName();

        await SettingsWebviewPanel.create(
            this.extensionUri,
            config,
            currentIdeKey,
            currentIdeName,
            async (newConfig) => {
                const oldLanguage = this.stateManager.getConfig().language;
                await this.stateManager.updateConfig({
                    targetPaths: newConfig.targetPaths,
                    storagePath: newConfig.storagePath,
                    language: newConfig.language,
                });

                // Update i18n if language changed
                if (newConfig.language !== oldLanguage) {
                    setLanguage(newConfig.language);
                    this.showBriefMessage(t('msgLanguageUpdated'));
                }

                await this.refresh();
            },
        );
    }

    // --- Import from Target Path ---

    private async importFromTarget(): Promise<void> {
        // Step 1: Choose target - create new profile or import into existing
        const profiles = await this.profileManager.listProfiles();
        const nonBackupProfiles = profiles.filter(p => !p.meta.isBackup);
        const targetItems: { label: string; description?: string; profileId?: string }[] = [
            { label: t('msgImportNewProfile'), description: t('msgImportNewProfileDesc') },
            ...nonBackupProfiles.map(p => ({
                label: p.meta.name,
                description: `${p.skillFiles.length} ${t('skillCountLabel')}`,
                profileId: p.meta.id,
            })),
        ];

        const targetSelected = await vscode.window.showQuickPick(targetItems, {
            placeHolder: t('msgImportChooseProfile'),
        });
        if (!targetSelected) {
            return;
        }

        let profileId: string;
        let profileName: string;

        if (targetSelected.profileId) {
            profileId = targetSelected.profileId;
            profileName = targetSelected.label;
        } else {
            const name = await vscode.window.showInputBox({
                prompt: t('msgImportProfileName'),
                placeHolder: t('msgImportProfileNamePlaceholder'),
                value: t('msgDefaultProfileName'),
            });
            if (!name) {
                return;
            }
            profileName = name;
            profileId = await this.profileManager.generateUniqueId(name);
            await this.profileManager.createProfile(profileId, name, '', undefined);
        }

        // Step 2: Choose source - from target path or from custom directory
        const sourceItems: { label: string; description: string; sourceType: 'target' | 'custom' }[] = [];
        if (this.stateManager.hasTargetPath()) {
            sourceItems.push({ label: t('msgImportFromTarget'), description: this.stateManager.getTargetPath(), sourceType: 'target' });
        }
        sourceItems.push({ label: t('msgImportFromDir'), description: t('msgImportFromDirDesc'), sourceType: 'custom' });

        const sourceSelected = await vscode.window.showQuickPick(sourceItems, {
            placeHolder: t('msgImportChooseSource'),
        });
        if (!sourceSelected) {
            return;
        }

        let sourcePath: string;
        if (sourceSelected.sourceType === 'target') {
            sourcePath = this.stateManager.getTargetPath();
            if (!(await pathExists(sourcePath))) {
                vscode.window.showWarningMessage(t('msgImportTargetNotFound', sourcePath));
                return;
            }
        } else {
            const uris = await vscode.window.showOpenDialog({
                canSelectMany: false,
                canSelectFiles: false,
                canSelectFolders: true,
                title: t('msgSelectSkillRootDir'),
            });
            if (!uris || uris.length === 0) {
                return;
            }
            sourcePath = uris[0].fsPath;
        }

        const skills = await listSkillDirectories(sourcePath);
        if (skills.length === 0) {
            vscode.window.showInformationMessage(t('msgImportNoSkills', sourcePath));
            return;
        }

        // Add all skill directories from source, skipping duplicates
        let addedCount = 0;
        let skippedCount = 0;
        for (const skillName of skills) {
            if (await this.profileManager.skillExists(profileId, skillName)) {
                skippedCount++;
                continue;
            }
            await this.profileManager.addSkill(profileId, skillName, path.join(sourcePath, skillName));
            addedCount++;
        }

        // Auto-activate if no active profile
        if (!this.stateManager.getActiveProfile()) {
            await this.stateManager.setActiveProfile(profileId);
            await this.doSync();
        }

        this.showBriefMessage(
            targetSelected.profileId
                ? t('msgImportAddedToExisting', String(addedCount), profileName) +
                  (skippedCount > 0 ? ` (${t('msgImportSkipped', String(skippedCount))})` : '')
                : t('msgImportSuccess', String(addedCount), profileName) +
                  (skippedCount > 0 ? ` (${t('msgImportSkipped', String(skippedCount))})` : '')
        );

        await this.refresh();
    }

    // --- Sync Helper ---

    async doSync(): Promise<void> {
        if (!this.stateManager.hasTargetPath()) {
            vscode.window.showWarningMessage(
                t('msgNoTargetPath', this.stateManager.getCurrentIdeName()),
                t('msgOpenSettings')
            ).then(action => {
                if (action === t('msgOpenSettings')) {
                    vscode.commands.executeCommand('skillSwitch.openSettings');
                }
            });
            return;
        }

        const state = this.stateManager.getState();
        const profiles = await this.profileManager.listProfiles();
        const activeProfile = profiles.find(p => p.meta.id === state.activeProfile);
        const profileName = activeProfile?.meta.name ?? t('msgNoProfileActive');

        await this.syncService.syncAndNotify(
            this.stateManager.getProfilesPath(),
            this.stateManager.getExtrasPath(),
            this.stateManager.getTargetPath(),
            state,
            profileName
        );
    }

    // --- Backup & Restore ---

    private async backupProfile(item: ProfileItem): Promise<void> {
        const meta = await this.profileManager.getProfileMeta(item.profileId);
        if (!meta) {
            return;
        }

        const backupName = `${meta.name} (${t('msgBackupTag')} ${new Date().toLocaleString()})`;
        const id = await this.profileManager.generateUniqueId(backupName);
        await this.profileManager.createProfile(id, backupName, `${t('msgBackupOf', meta.name)}`, item.profileId);
        // Mark as backup
        await this.profileManager.updateProfile(id, { isBackup: true, backupOf: item.profileId });

        this.showBriefMessage(
            t('msgBackupSuccess', meta.name, backupName)
        );

        await this.refresh();
    }

    private async restoreProfile(): Promise<void> {
        // List backup profiles
        const profiles = await this.profileManager.listProfiles();
        const backups = profiles.filter(p => p.meta.isBackup === true);

        if (backups.length === 0) {
            vscode.window.showWarningMessage(t('msgNoBackups'));
            return;
        }

        const items = backups.map(b => ({
            label: b.meta.name,
            description: `${b.skillFiles.length} ${t('skillCountLabel')}`,
            profileId: b.meta.id,
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: t('msgRestoreChooseBackup'),
        });
        if (!selected) {
            return;
        }

        // Restore: create a new normal profile from the backup
        const backupProfile = profiles.find(p => p.meta.id === selected.profileId);
        if (!backupProfile) {
            return;
        }

        const name = await vscode.window.showInputBox({
            prompt: t('msgRestoreProfileName'),
            placeHolder: t('msgRestoreProfileNamePlaceholder'),
            value: backupProfile.meta.backupOf
                ? (profiles.find(p => p.meta.id === backupProfile.meta.backupOf)?.meta.name ?? backupProfile.meta.name)
                : backupProfile.meta.name,
        });
        if (!name) {
            return;
        }

        const id = await this.profileManager.generateUniqueId(name);
        await this.profileManager.createProfile(id, name, '', selected.profileId);

        // Auto-activate if no active profile
        if (!this.stateManager.getActiveProfile()) {
            await this.stateManager.setActiveProfile(id);
            await this.doSync();
        }

        this.showBriefMessage(
            t('msgRestoreSuccess', name, String(backupProfile.skillFiles.length))
        );

        await this.refresh();
    }

}

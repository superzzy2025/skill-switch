import * as path from 'path';
import * as vscode from 'vscode';
import { StateManager } from './services/stateManager';
import { ProfileManager } from './services/profileManager';
import { ExtraManager } from './services/extraManager';
import { DesignDocManager } from './services/designDocManager';
import { SyncService } from './services/syncService';
import { SkillTreeProvider, ProfileSkillItem, PermanentSkillItem } from './tree/SkillTreeProvider';
import { CommandRegistry } from './commands';
import { initI18n, t } from './i18n';
import { pathExists, listSkillDirectories } from './utils/fileUtils';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    // Initialize services
    const stateManager = new StateManager();
    await stateManager.initialize(vscode.env.appName);

    // Initialize i18n with saved language
    initI18n(stateManager.getConfig().language);

    const profileManager = new ProfileManager(stateManager.getProfilesPath());
    const extraManager = new ExtraManager(stateManager.getExtrasPath());
    const designDocManager = new DesignDocManager(stateManager.getDesignDocsPath());
    const syncService = new SyncService();

    // Create tree provider
    const treeProvider = new SkillTreeProvider();
    treeProvider.setDesignDocsPath(stateManager.getDesignDocsPath());

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        50
    );
    statusBarItem.tooltip = t('sidebarTitle');
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Register tree view with checkbox support
    const treeView = vscode.window.createTreeView('skillSwitchView', {
        treeDataProvider: treeProvider,
        showCollapseAll: false,
        canSelectMany: false,
    });
    context.subscriptions.push(treeView);

    // Handle checkbox state changes
    treeView.onDidChangeCheckboxState(async (e) => {
        for (const [item, state] of e.items) {
            const enabled = state === vscode.TreeItemCheckboxState.Checked;
            if (item instanceof ProfileSkillItem) {
                await stateManager.toggleProfileSkill(item.profileId, item.fileName, enabled);
            } else if (item instanceof PermanentSkillItem) {
                await stateManager.toggleExtra(item.fileName, enabled);
            }
        }

        // Re-sync after checkbox change (silent - no notification)
        if (stateManager.hasTargetPath()) {
            const currentState = stateManager.getState();
            try {
                await syncService.sync(
                    stateManager.getProfilesPath(),
                    stateManager.getExtrasPath(),
                    stateManager.getTargetPath(),
                    currentState
                );
            } catch {
                // silent sync failure during checkbox change
            }
        }

        // Refresh tree and status bar
        const allProfiles = await profileManager.listProfiles();
        const profiles = allProfiles.filter(p => !p.meta.isBackup);
        const backups = allProfiles.filter(p => p.meta.isBackup === true);
        const extras = await extraManager.listExtras();
        const designDocs = await designDocManager.listDesignDocs();
        const currentState = stateManager.getState();
        treeProvider.refresh({ profiles, backups, extras, designDocs, state: currentState });

        const active = profiles.find(p => p.meta.id === currentState.activeProfile);
        if (active) {
            const disabledSkills = currentState.disabledProfileSkills[active.meta.id] ?? [];
            const enabledSkillCount = active.skillFiles.length - disabledSkills.length;
            const extraCount = currentState.enabledExtras.length;
            const extraPart = extraCount > 0 ? ` + ${extraCount} ${t('sectionPermanentSkills').toLowerCase()}` : '';
            statusBarItem.text = `$(sparkle) ${active.meta.name} | ${enabledSkillCount}${extraPart}`;
        }
    });

    // Register commands
    const commandRegistry = new CommandRegistry(
        stateManager,
        profileManager,
        extraManager,
        designDocManager,
        syncService,
        treeProvider,
        statusBarItem,
        context.extensionUri,
    );
    commandRegistry.register(context);

    // Auto-import skills from targetPath if no profiles exist
    let allProfiles = await profileManager.listProfiles();
    let profiles = allProfiles.filter(p => !p.meta.isBackup);
    if (profiles.length === 0 && stateManager.hasTargetPath()) {
        const targetPath = stateManager.getTargetPath();
        const count = await importSkillsFromTarget(
            profileManager,
            targetPath,
            t('msgDefaultProfileName')
        );
        if (count > 0) {
            vscode.window.setStatusBarMessage(
                t('msgImportSuccess', String(count), t('msgDefaultProfileName')),
                1000
            );
            allProfiles = await profileManager.listProfiles();
            profiles = allProfiles.filter(p => !p.meta.isBackup);
            // Auto-activate the imported profile
            if (profiles.length > 0 && !stateManager.getActiveProfile()) {
                await stateManager.setActiveProfile(profiles[0].meta.id);
            }
        }
    }

    const backups = allProfiles.filter(p => p.meta.isBackup === true);
    const extras = await extraManager.listExtras();
    const designDocs = await designDocManager.listDesignDocs();
    const state = stateManager.getState();
    treeProvider.refresh({ profiles, backups, extras, designDocs, state });

    // Update status bar
    const active = profiles.find(p => p.meta.id === state.activeProfile);
    if (active) {
        const disabledSkills = state.disabledProfileSkills[active.meta.id] ?? [];
        const enabledSkillCount = active.skillFiles.length - disabledSkills.length;
        const extraCount = state.enabledExtras.length;
        const extraPart = extraCount > 0 ? ` + ${extraCount} ${t('sectionPermanentSkills').toLowerCase()}` : '';
        statusBarItem.text = `$(sparkle) ${active.meta.name} | ${enabledSkillCount}${extraPart}`;
    } else {
        statusBarItem.text = `$(sparkle) ${t('msgNoProfileActive')}`;
    }

    // First-run guidance: prompt to configure target path if current IDE has none
    if (!stateManager.hasTargetPath()) {
        const action = await vscode.window.showWarningMessage(
            t('msgNoTargetPath', stateManager.getCurrentIdeName()),
            t('msgOpenSettings')
        );
        if (action === t('msgOpenSettings')) {
            vscode.commands.executeCommand('skillSwitch.openSettings');
        }
    }

    // First-run guidance: show welcome if still no profiles
    if (profiles.length === 0) {
        const action = await vscode.window.showInformationMessage(
            t('msgWelcome'),
            t('msgOpenSettings'),
            t('msgCreateProfile')
        );
        if (action === t('msgOpenSettings')) {
            vscode.commands.executeCommand('skillSwitch.openSettings');
        } else if (action === t('msgCreateProfile')) {
            vscode.commands.executeCommand('skillSwitch.createProfile');
        }
    }
}

/** Auto-import skill directories from targetPath as a default profile */
async function importSkillsFromTarget(
    profileManager: ProfileManager,
    targetPath: string,
    defaultName: string
): Promise<number> {
    if (!(await pathExists(targetPath))) {
        return 0;
    }
    const skills = await listSkillDirectories(targetPath);
    if (skills.length === 0) {
        return 0;
    }
    // Create a default profile and copy all skill directories into it
    const id = await profileManager.generateUniqueId(defaultName);
    await profileManager.createProfile(id, defaultName, '', undefined);
    for (const skillName of skills) {
        await profileManager.addSkill(id, skillName, path.join(targetPath, skillName));
    }
    return skills.length;
}

export function deactivate(): void {}

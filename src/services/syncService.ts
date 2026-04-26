import * as path from 'path';
import * as os from 'os';
import * as vscode from 'vscode';
import { AppState } from '../types';
import { t } from '../i18n';
import {
    ensureDir, pathExists, clearDirRecursive, copyDirRecursive,
    removeDir, listSkillDirectories
} from '../utils/fileUtils';

export class SyncService {
    /**
     * Sync skill directories to the target path based on current state.
     * Returns the count of active skills and extras.
     */
    async sync(
        profilesPath: string,
        extrasPath: string,
        targetPath: string,
        state: AppState
    ): Promise<{ skillCount: number; extraCount: number }> {
        // If no active profile, just clear the target
        if (!state.activeProfile) {
            await clearDirRecursive(targetPath);
            return { skillCount: 0, extraCount: 0 };
        }

        const profileDir = path.join(profilesPath, state.activeProfile);
        if (!(await pathExists(profileDir))) {
            throw new Error(`Active profile directory not found: ${state.activeProfile}`);
        }

        // Backup current target for rollback
        const backupPath = path.join(os.tmpdir(), 'skill-switch-backup');
        const targetExists = await pathExists(targetPath);
        if (targetExists) {
            await clearDirRecursive(backupPath);
            await copyDirRecursive(targetPath, backupPath);
        }

        try {
            // Clear target
            await ensureDir(targetPath);
            await clearDirRecursive(targetPath);

            // Copy all skill directories from profile to target (skip disabled ones for active profile)
            const disabledSkills = state.disabledProfileSkills[state.activeProfile] ?? [];
            const allSkills = await listSkillDirectories(profileDir);
            for (const skillName of allSkills) {
                if (!disabledSkills.includes(skillName)) {
                    await copyDirRecursive(
                        path.join(profileDir, skillName),
                        path.join(targetPath, skillName)
                    );
                }
            }

            // Copy enabled extras as skill directories (extras override profile skills on conflict)
            for (const extraSkill of state.enabledExtras) {
                const srcPath = path.join(extrasPath, extraSkill);
                if (await pathExists(srcPath)) {
                    await copyDirRecursive(srcPath, path.join(targetPath, extraSkill));
                }
            }

            // Count active skills
            const activeSkills = await listSkillDirectories(targetPath);
            const extraCount = state.enabledExtras.length;
            const skillCount = activeSkills.length - extraCount;

            // Clean up backup
            await removeDir(backupPath);

            return { skillCount: Math.max(0, skillCount), extraCount };
        } catch (error) {
            // Rollback on failure
            if (targetExists && await pathExists(backupPath)) {
                try {
                    await clearDirRecursive(targetPath);
                    await copyDirRecursive(backupPath, targetPath);
                } catch {
                    // Best effort rollback
                }
            }
            throw error;
        }
    }

    /** Convenience: sync and show notification */
    async syncAndNotify(
        profilesPath: string,
        extrasPath: string,
        targetPath: string,
        state: AppState,
        profileName: string
    ): Promise<void> {
        try {
            const { skillCount, extraCount } = await this.sync(
                profilesPath, extrasPath, targetPath, state
            );
            const extraPart = extraCount > 0 ? ` + ${extraCount} ${t('sectionPermanentSkills').toLowerCase()}` : '';
            vscode.window.showInformationMessage(
                t('msgSwitchedTo', profileName, String(skillCount), extraPart)
            );
        } catch (error) {
            vscode.window.showErrorMessage(
                t('msgSyncFailed', error instanceof Error ? error.message : String(error))
            );
            throw error;
        }
    }
}

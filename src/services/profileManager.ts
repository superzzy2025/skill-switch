import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { ProfileMeta, ResolvedProfile, ResolvedSkill } from '../types';
import {
    ensureDir, pathExists, readJsonFile, writeJsonFile,
    listSkillDirectories, copyDirRecursive, removeDir
} from '../utils/fileUtils';

export class ProfileManager {
    constructor(private profilesPath: string) {}

    /** List all profiles with their metadata and skill directories */
    async listProfiles(): Promise<ResolvedProfile[]> {
        if (!(await pathExists(this.profilesPath))) {
            return [];
        }
        const entries = await vscode.workspace.fs.readDirectory(
            vscode.Uri.file(this.profilesPath)
        );
        const profiles: ResolvedProfile[] = [];
        for (const [name, type] of entries) {
            if (type !== vscode.FileType.Directory) {
                continue;
            }
            const meta = await this.getProfileMeta(name);
            const dirNames = await listSkillDirectories(path.join(this.profilesPath, name));
            const skillFiles: ResolvedSkill[] = await Promise.all(
                dirNames.map(async (fileName) => {
                    const skillMeta = await this.readSkillMdMeta(path.join(this.profilesPath, name, fileName));
                    return {
                        fileName,
                        name: skillMeta.name || fileName,
                        description: skillMeta.description,
                    };
                })
            );
            profiles.push({
                meta: meta ?? {
                    id: name,
                    name: name,
                    description: '',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                },
                skillFiles,
            });
        }
        return profiles;
    }

    /** Get metadata for a single profile */
    async getProfileMeta(profileId: string): Promise<ProfileMeta | null> {
        return readJsonFile<ProfileMeta>(
            path.join(this.profilesPath, profileId, '_meta.json')
        );
    }

    /** Create a new profile */
    async createProfile(
        id: string,
        name: string,
        description: string,
        copyFromId?: string
    ): Promise<ResolvedProfile> {
        const profileDir = path.join(this.profilesPath, id);
        if (await pathExists(profileDir)) {
            throw new Error(`Profile "${id}" already exists`);
        }
        await ensureDir(profileDir);

        // Optionally copy skills from existing profile (copy each skill directory)
        if (copyFromId) {
            const srcDir = path.join(this.profilesPath, copyFromId);
            const existingSkills = await listSkillDirectories(srcDir);
            for (const skillName of existingSkills) {
                await copyDirRecursive(
                    path.join(srcDir, skillName),
                    path.join(profileDir, skillName)
                );
            }
        }

        const now = new Date().toISOString();
        const meta: ProfileMeta = { id, name, description, createdAt: now, updatedAt: now };
        await writeJsonFile(path.join(profileDir, '_meta.json'), meta);

        const dirNames = await listSkillDirectories(profileDir);
        const skillFiles: ResolvedSkill[] = await Promise.all(
            dirNames.map(async (fileName) => {
                const skillMeta = await this.readSkillMdMeta(path.join(profileDir, fileName));
                return {
                    fileName,
                    name: skillMeta.name || fileName,
                    description: skillMeta.description,
                };
            })
        );
        return { meta, skillFiles };
    }

    /** Update profile metadata */
    async updateProfile(
        profileId: string,
        updates: Partial<Omit<ProfileMeta, 'id' | 'createdAt'>>
    ): Promise<ProfileMeta> {
        const metaPath = path.join(this.profilesPath, profileId, '_meta.json');
        const existing = await readJsonFile<ProfileMeta>(metaPath);
        if (!existing) {
            throw new Error(`Profile "${profileId}" not found`);
        }
        const updated: ProfileMeta = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString(),
        };
        await writeJsonFile(metaPath, updated);
        return updated;
    }

    /** Delete an entire profile directory */
    async deleteProfile(profileId: string): Promise<void> {
        const profileDir = path.join(this.profilesPath, profileId);
        await removeDir(profileDir);
    }

    /**
     * Add a skill directory to a profile.
     * @param profileId - The profile to add the skill to
     * @param skillName - The skill directory name
     * @param sourceDirPath - Optional source directory path to copy from (e.g. from targetPath)
     * @throws if a skill with the same name already exists in the profile
     */
    async addSkill(
        profileId: string,
        skillName: string,
        sourceDirPath?: string
    ): Promise<void> {
        const destPath = path.join(this.profilesPath, profileId, skillName);
        if (await pathExists(destPath)) {
            throw new Error(`Skill "${skillName}" already exists in profile "${profileId}"`);
        }
        if (sourceDirPath) {
            await copyDirRecursive(sourceDirPath, destPath);
        } else {
            // Create a minimal skill directory with SKILL.md
            await ensureDir(destPath);
            await fs.promises.writeFile(
                path.join(destPath, 'SKILL.md'),
                `---\nname: ${skillName}\ndescription: \n---\n\n# ${skillName}\n\n`,
                'utf-8'
            );
        }
    }

    /** Check if a skill already exists in a profile */
    async skillExists(profileId: string, skillName: string): Promise<boolean> {
        return pathExists(path.join(this.profilesPath, profileId, skillName));
    }

    /** Remove a skill directory from a profile */
    async removeSkill(profileId: string, skillName: string): Promise<void> {
        await removeDir(path.join(this.profilesPath, profileId, skillName));
    }

    /** Get the full path to a skill directory for editing */
    getSkillDirPath(profileId: string, skillName: string): string {
        return path.join(this.profilesPath, profileId, skillName);
    }

    /** Get the full path to a skill's SKILL.md for editing */
    getSkillFilePath(profileId: string, skillName: string): string {
        return path.join(this.profilesPath, profileId, skillName, 'SKILL.md');
    }

    /** Sanitize a profile name into a valid directory ID */
    sanitizeId(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /** Generate a unique profile ID from a name */
    async generateUniqueId(name: string): Promise<string> {
        let base = this.sanitizeId(name);
        if (!base) {
            base = 'profile';
        }
        let id = base;
        let counter = 1;
        while (await pathExists(path.join(this.profilesPath, id))) {
            id = `${base}-${counter}`;
            counter++;
        }
        return id;
    }

    /** Read frontmatter from SKILL.md in a skill directory */
    async readSkillMdMeta(skillDir: string): Promise<{ name: string; description: string }> {
        const skillMdPath = path.join(skillDir, 'SKILL.md');
        try {
            const content = await fs.promises.readFile(skillMdPath, 'utf-8');
            const match = content.match(/^---\n([\s\S]*?)\n---/);
            if (match) {
                const frontmatter = match[1];
                const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
                const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
                return {
                    name: nameMatch?.[1]?.trim() || '',
                    description: descMatch?.[1]?.trim() || '',
                };
            }
        } catch {
            // File doesn't exist or can't be read
        }
        return { name: '', description: '' };
    }
}

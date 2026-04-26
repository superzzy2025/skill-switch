import * as path from 'path';
import * as fs from 'fs';
import { ExtraSkillMeta, ExtrasMeta } from '../types';
import {
    pathExists, readJsonFile, writeJsonFile,
    listSkillDirectories, copyDirRecursive, removeDir, ensureDir
} from '../utils/fileUtils';

export class ExtraManager {
    private metaPath: string;

    constructor(private extrasPath: string) {
        this.metaPath = path.join(extrasPath, '_meta.json');
    }

    /** List all extra skills (directories with SKILL.md) with their metadata */
    async listExtras(): Promise<{ filename: string; meta: ExtraSkillMeta }[]> {
        if (!(await pathExists(this.extrasPath))) {
            return [];
        }
        const extrasMeta = await this.readMeta();
        const dirs = await listSkillDirectories(this.extrasPath);
        return dirs.map(dirname => ({
            filename: dirname,
            meta: extrasMeta.skills[dirname] ?? {
                name: dirname,
                description: '',
            },
        }));
    }

    /**
     * Add an extra skill (from external directory or create empty).
     * @param skillName - The skill directory name
     * @param sourceDirPath - Optional source directory path to copy from
     * @throws if a skill with the same name already exists
     */
    async addExtra(
        skillName: string,
        sourceDirPath?: string
    ): Promise<void> {
        const destPath = path.join(this.extrasPath, skillName);
        if (await pathExists(destPath)) {
            throw new Error(`Extra skill "${skillName}" already exists`);
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

        // Update meta
        const meta = await this.readMeta();
        if (!meta.skills[skillName]) {
            meta.skills[skillName] = {
                name: skillName,
                description: '',
            };
            await this.writeMeta(meta);
        }
    }

    /** Check if an extra skill already exists */
    async extraExists(skillName: string): Promise<boolean> {
        return pathExists(path.join(this.extrasPath, skillName));
    }

    /** Remove an extra skill directory */
    async removeExtra(skillName: string): Promise<void> {
        await removeDir(path.join(this.extrasPath, skillName));
        const meta = await this.readMeta();
        delete meta.skills[skillName];
        await this.writeMeta(meta);
    }

    /** Update extra skill metadata (name, description) */
    async updateExtraMeta(
        skillName: string,
        updates: Partial<Pick<ExtraSkillMeta, 'name' | 'description'>>
    ): Promise<void> {
        const meta = await this.readMeta();
        const existing = meta.skills[skillName] ?? {
            name: skillName,
            description: '',
        };
        meta.skills[skillName] = { ...existing, ...updates };
        await this.writeMeta(meta);
    }

    /** Get the full path to an extra skill's SKILL.md for editing */
    getExtraFilePath(skillName: string): string {
        return path.join(this.extrasPath, skillName, 'SKILL.md');
    }

    /** Get the full path to an extra skill directory */
    getExtraDirPath(skillName: string): string {
        return path.join(this.extrasPath, skillName);
    }

    /** Read the extras metadata file */
    private async readMeta(): Promise<ExtrasMeta> {
        const meta = await readJsonFile<ExtrasMeta>(this.metaPath);
        return meta ?? { skills: {} };
    }

    /** Write the extras metadata file */
    private async writeMeta(meta: ExtrasMeta): Promise<void> {
        await writeJsonFile(this.metaPath, meta);
    }
}

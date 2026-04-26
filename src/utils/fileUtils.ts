import * as fs from 'fs';
import * as path from 'path';

/** Ensure a directory exists, creating it recursively if needed */
export async function ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
}

/** Check if a path exists */
export async function pathExists(p: string): Promise<boolean> {
    try {
        await fs.promises.access(p);
        return true;
    } catch {
        return false;
    }
}

/** Read and parse a JSON file, returning null if not found or invalid */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return JSON.parse(content) as T;
    } catch {
        return null;
    }
}

/** Write a JSON object to file, creating parent dirs if needed */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
    await ensureDir(path.dirname(filePath));
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * List all skill directories under a given path.
 * A skill is a subdirectory that contains a SKILL.md file.
 * Returns directory names (relative to dirPath).
 */
export async function listSkillDirectories(dirPath: string): Promise<string[]> {
    if (!(await pathExists(dirPath))) {
        return [];
    }
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const skills: string[] = [];
    for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            const skillMdPath = path.join(dirPath, entry.name, 'SKILL.md');
            if (await pathExists(skillMdPath)) {
                skills.push(entry.name);
            }
        }
    }
    return skills;
}

/**
 * Copy an entire directory tree from srcDir to destDir recursively.
 * Note: _meta.json files are NOT excluded — callers must handle this if needed.
 */
export async function copyDirRecursive(srcDir: string, destDir: string): Promise<void> {
    await ensureDir(destDir);
    if (!(await pathExists(srcDir))) {
        return;
    }
    await fs.promises.cp(srcDir, destDir, { recursive: true, force: true });
}

/** Delete all files and subdirectories in a directory, keeping the directory itself */
export async function clearDirRecursive(dirPath: string): Promise<void> {
    if (!(await pathExists(dirPath))) {
        return;
    }
    await fs.promises.rm(dirPath, { recursive: true, force: true });
    await ensureDir(dirPath);
}

/** Delete a directory and all its contents recursively */
export async function removeDir(dirPath: string): Promise<void> {
    if (await pathExists(dirPath)) {
        await fs.promises.rm(dirPath, { recursive: true, force: true });
    }
}



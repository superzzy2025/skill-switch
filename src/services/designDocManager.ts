import * as path from 'path';
import * as fs from 'fs';
import { pathExists, readJsonFile, writeJsonFile, copyDirRecursive, removeDir, ensureDir } from '../utils/fileUtils';

/** Metadata for a single design document entry */
export interface DesignDocMeta {
    name: string;
    description: string;
    /** Original file name imported from */
    sourceName?: string;
}

/** The design-docs/_meta.json structure */
export interface DesignDocsMeta {
    docs: Record<string, DesignDocMeta>;  // key = directory name
}

export class DesignDocManager {
    private metaPath: string;

    constructor(private designDocsPath: string) {
        this.metaPath = path.join(designDocsPath, '_meta.json');
    }

    /** List all design documents with their metadata */
    async listDesignDocs(): Promise<{ dirname: string; meta: DesignDocMeta }[]> {
        if (!(await pathExists(this.designDocsPath))) {
            return [];
        }
        const meta = await this.readMeta();
        const entries = await fs.promises.readdir(this.designDocsPath, { withFileTypes: true });
        const docs: { dirname: string; meta: DesignDocMeta }[] = [];
        for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                docs.push({
                    dirname: entry.name,
                    meta: meta.docs[entry.name] ?? {
                        name: entry.name,
                        description: '',
                    },
                });
            }
        }
        return docs;
    }

    /**
     * Add a design document (from external directory or file).
     * @param docName - The document directory name
     * @param sourcePath - Optional source path (directory or file) to copy from
     */
    async addDesignDoc(docName: string, sourcePath?: string): Promise<void> {
        const destPath = path.join(this.designDocsPath, docName);
        if (await pathExists(destPath)) {
            throw new Error(`Design document "${docName}" already exists`);
        }
        await ensureDir(destPath);

        if (sourcePath) {
            const srcStat = await fs.promises.stat(sourcePath);
            if (srcStat.isDirectory()) {
                // Copy entire directory contents into the doc dir
                const entries = await fs.promises.readdir(sourcePath);
                for (const entry of entries) {
                    const srcEntry = path.join(sourcePath, entry);
                    const destEntry = path.join(destPath, entry);
                    await copyDirRecursive(srcEntry, destEntry);
                }
            } else {
                // Copy single file into the doc dir
                const fileName = path.basename(sourcePath);
                await fs.promises.copyFile(sourcePath, path.join(destPath, fileName));
            }
        }

        // Update meta
        const meta = await this.readMeta();
        if (!meta.docs[docName]) {
            meta.docs[docName] = {
                name: docName,
                description: '',
                sourceName: sourcePath ? path.basename(sourcePath) : undefined,
            };
            await this.writeMeta(meta);
        }
    }

    /** Check if a design doc already exists */
    async designDocExists(docName: string): Promise<boolean> {
        return pathExists(path.join(this.designDocsPath, docName));
    }

    /** Remove a design document directory */
    async removeDesignDoc(docName: string): Promise<void> {
        await removeDir(path.join(this.designDocsPath, docName));
        const meta = await this.readMeta();
        delete meta.docs[docName];
        await this.writeMeta(meta);
    }

    /** Update design doc metadata (name, description) */
    async updateDesignDocMeta(
        docName: string,
        updates: Partial<Pick<DesignDocMeta, 'name' | 'description'>>
    ): Promise<void> {
        const meta = await this.readMeta();
        const existing = meta.docs[docName] ?? {
            name: docName,
            description: '',
        };
        meta.docs[docName] = { ...existing, ...updates };
        await this.writeMeta(meta);
    }

    /** Get the full path to a design document directory */
    getDesignDocDirPath(docName: string): string {
        return path.join(this.designDocsPath, docName);
    }

    /** Get the full path to a design document directory for editing */
    getDesignDocPath(docName: string): string {
        return path.join(this.designDocsPath, docName);
    }

    /** Read the design docs metadata file */
    private async readMeta(): Promise<DesignDocsMeta> {
        const meta = await readJsonFile<DesignDocsMeta>(this.metaPath);
        return meta ?? { docs: {} };
    }

    /** Write the design docs metadata file */
    private async writeMeta(meta: DesignDocsMeta): Promise<void> {
        await writeJsonFile(this.metaPath, meta);
    }
}

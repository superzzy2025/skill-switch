/**
 * Use vscode.env.appName directly as the IDE identifier.
 * No pattern matching — just return the raw appName.
 */
export function detectCurrentIde(appName: string): string {
    return appName || 'unknown';
}

/**
 * Get the display name for an IDE key.
 * Simply returns the key itself (which is the appName).
 */
export function getIdeDisplayName(ideKey: string): string {
    return ideKey === 'unknown' ? 'Unknown IDE' : ideKey;
}

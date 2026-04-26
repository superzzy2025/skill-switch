import * as vscode from 'vscode';
import { AppConfig, Language } from '../types';
import { t, getCurrentLanguage } from '../i18n';

export class SettingsWebviewPanel {
    public static currentPanel: SettingsWebviewPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private config: AppConfig;
    private disposables: vscode.Disposable[] = [];
    private onSaved: ((config: AppConfig) => Promise<void>) | undefined;

    public static async create(
        extensionUri: vscode.Uri,
        config: AppConfig,
        onSaved: (config: AppConfig) => Promise<void>,
    ): Promise<SettingsWebviewPanel> {
        // If panel already exists, reveal it
        if (SettingsWebviewPanel.currentPanel) {
            SettingsWebviewPanel.currentPanel.config = config;
            SettingsWebviewPanel.currentPanel.onSaved = onSaved;
            SettingsWebviewPanel.currentPanel.panel.reveal(vscode.ViewColumn.One);
            SettingsWebviewPanel.currentPanel.updateWebview();
            return SettingsWebviewPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'skillSwitchSettings',
            t('settingsTitle'),
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [],
            },
        );

        SettingsWebviewPanel.currentPanel = new SettingsWebviewPanel(
            panel,
            extensionUri,
            config,
            onSaved,
        );

        return SettingsWebviewPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        _extensionUri: vscode.Uri,
        config: AppConfig,
        onSaved: (config: AppConfig) => Promise<void>,
    ) {
        this.panel = panel;
        this.config = config;
        this.onSaved = onSaved;

        this.panel.iconPath = new vscode.ThemeIcon('settings-gear');

        this.updateWebview();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async (msg) => {
                switch (msg.command) {
                    case 'browseTargetPath':
                        await this.handleBrowseTargetPath();
                        break;
                    case 'browseStoragePath':
                        await this.handleBrowseStoragePath();
                        break;
                    case 'save':
                        await this.handleSave(msg.data);
                        break;
                    case 'cancel':
                        this.panel.dispose();
                        break;
                }
            },
            null,
            this.disposables,
        );
    }

    private updateWebview(): void {
        this.panel.webview.html = this.getHtmlForWebview();
    }

    private async handleBrowseTargetPath(): Promise<void> {
        const uris = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: false,
            canSelectFolders: true,
            title: t('targetPathLabel'),
            defaultUri: vscode.Uri.file(this.config.targetPath),
        });
        if (uris && uris.length > 0) {
            let selectedPath = uris[0].fsPath;
            // Ensure trailing separator
            if (!selectedPath.endsWith('/') && !selectedPath.endsWith('\\')) {
                selectedPath += '/';
            }
            this.config = { ...this.config, targetPath: selectedPath };
            this.panel.webview.postMessage({ command: 'updateTargetPath', value: selectedPath });
        }
    }

    private async handleBrowseStoragePath(): Promise<void> {
        const result = await vscode.window.showOpenDialog({
            canSelectMany: false,
            canSelectFiles: false,
            canSelectFolders: true,
            title: t('storagePathLabel'),
            defaultUri: vscode.Uri.file(this.config.storagePath),
        });
        if (result && result.length > 0) {
            const newPath = result[0].fsPath;
            this.config = { ...this.config, storagePath: newPath };
            this.panel.webview.postMessage({ command: 'updateStoragePath', value: newPath });
        }
    }

    private async handleSave(data: { targetPath: string; storagePath: string; language: Language }): Promise<void> {
        this.config = {
            targetPath: data.targetPath,
            storagePath: data.storagePath,
            language: data.language,
        };

        if (this.onSaved) {
            await this.onSaved(this.config);
        }

        vscode.window.showInformationMessage(t('msgSettingsSaved'));
    }

    private getHtmlForWebview(): string {
        const lang = getCurrentLanguage();
        const config = this.config;

        return /*html*/ `
<!DOCTYPE html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>${t('settingsTitle')}</title>
    <style>
        :root {
            --vscode-blue: #0078D4;
            --vscode-blue-hover: #1A8AE8;
            --vscode-blue-muted: rgba(0, 120, 212, 0.12);
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --bg-input: var(--vscode-input-background);
            --border: var(--vscode-input-border, rgba(255,255,255,0.12));
            --fg-primary: var(--vscode-foreground);
            --fg-secondary: var(--vscode-descriptionForeground);
            --fg-muted: var(--vscode-disabledForeground);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            color: var(--fg-primary);
            background: var(--bg-primary);
            padding: 32px 48px;
            line-height: 1.5;
        }

        .title-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
        }

        .title-row .icon {
            width: 24px;
            height: 24px;
            color: var(--vscode-blue);
        }

        .title-row h1 {
            font-size: 24px;
            font-weight: 700;
        }

        .section {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 24px;
        }

        .section-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 4px;
        }

        .section-header .icon {
            width: 16px;
            height: 16px;
            color: var(--vscode-blue);
        }

        .section-header h2 {
            font-size: 14px;
            font-weight: 600;
        }

        .section-desc {
            font-size: 11px;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            color: var(--fg-secondary);
            margin-bottom: 16px;
        }

        .divider {
            height: 1px;
            background: var(--border);
            margin: 12px 0;
        }

        .field-group {
            margin-bottom: 16px;
        }

        .field-group:last-child {
            margin-bottom: 0;
        }

        .field-label {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 2px;
        }

        .field-label .icon {
            width: 12px;
            height: 12px;
            color: var(--fg-secondary);
        }

        .field-label label {
            font-size: 12px;
            font-weight: 600;
            color: var(--fg-secondary);
        }

        .field-hint {
            font-size: 10px;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            color: var(--fg-muted);
            margin-bottom: 6px;
        }

        .input-row {
            display: flex;
            align-items: center;
            gap: 8px;
            height: 32px;
        }

        .input-row input {
            flex: 1;
            height: 32px;
            padding: 0 10px;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            font-size: 12px;
            color: var(--fg-primary);
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 4px;
            outline: none;
        }

        .input-row input:focus {
            border-color: var(--vscode-blue);
        }

        .browse-btn {
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 3px 8px;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            font-size: 10px;
            font-weight: 600;
            color: var(--fg-secondary);
            background: transparent;
            border: 1px solid var(--border);
            border-radius: 3px;
            cursor: pointer;
            white-space: nowrap;
        }

        .browse-btn:hover {
            background: var(--vscode-blue-muted);
            color: var(--vscode-blue);
            border-color: var(--vscode-blue);
        }

        .browse-btn .icon {
            width: 12px;
            height: 12px;
        }

        .select-wrapper {
            position: relative;
            width: 100%;
            height: 32px;
        }

        .select-wrapper select {
            width: 100%;
            height: 32px;
            padding: 0 28px 0 10px;
            font-family: var(--vscode-font-family);
            font-size: 12px;
            color: var(--fg-primary);
            background: var(--bg-input);
            border: 1px solid var(--border);
            border-radius: 4px;
            outline: none;
            appearance: none;
            -webkit-appearance: none;
            cursor: pointer;
        }

        .select-wrapper select:focus {
            border-color: var(--vscode-blue);
        }

        .select-wrapper::after {
            content: '';
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            width: 0;
            height: 0;
            border-left: 4px solid transparent;
            border-right: 4px solid transparent;
            border-top: 5px solid var(--fg-secondary);
            pointer-events: none;
        }

        .language-hint {
            font-size: 10px;
            font-family: var(--vscode-editor-font-family, 'Consolas', monospace);
            color: var(--fg-muted);
            margin-top: 6px;
        }

        .btn-row {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 16px;
            padding-top: 16px;
        }

        .btn {
            padding: 8px 20px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: none;
            outline: none;
        }

        .btn-cancel {
            color: var(--fg-secondary);
            background: transparent;
            border: 1px solid var(--border);
        }

        .btn-cancel:hover {
            background: var(--vscode-blue-muted);
        }

        .btn-save {
            display: flex;
            align-items: center;
            gap: 6px;
            color: #fff;
            background: var(--vscode-blue);
        }

        .btn-save:hover {
            background: var(--vscode-blue-hover);
        }

        .btn-save .icon {
            width: 14px;
            height: 14px;
        }
    </style>
</head>
<body>
    <div class="title-row">
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <h1>${t('settingsTitle')}</h1>
    </div>

    <!-- Path Configuration Section -->
    <div class="section">
        <div class="section-header">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            <h2>${t('pathConfigTitle')}</h2>
        </div>
        <div class="section-desc">${t('pathConfigDesc')}</div>
        <div class="divider"></div>

        <!-- Target Path -->
        <div class="field-group">
            <div class="field-label">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                </svg>
                <label>${t('targetPathLabel')}</label>
            </div>
            <div class="field-hint">${t('targetPathHint')}</div>
            <div class="input-row">
                <input type="text" id="targetPath" value="${this.escapeHtml(config.targetPath)}" />
                <button class="browse-btn" onclick="browseTargetPath()">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    ${t('browseBtn')}
                </button>
            </div>
        </div>

        <!-- Storage Path -->
        <div class="field-group">
            <div class="field-label">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/><line x1="2" y1="12" x2="22" y2="12"/>
                </svg>
                <label>${t('storagePathLabel')}</label>
            </div>
            <div class="field-hint">${t('storagePathHint')}</div>
            <div class="input-row">
                <input type="text" id="storagePath" value="${this.escapeHtml(config.storagePath)}" />
                <button class="browse-btn" onclick="browseStoragePath()">
                    <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    ${t('browseBtn')}
                </button>
            </div>
        </div>
    </div>

    <!-- Language Section -->
    <div class="section">
        <div class="section-header">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <h2>${t('languageTitle')}</h2>
        </div>
        <div class="section-desc">${t('languageDesc')}</div>
        <div class="divider"></div>

        <div class="field-group">
            <div class="field-label">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
                </svg>
                <label>${t('displayLanguageLabel')}</label>
            </div>
            <div class="select-wrapper">
                <select id="language">
                    <option value="en" ${config.language === 'en' ? 'selected' : ''}>${t('langEn')}</option>
                    <option value="zh" ${config.language === 'zh' ? 'selected' : ''}>${t('langZh')}</option>
                </select>
            </div>
            <div class="language-hint">${t('languageHint')}</div>
        </div>
    </div>

    <!-- Button Row -->
    <div class="btn-row">
        <button class="btn btn-cancel" onclick="cancel()">${t('cancelBtn')}</button>
        <button class="btn btn-save" onclick="save()">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            ${t('saveBtn')}
        </button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        function browseTargetPath() {
            vscode.postMessage({ command: 'browseTargetPath' });
        }

        function browseStoragePath() {
            vscode.postMessage({ command: 'browseStoragePath' });
        }

        function save() {
            const targetPath = document.getElementById('targetPath').value;
            const storagePath = document.getElementById('storagePath').value;
            const language = document.getElementById('language').value;
            vscode.postMessage({
                command: 'save',
                data: { targetPath, storagePath, language }
            });
        }

        function cancel() {
            vscode.postMessage({ command: 'cancel' });
        }

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.command === 'updateTargetPath') {
                document.getElementById('targetPath').value = msg.value;
            } else if (msg.command === 'updateStoragePath') {
                document.getElementById('storagePath').value = msg.value;
            }
        });
    </script>
</body>
</html>`;
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    public dispose(): void {
        SettingsWebviewPanel.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}

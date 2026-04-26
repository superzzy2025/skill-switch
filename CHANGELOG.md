# Changelog

All notable changes to the "Skill Switch" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-04-26

### Fixed
- Fixed runtime crash when creating a profile: `createProfile` returned `string[]` for `skillFiles` instead of `ResolvedSkill[]`, causing `skill.name` / `skill.description` to be `undefined` in the tree view.
- Fixed async method signature incompatibility: `getChildren` now properly declared as `async` returning `Promise<SkillTreeItem[]>` instead of synchronous `ProviderResult<SkillTreeItem[]>`.
- Fixed missing `await` on `buildDesignDocItems()` call in `getChildren`, which returned a raw Promise instead of resolved array, breaking design doc rendering.
- Fixed missing `await` on `getDirChildren()` calls in `getChildren`, causing design doc folder/file nodes to fail loading.
- Fixed `Promise.race` timeout anti-pattern in `showUndoMessage` that could silently swallow undo actions; simplified to direct `await`.
- Added runtime type guard in `SettingsWebviewPanel.handleSave` to validate incoming webview message data before processing.
- Added `hasTargetPath()` guard before showing "import from target" option in profile creation flow.

### Changed
- Migrated `SkillTreeProvider.countChildren` and `getDirChildren` from sync (`fs.readdirSync`) to async (`fs.promises.readdir`) for non-blocking I/O.
- Changed `ResolvedProfile.skillFiles` type from `string[]` to `ResolvedSkill[]`, with SKILL.md frontmatter metadata (name, description) resolved at load time.
- Cleaned up all `as any` type casts across `commands/index.ts` and `extension.ts`; `ProfileMeta` fields (`isBackup`, `backupOf`) are now properly typed.
- Replaced local `readSkillMdMeta` / `writeSkillMdMeta` dead code in `commands/index.ts` with `ProfileManager.readSkillMdMeta`.

### Removed
- Deleted unused `backupDir()` and `restoreBackup()` functions from `fileUtils.ts`.
- Deleted duplicate `getDesignDocPath()` method from `DesignDocManager` (identical to `getDesignDocDirPath`).
- Removed unused imports (`Language`, `getCurrentLanguage`) and unused variable `skillMeta` from `commands/index.ts`.

### Added
- Responsive CSS (`@media max-width: 600px`) for the settings webview panel.
- ARIA labels on form inputs in the settings webview for accessibility.

## [0.1.0] - 2026-04-26

### Added
- Initial release of Skill Switch.
- Profile management: create, edit, delete, and switch between skill profiles.
- Checkbox support to enable/disable individual skills within a profile.
- Permanent skills that remain active across all profiles.
- Design document management with folder and file support.
- Auto-import existing skill directories on first launch.
- Backup and restore functionality for profiles.
- Import skills from target path or custom directory.
- Move/copy skills between profiles and permanent skills.
- Settings webview for configuring target path, storage path, and language.
- Bilingual UI support (English and Chinese).
- Status bar indicator showing the active profile and enabled skill count.

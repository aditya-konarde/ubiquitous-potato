import type {
  ModuleContext,
  SimplyMailModule,
  SimplyMailSettings,
  ToggleableModuleName,
} from '@/shared/types';

const SETTINGS_KEY: Record<ToggleableModuleName, keyof SimplyMailSettings> = {
  uiCleanup: 'uiCleanup',
  darkMode: 'darkMode',
  keyboardNavigation: 'keyboardNavigation',
  commandPalette: 'commandPalette',
  savedSearches: 'savedSearches',
  splitInbox: 'splitInboxSettings',
  pauseInbox: 'pauseInbox',
  groupByDate: 'groupByDate',
  inboxZero: 'inboxZero',
  trackerBlocker: 'trackerBlocker',
  autoCcBcc: 'autoCcBcc',
  instantReply: 'instantReply',
  smartActions: 'smartActions',
  emailAnalytics: 'emailAnalytics',
  snippetExpansion: 'snippets',
  inboxSummary: 'inboxSummary',
  readingPane: 'readingPane',
  batchActions: 'batchActions',
  scrollProgress: 'scrollProgress',
  rowAnimations: 'rowAnimations',
  skeletonLoading: 'skeletonLoading',
  senderAvatars: 'senderAvatars',
  priorityBadges: 'priorityBadges',
  attachmentChips: 'attachmentChips',
};

export function isEnabled(moduleName: ToggleableModuleName, settings: SimplyMailSettings): boolean {
  if (settings.paused && moduleName !== 'pauseInbox') {
    return false;
  }

  // snippetExpansion is enabled when any snippets are configured
  if (moduleName === 'snippetExpansion') {
    return settings.snippets.length > 0;
  }

  const key = SETTINGS_KEY[moduleName];
  const section = settings[key];
  return typeof section === 'object' && section !== null && 'enabled' in section
    ? (section as { enabled: boolean }).enabled
    : false;
}

export class ModuleRegistry {
  private modules = new Map<ToggleableModuleName, SimplyMailModule>();
  private activeModules = new Set<ToggleableModuleName>();

  constructor(private context: ModuleContext) {}

  register(module: SimplyMailModule): void {
    this.modules.set(module.name, module);
  }

  async sync(settings: SimplyMailSettings): Promise<void> {
    const previous = this.context.settings;
    this.context.settings = settings;

    const toInit: ToggleableModuleName[] = [];
    const toDestroy: ToggleableModuleName[] = [];
    const toSettingsChange: { module: SimplyMailModule; settings: SimplyMailSettings }[] = [];

    for (const [name, module] of this.modules.entries()) {
      const enabled = isEnabled(name, settings);
      const active = this.activeModules.has(name);

      if (enabled && !active) {
        toInit.push(name);
      } else if (!enabled && active) {
        toDestroy.push(name);
      } else if (enabled && active && module.onSettingsChange && previous !== settings) {
        toSettingsChange.push({ module, settings });
      }
    }

    await Promise.all([
      ...toInit.map(async (name) => {
        const mod = this.modules.get(name);
        if (mod) {
          try {
            await mod.init(this.context);
            this.activeModules.add(name);
          } catch (error) {
            console.error(`[Simply Mail] Failed to init module "${name}":`, error);
          }
        }
      }),
      ...toDestroy.map(async (name) => {
        const mod = this.modules.get(name);
        if (mod) {
          try {
            await mod.destroy();
          } catch (error) {
            console.error(`[Simply Mail] Failed to destroy module "${name}":`, error);
          }
          this.context.commandPalette.unregisterCommands(name);
          this.activeModules.delete(name);
        }
      }),
      ...toSettingsChange.map(async ({ module, settings: s }) => {
        try {
          if (module.onSettingsChange) {
            await module.onSettingsChange(s, this.context);
          }
        } catch (error) {
          console.error(`[Simply Mail] Failed to update settings for module "${module.name}":`, error);
        }
      }),
    ]);
  }

  async destroyAll(): Promise<void> {
    const names = Array.from(this.activeModules);
    await Promise.all(
      names.map(async (name) => {
        const module = this.modules.get(name);
        if (!module) {
          return;
        }
        try {
          await module.destroy();
        } catch (error) {
          console.error(`[Simply Mail] Failed to destroy module "${name}":`, error);
        }
        this.context.commandPalette.unregisterCommands(name);
        this.activeModules.delete(name);
      }),
    );
  }

  getActiveModuleNames(): ToggleableModuleName[] {
    return Array.from(this.activeModules);
  }
}

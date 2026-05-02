import { ModuleRegistry } from '@/content/module-registry';
import type { CommandPaletteRegistryLike, MailObserverLike, MailView, ModuleContext, SimplyMailModule } from '@/shared/types';
import { DEFAULT_SETTINGS } from '@/shared/constants';

function createContext(): ModuleContext {
  const observer: MailObserverLike = {
    start: vi.fn(),
    stop: vi.fn(),
    getCurrentView: vi.fn<() => MailView>(() => 'inbox'),
    on: vi.fn(() => () => undefined),
  };

  const storage = {
    getSettings: vi.fn(async () => DEFAULT_SETTINGS),
    setSettings: vi.fn(async () => undefined),
    patchSettings: vi.fn(async () => DEFAULT_SETTINGS),
    getSnoozedItems: vi.fn(async () => []),
    setSnoozedItems: vi.fn(async () => undefined),
    getReminderItems: vi.fn(async () => []),
    setReminderItems: vi.fn(async () => undefined),
    getStats: vi.fn(async () => ({ trackersBlockedToday: 0, snoozedCount: 0, reminderCount: 0 })),
    setStats: vi.fn(async () => undefined),
    onSettingsChanged: vi.fn(() => () => undefined),
  };

  const commandPalette: CommandPaletteRegistryLike = {
    registerCommands: vi.fn(),
    unregisterCommands: vi.fn(),
  };

  return {
    observer,
    settings: structuredClone(DEFAULT_SETTINGS),
    storage,
    commandPalette,
  };
}

function createModule(name: SimplyMailModule['name']) {
  return {
    name,
    init: vi.fn(async () => undefined),
    destroy: vi.fn(async () => undefined),
    onSettingsChange: vi.fn(async () => undefined),
  } satisfies SimplyMailModule;
}

describe('ModuleRegistry', () => {
  it('initializes enabled modules', async () => {
    const context = createContext();
    const registry = new ModuleRegistry(context);
    const module = createModule('uiCleanup');

    registry.register(module);
    await registry.sync(structuredClone(DEFAULT_SETTINGS));

    expect(module.init).toHaveBeenCalledTimes(1);
    expect(registry.getActiveModuleNames()).toEqual(['uiCleanup']);
  });

  it('destroys modules when disabled and unregisters commands', async () => {
    const context = createContext();
    const registry = new ModuleRegistry(context);
    const module = createModule('commandPalette');

    registry.register(module);
    await registry.sync(structuredClone(DEFAULT_SETTINGS));
    await registry.sync({ ...structuredClone(DEFAULT_SETTINGS), commandPalette: { ...DEFAULT_SETTINGS.commandPalette, enabled: false } });

    expect(module.destroy).toHaveBeenCalledTimes(1);
    expect(context.commandPalette.unregisterCommands).toHaveBeenCalledWith('commandPalette');
    expect(registry.getActiveModuleNames()).toEqual([]);
  });

  it('calls onSettingsChange for active modules', async () => {
    const context = createContext();
    const registry = new ModuleRegistry(context);
    const module = createModule('darkMode');

    registry.register(module);
    await registry.sync(structuredClone(DEFAULT_SETTINGS));
    await registry.sync({ ...structuredClone(DEFAULT_SETTINGS), darkMode: { ...DEFAULT_SETTINGS.darkMode, invertMessageBodies: true } });

    expect(module.onSettingsChange).toHaveBeenCalledTimes(1);
  });

  it('destroyAll tears down every active module and unregisters its commands', async () => {
    const context = createContext();
    const registry = new ModuleRegistry(context);
    const uiCleanup = createModule('uiCleanup');
    const keyboardNavigation = createModule('keyboardNavigation');

    registry.register(uiCleanup);
    registry.register(keyboardNavigation);
    await registry.sync(structuredClone(DEFAULT_SETTINGS));

    await registry.destroyAll();

    expect(uiCleanup.destroy).toHaveBeenCalledTimes(1);
    expect(keyboardNavigation.destroy).toHaveBeenCalledTimes(1);
    expect(context.commandPalette.unregisterCommands).toHaveBeenCalledWith('uiCleanup');
    expect(context.commandPalette.unregisterCommands).toHaveBeenCalledWith('keyboardNavigation');
    expect(registry.getActiveModuleNames()).toEqual([]);
  });

  it('destroys active modules when the extension is paused', async () => {
    const context = createContext();
    const registry = new ModuleRegistry(context);
    const module = createModule('uiCleanup');

    registry.register(module);
    await registry.sync(structuredClone(DEFAULT_SETTINGS));
    await registry.sync({ ...structuredClone(DEFAULT_SETTINGS), paused: true });

    expect(module.destroy).toHaveBeenCalledTimes(1);
    expect(context.commandPalette.unregisterCommands).toHaveBeenCalledWith('uiCleanup');
    expect(registry.getActiveModuleNames()).toEqual([]);
  });
});

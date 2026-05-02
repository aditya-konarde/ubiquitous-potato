import { CommandPaletteRegistry } from '@/content/command-registry';

describe('CommandPaletteRegistry', () => {
  it('flattens registered commands and emits change events on register/unregister', async () => {
    const registry = new CommandPaletteRegistry();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    const first = { id: 'first', title: 'First', run: vi.fn() };
    const second = { id: 'second', title: 'Second', run: vi.fn() };

    registry.registerCommands('alpha', [first]);
    registry.registerCommands('beta', [second]);

    expect(registry.getCommands()).toEqual([first, second]);

    registry.unregisterCommands('alpha');

    expect(registry.getCommands()).toEqual([second]);

    // Flush microtask-batched notifications
    await new Promise<void>((resolve) => queueMicrotask(resolve));

    // registerCommands x2 + unregisterCommands x1, batched into a single microtask
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
  });
});
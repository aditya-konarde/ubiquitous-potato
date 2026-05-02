import type { CommandDefinition, CommandPaletteRegistryLike } from '@/shared/types';

export class CommandPaletteRegistry implements CommandPaletteRegistryLike {
  private commands = new Map<string, CommandDefinition[]>();
  private pendingNotify = false;

  private scheduleNotify(): void {
    if (this.pendingNotify) return;
    this.pendingNotify = true;
    queueMicrotask(() => {
      this.pendingNotify = false;
      window.dispatchEvent(new CustomEvent('simply-mail:commands-changed'));
    });
  }

  registerCommands(moduleName: string, commands: CommandDefinition[]): void {
    this.commands.set(moduleName, commands);
    this.scheduleNotify();
  }

  unregisterCommands(moduleName: string): void {
    this.commands.delete(moduleName);
    this.scheduleNotify();
  }

  getCommands(): CommandDefinition[] {
    return Array.from(this.commands.values()).flat();
  }
}

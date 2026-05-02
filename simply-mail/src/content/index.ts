import { DEFAULT_SETTINGS } from '@/shared/constants';
import { storage } from '@/shared/storage';
import { MailObserver } from './mail-observer';
import { ModuleRegistry } from './module-registry';
import { createUiCleanupModule } from './modules/ui-cleanup';
import { createDarkModeModule } from './modules/dark-mode';
import { createKeyboardNavigationModule } from './modules/keyboard-nav';
import { createCommandPaletteModule } from './modules/command-palette';
import { createSavedSearchesModule } from './modules/saved-searches';
import { createSplitInboxModule } from './modules/split-inbox';
import { createGroupByDateModule } from './modules/group-by-date';
import { createPauseInboxModule } from './modules/pause-inbox';
import { createInboxZeroModule } from './modules/inbox-zero';
import { createAutoCcBccModule } from './modules/auto-cc-bcc';
import { createTrackerBlockerModule } from './modules/tracker-blocker';
import { createInstantReplyModule } from './modules/instant-reply';
import { createSmartActionsModule } from './modules/smart-actions';
import { createEmailAnalyticsModule } from './modules/email-analytics';
import { createSnippetExpansionModule } from './modules/snippet-expansion';
import { createReadingPaneModule } from './modules/reading-pane';
import { createBatchActionsModule } from './modules/batch-actions';
import { createInboxSummaryModule } from './modules/inbox-summary';
import { createScrollProgressModule } from './modules/scroll-progress';
import { createRowAnimationsModule } from './modules/row-animations';
import { createSkeletonLoadingModule } from './modules/skeleton-loading';
import { createSenderAvatarsModule } from './modules/sender-avatars';
import { createPriorityBadgesModule } from './modules/priority-badges';
import { createAttachmentChipsModule } from './modules/attachment-chips';
import { initToastSystem, destroyToastSystem } from './modules/toast';
import { initOnboarding } from './modules/onboarding';
import { CommandPaletteRegistry } from './command-registry';
import { installDebugBridge } from './debug-bridge';

async function waitForMailShell(): Promise<void> {
  if (document.body) return;

  await new Promise<void>((resolve) => {
    const observer = new MutationObserver(() => {
      if (document.body) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.documentElement, { childList: true });
    // Double-check in case body appeared during observer setup
    if (document.body) {
      observer.disconnect();
      resolve();
    }
  });
}

async function bootstrap() {
  try {
    await waitForMailShell();
  } catch {
    return;
  }

  const initialSettings = await storage.getSettings().catch(() => DEFAULT_SETTINGS);
  const observer = new MailObserver();
  const commandPalette = new CommandPaletteRegistry();
  let currentSettings = initialSettings;
  const registry = new ModuleRegistry({
    observer,
    settings: initialSettings,
    storage,
    commandPalette,
  });

  const modules = [
    createUiCleanupModule(),
    createDarkModeModule(),
    createKeyboardNavigationModule(),
    createCommandPaletteModule(),
    createSavedSearchesModule(),
    createSplitInboxModule(),
    createGroupByDateModule(),
    createPauseInboxModule(),
    createInboxZeroModule(),
    createAutoCcBccModule(),
    createTrackerBlockerModule(),
    createInstantReplyModule(),
    createSmartActionsModule(),
    createEmailAnalyticsModule(),
    createSnippetExpansionModule(),
    createReadingPaneModule(),
    createBatchActionsModule(),
    createInboxSummaryModule(),
    createScrollProgressModule(),
    createRowAnimationsModule(),
    createSkeletonLoadingModule(),
    createSenderAvatarsModule(),
    createPriorityBadgesModule(),
    createAttachmentChipsModule(),
  ];

  for (const mod of modules) {
    registry.register(mod);
  }

  initToastSystem();

  // Show onboarding overlay immediately (before modules init)
  const cleanupOnboarding = await initOnboarding(storage).catch(() => () => {});
  const cleanupDebugBridge = installDebugBridge(() => ({
    currentView: observer.getCurrentView(),
    settings: currentSettings,
    activeModules: registry.getActiveModuleNames(),
  }));

  observer.start();
  await registry.sync(initialSettings);

  const unsubscribe = storage.onSettingsChanged((settings) => {
    currentSettings = settings;
    void registry.sync(settings);
  });

  window.addEventListener('beforeunload', () => {
    cleanupOnboarding();
    cleanupDebugBridge();
    unsubscribe();
    observer.stop();
    destroyToastSystem();
    void registry.destroyAll();
  });
}

void bootstrap();

// background.js — Service Worker
// Handles install events, context menus, and keyboard shortcuts.

'use strict';

// ── Install ───────────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === 'install') {
    // Seed default settings
    chrome.storage.local.set({
      theme: 'dark',
      history: [],
      processingCount: 0,
    });

    // Create context menu item
    chrome.contextMenus.create({
      id: 'humanize-selection',
      title: 'Humanize with AI Humanizer',
      contexts: ['selection'],
    });
  }
});

// ── Context Menu ──────────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'humanize-selection' && info.selectionText) {
    // Store the selected text and open the popup
    chrome.storage.local.set({ pendingText: info.selectionText });
    chrome.action.openPopup().catch(() => {
      // openPopup can fail in some contexts — silently ignore
    });
  }
});

// ── Keyboard Shortcut ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener((command) => {
  if (command === 'humanize-text') {
    chrome.action.openPopup().catch(() => {});
  }
});

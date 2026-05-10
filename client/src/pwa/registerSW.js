export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('SW registered:', registration.scope);

      // Listen for sync trigger messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'TRIGGER_SYNC') {
          // Will be handled by the sync manager in the app
          window.dispatchEvent(new CustomEvent('sw-sync-trigger'));
        }
      });

      return registration;
    } catch (err) {
      console.error('SW registration failed:', err);
    }
  }
}

// Request background sync
export async function requestSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register('sync-field-data');
  }
}

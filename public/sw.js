// public/sw.js

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-chama-contributions') {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  const contributions = await getPendingContributions(); // Access IDB
  
  return Promise.all(contributions.map(async (item) => {
    try {
      const response = await fetch('/api/v1/chama/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });

      if (response.ok) {
        await clearSyncedItem(item.id); // Remove from "Waiting Room"
        showNotification('Sync Complete', 'Your contribution was uploaded.');
      }
    } catch (err) {
      console.error('Sync failed for item:', item.id);
      throw err; // Browser will retry later
    }
  }));
}

function showNotification(title, body) {
  self.registration.showNotification(title, { body, icon: '/pwa-192.png' });
}

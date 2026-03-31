// src/components/ChamaForm.tsx
import { queueContribution } from '../utils/db';

const handleChamaSubmit = async (data) => {
  if (!navigator.onLine) {
    // 1. Save to Local DB
    await queueContribution(data);

    // 2. Register for Background Sync
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) {
      await registration.sync.register('sync-chama-contributions');
      toast.info("Offline: Data saved and will sync automatically!");
    }
  } else {
    // Standard online submission
    await api.post('/contribute', data);
  }
};

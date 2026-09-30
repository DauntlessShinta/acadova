import api from './api';

const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
let initialization;
let sdkInstance;
let identityQueue = Promise.resolve();
let currentUserId = null;
let activeAlias = null;

export const pushAvailable = Boolean(appId && typeof window !== 'undefined'
  && window.isSecureContext && 'serviceWorker' in navigator && 'Notification' in window);

const initialize = () => {
  if (!pushAvailable) return Promise.resolve(null);
  if (initialization) return initialization;
  initialization = new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({ appId,
          serviceWorkerPath: 'push/onesignal/OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/push/onesignal/' },
          promptOptions: { slidedown: { prompts: [{ type: 'push', autoPrompt: false }] } },
        });
        sdkInstance = OneSignal;
        resolve(OneSignal);
      } catch (error) { reject(error); }
    });
    if (!document.querySelector('script[data-acadova-onesignal]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      script.dataset.acadovaOnesignal = 'true';
      script.onerror = () => reject(new Error('Push setup unavailable'));
      document.head.appendChild(script);
    }
  }).catch((error) => { initialization = undefined; throw error; });
  return initialization;
};

export function syncPushIdentity(userId) {
  identityQueue = identityQueue.catch(() => {}).then(async () => {
    if (currentUserId !== userId) {
      if (sdkInstance) await sdkInstance.logout();
      currentUserId = userId;
      activeAlias = null;
    }
    if (!userId) return;
    if (!pushAvailable) return;
    const response = await api.get('/api/notifications/push-identity');
    const alias = response?.data?.alias;
    if (!response?.data?.enabled || !alias) return;
    const sdk = await initialize();
    if (sdk) { await sdk.login(alias); activeAlias = alias; }
  });
  return identityQueue;
}

export async function requestPushPermission() {
  await identityQueue;
  if (!activeAlias) throw new Error('Push is not configured for this account.');
  const sdk = await initialize();
  if (!sdk || !sdk.Notifications.isPushSupported()) throw new Error('Push is unavailable in this browser.');
  await sdk.Slidedown.promptPush();
}

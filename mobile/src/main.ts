import { createApp } from 'vue';
import App from './app/App.vue';
import { router } from './app/router';
import { pinia } from './app/stores';
import { useLocalizationStore } from './app/stores/localization';
import { i18n } from './features/localization/i18n';
import { initializeStorageServices } from './shared/services/storageService';
import { hideLaunchSplash } from './shared/services/splashScreenService';
import { configureSystemBars } from './shared/services/systemBarsService';
import { initializeVConsole } from './shared/services/vconsoleService';
import { initializeSentry } from './shared/services/sentryPrivacy';
import './styles/main.css';

const app = createApp(App);
initializeSentry(app, import.meta.env.VITE_SENTRY_DSN);

app.use(pinia);

async function bootstrapApp() {
  await initializeVConsole();
  await initializeStorageServices();

  useLocalizationStore().applyLocale();

  app.use(i18n).use(router);

  await router.isReady();
  app.mount('#app');

  void configureSystemBars().then(async () => {
    await hideLaunchSplash();
    await configureSystemBars();
  });
}

void bootstrapApp();

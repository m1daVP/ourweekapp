import { createApp } from 'vue';
import App from './app/App.vue';
import { router } from './app/router';
import { pinia } from './app/stores';
import { useLocalizationStore } from './app/stores/localization';
import { i18n } from './features/localization/i18n';
import { initializeStorageServices } from './shared/services/storageService';
import { hideLaunchSplash } from './shared/services/splashScreenService';
import { configureSystemBars } from './shared/services/systemBarsService';
import './styles/main.css';

const app = createApp(App);

app.use(pinia);

void initializeStorageServices().then(() => {
  useLocalizationStore().applyLocale();

  app.use(i18n).use(router);

  void router.isReady().then(() => {
    app.mount('#app');
    void configureSystemBars().then(async () => {
      await hideLaunchSplash();
      await configureSystemBars();
    });
  });
});

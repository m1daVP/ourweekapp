import { createApp } from 'vue';
import App from './app/App.vue';
import { router } from './app/router';
import { pinia } from './app/stores';
import './styles/main.css';

createApp(App).use(pinia).use(router).mount('#app');

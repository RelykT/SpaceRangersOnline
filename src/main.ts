import '@fontsource/rubik/cyrillic-400.css';
import '@fontsource/rubik/cyrillic-500.css';
import '@fontsource/rubik/cyrillic-700.css';
import '@fontsource/unbounded/cyrillic-700.css';
import './style.css';
import { startGame } from './game/app';

const root = document.querySelector<HTMLElement>('#app');
if (root) startGame(root);

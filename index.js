import { registerRootComponent } from 'expo';
import './src/gpsTask'; // registra a tarefa de GPS antes de abrir o app
import App from './App';

registerRootComponent(App);

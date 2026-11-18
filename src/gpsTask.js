import * as TaskManager from 'expo-task-manager';
import { addLocations } from './store';

export const TASK = 'rally-gps-task';

// Precisa ser definida no escopo global (importada em index.js).
TaskManager.defineTask(TASK, ({ data, error }) => {
  if (error) return;
  if (data && data.locations) addLocations(data.locations);
});

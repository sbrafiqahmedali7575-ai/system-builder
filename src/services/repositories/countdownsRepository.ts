import {
  getCountdownSettings,
  saveCountdownSettings,
} from '../firebaseService';

export const countdownsRepository = {
  get: getCountdownSettings,
  save: saveCountdownSettings,
} as const;

export type CountdownsRepository = typeof countdownsRepository;

import { saveCountdownSettings } from '../firebaseService';

export const countdownsRepository = {
  save: saveCountdownSettings,
} as const;

export type CountdownsRepository = typeof countdownsRepository;

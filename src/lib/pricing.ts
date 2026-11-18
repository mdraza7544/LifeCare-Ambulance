import type { AmbulanceType } from './types';

/** Standard base pricing in INR per ambulance type. */
export const ambulanceTypePricing: Record<AmbulanceType | string, number> = {
  Basic: 1800,
  Advanced: 3500,
  Cardiac: 5200,
  Neonatal: 4200,
};

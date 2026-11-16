import { onCall } from 'firebase-functions/v2/functions';
import * as admin from 'firebase-admin';
import fetch, { BodyResponseType } from 'node-fetch';
import * as geocode from '@google/maps';

admin.initializeApp();

const firestore = admin.firestore();

// Google Maps Geocoding client (using server-side key)
const gm = geocode({
  key: process.env.GOOGLE_MAPS_KEY ?? '',
  Promise: Promise,
});

interface WIBHospital {
  name: string;
  city: string;
  type: string;
  beds: number;
  rating: number;
  specialties: string[];
  nabh: boolean;
  address: string;
}

interface GeocodedHospital {
  id: string;
  name: string;
  area: string;
  city: string;
  address: string;
  beds: number;
  phone: string;
  emergency: boolean;
  lat: number;
  lng: number;
  type: string;
}

/**
 * Seed hospitals from WIB India Dataset 2026
 * Fetches the dataset, geocodes each hospital, and stores in Firestore
 */
export const seedHospitals = onCall(async (request) => {
  try {
    // Fetch WIB dataset
    const datasetResponse = await fetch('https://wibest.in/data/json/hospitals.json');
    if (!datasetResponse.ok) {
      throw new Error('Failed to fetch WIB dataset');
    }
    const dataset = await datasetResponse.json() as { data: WIBHospital[]; count: number };
    
    const hospitalsToGeocode = dataset.data || [];
    const geocodedHospitals: GeocodedHospital[] = [];
    
    // Geocode each hospital in batches to avoid rate limits
    for (let i = 0; i < hospitalsToGeocode.length; i++) {
      const hospital = hospitalsToGeocode[i];
      const locationQuery = `${hospital.name}, ${hospital.address}, ${hospital.city}`;
      
      const geocodeResponse = await gm.geocode({ address: locationQuery }).asPromise();
      
      if (geocodeResponse.json?.status === 'OK' && geocodeResponse.json?.results?.length > 0) {
        const result = geocodeResponse.json!.results![0];
        const lat = result.geometry?.location?.lat;
        const lng = result.geometry?.location?.lng;
        
        if (lat && lng) {
          const id = hospital.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + i;
          geocodedHospitals.push({
            id,
            name: hospital.name,
            area: hospital.city || 'Unknown',
            city: hospital.city || 'Unknown',
            address: hospital.address || result.formatted_address || '',
            beds: hospital.beds || 0,
            phone: '', // Not available in dataset
            emergency: hospital.nabh || false,
            lat,
            lng,
            type: hospital.type || 'General',
          });
        }
      }
      
      // Small delay to avoid rate limiting
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Store in Firestore
    const batch = firestore.batch();
    
    geocodedHospitals.forEach((hospital) => {
      const docRef = firestore.collection('hospitals').doc(hospital.id);
      batch.set(docRef, hospital);
    });
    
    await batch.commit();
    
    return {
      success: true,
      message: `Successfully seeded ${geocodedHospitals.length} hospitals out of ${hospitalsToGeocode.length}`,
      totalInDataset: hospitalsToGeocode.length,
      geocodedCount: geocodedHospitals.length,
    };
  } catch (error: any) {
    console.error('Error seeding hospitals:', error);
    throw new Error(error.message || 'Failed to seed hospitals');
  }
});

/**
 * Fetch all geocoded hospitals from Firestore
 */
export const getHospitals = onCall(async () => {
  const snapshot = await firestore.collection('hospitals').get();
  const hospitals: GeocodedHospital[] = [];
  
  snapshot.forEach((doc) => {
    hospitals.push(doc.data() as GeocodedHospital);
  });
  
  return {
    success: true,
    hospitals,
    count: hospitals.length,
  };
});
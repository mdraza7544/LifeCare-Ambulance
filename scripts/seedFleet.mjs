/**
 * LifeCare Ambulance Service — Deterministic Fleet & Drivers Seeder
 *
 * Seeds 100 ambulances and 100 drivers into Firestore using existing schema & collections.
 *
 * Usage:
 *   npm run seed:fleet           # Seeds 100 ambulances & 100 drivers (skips existing IDs)
 *   npm run seed:fleet -- --force # Overwrites existing seeded IDs
 *   npm run seed:fleet:clean     # Deletes all docs with seeded: true
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// 1. Resolve firebase-admin
let admin;
try {
  admin = require('firebase-admin');
} catch {
  try {
    admin = require(path.resolve(__dirname, '../functions/node_modules/firebase-admin'));
  } catch (err) {
    console.error('\n❌ firebase-admin is not installed.');
    console.error('Please run: npm install -D firebase-admin\n');
    process.exit(1);
  }
}

// 2. Read serviceAccountKey.json
const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error(`\n❌ serviceAccountKey.json not found at: ${keyPath}`);
  console.error('Please ensure serviceAccountKey.json is in your project root.\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const AMBULANCES_COLLECTION = 'ambulances';
const DRIVERS_COLLECTION = 'drivers';

// Flags
const isClean = process.argv.includes('--clean');
const isForce = process.argv.includes('--force');

// State codes and RTO series for Indian vehicle plates
const STATE_CODES = ['KA', 'MH', 'DL', 'TN', 'TG'];
const CITY_MAP = {
  KA: 'Bengaluru',
  MH: 'Mumbai',
  DL: 'New Delhi',
  TN: 'Chennai',
  TG: 'Hyderabad',
};
const SERIES = ['AB', 'CD', 'EF', 'GH', 'JK', 'LM', 'NP', 'RS', 'TU', 'XY'];

// 100 Unique Indian Names (First + Last)
const FIRST_NAMES = [
  'Rajesh', 'Suresh', 'Ramesh', 'Amit', 'Vikram', 'Sunil', 'Anil', 'Deepak', 'Manoj', 'Sanjay',
  'Pradeep', 'Rakesh', 'Ajay', 'Vijay', 'Rahul', 'Rohit', 'Santosh', 'Dharmendra', 'Naresh', 'Mukesh',
  'Arvind', 'Ashok', 'Dinesh', 'Harish', 'Jagdish', 'Kamesh', 'Mahesh', 'Nitin', 'Pankaj', 'Rajendra',
  'Sachin', 'Tarun', 'Umesh', 'Vinod', 'Yogesh', 'Anand', 'Balaji', 'Chetan', 'Deven', 'Govind',
  'Hemant', 'Ishwar', 'Jatin', 'Kishore', 'Lokesh', 'Madhav', 'Naveen', 'Omkar', 'Parth', 'Raghav',
  'Sandeep', 'Tanmay', 'Utkarsh', 'Varun', 'Yash', 'Abhishek', 'Bharat', 'Chandan', 'Devendra', 'Gaurav',
  'Hitesh', 'Indra', 'Jignesh', 'Kiran', 'Lalit', 'Mayank', 'Narendra', 'Prashant', 'Ravindra', 'Shailesh',
  'Tushar', 'Upendra', 'Vikas', 'Alok', 'Bhupendra', 'Chinmay', 'Darshan', 'Girish', 'Hemanth', 'Jayesh',
  'Kripal', 'Laxman', 'Murali', 'Neeraj', 'Prabhat', 'Rupesh', 'Sharad', 'Tejas', 'Vaibhav', 'Vimal',
  'Amar', 'Brijesh', 'Chirag', 'Dhiren', 'Gopal', 'Himanshu', 'Jayant', 'Kamlesh', 'Laxmikant', 'Mohan'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Patel', 'Reddy', 'Rao', 'Kumar', 'Singh', 'Nair', 'Joshi', 'Deshmukh',
  'Kulkarni', 'Iyer', 'Gupta', 'Mishra', 'Yadav', 'Patil', 'Hegde', 'Gowda', 'Bhat', 'Pillai',
  'Menon', 'Das', 'Sen', 'Chatterjee', 'Banerjee', 'Mukherjee', 'Shinde', 'Jadhav', 'Chavan', 'Pawar',
  'More', 'Gaikwad', 'Salunkhe', 'Kadam', 'Bhosle', 'Sawant', 'Shetty', 'Poojary', 'Rai', 'Nayak',
  'Shenoy', 'Kamath', 'Pai', 'Prabhu', 'Kini', 'Swamy', 'Murthy', 'Prasad', 'Raju', 'Choudhary'
];

// Helper to batch commit operations in chunks of 400 or fewer
async function batchCommit(items, commitFn, chunkSize = 400) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = db.batch();
    chunk.forEach((item) => commitFn(batch, item));
    await batch.commit();
  }
}

async function cleanSeededData() {
  console.log('\n🧹 Cleaning seeded fleet and driver records (seeded == true)...\n');

  // 1. Clean Ambulances
  const ambSnapshot = await db.collection(AMBULANCES_COLLECTION).where('seeded', '==', true).get();
  console.log(`Found ${ambSnapshot.size} seeded ambulance records to remove.`);
  if (!ambSnapshot.empty) {
    await batchCommit(ambSnapshot.docs, (batch, doc) => {
      batch.delete(doc.ref);
    });
    console.log(`✅ Removed ${ambSnapshot.size} seeded ambulances.`);
  }

  // 2. Clean Drivers
  const drvSnapshot = await db.collection(DRIVERS_COLLECTION).where('seeded', '==', true).get();
  console.log(`Found ${drvSnapshot.size} seeded driver records to remove.`);
  if (!drvSnapshot.empty) {
    await batchCommit(drvSnapshot.docs, (batch, doc) => {
      batch.delete(doc.ref);
    });
    console.log(`✅ Removed ${drvSnapshot.size} seeded drivers.`);
  }

  console.log('\n✨ Clean complete! Real, unseeded records remain untouched.\n');
}

async function seedFleet() {
  console.log('\n🚀 Starting LifeCare Fleet & Driver Seeding...\n');

  // 1. Print existing stats
  const ambExistingSnap = await db.collection(AMBULANCES_COLLECTION).get();
  const drvExistingSnap = await db.collection(DRIVERS_COLLECTION).get();

  console.log('📊 Current Firestore status:');
  console.log(`   - Ambulances: ${ambExistingSnap.size} existing records`);
  console.log(`   - Drivers:    ${drvExistingSnap.size} existing records\n`);

  const existingAmbIds = new Set(ambExistingSnap.docs.map((d) => d.id));
  const existingDrvIds = new Set(drvExistingSnap.docs.map((d) => d.id));

  // 2. Prepare 100 Ambulances
  // Target distribution: BLS: 50%, ALS: 30%, ICU: 20%
  const ambulancesToSeed = [];
  let skippedAmb = 0;

  for (let i = 0; i < 100; i++) {
    const id = `amb_${String(i + 1).padStart(3, '0')}`;
    if (!isForce && existingAmbIds.has(id)) {
      skippedAmb++;
      continue;
    }

    const state = STATE_CODES[i % STATE_CODES.length];
    const rto = String((Math.floor(i / STATE_CODES.length) % 20) + 1).padStart(2, '0');
    const series = SERIES[Math.floor(i / 10) % SERIES.length];
    const num = 1001 + i;
    const plateNumber = `${state}-${rto}-${series}-${num}`;

    let type = 'BLS';
    let model = 'Force Traveller BLS';
    let capacity = 2;

    if (i >= 50 && i < 80) {
      type = 'ALS';
      model = 'Force Traveller ALS (Life Line)';
      capacity = 3;
    } else if (i >= 80) {
      type = 'ICU';
      model = 'Mercedes-Benz Sprinter Mobile ICU';
      capacity = 4;
    }

    ambulancesToSeed.push({
      id,
      data: {
        number: plateNumber,
        type,
        status: 'available',
        currentBookingId: null,
        model,
        capacity,
        city: CITY_MAP[state] || 'Bengaluru',
        seeded: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  // 3. Prepare 100 Drivers
  const driversToSeed = [];
  let skippedDrv = 0;

  for (let i = 0; i < 100; i++) {
    const id = `drv_${String(i + 1).padStart(3, '0')}`;
    if (!isForce && existingDrvIds.has(id)) {
      skippedDrv++;
      continue;
    }

    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;

    // Unique 10-digit dummy phone starting with 98
    const phone = `98${String(10000000 + i).slice(0, 8)}`;

    const state = STATE_CODES[i % STATE_CODES.length];
    const rto = String((Math.floor(i / STATE_CODES.length) % 20) + 1).padStart(2, '0');
    const licenseNumber = `${state}${rto}202300${String(1001 + i)}`;

    driversToSeed.push({
      id,
      data: {
        name: fullName,
        phone,
        license: licenseNumber,
        licenseNumber,
        status: 'available',
        currentBookingId: null,
        experience: `${3 + (i % 12)} years`,
        city: CITY_MAP[state] || 'Bengaluru',
        seeded: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
    });
  }

  // 4. Write Ambulances in chunks of 400 or fewer
  if (ambulancesToSeed.length > 0) {
    let written = 0;
    await batchCommit(
      ambulancesToSeed,
      (batch, item) => {
        const ref = db.collection(AMBULANCES_COLLECTION).doc(item.id);
        batch.set(ref, item.data, { merge: true });
        written++;
      },
      400
    );
    console.log(`Ambulances: ${written}/100 written${skippedAmb > 0 ? ` (${skippedAmb} skipped, pass --force to overwrite)` : ''}`);
  } else {
    console.log(`Ambulances: 0/100 written (${skippedAmb} skipped as they already exist. Pass --force to overwrite)`);
  }

  // 5. Write Drivers in chunks of 400 or fewer
  if (driversToSeed.length > 0) {
    let written = 0;
    await batchCommit(
      driversToSeed,
      (batch, item) => {
        const ref = db.collection(DRIVERS_COLLECTION).doc(item.id);
        batch.set(ref, item.data, { merge: true });
        written++;
      },
      400
    );
    console.log(`Drivers: ${written}/100 written${skippedDrv > 0 ? ` (${skippedDrv} skipped, pass --force to overwrite)` : ''}`);
  } else {
    console.log(`Drivers: 0/100 written (${skippedDrv} skipped as they already exist. Pass --force to overwrite)`);
  }

  console.log('\n🎉 Seeding finished successfully!');
  console.log('👉 Open Admin > Ambulances and Admin > Drivers to view the real-time live fleet.\n');
}

async function main() {
  try {
    if (isClean) {
      await cleanSeededData();
    } else {
      await seedFleet();
    }
  } catch (err) {
    console.error('\n❌ Error during execution:', err);
    process.exit(1);
  }
}

main();

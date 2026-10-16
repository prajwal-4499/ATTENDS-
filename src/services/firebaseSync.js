/**
 * ATTENDS — Live Multi-Device Cloud Sync Service
 * Uses Google Firebase Firestore (100% Free Spark Plan)
 * Synchronizes Desktop App (Windows) and Mobile App (Android/iOS) in Real Time
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

const CONFIG_STORAGE_KEY = 'attends_firebase_config';
const SHOP_CODE_STORAGE_KEY = 'attends_shop_code';
const DEVICE_ROLE_STORAGE_KEY = 'attends_device_role';
const LAST_SYNC_TS_KEY = 'attends_last_cloud_sync_ts';

let firebaseApp = null;
let firestoreDb = null;
let activeUnsubscribers = [];

/**
 * Get stored Firebase configuration
 */
export function getStoredFirebaseConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Get stored shop sync code (e.g. ATTENDS-SHOP-01)
 */
export function getStoredShopCode() {
  return localStorage.getItem(SHOP_CODE_STORAGE_KEY) || '';
}

/**
 * Get device role ('owner' or 'manager')
 */
export function getStoredDeviceRole() {
  return localStorage.getItem(DEVICE_ROLE_STORAGE_KEY) || 'owner';
}

/**
 * Initialize Firebase Firestore with given or stored configuration
 */
export function initFirebaseService(customConfig = null) {
  try {
    const config = customConfig || getStoredFirebaseConfig();
    if (!config || !config.apiKey || !config.projectId) {
      return { initialized: false, error: 'Firebase credentials not configured yet' };
    }

    if (getApps().length > 0) {
      firebaseApp = getApp();
    } else {
      firebaseApp = initializeApp(config, 'ATTENDS_SYNC');
    }

    firestoreDb = getFirestore(firebaseApp);
    return { initialized: true, db: firestoreDb };
  } catch (err) {
    console.warn('[FirebaseSync] Initialization error:', err);
    return { initialized: false, error: err.message };
  }
}

/**
 * Check if cloud sync is fully ready to communicate
 */
export function isCloudSyncReady() {
  const shopCode = getStoredShopCode();
  const config = getStoredFirebaseConfig();
  return Boolean(firestoreDb && shopCode && config?.apiKey);
}

/**
 * Save Firebase Configuration & Shop Sync Code
 */
export function saveCloudSyncSettings({ config, shopCode, role }) {
  if (config) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
  if (shopCode) {
    localStorage.setItem(SHOP_CODE_STORAGE_KEY, shopCode.trim().toUpperCase());
  }
  if (role) {
    localStorage.setItem(DEVICE_ROLE_STORAGE_KEY, role);
  }

  // Clear existing listeners and re-init
  stopRealtimeListeners();
  return initFirebaseService(config);
}

/**
 * Push a single record to Firestore under shops/{shopCode}/{table}/{id}
 */
export async function pushRecordToCloud(table, record) {
  try {
    if (!isCloudSyncReady() || !record?.id) return false;
    const shopCode = getStoredShopCode();
    const docRef = doc(firestoreDb, 'shops', shopCode, table, String(record.id));
    
    // Clean undefined values for Firestore
    const cleanRecord = { ...record };
    Object.keys(cleanRecord).forEach(k => {
      if (cleanRecord[k] === undefined) delete cleanRecord[k];
    });

    cleanRecord._syncedAt = new Date().toISOString();
    cleanRecord._syncedBy = getStoredDeviceRole();

    await setDoc(docRef, cleanRecord, { merge: true });
    localStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
    return true;
  } catch (err) {
    console.warn(`[FirebaseSync] Error pushing to ${table}:`, err);
    return false;
  }
}

/**
 * Bulk push an array of records to Firestore using writeBatch
 */
export async function pushBulkToCloud(table, records) {
  try {
    if (!isCloudSyncReady() || !records || records.length === 0) return 0;
    const shopCode = getStoredShopCode();
    const batch = writeBatch(firestoreDb);
    let count = 0;

    for (const record of records) {
      if (!record.id) continue;
      const docRef = doc(firestoreDb, 'shops', shopCode, table, String(record.id));
      const cleanRecord = { ...record };
      Object.keys(cleanRecord).forEach(k => {
        if (cleanRecord[k] === undefined) delete cleanRecord[k];
      });
      cleanRecord._syncedAt = new Date().toISOString();
      cleanRecord._syncedBy = getStoredDeviceRole();

      batch.set(docRef, cleanRecord, { merge: true });
      count++;
    }

    await batch.commit();
    localStorage.setItem(LAST_SYNC_TS_KEY, String(Date.now()));
    return count;
  } catch (err) {
    console.warn(`[FirebaseSync] Bulk push error on ${table}:`, err);
    return 0;
  }
}

/**
 * Listen for Real-Time Updates from Cloud (Other Devices)
 * onUpdate callback: ({ table, records }) => void
 */
export function startRealtimeListeners(onUpdate) {
  stopRealtimeListeners();

  if (!isCloudSyncReady()) {
    return false;
  }

  const shopCode = getStoredShopCode();
  const tables = ['staff', 'attendance', 'salary_ledger', 'shop_profile'];

  try {
    tables.forEach((table) => {
      const colRef = collection(firestoreDb, 'shops', shopCode, table);
      const unsub = onSnapshot(colRef, (snapshot) => {
        // Collect doc changes
        const changedRecords = [];
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            changedRecords.push(change.doc.data());
          }
        });

        if (changedRecords.length > 0 && typeof onUpdate === 'function') {
          onUpdate({ table, records: changedRecords });
        }
      }, (error) => {
        console.warn(`[FirebaseSync] Listener error on ${table}:`, error);
      });

      activeUnsubscribers.push(unsub);
    });

    return true;
  } catch (err) {
    console.warn('[FirebaseSync] Failed to start listeners:', err);
    return false;
  }
}

/**
 * Stop active cloud listeners
 */
export function stopRealtimeListeners() {
  activeUnsubscribers.forEach((unsub) => {
    try {
      if (typeof unsub === 'function') unsub();
    } catch (e) {}
  });
  activeUnsubscribers = [];
}

/**
 * Fetch all records for a table from Firestore
 */
export async function fetchAllFromCloud(table) {
  try {
    if (!isCloudSyncReady()) return [];
    const shopCode = getStoredShopCode();
    const colRef = collection(firestoreDb, 'shops', shopCode, table);
    const snap = await getDocs(colRef);
    const list = [];
    snap.forEach((d) => list.push(d.data()));
    return list;
  } catch (err) {
    console.warn(`[FirebaseSync] Error fetching ${table}:`, err);
    return [];
  }
}

/**
 * Full 2-Way Synchronization:
 * 1. Pushes local records to cloud
 * 2. Fetches cloud records for merging into local SQLite
 */
export async function executeFullCloudSync(localData) {
  if (!isCloudSyncReady()) {
    return { success: false, message: 'Cloud sync not configured or ready.' };
  }

  try {
    let pushedCount = 0;

    // Push local data to cloud
    if (localData.staff?.length) {
      pushedCount += await pushBulkToCloud('staff', localData.staff);
    }
    if (localData.attendance?.length) {
      pushedCount += await pushBulkToCloud('attendance', localData.attendance);
    }
    if (localData.salaryLedger?.length) {
      pushedCount += await pushBulkToCloud('salary_ledger', localData.salaryLedger);
    }
    if (localData.shopProfile) {
      await pushRecordToCloud('shop_profile', localData.shopProfile);
      pushedCount++;
    }

    // Pull cloud data for all tables
    const cloudStaff = await fetchAllFromCloud('staff');
    const cloudAttendance = await fetchAllFromCloud('attendance');
    const cloudLedger = await fetchAllFromCloud('salary_ledger');
    const cloudProfiles = await fetchAllFromCloud('shop_profile');

    const now = Date.now();
    localStorage.setItem(LAST_SYNC_TS_KEY, String(now));

    return {
      success: true,
      pushed: pushedCount,
      cloudData: {
        staff: cloudStaff,
        attendance: cloudAttendance,
        salaryLedger: cloudLedger,
        shopProfile: cloudProfiles.length > 0 ? cloudProfiles[0] : null
      },
      timestamp: now
    };
  } catch (err) {
    console.error('[FirebaseSync] Full sync error:', err);
    return { success: false, message: err.message };
  }
}

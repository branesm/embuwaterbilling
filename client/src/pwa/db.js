import { openDB } from 'idb';

const DB_NAME = 'ewasco-field';
const DB_VERSION = 1;

export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending meter readings to sync
      if (!db.objectStoreNames.contains('pendingReadings')) {
        db.createObjectStore('pendingReadings', { keyPath: 'localId', autoIncrement: true });
      }
      // Pending work order status updates
      if (!db.objectStoreNames.contains('pendingWorkOrderUpdates')) {
        db.createObjectStore('pendingWorkOrderUpdates', { keyPath: 'localId', autoIncrement: true });
      }
      // Pending photos (blobs) to upload
      if (!db.objectStoreNames.contains('pendingPhotos')) {
        const photoStore = db.createObjectStore('pendingPhotos', { keyPath: 'localId', autoIncrement: true });
        photoStore.createIndex('refType', 'refType'); // 'reading' or 'workorder'
      }
      // Cached work orders for offline
      if (!db.objectStoreNames.contains('cachedWorkOrders')) {
        db.createObjectStore('cachedWorkOrders', { keyPath: 'id' });
      }
      // Cached meters for offline reading
      if (!db.objectStoreNames.contains('cachedRouteMeters')) {
        db.createObjectStore('cachedRouteMeters', { keyPath: 'id' });
      }
      // Sync log
      if (!db.objectStoreNames.contains('syncLog')) {
        db.createObjectStore('syncLog', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

// Generic CRUD helpers
export async function addItem(storeName, item) {
  const db = await getDB();
  return db.add(storeName, { ...item, createdAt: new Date().toISOString() });
}

export async function getAllItems(storeName) {
  const db = await getDB();
  return db.getAll(storeName);
}

export async function getItem(storeName, key) {
  const db = await getDB();
  return db.get(storeName, key);
}

export async function deleteItem(storeName, key) {
  const db = await getDB();
  return db.delete(storeName, key);
}

export async function clearStore(storeName) {
  const db = await getDB();
  return db.clear(storeName);
}

export async function putItem(storeName, item) {
  const db = await getDB();
  return db.put(storeName, item);
}

export async function countItems(storeName) {
  const db = await getDB();
  return db.count(storeName);
}

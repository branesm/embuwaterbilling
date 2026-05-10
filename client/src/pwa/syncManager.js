import api from '../api/axios';
import { getAllItems, deleteItem, addItem } from './db';

// Upload a single photo blob and return the URL
async function uploadPhoto(photoRecord) {
  const formData = new FormData();
  const file = photoRecord.blob || photoRecord.file;
  formData.append('photo', file, photoRecord.fileName || 'photo.jpg');
  const response = await api.post('/uploads/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data.data.url;
}

// Sync all pending photos first, returning a map of localId -> serverUrl
async function syncPhotos() {
  const photos = await getAllItems('pendingPhotos');
  const urlMap = {};
  for (const photo of photos) {
    try {
      const url = await uploadPhoto(photo);
      urlMap[photo.localId] = url;
      await deleteItem('pendingPhotos', photo.localId);
    } catch (err) {
      console.error('Photo sync failed:', photo.localId, err);
      // Continue with other photos
    }
  }
  return urlMap;
}

// Sync pending meter readings
async function syncReadings(photoUrlMap) {
  const readings = await getAllItems('pendingReadings');
  let synced = 0, failed = 0;
  for (const reading of readings) {
    try {
      // If reading has a local photo ref, resolve to server URL
      const payload = { ...reading };
      delete payload.localId;
      delete payload.createdAt;
      if (reading.photoLocalId && photoUrlMap[reading.photoLocalId]) {
        payload.photoUrl = photoUrlMap[reading.photoLocalId];
      }
      delete payload.photoLocalId;
      delete payload.photoBlob;
      await api.post('/readings', payload);
      await deleteItem('pendingReadings', reading.localId);
      synced++;
    } catch (err) {
      console.error('Reading sync failed:', reading.localId, err);
      failed++;
    }
  }
  return { synced, failed };
}

// Sync pending work order updates
async function syncWorkOrderUpdates(photoUrlMap) {
  const updates = await getAllItems('pendingWorkOrderUpdates');
  let synced = 0, failed = 0;
  for (const update of updates) {
    try {
      const { workOrderId, type, ...payload } = update;
      delete payload.localId;
      delete payload.createdAt;

      // Resolve photo URLs
      if (update.beforePhotoLocalId && photoUrlMap[update.beforePhotoLocalId]) {
        payload.beforePhotoUrl = photoUrlMap[update.beforePhotoLocalId];
      }
      if (update.afterPhotoLocalId && photoUrlMap[update.afterPhotoLocalId]) {
        payload.afterPhotoUrl = photoUrlMap[update.afterPhotoLocalId];
      }
      delete payload.beforePhotoLocalId;
      delete payload.afterPhotoLocalId;

      if (type === 'statusChange') {
        await api.put(`/workorders/${workOrderId}`, payload);
      } else if (type === 'comment') {
        await api.post(`/workorders/${workOrderId}/comments`, payload);
      }
      await deleteItem('pendingWorkOrderUpdates', update.localId);
      synced++;
    } catch (err) {
      console.error('Work order sync failed:', update.localId, err);
      failed++;
    }
  }
  return { synced, failed };
}

// Main sync function
export async function syncAll() {
  const startTime = Date.now();
  const results = { photos: 0, readings: { synced: 0, failed: 0 }, workOrders: { synced: 0, failed: 0 } };

  try {
    // 1. Upload photos first
    const photoUrlMap = await syncPhotos();
    results.photos = Object.keys(photoUrlMap).length;

    // 2. Sync readings (with resolved photo URLs)
    results.readings = await syncReadings(photoUrlMap);

    // 3. Sync work order updates
    results.workOrders = await syncWorkOrderUpdates(photoUrlMap);

    // Log sync result
    await addItem('syncLog', {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      status: 'success',
      ...results,
    });
  } catch (err) {
    await addItem('syncLog', {
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      status: 'error',
      error: err.message,
    });
    throw err;
  }

  return results;
}

// Cache work orders and meters for offline use
export async function cacheFieldData(technicianId) {
  try {
    // Cache assigned work orders
    const params = technicianId ? { technicianId } : {};
    const woResponse = await api.get('/workorders/my-assignments', { params });
    const workOrders = woResponse.data.data || [];
    const { clearStore, putItem } = await import('./db');
    await clearStore('cachedWorkOrders');
    for (const wo of workOrders) {
      await putItem('cachedWorkOrders', wo);
    }

    // Cache meters (technician's route)
    const metersResponse = await api.get('/meters?limit=500');
    const meters = metersResponse.data.data || [];
    await clearStore('cachedRouteMeters');
    for (const meter of meters) {
      await putItem('cachedRouteMeters', meter);
    }
  } catch (err) {
    console.error('Failed to cache field data:', err);
  }
}

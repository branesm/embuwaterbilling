import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, MapPin, AlertTriangle, CheckCircle, Loader2, X, Save } from 'lucide-react'
import { getItem, addItem, putItem } from '../../pwa/db'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'
import api from '../../api/axios'

export default function FieldReadingForm() {
  const { meterId } = useParams()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()

  const [meter, setMeter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentReading, setCurrentReading] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [gps, setGps] = useState(null)
  const [gpsStatus, setGpsStatus] = useState('pending') // pending | captured | unavailable
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [warnings, setWarnings] = useState([])

  const fileInputRef = useRef(null)

  // Load meter data
  useEffect(() => {
    let cancelled = false
    const loadMeter = async () => {
      setLoading(true)
      try {
        // Try IndexedDB first
        const cached = await getItem('cachedRouteMeters', parseInt(meterId))
        if (cached) {
          if (!cancelled) setMeter(cached)
        } else if (isOnline) {
          // Fallback to API
          try {
            const res = await api.get(`/meters/${meterId}`)
            const data = res.data?.data
            if (data && !cancelled) {
              setMeter(data)
              await putItem('cachedRouteMeters', data).catch(() => {})
            }
          } catch {
            // API error
          }
        }
      } catch {
        // IndexedDB not available
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadMeter()
    return () => { cancelled = true }
  }, [meterId, isOnline])

  // Capture GPS on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable')
      return
    }
    setGpsStatus('pending')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        })
        setGpsStatus('captured')
      },
      () => {
        setGpsStatus('unavailable')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }, [])

  // Anomaly checks
  useEffect(() => {
    const newWarnings = []
    if (!currentReading || !meter) {
      setWarnings(newWarnings)
      return
    }

    const current = parseFloat(currentReading)
    const previous = parseFloat(meter.current_reading || 0)

    if (!isNaN(current) && !isNaN(previous)) {
      // Check reading less than previous
      if (current < previous) {
        newWarnings.push({
          type: 'tampering',
          message: 'Reading is less than previous. Possible meter tampering?',
          color: 'red',
        })
      }

      // Check unusually high consumption
      const consumption = current - previous
      const avgConsumption = parseFloat(meter.average_consumption || meter.normal_consumption || 0)
      if (avgConsumption > 0 && consumption > 3 * avgConsumption) {
        newWarnings.push({
          type: 'leak',
          message: `Unusually high consumption (${consumption.toFixed(1)} vs avg ${avgConsumption.toFixed(1)}). Possible leak?`,
          color: 'orange',
        })
      }
    }

    setWarnings(newWarnings)
  }, [currentReading, meter])

  // Handle photo capture
  const handlePhotoChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }, [])

  const removePhoto = useCallback(() => {
    setPhoto(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [photoPreview])

  // Submit handler
  const handleSubmit = async () => {
    setError(null)

    // Validation
    if (!currentReading || isNaN(parseFloat(currentReading))) {
      setError('Please enter a valid reading value.')
      return
    }
    if (!photo) {
      setError('Please take a photo of the meter.')
      return
    }

    setSubmitting(true)

    try {
      const readingData = {
        meterId: parseInt(meterId),
        customerId: meter.customer_id,
        readingDate: new Date().toISOString().split('T')[0],
        currentReading: parseFloat(currentReading),
        previousReading: parseFloat(meter.current_reading || 0),
        consumption: parseFloat(currentReading) - parseFloat(meter.current_reading || 0),
        notes,
        gpsLat: gps?.latitude,
        gpsLng: gps?.longitude,
      }

      if (isOnline) {
        // Upload photo first
        const formData = new FormData()
        formData.append('photo', photo)
        const photoRes = await api.post('/uploads/photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        readingData.photoUrl = photoRes.data?.data?.url || photoRes.data?.url

        // Submit reading
        await api.post('/readings', readingData)
      } else {
        // Queue photo for later upload
        const photoLocalId = await addItem('pendingPhotos', {
          blob: photo,
          fileName: `reading_${meterId}_${Date.now()}.jpg`,
          refType: 'reading',
        })
        readingData.photoLocalId = photoLocalId
        await addItem('pendingReadings', readingData)
      }

      // Update cached meter with new reading
      const updatedMeter = {
        ...meter,
        current_reading: parseFloat(currentReading),
      }
      await putItem('cachedRouteMeters', updatedMeter).catch(() => {})

      // Mark as read today
      if (window.__ewasco_markReadToday) {
        window.__ewasco_markReadToday(parseInt(meterId))
      }

      // Navigate back to readings list
      navigate('/field/readings')
    } catch (err) {
      console.error('Submit error:', err)
      setError(err?.response?.data?.message || err?.message || 'Failed to submit reading. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Helper to get display values
  const getSerial = (m) => m?.meter_no || m?.serial_number || '—'
  const getCustomerName = (m) => {
    if (!m) return '—'
    if (m.customer_name) return m.customer_name
    return `${m.first_name || ''} ${m.last_name || ''}`.trim() || 'Unknown'
  }
  const getMeterSize = (m) => m?.meter_size || m?.meter_type_name || ''
  const getMeterType = (m) => m?.meter_type || m?.meter_type_name || ''

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!meter) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-4">Meter not found</p>
        <button
          onClick={() => navigate('/field/readings')}
          className="text-primary-600 font-medium text-sm"
        >
          Back to Readings
        </button>
      </div>
    )
  }

  const previousReading = parseFloat(meter.current_reading || 0)
  const currentVal = parseFloat(currentReading) || 0
  const consumption = currentVal - previousReading

  return (
    <div className="-mx-4 -mt-4">
      {/* Header */}
      <div className="sticky top-14 z-40 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate('/field/readings')}
          className="p-1 -ml-1 rounded-full hover:bg-gray-100 active:bg-gray-200"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-gray-900 truncate">{getSerial(meter)}</h1>
          <p className="text-xs text-gray-500 truncate">{getCustomerName(meter)}</p>
        </div>
        {!isOnline && (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full font-medium">
            Offline
          </span>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Meter info card */}
        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Serial Number</span>
            <span className="text-sm font-semibold text-gray-900">{getSerial(meter)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Customer</span>
            <span className="text-sm text-gray-700">{getCustomerName(meter)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Last Reading</span>
            <span className="text-sm font-medium text-gray-900">{previousReading}</span>
          </div>
          {(getMeterSize(meter) || getMeterType(meter)) && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Size / Type</span>
              <span className="text-sm text-gray-700">
                {[getMeterSize(meter), getMeterType(meter)].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}
        </div>

        {/* Current Reading */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Current Reading <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={currentReading}
            onChange={(e) => setCurrentReading(e.target.value)}
            placeholder="0.00"
            className="w-full text-3xl font-bold text-center py-4 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
          />
          {currentReading && !isNaN(currentVal) && (
            <div className="mt-2 text-center">
              <span className="text-sm text-gray-500">
                Consumption: <span className={`font-semibold ${consumption < 0 ? 'text-red-600' : consumption > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                  {consumption.toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Anomaly warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            {warnings.map((w, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                  w.color === 'red'
                    ? 'bg-red-50 border border-red-200 text-red-800'
                    : 'bg-orange-50 border border-orange-200 text-orange-800'
                }`}
              >
                <AlertTriangle className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                  w.color === 'red' ? 'text-red-500' : 'text-orange-500'
                }`} />
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Photo Capture */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Meter Photo <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
          {photoPreview ? (
            <div className="relative rounded-lg overflow-hidden border-2 border-gray-200">
              <img
                src={photoPreview}
                alt="Meter photo"
                className="w-full h-48 object-cover"
              />
              <button
                type="button"
                onClick={removePhoto}
                className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 active:bg-gray-200 transition-colors"
            >
              <Camera className="h-8 w-8 text-gray-400" />
              <span className="text-sm font-medium text-gray-600">Take Photo</span>
              <span className="text-xs text-gray-400">Tap to open camera</span>
            </button>
          )}
        </div>

        {/* GPS Coordinates */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">GPS Location</label>
          <div className="bg-gray-50 rounded-lg p-3">
            {gpsStatus === 'pending' && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Getting location...</span>
              </div>
            )}
            {gpsStatus === 'captured' && gps && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-green-700 font-medium">Location captured</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>
                    {gps.latitude.toFixed(6)}, {gps.longitude.toFixed(6)}
                  </span>
                  <span className="text-gray-400 ml-1">
                    (±{Math.round(gps.accuracy)}m)
                  </span>
                </div>
              </div>
            )}
            {gpsStatus === 'unavailable' && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-amber-500" />
                <span className="text-amber-700">Location unavailable</span>
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional notes about this reading..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
            <p>{error}</p>
            <button
              onClick={handleSubmit}
              className="mt-2 text-xs font-medium text-red-700 underline hover:text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Submitting...</span>
            </>
          ) : (
            <>
              <Save className="h-5 w-5" />
              <span>{isOnline ? 'Submit Reading' : 'Save Offline'}</span>
            </>
          )}
        </button>

        {/* Offline notice */}
        {!isOnline && (
          <p className="text-xs text-center text-amber-600">
            Reading will be queued for sync when you're back online.
          </p>
        )}
      </div>
    </div>
  )
}

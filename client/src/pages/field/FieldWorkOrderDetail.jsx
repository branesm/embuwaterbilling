import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Phone, MapPin, Navigation, Clock, Camera,
  CheckCircle, Play, MessageSquare, Send, Image as ImageIcon,
  Wrench, DollarSign, FileText, AlertCircle
} from 'lucide-react'
import { getItem, putItem, addItem } from '../../pwa/db'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'
import api from '../../api/axios'
import toast from 'react-hot-toast'

const TYPE_BADGES = {
  new_connection: { label: 'New Connection', color: 'bg-blue-100 text-blue-800' },
  disconnection: { label: 'Disconnection', color: 'bg-red-100 text-red-800' },
  reconnection: { label: 'Reconnection', color: 'bg-green-100 text-green-800' },
  meter_replacement: { label: 'Meter Replace', color: 'bg-orange-100 text-orange-800' },
  meter_repair: { label: 'Meter Repair', color: 'bg-orange-100 text-orange-800' },
  leak_repair: { label: 'Leak Repair', color: 'bg-purple-100 text-purple-800' },
  pipe_repair: { label: 'Pipe Repair', color: 'bg-purple-100 text-purple-800' },
  valve_repair: { label: 'Valve Repair', color: 'bg-purple-100 text-purple-800' },
  complaint: { label: 'Complaint', color: 'bg-yellow-100 text-yellow-800' },
  inspection: { label: 'Inspection', color: 'bg-cyan-100 text-cyan-800' },
  other: { label: 'Other', color: 'bg-gray-100 text-gray-800' },
}

const PRIORITY_BADGES = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-800' },
}

const STATUS_BADGES = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-800' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-800' },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-800' },
  on_hold: { label: 'On Hold', color: 'bg-yellow-100 text-yellow-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
}

export default function FieldWorkOrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const fileInputRef = useRef(null)
  const afterFileInputRef = useRef(null)

  const [workOrder, setWorkOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // Form state for in_progress
  const [materialsUsed, setMaterialsUsed] = useState('')
  const [actualCost, setActualCost] = useState('')
  const [completionNotes, setCompletionNotes] = useState('')

  // Photo state
  const [beforePhoto, setBeforePhoto] = useState(null)
  const [afterPhoto, setAfterPhoto] = useState(null)
  const [beforePhotoPreview, setBeforePhotoPreview] = useState(null)
  const [afterPhotoPreview, setAfterPhotoPreview] = useState(null)
  const [photoMode, setPhotoMode] = useState(null) // 'before' or 'after'

  // Comments
  const [commentText, setCommentText] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  // Load work order
  const loadWorkOrder = useCallback(async () => {
    try {
      let wo = await getItem('cachedWorkOrders', parseInt(id))

      if (!wo && isOnline) {
        const res = await api.get(`/workorders/${id}`)
        wo = res.data?.data || null
        if (wo) {
          await putItem('cachedWorkOrders', wo)
        }
      }

      if (wo) {
        setWorkOrder(wo)
        // Pre-fill form fields if available
        if (wo.materials_used) setMaterialsUsed(wo.materials_used)
        if (wo.actual_cost) setActualCost(String(wo.actual_cost))
      }
    } catch (err) {
      console.error('Failed to load work order:', err)
      toast.error('Failed to load work order')
    } finally {
      setLoading(false)
    }
  }, [id, isOnline])

  useEffect(() => {
    loadWorkOrder()
  }, [loadWorkOrder])

  // Handle photo capture
  const handlePhotoCapture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const preview = URL.createObjectURL(file)

    if (photoMode === 'before') {
      setBeforePhoto(file)
      setBeforePhotoPreview(preview)
    } else if (photoMode === 'after') {
      setAfterPhoto(file)
      setAfterPhotoPreview(preview)
    }
    // Reset input so same file can be re-captured
    e.target.value = ''
  }

  // Get GPS position
  const getGPS = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 15000 }
      )
    })
  }

  // Upload photo to server
  const uploadPhoto = async (file, workOrderId, photoType) => {
    const formData = new FormData()
    formData.append('photo', file)
    formData.append('refType', 'workorder')
    formData.append('refId', workOrderId)
    formData.append('photoType', photoType)
    const res = await api.post('/workorders/upload-photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data
  }

  // Update local cached work order
  const updateLocalCache = async (updated) => {
    const merged = { ...workOrder, ...updated }
    setWorkOrder(merged)
    await putItem('cachedWorkOrders', merged)
  }

  // ===== START WORK (assigned -> in_progress) =====
  const handleStartWork = async () => {
    setSubmitting(true)
    try {
      // 1. Capture GPS
      let locationLat = workOrder?.location_lat
      let locationLng = workOrder?.location_lng
      try {
        const gps = await getGPS()
        locationLat = gps.lat
        locationLng = gps.lng
      } catch {
        toast('GPS unavailable, continuing without location update', { icon: '⚠️' })
      }

      // 2. Trigger before photo capture
      // If no before photo yet, trigger camera
      if (!beforePhoto) {
        setPhotoMode('before')
        setSubmitting(false)
        // We need to trigger camera then come back
        // Use a state-driven approach
        fileInputRef.current?.click()
        return
      }

      // 3. Submit
      const updatePayload = {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        locationLat,
        locationLng,
      }

      if (isOnline) {
        // Upload before photo
        if (beforePhoto) {
          try {
            await uploadPhoto(beforePhoto, id, 'before')
          } catch (err) {
            console.error('Photo upload failed, queuing offline:', err)
            await addItem('pendingPhotos', {
              blob: beforePhoto,
              refType: 'workorder',
              refId: parseInt(id),
              photoType: 'before',
              fileName: beforePhoto.name,
            })
          }
        }
        // Update status
        await api.put(`/workorders/${id}`, updatePayload)
        toast.success('Work started successfully!')
      } else {
        // Queue offline
        if (beforePhoto) {
          await addItem('pendingPhotos', {
            blob: beforePhoto,
            refType: 'workorder',
            refId: parseInt(id),
            photoType: 'before',
            fileName: beforePhoto.name,
          })
        }
        await addItem('pendingWorkOrderUpdates', {
          type: 'statusChange',
          workOrderId: parseInt(id),
          ...updatePayload,
        })
        toast.success('Work started (offline — will sync when online)')
      }

      // 5. Update local cache
      await updateLocalCache({
        status: 'in_progress',
        started_at: new Date().toISOString(),
        location_lat: locationLat,
        location_lng: locationLng,
      })
    } catch (err) {
      console.error('Start work failed:', err)
      toast.error('Failed to start work')
    } finally {
      setSubmitting(false)
    }
  }

  // Watch for before photo being set, then auto-proceed with start work
  const [pendingStart, setPendingStart] = useState(false)

  useEffect(() => {
    if (beforePhoto && pendingStart) {
      setPendingStart(false)
      handleStartWork()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beforePhoto, pendingStart])

  const handleStartWorkClick = () => {
    if (!beforePhoto) {
      setPhotoMode('before')
      setPendingStart(true)
      fileInputRef.current?.click()
    } else {
      handleStartWork()
    }
  }

  // ===== COMPLETE WORK (in_progress -> completed) =====
  const handleCompleteWork = async () => {
    if (!afterPhoto) {
      setPhotoMode('after')
      afterFileInputRef.current?.click()
      return
    }

    setSubmitting(true)
    try {
      // 1. Capture GPS
      let locationLat = workOrder?.location_lat
      let locationLng = workOrder?.location_lng
      try {
        const gps = await getGPS()
        locationLat = gps.lat
        locationLng = gps.lng
      } catch {
        toast('GPS unavailable, continuing without location update', { icon: '⚠️' })
      }

      const updatePayload = {
        status: 'completed',
        completedAt: new Date().toISOString(),
        materialsUsed,
        actualCost: actualCost ? parseFloat(actualCost) : null,
        locationLat,
        locationLng,
      }

      if (isOnline) {
        // Upload after photo
        if (afterPhoto) {
          try {
            await uploadPhoto(afterPhoto, id, 'after')
          } catch (err) {
            console.error('Photo upload failed, queuing offline:', err)
            await addItem('pendingPhotos', {
              blob: afterPhoto,
              refType: 'workorder',
              refId: parseInt(id),
              photoType: 'after',
              fileName: afterPhoto.name,
            })
          }
        }
        await api.put(`/workorders/${id}`, updatePayload)
        toast.success('Work completed!')
      } else {
        if (afterPhoto) {
          await addItem('pendingPhotos', {
            blob: afterPhoto,
            refType: 'workorder',
            refId: parseInt(id),
            photoType: 'after',
            fileName: afterPhoto.name,
          })
        }
        await addItem('pendingWorkOrderUpdates', {
          type: 'statusChange',
          workOrderId: parseInt(id),
          ...updatePayload,
        })
        toast.success('Work completed (offline — will sync when online)')
      }

      // Update local cache
      await updateLocalCache({
        status: 'completed',
        completed_at: new Date().toISOString(),
        materials_used: materialsUsed,
        actual_cost: actualCost ? parseFloat(actualCost) : null,
        location_lat: locationLat,
        location_lng: locationLng,
      })

      // Navigate back
      navigate('/field/workorders')
    } catch (err) {
      console.error('Complete work failed:', err)
      toast.error('Failed to complete work')
    } finally {
      setSubmitting(false)
    }
  }

  // Watch for after photo, then auto-proceed
  const [pendingComplete, setPendingComplete] = useState(false)

  useEffect(() => {
    if (afterPhoto && pendingComplete) {
      setPendingComplete(false)
      handleCompleteWork()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [afterPhoto, pendingComplete])

  const handleCompleteClick = () => {
    if (!afterPhoto) {
      setPhotoMode('after')
      setPendingComplete(true)
      afterFileInputRef.current?.click()
    } else {
      handleCompleteWork()
    }
  }

  // ===== ADD COMMENT =====
  const handleAddComment = async () => {
    if (!commentText.trim()) return
    setAddingComment(true)
    try {
      const comment = {
        comment: commentText.trim(),
        commentType: 'note',
        created_by: null,
        first_name: 'You',
        last_name: '',
        created_at: new Date().toISOString(),
      }

      if (isOnline) {
        const res = await api.post(`/workorders/${id}/comments`, {
          comment: commentText.trim(),
          commentType: 'note',
        })
        // Use server response if available
        const serverComment = res.data?.data
        if (serverComment) {
          comment.id = serverComment.id
          comment.created_at = serverComment.created_at
        }
      } else {
        await addItem('pendingWorkOrderUpdates', {
          type: 'comment',
          workOrderId: parseInt(id),
          comment: commentText.trim(),
          commentType: 'note',
        })
        toast.success('Note saved (offline — will sync when online)')
      }

      // Update local cache with new comment
      const existingComments = workOrder?.comments || []
      await updateLocalCache({
        comments: [comment, ...existingComments],
      })
      setCommentText('')
    } catch (err) {
      console.error('Add comment failed:', err)
      toast.error('Failed to add note')
    } finally {
      setAddingComment(false)
    }
  }

  // Navigate in Google Maps
  const handleNavigate = () => {
    const lat = workOrder?.location_lat
    const lng = workOrder?.location_lng
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`)
    } else {
      toast.error('No GPS coordinates available')
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-2" />
        <p className="text-sm">Loading work order...</p>
      </div>
    )
  }

  if (!workOrder) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <AlertCircle className="h-12 w-12 mb-3" />
        <p className="text-base font-medium text-gray-500">Work order not found</p>
        <button onClick={() => navigate('/field/workorders')} className="mt-4 text-primary-600 font-medium text-sm">
          Back to Work Orders
        </button>
      </div>
    )
  }

  const typeBadge = TYPE_BADGES[workOrder.work_order_type] || TYPE_BADGES.other
  const priorityBadge = PRIORITY_BADGES[workOrder.priority] || PRIORITY_BADGES.medium
  const statusBadge = STATUS_BADGES[workOrder.status] || STATUS_BADGES.pending

  return (
    <div className="pb-6">
      {/* Hidden file inputs for camera */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />
      <input
        ref={afterFileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoCapture}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/field/workorders')}
          className="p-1 -ml-1 rounded-lg hover:bg-gray-100 active:bg-gray-200"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">{workOrder.work_order_number}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${typeBadge.color}`}>
              {typeBadge.label}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${priorityBadge.color}`}>
              {priorityBadge.label}
            </span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge.color}`}>
              {statusBadge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Customer Info Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Customer</h2>
        <div className="space-y-2">
          <p className="text-base font-bold text-gray-900">{workOrder.customer_name || 'Unknown'}</p>
          {workOrder.customer_phone && (
            <a
              href={`tel:${workOrder.customer_phone}`}
              className="inline-flex items-center gap-2 text-primary-600 font-medium text-sm"
            >
              <Phone className="h-4 w-4" />
              {workOrder.customer_phone}
            </a>
          )}
          {workOrder.customer_address && (
            <p className="text-sm text-gray-600">{workOrder.customer_address}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600">
            {workOrder.account_number && (
              <span>Acct: <strong>{workOrder.account_number}</strong></span>
            )}
            {workOrder.meter_number && (
              <span>Meter: <strong>{workOrder.meter_number}</strong></span>
            )}
          </div>
        </div>
      </div>

      {/* Location Card */}
      {(workOrder.location_lat && workOrder.location_lng) && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400" />
              <span>{Number(workOrder.location_lat).toFixed(6)}, {Number(workOrder.location_lng).toFixed(6)}</span>
            </div>
            <button
              onClick={handleNavigate}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 active:bg-blue-800"
            >
              <Navigation className="h-4 w-4" />
              Navigate
            </button>
          </div>
        </div>
      )}

      {/* Instructions Card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Instructions</h2>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{workOrder.description || 'No description provided.'}</p>
          </div>
          {workOrder.instructions && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-1">Special Instructions</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{workOrder.instructions}</p>
            </div>
          )}
          {workOrder.estimated_cost && (
            <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600">Estimated: <strong>KES {Number(workOrder.estimated_cost).toLocaleString()}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* ===== ACTION SECTIONS BY STATUS ===== */}

      {/* ASSIGNED: Start Work */}
      {workOrder.status === 'assigned' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Start Work</h2>

          {beforePhotoPreview && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Before Photo</p>
              <img src={beforePhotoPreview} alt="Before" className="w-full h-40 object-cover rounded-lg" />
            </div>
          )}

          <button
            onClick={handleStartWorkClick}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 h-14 bg-green-600 text-white text-base font-bold rounded-xl hover:bg-green-700 active:bg-green-800 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-5 w-5" />
                Start Work
              </>
            )}
          </button>
          {!beforePhoto && (
            <p className="text-xs text-gray-400 text-center mt-2">A "Before" photo will be captured</p>
          )}
        </div>
      )}

      {/* IN PROGRESS: Complete Work */}
      {workOrder.status === 'in_progress' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Complete Work</h2>

          {/* Before photo */}
          {beforePhotoPreview && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Before Photo</p>
              <img src={beforePhotoPreview} alt="Before" className="w-full h-40 object-cover rounded-lg" />
            </div>
          )}

          {/* After photo */}
          {afterPhotoPreview && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">After Photo</p>
              <img src={afterPhotoPreview} alt="After" className="w-full h-40 object-cover rounded-lg" />
            </div>
          )}

          <div className="space-y-3">
            {/* After photo capture button */}
            <button
              onClick={() => {
                setPhotoMode('after')
                afterFileInputRef.current?.click()
              }}
              className="w-full flex items-center justify-center gap-2 h-12 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              <Camera className="h-5 w-5" />
              {afterPhoto ? 'Retake After Photo' : 'Capture After Photo *'}
            </button>

            {/* Materials Used */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Wrench className="h-4 w-4 inline mr-1" />
                Materials Used
              </label>
              <input
                type="text"
                value={materialsUsed}
                onChange={(e) => setMaterialsUsed(e.target.value)}
                placeholder="e.g., 10m pipe, 2 elbows, 1 valve"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Actual Cost */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="h-4 w-4 inline mr-1" />
                Actual Cost (KES)
              </label>
              <input
                type="number"
                value={actualCost}
                onChange={(e) => setActualCost(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            {/* Completion Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                Completion Notes
              </label>
              <textarea
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
                placeholder="Any additional notes about the work..."
                rows={3}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
              />
            </div>

            {/* Complete button */}
            <button
              onClick={handleCompleteClick}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 h-14 bg-blue-600 text-white text-base font-bold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  Complete Work
                </>
              )}
            </button>
            {!afterPhoto && (
              <p className="text-xs text-red-500 text-center">An "After" photo is required to complete</p>
            )}
          </div>
        </div>
      )}

      {/* COMPLETED: Read-only summary */}
      {workOrder.status === 'completed' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Summary</h2>
          <div className="space-y-3">
            {workOrder.started_at && (
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Started: <strong>{new Date(workOrder.started_at).toLocaleString()}</strong></span>
              </div>
            )}
            {workOrder.completed_at && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-gray-600">Completed: <strong>{new Date(workOrder.completed_at).toLocaleString()}</strong></span>
              </div>
            )}
            {workOrder.materials_used && (
              <div className="flex items-start gap-2 text-sm">
                <Wrench className="h-4 w-4 text-gray-400 mt-0.5" />
                <span className="text-gray-600">Materials: <strong>{workOrder.materials_used}</strong></span>
              </div>
            )}
            {workOrder.actual_cost && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Actual Cost: <strong>KES {Number(workOrder.actual_cost).toLocaleString()}</strong></span>
              </div>
            )}
          </div>

          {/* Photos */}
          {(beforePhotoPreview || workOrder.attachments?.length > 0) && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 font-medium mb-2">Photos</p>
              <div className="flex gap-2 overflow-x-auto">
                {beforePhotoPreview && (
                  <img src={beforePhotoPreview} alt="Before" className="h-24 w-24 object-cover rounded-lg flex-shrink-0" />
                )}
                {afterPhotoPreview && (
                  <img src={afterPhotoPreview} alt="After" className="h-24 w-24 object-cover rounded-lg flex-shrink-0" />
                )}
                {workOrder.attachments?.map((att) => (
                  <img
                    key={att.id}
                    src={att.file_path || att.url}
                    alt={att.photo_type || 'Photo'}
                    className="h-24 w-24 object-cover rounded-lg flex-shrink-0"
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== COMMENTS SECTION ===== */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          <MessageSquare className="h-4 w-4 inline mr-1" />
          Notes & Comments
        </h2>

        {/* Existing comments */}
        {workOrder.comments && workOrder.comments.length > 0 ? (
          <div className="space-y-2 mb-3">
            {workOrder.comments.map((c, idx) => (
              <div key={c.id || idx} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-700">
                    {c.first_name ? `${c.first_name} ${c.last_name || ''}`.trim() : 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-400">
                    {c.created_at ? new Date(c.created_at).toLocaleString() : ''}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.comment}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-3">No comments yet</p>
        )}

        {/* Add note */}
        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleAddComment()
              }
            }}
            placeholder="Add a note..."
            className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <button
            onClick={handleAddComment}
            disabled={addingComment || !commentText.trim()}
            className="flex items-center justify-center w-12 h-12 bg-primary-600 text-white rounded-lg hover:bg-primary-700 active:bg-primary-800 disabled:opacity-50 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Started at info (if in progress) */}
      {workOrder.status === 'in_progress' && workOrder.started_at && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <Clock className="h-4 w-4" />
            <span>Started: {new Date(workOrder.started_at).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

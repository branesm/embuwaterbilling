import { useState } from 'react'
import { useQuery, useMutation } from 'react-query'
import api from '../../api/axios'
import { 
  Calculator, 
  Search, 
  Droplets,
  Banknote,
  ArrowRight,
  RefreshCw,
  FileText,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

const BillSimulationPage = () => {
  const [customerId, setCustomerId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [simulationParams, setSimulationParams] = useState({
    previousReading: 0,
    currentReading: 0,
    tariffConfigId: ''
  })
  const [simulationResult, setSimulationResult] = useState(null)

  // Search customers
  const { data: customersData, isLoading: searching } = useQuery(
    ['customer-search', searchQuery],
    async () => {
      if (!searchQuery || searchQuery.length < 2) return { data: [] }
      const response = await api.get(`/customers?search=${searchQuery}&limit=10`)
      return response.data
    },
    { enabled: searchQuery.length >= 2 }
  )

  // Get customer details with meter
  const { data: customerDetail } = useQuery(
    ['customer-detail', customerId],
    async () => {
      if (!customerId) return null
      const response = await api.get(`/customers/${customerId}`)
      return response.data
    },
    { enabled: !!customerId }
  )

  // Get tariff configs
  const { data: tariffsData } = useQuery(
    ['tariffs'],
    async () => {
      const response = await api.get('/tariffs')
      return response.data
    }
  )

  // Simulate bill mutation
  const simulateMutation = useMutation(
    async (data) => {
      // Calculate locally based on tariff tiers
      const consumption = data.currentReading - data.previousReading
      const tariff = tariffsData?.data?.find(t => t.id === parseInt(data.tariffConfigId))
      
      if (!tariff || !tariff.tiers) {
        throw new Error('Tariff not found')
      }

      let remainingConsumption = consumption
      let waterCharge = 0
      const breakdown = []

      // Sort tiers by min consumption
      const sortedTiers = [...tariff.tiers].sort((a, b) => a.min_consumption - b.min_consumption)

      for (const tier of sortedTiers) {
        if (remainingConsumption <= 0) break
        
        const tierRange = tier.max_consumption - tier.min_consumption
        const consumptionInTier = Math.min(remainingConsumption, tierRange)
        const tierCharge = consumptionInTier * tier.price_per_unit
        
        breakdown.push({
          tier: tier.tier_name,
          consumption: consumptionInTier,
          rate: tier.price_per_unit,
          amount: tierCharge
        })
        
        waterCharge += tierCharge
        remainingConsumption -= consumptionInTier
      }

      // Calculate additional charges
      const sewerageCharge = waterCharge * 0.5 // 50% of water charge
      const standingCharge = 100 // Fixed monthly charge
      const meterRent = 50 // Fixed monthly rent
      
      const totalAmount = waterCharge + sewerageCharge + standingCharge + meterRent

      return {
        consumption,
        waterCharge,
        sewerageCharge,
        standingCharge,
        meterRent,
        totalAmount,
        breakdown,
        tariffName: tariff.name
      }
    },
    {
      onSuccess: (data) => {
        setSimulationResult(data)
      }
    }
  )

  const handleSimulate = (e) => {
    e.preventDefault()
    simulateMutation.mutate(simulationParams)
  }

  const selectCustomer = (customer) => {
    setCustomerId(customer.id)
    setSearchQuery('')
    // Pre-fill with customer's current meter reading if available
    if (customer.current_reading) {
      setSimulationParams(prev => ({
        ...prev,
        previousReading: parseFloat(customer.current_reading)
      }))
    }
  }

  const customer = customerDetail?.data
  const customers = customersData?.data || []
  const tariffs = tariffsData?.data || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill Simulation</h1>
          <p className="text-gray-500 mt-1">Calculate estimated bills before final processing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Selection & Input Form */}
        <div className="space-y-6">
          {/* Customer Search */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Customer</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, account number, or meter number..."
                className="input pl-10 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              )}
            </div>
            
            {/* Search Results */}
            {customers.length > 0 && searchQuery && (
              <div className="mt-2 border rounded-lg max-h-48 overflow-y-auto">
                {customers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium text-gray-900">{c.first_name} {c.last_name}</div>
                    <div className="text-sm text-gray-500">{c.account_number} • {c.meter_number || 'No meter'}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Customer */}
            {customer && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                  <span className="font-semibold text-blue-900">Selected Customer</span>
                </div>
                <div className="text-sm text-blue-800">
                  <p><strong>Name:</strong> {customer.first_name} {customer.last_name}</p>
                  <p><strong>Account:</strong> {customer.account_number}</p>
                  <p><strong>Meter:</strong> {customer.meter_number || 'N/A'}</p>
                  <p><strong>Current Reading:</strong> {customer.current_reading || 'N/A'}</p>
                  <p><strong>Zone:</strong> {customer.zone_name || 'N/A'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Simulation Parameters */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reading Details</h3>
            <form onSubmit={handleSimulate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Previous Reading</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    value={simulationParams.previousReading}
                    onChange={(e) => setSimulationParams({ ...simulationParams, previousReading: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Current Reading</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full"
                    value={simulationParams.currentReading}
                    onChange={(e) => setSimulationParams({ ...simulationParams, currentReading: parseFloat(e.target.value) || 0 })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="label">Tariff Category</label>
                <select
                  className="input w-full"
                  value={simulationParams.tariffConfigId}
                  onChange={(e) => setSimulationParams({ ...simulationParams, tariffConfigId: e.target.value })}
                  required
                >
                  <option value="">Select Tariff</option>
                  {tariffs.map((tariff) => (
                    <option key={tariff.id} value={tariff.id}>
                      {tariff.name} ({tariff.customer_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Consumption Preview */}
              {simulationParams.currentReading > simulationParams.previousReading && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Consumption:</span>
                    <span className="font-semibold text-blue-600">
                      {(simulationParams.currentReading - simulationParams.previousReading).toFixed(2)} m³
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={simulateMutation.isLoading || !customer}
                className="btn btn-primary w-full flex items-center justify-center space-x-2"
              >
                {simulateMutation.isLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Calculating...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    <span>Simulate Bill</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Simulation Result */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Simulation Result</h3>
          
          {!simulationResult ? (
            <div className="text-center py-12 text-gray-400">
              <Calculator className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Enter reading details and click "Simulate Bill"</p>
              <p className="text-sm mt-2">The estimated bill will appear here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-blue-800">Total Amount Due</span>
                  <span className="text-2xl font-bold text-blue-900">
                    KES {simulationResult.totalAmount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-sm text-blue-600">
                  Tariff: {simulationResult.tariffName} • Consumption: {simulationResult.consumption.toFixed(2)} m³
                </div>
              </div>

              {/* Breakdown */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Water Charge Breakdown</h4>
                <div className="space-y-2">
                  {simulationResult.breakdown.map((item, index) => (
                    <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium text-gray-700">{item.tier}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {item.consumption.toFixed(2)} m³ × KES {item.rate}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">
                        KES {item.amount.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center p-2 mt-2 border-t">
                  <span className="font-medium text-gray-700">Total Water Charge</span>
                  <span className="font-semibold text-gray-900">
                    KES {simulationResult.waterCharge.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Additional Charges */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Additional Charges</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">Sewerage Charge (50%)</span>
                    <span className="font-medium text-gray-900">
                      KES {simulationResult.sewerageCharge.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">Standing Charge</span>
                    <span className="font-medium text-gray-900">
                      KES {simulationResult.standingCharge.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span className="text-sm text-gray-600">Meter Rent</span>
                    <span className="font-medium text-gray-900">
                      KES {simulationResult.meterRent.toLocaleString('en-KE', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4 border-t">
                <button 
                  onClick={() => setSimulationResult(null)}
                  className="btn btn-secondary flex-1 flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>New Simulation</span>
                </button>
                <button className="btn btn-primary flex-1 flex items-center justify-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Generate Bill</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BillSimulationPage

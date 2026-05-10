import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from 'react-query'
import api from '../../api/axios'
import { 
  Repeat, 
  Search, 
  ArrowRight,
  CheckCircle,
  FileText,
  User,
  Home,
  Banknote,
  AlertCircle,
  RefreshCw
} from 'lucide-react'

const ChangeTenancyPage = () => {
  const [step, setStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedContract, setSelectedContract] = useState(null)
  const [newTenant, setNewTenant] = useState({
    firstName: '',
    lastName: '',
    idNumber: '',
    phone: '',
    email: '',
    address: ''
  })
  const [transferDetails, setTransferDetails] = useState({
    transferDate: new Date().toISOString().split('T')[0],
    outstandingBalance: 0,
    depositTransfer: true,
    notes: ''
  })
  const queryClient = useQueryClient()

  // Search for existing contracts
  const { data: contractsData, isLoading: searching } = useQuery(
    ['contract-search', searchQuery],
    async () => {
      if (!searchQuery || searchQuery.length < 2) return { data: [] }
      const response = await api.get(`/contracts?search=${searchQuery}&limit=10`)
      return response.data
    },
    { enabled: searchQuery.length >= 2 }
  )

  // Get contract details
  const { data: contractDetail } = useQuery(
    ['contract-detail', selectedContract?.contract_id],
    async () => {
      if (!selectedContract) return null
      const response = await api.get(`/contracts/${selectedContract.contract_id}`)
      return response.data
    },
    { enabled: !!selectedContract }
  )

  const changeTenancyMutation = useMutation(
    async (data) => {
      const response = await api.post('/contracts/change-tenancy', data)
      return response.data
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['contracts'])
        setStep(4) // Success step
      }
    }
  )

  const selectContract = (contract) => {
    setSelectedContract(contract)
    setSearchQuery('')
    setTransferDetails(prev => ({
      ...prev,
      outstandingBalance: contract.balance || 0
    }))
  }

  const handleSubmit = () => {
    changeTenancyMutation.mutate({
      contractId: selectedContract.contract_id,
      oldCustomerId: selectedContract.customer_id,
      newTenant,
      transferDetails
    })
  }

  const contracts = contractsData?.data || []
  const contract = contractDetail?.data

  const steps = [
    { number: 1, title: 'Select Contract', description: 'Find existing contract' },
    { number: 2, title: 'New Tenant', description: 'Enter new tenant details' },
    { number: 3, title: 'Transfer Details', description: 'Review and confirm' },
    { number: 4, title: 'Complete', description: 'Transfer completed' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Change of Tenancy</h1>
        <p className="text-gray-500 mt-1">Transfer water service contract to a new tenant</p>
      </div>

      {/* Progress Steps */}
      <div className="card">
        <div className="flex items-center justify-between">
          {steps.map((s, index) => (
            <div key={s.number} className="flex items-center">
              <div className={`flex flex-col items-center ${step >= s.number ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step > s.number ? 'bg-green-500 text-white' :
                  step === s.number ? 'bg-blue-600 text-white' :
                  'bg-gray-200 text-gray-600'
                }`}>
                  {step > s.number ? <CheckCircle className="w-5 h-5" /> : s.number}
                </div>
                <span className="text-xs mt-1 font-medium">{s.title}</span>
              </div>
              {index < steps.length - 1 && (
                <div className={`w-16 md:w-24 h-0.5 mx-2 ${step > s.number ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Select Contract */}
      {step === 1 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Contract</h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by contract number, customer name, or account number..."
              className="input pl-12 w-full text-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            )}
          </div>

          {/* Search Results */}
          {contracts.length > 0 && searchQuery && (
            <div className="border rounded-lg divide-y">
              {contracts.map((c) => (
                <button
                  key={c.contract_id}
                  onClick={() => selectContract(c)}
                  className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-gray-900">{c.contract_number}</div>
                      <div className="text-sm text-gray-600">
                        {c.first_name} {c.last_name} • {c.account_number}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {c.meter_number} • {c.zone_name}
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      c.status === 'active' ? 'bg-green-100 text-green-800' :
                      c.status === 'suspended' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {contracts.length === 0 && searchQuery.length >= 2 && !searching && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No contracts found matching your search</p>
            </div>
          )}

          {/* Selected Contract Preview */}
          {selectedContract && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span className="font-semibold text-blue-900">Selected Contract</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Contract:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedContract.contract_number}</span>
                </div>
                <div>
                  <span className="text-gray-600">Current Tenant:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedContract.first_name} {selectedContract.last_name}</span>
                </div>
                <div>
                  <span className="text-gray-600">Meter:</span>
                  <span className="ml-2 font-medium text-gray-900">{selectedContract.meter_number}</span>
                </div>
                <div>
                  <span className="text-gray-600">Balance:</span>
                  <span className="ml-2 font-medium text-red-600">KES {parseFloat(selectedContract.balance || 0).toLocaleString()}</span>
                </div>
              </div>
              <button 
                onClick={() => setStep(2)}
                className="btn btn-primary mt-4 w-full flex items-center justify-center space-x-2"
              >
                <span>Continue to New Tenant</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Step 2: New Tenant Details */}
      {step === 2 && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">New Tenant Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input
                type="text"
                className="input w-full"
                value={newTenant.firstName}
                onChange={(e) => setNewTenant({ ...newTenant, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input
                type="text"
                className="input w-full"
                value={newTenant.lastName}
                onChange={(e) => setNewTenant({ ...newTenant, lastName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">ID Number *</label>
              <input
                type="text"
                className="input w-full"
                value={newTenant.idNumber}
                onChange={(e) => setNewTenant({ ...newTenant, idNumber: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="label">Phone Number *</label>
              <input
                type="tel"
                className="input w-full"
                value={newTenant.phone}
                onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Email</label>
              <input
                type="email"
                className="input w-full"
                value={newTenant.email}
                onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Physical Address *</label>
              <textarea
                className="input w-full h-20"
                value={newTenant.address}
                onChange={(e) => setNewTenant({ ...newTenant, address: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex space-x-3 mt-6">
            <button 
              onClick={() => setStep(1)}
              className="btn btn-secondary flex-1"
            >
              Back
            </button>
            <button 
              onClick={() => setStep(3)}
              disabled={!newTenant.firstName || !newTenant.lastName || !newTenant.idNumber || !newTenant.phone}
              className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              <span>Continue</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review and Confirm */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card bg-gray-50">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <User className="w-5 h-5 text-gray-500" />
                <span>Current Tenant (Outgoing)</span>
              </h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-600">Name:</span> <span className="font-medium">{selectedContract?.first_name} {selectedContract?.last_name}</span></p>
                <p><span className="text-gray-600">Account:</span> <span className="font-medium">{selectedContract?.account_number}</span></p>
                <p><span className="text-gray-600">Contract:</span> <span className="font-medium">{selectedContract?.contract_number}</span></p>
              </div>
            </div>

            <div className="card bg-blue-50 border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                <UserSwitch className="w-5 h-5 text-blue-500" />
                <span>New Tenant (Incoming)</span>
              </h4>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-600">Name:</span> <span className="font-medium">{newTenant.firstName} {newTenant.lastName}</span></p>
                <p><span className="text-gray-600">ID Number:</span> <span className="font-medium">{newTenant.idNumber}</span></p>
                <p><span className="text-gray-600">Phone:</span> <span className="font-medium">{newTenant.phone}</span></p>
              </div>
            </div>
          </div>

          {/* Transfer Details */}
          <div className="card">
            <h4 className="font-semibold text-gray-900 mb-4">Transfer Details</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Transfer Date</label>
                <input
                  type="date"
                  className="input w-full"
                  value={transferDetails.transferDate}
                  onChange={(e) => setTransferDetails({ ...transferDetails, transferDate: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Outstanding Balance (KES)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input w-full"
                  value={transferDetails.outstandingBalance}
                  onChange={(e) => setTransferDetails({ ...transferDetails, outstandingBalance: parseFloat(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={transferDetails.depositTransfer}
                    onChange={(e) => setTransferDetails({ ...transferDetails, depositTransfer: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Transfer deposit to new tenant</span>
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="label">Notes</label>
                <textarea
                  className="input w-full h-20"
                  value={transferDetails.notes}
                  onChange={(e) => setTransferDetails({ ...transferDetails, notes: e.target.value })}
                  placeholder="Any additional notes about this transfer..."
                />
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium">Important:</p>
              <p>This action will transfer the water service contract to the new tenant. The current tenant will no longer be responsible for this connection. Please ensure all parties have agreed to this transfer.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <button 
              onClick={() => setStep(2)}
              className="btn btn-secondary flex-1"
            >
              Back
            </button>
            <button 
              onClick={handleSubmit}
              disabled={changeTenancyMutation.isLoading}
              className="btn btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              {changeTenancyMutation.isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Complete Transfer</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Transfer Completed Successfully</h3>
          <p className="text-gray-600 mb-6">
            The water service contract has been transferred from {selectedContract?.first_name} {selectedContract?.last_name} to {newTenant.firstName} {newTenant.lastName}.
          </p>
          <div className="flex justify-center space-x-3">
            <button 
              onClick={() => {
                setStep(1)
                setSelectedContract(null)
                setNewTenant({
                  firstName: '',
                  lastName: '',
                  idNumber: '',
                  phone: '',
                  email: '',
                  address: ''
                })
              }}
              className="btn btn-secondary"
            >
              Start New Transfer
            </button>
            <button 
              onClick={() => window.location.href = '/contracts'}
              className="btn btn-primary"
            >
              View Contracts
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChangeTenancyPage

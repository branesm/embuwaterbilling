import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Activity, Copy, Plus, Pencil, Trash2, X, Check, TrendingUp } from 'lucide-react'

export default function TariffsPage() {
  const [activeTab, setActiveTab] = useState<'categories' | 'lines' | 'duplicate'>('categories')
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null)
  const [editingLineId, setEditingLineId] = useState<number | null>(null)
  const queryClient = useQueryClient()

  const { data: categories } = useQuery({
    queryKey: ['tariff-categories'],
    queryFn: async () => {
      const res = await api.get('/tariffs/categories')
      return res.data.data
    },
  })

  const { data: tariffLines } = useQuery({
    queryKey: ['tariff-lines', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return []
      const res = await api.get(`/tariffs/lines/${selectedCategory}`)
      return res.data.data
    },
    enabled: !!selectedCategory,
  })

  const createCategory = useMutation({
    mutationFn: (data: any) => api.post('/tariffs/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-categories'] })
    },
  })

  const updateCategory = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/tariffs/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-categories'] })
      setEditingCategoryId(null)
    },
  })

  const deleteCategory = useMutation({
    mutationFn: (id: number) => api.delete(`/tariffs/categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-categories'] })
      if (selectedCategory && categories?.find((c: any) => c.id === selectedCategory)?.is_active === false) {
        setSelectedCategory(null)
      }
    },
  })

  const createLine = useMutation({
    mutationFn: (data: any) => api.post('/tariffs/lines', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-lines', selectedCategory] })
    },
  })

  const updateLine = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.put(`/tariffs/lines/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-lines', selectedCategory] })
      setEditingLineId(null)
    },
  })

  const deleteLine = useMutation({
    mutationFn: (id: number) => api.delete(`/tariffs/lines/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-lines', selectedCategory] })
    },
  })

  const duplicateTariff = useMutation({
    mutationFn: (data: any) => api.post('/tariffs/duplicate', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tariff-lines', selectedCategory] })
    },
  })

  const [categoryForm, setCategoryForm] = useState({ code: '', name: '', description: '' })
  const [lineForm, setLineForm] = useState({ min_units: '', max_units: '', rate: '', fixed_charge: '', effective_from: new Date().toISOString().split('T')[0], effective_to: '' })
  const [duplicateForm, setDuplicateForm] = useState({ from_category_id: '', new_effective_from: new Date().toISOString().split('T')[0] })
  const [editCategoryForm, setEditCategoryForm] = useState<any>({})
  const [editLineForm, setEditLineForm] = useState<any>({})

  const selectedCatData = categories?.find((c: any) => c.id === selectedCategory)

  const startEditCategory = (cat: any) => {
    setEditingCategoryId(cat.id)
    setEditCategoryForm({ ...cat })
  }

  const startEditLine = (line: any) => {
    setEditingLineId(line.id)
    setEditLineForm({ ...line })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tariff Management</h1>
          <p className="text-gray-500">Configure water and sewerage tariff categories and tiered pricing</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex border-b border-gray-200">
          {[
            { key: 'categories' as const, label: 'Categories', icon: Activity },
            { key: 'lines' as const, label: 'Tariff Lines', icon: TrendingUp },
            { key: 'duplicate' as const, label: 'Duplicate', icon: Copy },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* Categories Tab */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Create Category Form */}
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">New Tariff Category</h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    createCategory.mutate(categoryForm)
                    setCategoryForm({ code: '', name: '', description: '' })
                  }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                    <input required value={categoryForm.code} onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                    <input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                    <input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="flex items-end">
                    <button type="submit" disabled={createCategory.isPending} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm">
                      {createCategory.isPending ? 'Creating...' : 'Create Category'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Categories Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Code</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Description</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categories?.map((cat: any) => (
                      <tr key={cat.id} className="hover:bg-gray-50">
                        {editingCategoryId === cat.id ? (
                          <>
                            <td className="px-4 py-2"><input value={editCategoryForm.code || ''} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, code: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                            <td className="px-4 py-2"><input value={editCategoryForm.name || ''} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, name: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                            <td className="px-4 py-2"><input value={editCategoryForm.description || ''} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, description: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                            <td className="px-4 py-2">
                              <select value={editCategoryForm.is_active ? 'true' : 'false'} onChange={(e) => setEditCategoryForm({ ...editCategoryForm, is_active: e.target.value === 'true' })} className="px-2 py-1 border border-gray-300 rounded text-sm">
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateCategory.mutate({ id: cat.id, data: editCategoryForm })} className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Save"><Check className="w-4 h-4" /></button>
                                <button onClick={() => setEditingCategoryId(null)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Cancel"><X className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-medium">{cat.code}</td>
                            <td className="px-4 py-3">{cat.name}</td>
                            <td className="px-4 py-3 text-gray-600">{cat.description}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${cat.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                {cat.is_active !== false ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => { setSelectedCategory(cat.id); setActiveTab('lines') }} className="px-2 py-1 text-xs bg-sky-50 text-sky-700 rounded border border-sky-200 hover:bg-sky-100" title="View Lines">Lines</button>
                                <button onClick={() => startEditCategory(cat)} className="p-1.5 hover:bg-sky-50 rounded text-sky-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                                <button onClick={() => { if (confirm('Deactivate this category?')) deleteCategory.mutate(cat.id) }} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                    {(!categories || categories.length === 0) && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No tariff categories found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lines Tab */}
          {activeTab === 'lines' && (
            <div className="space-y-6">
              {selectedCategory ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedCatData?.name}</h3>
                      <p className="text-sm text-gray-500">Tariff lines for {selectedCatData?.code}</p>
                    </div>
                    <button onClick={() => setSelectedCategory(null)} className="text-sm text-sky-600 hover:text-sky-700">Clear selection</button>
                  </div>

                  {/* Add Line Form */}
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Add Tariff Line</h3>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        createLine.mutate({
                          tariff_category_id: selectedCategory,
                          min_units: parseFloat(lineForm.min_units),
                          max_units: parseFloat(lineForm.max_units),
                          rate: parseFloat(lineForm.rate),
                          fixed_charge: parseFloat(lineForm.fixed_charge) || 0,
                          effective_from: lineForm.effective_from,
                          effective_to: lineForm.effective_to || null,
                        })
                        setLineForm({ min_units: '', max_units: '', rate: '', fixed_charge: '', effective_from: new Date().toISOString().split('T')[0], effective_to: '' })
                      }}
                      className="grid grid-cols-2 md:grid-cols-6 gap-4"
                    >
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Min Units</label>
                        <input type="number" step="0.01" required value={lineForm.min_units} onChange={(e) => setLineForm({ ...lineForm, min_units: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Max Units</label>
                        <input type="number" step="0.01" required value={lineForm.max_units} onChange={(e) => setLineForm({ ...lineForm, max_units: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Rate</label>
                        <input type="number" step="0.0001" required value={lineForm.rate} onChange={(e) => setLineForm({ ...lineForm, rate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Fixed Charge</label>
                        <input type="number" step="0.01" value={lineForm.fixed_charge} onChange={(e) => setLineForm({ ...lineForm, fixed_charge: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Effective From</label>
                        <input type="date" required value={lineForm.effective_from} onChange={(e) => setLineForm({ ...lineForm, effective_from: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Effective To</label>
                        <input type="date" value={lineForm.effective_to} onChange={(e) => setLineForm({ ...lineForm, effective_to: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                      </div>
                      <div className="md:col-span-6">
                        <button type="submit" disabled={createLine.isPending} className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm">
                          {createLine.isPending ? 'Adding...' : 'Add Tariff Line'}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Tariff Tier Visualization */}
                  {tariffLines?.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-200 p-4">
                      <h3 className="text-sm font-medium text-gray-900 mb-3">Tariff Structure</h3>
                      <div className="flex flex-wrap gap-2">
                        {tariffLines.map((line: any, idx: number) => (
                          <div key={line.id} className="flex-1 min-w-[140px] bg-sky-50 border border-sky-200 rounded-lg p-3 text-center">
                            <div className="text-xs text-sky-700 font-medium uppercase tracking-wide">Tier {idx + 1}</div>
                            <div className="text-lg font-bold text-sky-900 mt-1">{line.min_units} - {line.max_units}</div>
                            <div className="text-xs text-gray-600">units</div>
                            <div className="mt-2 text-sm font-semibold text-gray-900">KES {parseFloat(line.rate).toFixed(4)}</div>
                            <div className="text-xs text-gray-500">per unit</div>
                            {parseFloat(line.fixed_charge) > 0 && (
                              <div className="mt-1 text-xs text-gray-600">+ Fixed KES {parseFloat(line.fixed_charge).toLocaleString()}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lines Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">Min Units</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">Max Units</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-700">Rate</th>
                          <th className="text-right px-4 py-3 font-medium text-gray-700">Fixed Charge</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">Effective From</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">Effective To</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                          <th className="text-left px-4 py-3 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {tariffLines?.map((line: any) => (
                          <tr key={line.id} className="hover:bg-gray-50">
                            {editingLineId === line.id ? (
                              <>
                                <td className="px-4 py-2"><input type="number" step="0.01" value={editLineForm.min_units || ''} onChange={(e) => setEditLineForm({ ...editLineForm, min_units: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-2"><input type="number" step="0.01" value={editLineForm.max_units || ''} onChange={(e) => setEditLineForm({ ...editLineForm, max_units: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-2"><input type="number" step="0.0001" value={editLineForm.rate || ''} onChange={(e) => setEditLineForm({ ...editLineForm, rate: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-2"><input type="number" step="0.01" value={editLineForm.fixed_charge || ''} onChange={(e) => setEditLineForm({ ...editLineForm, fixed_charge: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-2"><input type="date" value={editLineForm.effective_from ? editLineForm.effective_from.split('T')[0] : ''} onChange={(e) => setEditLineForm({ ...editLineForm, effective_from: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-2"><input type="date" value={editLineForm.effective_to ? editLineForm.effective_to.split('T')[0] : ''} onChange={(e) => setEditLineForm({ ...editLineForm, effective_to: e.target.value })} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /></td>
                                <td className="px-4 py-2"><span className="text-xs">-</span></td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => updateLine.mutate({ id: line.id, data: editLineForm })} className="p-1.5 hover:bg-green-50 rounded text-green-600" title="Save"><Check className="w-4 h-4" /></button>
                                    <button onClick={() => setEditingLineId(null)} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Cancel"><X className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3">{line.min_units}</td>
                                <td className="px-4 py-3">{line.max_units}</td>
                                <td className="px-4 py-3 text-right">{parseFloat(line.rate).toFixed(4)}</td>
                                <td className="px-4 py-3 text-right">{parseFloat(line.fixed_charge || 0).toLocaleString()}</td>
                                <td className="px-4 py-3">{new Date(line.effective_from).toLocaleDateString()}</td>
                                <td className="px-4 py-3">{line.effective_to ? new Date(line.effective_to).toLocaleDateString() : '-'}</td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${line.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                    {line.is_active !== false ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => startEditLine(line)} className="p-1.5 hover:bg-sky-50 rounded text-sky-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                                    <button onClick={() => { if (confirm('Deactivate this tariff line?')) deleteLine.mutate(line.id) }} className="p-1.5 hover:bg-red-50 rounded text-red-600" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                        {(!tariffLines || tariffLines.length === 0) && (
                          <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No tariff lines found for this category</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center">
                  <TrendingUp className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Select a tariff category to view and manage its lines</p>
                  <button onClick={() => setActiveTab('categories')} className="mt-2 text-sm text-sky-600 hover:text-sky-700">Go to Categories</button>
                </div>
              )}
            </div>
          )}

          {/* Duplicate Tab */}
          {activeTab === 'duplicate' && (
            <div className="max-w-xl">
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-1">Duplicate Tariff to New Effective Date</h3>
                <p className="text-xs text-gray-500 mb-4">Creates a new version of all active tariff lines for a category, deactivating the previous version.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    duplicateTariff.mutate({
                      from_category_id: parseInt(duplicateForm.from_category_id),
                      new_effective_from: duplicateForm.new_effective_from,
                    })
                    setDuplicateForm({ from_category_id: '', new_effective_from: new Date().toISOString().split('T')[0] })
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">From Category</label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      value={duplicateForm.from_category_id}
                      onChange={(e) => setDuplicateForm({ ...duplicateForm, from_category_id: e.target.value })}
                      required
                    >
                      <option value="">Select Category</option>
                      {categories?.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">New Effective From</label>
                    <input
                      type="date"
                      required
                      value={duplicateForm.new_effective_from}
                      onChange={(e) => setDuplicateForm({ ...duplicateForm, new_effective_from: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <button type="submit" disabled={duplicateTariff.isPending} className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 text-sm">
                    <Copy className="w-4 h-4" />
                    {duplicateTariff.isPending ? 'Duplicating...' : 'Duplicate Tariff'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

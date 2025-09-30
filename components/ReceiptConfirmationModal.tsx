'use client';

import { useState } from 'react';
import addExpenseRecord from '@/app/actions/addExpenseRecord';
import { ExtractedData } from '@/lib/heuristicExtraction';

interface ReceiptConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  extracted: ExtractedData;
  category: string;
  uploadId: string;
  onSuccess: () => void;
}

export default function ReceiptConfirmationModal({
  isOpen,
  onClose,
  extracted,
  category,
  uploadId,
  onSuccess,
}: ReceiptConfirmationModalProps) {
  // Log upload ID for debugging
  console.log('Processing upload:', uploadId);
  
  const [formData, setFormData] = useState({
    description: extracted.description || '',
    provider: extracted.provider || '',
    amount: extracted.amount?.toString() || '',
    date: extracted.date || new Date().toISOString().split('T')[0],
    category,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async () => {
    if (!formData.description.trim() || !formData.amount || !formData.date) {
      setError('Por favor completa todos los campos requeridos');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create FormData for the addExpenseRecord action
      const submitFormData = new FormData();
      submitFormData.append('text', formData.description);
      submitFormData.append('amount', formData.amount);
      submitFormData.append('category', formData.category);
      submitFormData.append('date', formData.date);

      const result = await addExpenseRecord(submitFormData);

      if (result.error) {
        setError(result.error);
      } else {
        onSuccess();
        onClose();
      }
    } catch {
      setError('Error al guardar el gasto. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-lg">✓</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Confirmar Gasto
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Revisa y edita la información extraída
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <span className="text-gray-500 dark:text-gray-400 text-xl">×</span>
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Descripción del gasto"
              />
            </div>

            {/* Provider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proveedor
              </label>
              <input
                type="text"
                value={formData.provider}
                onChange={(e) => handleInputChange('provider', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Nombre del proveedor"
              />
            </div>

            {/* Amount and Date Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Monto *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoría
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="Food">Comida</option>
                <option value="Transportation">Transporte</option>
                <option value="Entertainment">Entretenimiento</option>
                <option value="Shopping">Compras</option>
                <option value="Bills">Facturas</option>
                <option value="Healthcare">Salud</option>
                <option value="Other">Otro</option>
              </select>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Guardando...
                </>
              ) : (
                'Guardar Gasto'
              )}
            </button>
          </div>

          {/* Confidence Indicators */}
          {extracted.confidence && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Confianza de Extracción
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Monto:</span>
                  <span className={`font-medium ${extracted.confidence.amount > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {Math.round(extracted.confidence.amount * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Fecha:</span>
                  <span className={`font-medium ${extracted.confidence.date > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {Math.round(extracted.confidence.date * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Proveedor:</span>
                  <span className={`font-medium ${extracted.confidence.provider > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {Math.round(extracted.confidence.provider * 100)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Descripción:</span>
                  <span className={`font-medium ${extracted.confidence.description > 0.7 ? 'text-green-600' : 'text-yellow-600'}`}>
                    {Math.round(extracted.confidence.description * 100)}%
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

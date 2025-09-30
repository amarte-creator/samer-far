'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ReceiptConfirmationModal from './ReceiptConfirmationModal';
import { ExtractedData } from '@/lib/heuristicExtraction';

interface UploadState {
  isUploading: boolean;
  success: boolean;
  error: string | null;
}

interface UploadResponse {
  success: boolean;
  uploadId: string;
  extracted: ExtractedData;
  category: string;
  ocrConfidence: number;
  heuristicConfidence: number;
  error?: string;
}

export default function UploadReceipt() {
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    success: false,
    error: null,
  });
  const [modalData, setModalData] = useState<{
    isOpen: boolean;
    extracted: ExtractedData | null;
    category: string;
    uploadId: string;
  }>({
    isOpen: false,
    extracted: null,
    category: '',
    uploadId: '',
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const processFile = async (file: File) => {
    // Validate file type
    const fileType = file.type;
    const isPDF = fileType === 'application/pdf';
    const isImage = fileType.startsWith('image/');

    if (!isPDF && !isImage) {
      setUploadState({
        isUploading: false,
        success: false,
        error: 'Please select a PDF or image file',
      });
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadState({
        isUploading: false,
        success: false,
        error: 'File size must be less than 10MB',
      });
      return;
    }

    setUploadState({
      isUploading: true,
      success: false,
      error: null,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload-receipt', {
        method: 'POST',
        body: formData,
      });

      const data: UploadResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadState({
        isUploading: false,
        success: false,
        error: null,
      });

      // Show confirmation modal with extracted data
      setModalData({
        isOpen: true,
        extracted: data.extracted,
        category: data.category,
        uploadId: data.uploadId,
      });

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      setUploadState({
        isUploading: false,
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Process the file directly instead of creating a synthetic event
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleModalClose = () => {
    setModalData({
      isOpen: false,
      extracted: null,
      category: '',
      uploadId: '',
    });
  };

  const handleModalSuccess = () => {
    // Refresh the page to show the new record
    router.refresh();
    
    // Show success message
    setUploadState({
      isUploading: false,
      success: true,
      error: null,
    });

    // Clear success message after 3 seconds
    setTimeout(() => {
      setUploadState({
        isUploading: false,
        success: false,
        error: null,
      });
    }, 3000);
  };

  return (
    <div className='bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-6 lg:p-8 rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 hover:shadow-2xl transition-all duration-300'>
      <div className='flex items-center gap-3 mb-6'>
        <div className='w-10 h-10 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg'>
          <span className='text-white text-lg'>📄</span>
        </div>
        <div>
          <h3 className='text-xl font-bold text-gray-900 dark:text-gray-100'>
            Upload Receipt
          </h3>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            Upload PDF or image receipts to automatically extract expense data
          </p>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          uploadState.isUploading
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type='file'
          accept='.pdf,image/*'
          onChange={handleFileUpload}
          className='absolute inset-0 w-full h-full opacity-0 cursor-pointer'
          disabled={uploadState.isUploading}
        />

        {uploadState.isUploading ? (
          <div className='space-y-4'>
            <div className='w-12 h-12 mx-auto bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center animate-pulse'>
              <div className='w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
            </div>
            <div>
              <p className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                Processing...
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Extracting text and analyzing your receipt
              </p>
            </div>
          </div>
        ) : uploadState.success ? (
          <div className='space-y-4'>
            <div className='w-12 h-12 mx-auto bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center'>
              <span className='text-white text-xl'>✓</span>
            </div>
            <div>
              <p className='text-lg font-semibold text-green-700 dark:text-green-400'>
                Success!
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                Receipt processed and expense added
              </p>
            </div>
          </div>
        ) : uploadState.error ? (
          <div className='space-y-4'>
            <div className='w-12 h-12 mx-auto bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center'>
              <span className='text-white text-xl'>✕</span>
            </div>
            <div>
              <p className='text-lg font-semibold text-red-700 dark:text-red-400'>
                Upload Failed
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>
                {uploadState.error}
              </p>
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='w-12 h-12 mx-auto bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center'>
              <span className='text-white text-xl'>📁</span>
            </div>
            <div>
              <p className='text-lg font-semibold text-gray-900 dark:text-gray-100'>
                Drop your receipt here
              </p>
              <p className='text-sm text-gray-600 dark:text-gray-400 mb-4'>
                or click to browse files
              </p>
              <div className='flex flex-wrap gap-2 justify-center text-xs text-gray-500 dark:text-gray-400'>
                <span className='bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded'>
                  PDF
                </span>
                <span className='bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded'>
                  JPG
                </span>
                <span className='bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded'>
                  PNG
                </span>
                <span className='bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded'>
                  Max 10MB
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!uploadState.isUploading && !uploadState.success && !uploadState.error && (
        <div className='mt-4 text-center'>
          <p className='text-xs text-gray-500 dark:text-gray-400'>
            Supported formats: PDF, JPG, PNG, GIF, WEBP
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      {modalData.extracted && (
        <ReceiptConfirmationModal
          isOpen={modalData.isOpen}
          onClose={handleModalClose}
          extracted={modalData.extracted}
          category={modalData.category}
          uploadId={modalData.uploadId}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

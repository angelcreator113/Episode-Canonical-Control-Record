import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiVideo, FiCheckCircle, FiX, FiLoader, FiAlertCircle } from 'react-icons/fi';
import footageService from '../services/footageService';

/**
 * Raw Footage Upload Component
 * Handles video file uploads to S3 with progress tracking
 */
export default function RawFootageUpload({ episodeId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [errors, setErrors] = useState([]);

  // Video file validation
  const acceptedFormats = {
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
    'video/x-msvideo': ['.avi'],
    'video/webm': ['.webm']
  };

  const onDrop = useCallback(async (acceptedFiles, rejectedFiles) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const newErrors = rejectedFiles.map(({ file, errors }) => ({
        filename: file.name,
        message: errors.map(e => e.message).join(', ')
      }));
      setErrors(prev => [...prev, ...newErrors]);
    }

    // Handle accepted files
    if (acceptedFiles.length > 0) {
      setUploading(true);
      setErrors([]);

      for (const file of acceptedFiles) {
        await uploadFile(file);
      }

      setUploading(false);
      if (onUploadComplete) onUploadComplete();
    }
  }, [episodeId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: acceptedFormats,
    maxSize: 500 * 1024 * 1024, // 500MB max per file
    multiple: true
  });

  const uploadFile = async (file) => {
    const fileId = `${Date.now()}-${file.name}`;
    
    try {
      // Initialize progress
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 0, status: 'uploading' }
      }));

      // Upload using service
      const result = await footageService.uploadFootage(file, episodeId);

      // Update progress
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 100, status: 'complete' }
      }));

      // Add to uploaded files
      setUploadedFiles(prev => [...prev, {
        id: result.scene?.id || fileId,
        filename: file.name,
        size: file.size,
        s3_key: result.scene?.raw_footage_s3_key,
        duration: result.scene?.duration_seconds,
        status: 'complete'
      }]);

    } catch (error) {
      console.error('Upload error:', error);
      
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 0, status: 'error' }
      }));

      setErrors(prev => [...prev, {
        filename: file.name,
        message: error.response?.data?.message || error.message
      }]);
    }
  };

  const removeError = (index) => {
    setErrors(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
          isDragActive
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-300 hover:border-purple-400 hover:bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <FiUploadCloud className="mx-auto text-5xl text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium text-purple-600">Drop video files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium text-gray-700 mb-2">
              Drag & drop video files here
            </p>
            <p className="text-sm text-gray-500">
              or click to browse (MP4, MOV, AVI, WebM • Max 500MB per file)
            </p>
          </>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="space-y-2">
          {errors.map((error, idx) => (
            <div key={idx} className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start justify-between">
              <div className="flex items-start space-x-2">
                <FiAlertCircle className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">{error.filename}</p>
                  <p className="text-xs text-red-600">{error.message}</p>
                </div>
              </div>
              <button
                onClick={() => removeError(idx)}
                className="text-red-400 hover:text-red-600"
              >
                <FiX />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Progress */}
      {Object.keys(uploadProgress).length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">Uploading...</h4>
          {Object.entries(uploadProgress).map(([fileId, { progress, status }]) => (
            <div key={fileId} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700 truncate">
                  {fileId.split('-').slice(1).join('-')}
                </span>
                {status === 'uploading' && (
                  <FiLoader className="animate-spin text-purple-500" />
                )}
                {status === 'complete' && (
                  <FiCheckCircle className="text-green-500" />
                )}
                {status === 'error' && (
                  <FiAlertCircle className="text-red-500" />
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    status === 'complete' ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-gray-700">
            Uploaded Files ({uploadedFiles.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {uploadedFiles.map((file, idx) => (
              <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 flex items-center space-x-3">
                <FiVideo className="text-purple-500 text-2xl flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.filename}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(file.size)} • {formatDuration(file.duration)}
                  </p>
                </div>
                <FiCheckCircle className="text-green-500 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helper Text */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-700">
          <strong>💡 Tip:</strong> Name files like EPISODE-SCENE-TAKE-1.mp4 for automatic scene linking (e.g., EP01-INTRO-TAKE-1.mp4)
        </p>
      </div>
    </div>
  );
}

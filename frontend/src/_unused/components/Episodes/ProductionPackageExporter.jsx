import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Package, 
  Download, 
  Clock, 
  FileText, 
  Music, 
  Mouse, 
  Sparkles,
  CheckCircle,
  AlertCircle,
  Loader,
} from 'lucide-react';

const ProductionPackageExporter = ({ episodeId }) => {
  const [latestPackage, setLatestPackage] = useState(null);
  const [packageHistory, setPackageHistory] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPackageData();
  }, [episodeId]);

  const fetchPackageData = async () => {
    try {
      setLoading(true);

      // Fetch latest package
      try {
        const latestRes = await axios.get(`/api/v1/episodes/${episodeId}/production-package/latest`);
        setLatestPackage(latestRes.data.data);
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error('Error fetching latest package:', error);
        }
        setLatestPackage(null);
      }

      // Fetch package history
      const historyRes = await axios.get(`/api/v1/episodes/${episodeId}/production-package/versions`);
      setPackageHistory(historyRes.data.data || []);

    } catch (error) {
      console.error('Error fetching package data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePackage = async () => {
    if (!confirm('Generate complete production package? This will bundle all approved cues, scripts, and metadata into a downloadable ZIP file.')) {
      return;
    }

    try {
      setGenerating(true);

      const response = await axios.post(`/api/v1/episodes/${episodeId}/production-package/generate`);
      
      const newPackage = response.data.data;
      setLatestPackage(newPackage);

      // Refresh history
      await fetchPackageData();

      alert('Production package generated successfully!');

      // Auto-download
      if (newPackage.zip_file_s3_url) {
        window.open(newPackage.zip_file_s3_url, '_blank');
      }

    } catch (error) {
      console.error('Error generating package:', error);
      alert('Failed to generate production package: ' + (error.response?.data?.error?.message || error.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPackage = (packageId) => {
    window.open(`/api/v1/episodes/${episodeId}/production-package/${packageId}/download`, '_blank');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading package data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Generate New Package Section */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg border border-purple-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-purple-900 flex items-center mb-2">
              <Package className="w-5 h-5 mr-2" />
              Production Package Export
            </h3>
            <p className="text-sm text-purple-700 mb-4">
              Bundle all approved icon cues, cursor paths, music cues, scripts, and metadata into a single downloadable ZIP file for your editor.
            </p>

            <div className="bg-white p-4 rounded-md border border-purple-200 mb-4">
              <h4 className="font-medium text-sm text-gray-900 mb-2">Package Contents:</h4>
              <ul className="space-y-1 text-sm text-gray-700">
                <li className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-blue-500" />
                  Final script (Markdown + JSON)
                </li>
                <li className="flex items-center">
                  <Sparkles className="w-4 h-4 mr-2 text-yellow-500" />
                  Icon cues timeline (Markdown + JSON)
                </li>
                <li className="flex items-center">
                  <Mouse className="w-4 h-4 mr-2 text-green-500" />
                  Cursor action paths (JSON)
                </li>
                <li className="flex items-center">
                  <Music className="w-4 h-4 mr-2 text-purple-500" />
                  Music cue sheet (Markdown)
                </li>
                <li className="flex items-center">
                  <FileText className="w-4 h-4 mr-2 text-gray-500" />
                  Publishing metadata + README
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleGeneratePackage}
            disabled={generating}
            className={`ml-4 px-6 py-3 rounded-md font-medium flex items-center gap-2 ${
              generating
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {generating ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Package className="w-5 h-5" />
                Generate Package
              </>
            )}
          </button>
        </div>
      </div>

      {/* Latest Package Card */}
      {latestPackage && (
        <div className="bg-white p-6 rounded-lg shadow border-2 border-green-200">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-green-900">Latest Package</h3>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  {latestPackage.package_version}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Generated {formatDate(latestPackage.created_at)}
              </p>
            </div>

            <button
              onClick={() => handleDownloadPackage(latestPackage.id)}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download ZIP
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-600">File Size</div>
              <div className="font-medium">{formatFileSize(latestPackage.zip_file_size_bytes)}</div>
            </div>
            <div>
              <div className="text-gray-600">Generation Time</div>
              <div className="font-medium">{latestPackage.generation_duration_ms || 0}ms</div>
            </div>
            <div>
              <div className="text-gray-600">Generated By</div>
              <div className="font-medium">{latestPackage.generated_by || 'System'}</div>
            </div>
            <div>
              <div className="text-gray-600">Status</div>
              <div className="font-medium text-green-600">Ready</div>
            </div>
          </div>

          {/* Package Contents Preview */}
          {latestPackage.package_data && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Package Structure:</h4>
              <div className="bg-gray-50 p-3 rounded text-xs font-mono text-gray-700">
                <div>📁 EPISODE_{latestPackage.episode_id.substring(0, 8)}_PRODUCTION/</div>
                <div className="ml-4">📁 scripts/</div>
                <div className="ml-8">📄 final_script.md</div>
                <div className="ml-8">📄 final_script.json</div>
                <div className="ml-4">📁 cues/</div>
                <div className="ml-8">📄 icon_cues.md</div>
                <div className="ml-8">📄 icon_cues.json</div>
                <div className="ml-8">📄 cursor_paths.json</div>
                <div className="ml-8">📄 music_cues.md</div>
                <div className="ml-4">📁 metadata/</div>
                <div className="ml-8">📄 publishing_info.md</div>
                {latestPackage.state_tracker_json && (
                  <div className="ml-8">📄 state_tracker.json</div>
                )}
                <div className="ml-4">📄 README.md</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Package History */}
      {packageHistory.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-gray-600" />
            Package History ({packageHistory.length})
          </h3>

          <div className="space-y-3">
            {packageHistory.map((pkg) => (
              <div
                key={pkg.id}
                className={`p-4 rounded-md border ${
                  pkg.is_latest
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{pkg.package_version}</span>
                      {pkg.is_latest && (
                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(pkg.created_at)} • {formatFileSize(pkg.zip_file_size_bytes)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleDownloadPackage(pkg.id)}
                    className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Package Yet */}
      {!latestPackage && packageHistory.length === 0 && (
        <div className="bg-white p-12 rounded-lg shadow text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Production Packages Yet</h3>
          <p className="text-gray-600 mb-6">
            Generate your first production package to bundle all episode data for your editor.
          </p>
          <button
            onClick={handleGeneratePackage}
            disabled={generating}
            className="px-6 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 inline-flex items-center gap-2"
          >
            <Package className="w-5 h-5" />
            Generate First Package
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductionPackageExporter;

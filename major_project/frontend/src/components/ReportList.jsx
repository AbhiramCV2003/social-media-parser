// src/components/ReportList.jsx
import React, { useState, useEffect, useRef } from 'react'; // Add useRef
import axios from 'axios';
import './ReportList.css'; // Assuming you have this CSS file

const API_REPORTS_URL = 'http://localhost:5001/api/report'; // Adjust if different

function ReportList() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(null);
  const isPolling = useRef(false); // Ref to track polling status
  const pollInterval = useRef(null); // Ref to store interval ID

  // --- Function to Fetch Reports ---
  const fetchReports = async (isInitialLoad = false) => {
    // Log when fetch starts
    console.log(`ReportList: fetchReports called. isInitialLoad: ${isInitialLoad}, isPolling: ${isPolling.current}`);

    if (isInitialLoad) setLoading(true); // Show loading indicator only on the first load
    if (isInitialLoad) setError(''); // Clear error only on initial load

    try {
      console.log('ReportList: Fetching reports from', `${API_REPORTS_URL}/list`);
      // Axios should automatically send the Auth token if setupAxiosInterceptors was called
      const response = await axios.get(`${API_REPORTS_URL}/list`);
      const fetchedReports = response.data || [];

      // --- Log received data ---
      console.log('ReportList: Data received from backend:', JSON.stringify(fetchedReports, null, 2));
      // ----------------------------------

      setReports(fetchedReports); // Update component state with fetched reports

      // --- Polling Logic ---
      const stillProcessing = fetchedReports.some(
         report => report.status === 'Received' || report.status === 'Generating' || report.status === 'Processing'
      );

      // --- Log processing status check ---
      console.log(`ReportList: Checking for processing reports. Found processing: ${stillProcessing}`);
      // --------------------------------------

      if (stillProcessing && !isPolling.current) {
        // If reports are processing AND we aren't already polling, start polling
        console.log("ReportList: Starting polling interval (every 10s)...");
        isPolling.current = true;
        if (pollInterval.current) clearInterval(pollInterval.current); // Clear any previous interval
        pollInterval.current = setInterval(() => fetchReports(false), 10000); // Poll every 10 seconds
      } else if (!stillProcessing && isPolling.current) {
        // If no reports are processing AND we ARE currently polling, stop polling
        console.log("ReportList: All reports processed, stopping polling interval.");
        clearInterval(pollInterval.current);
        pollInterval.current = null;
        isPolling.current = false;
      }
      // --- End Polling Logic ---

    } catch (err) {
        console.error('Error fetching reports:', err);
        const message = err.response?.data?.message || err.message || 'Failed to fetch reports.';
        // Avoid setting generic error state if it's an auth error (handled by interceptor/redirect)
        if (err.response?.status !== 401) {
           setError(message);
        }
        // Stop polling on error too
        if (pollInterval.current) {
            console.log("ReportList: Stopping polling due to fetch error.");
            clearInterval(pollInterval.current);
            pollInterval.current = null;
            isPolling.current = false;
        }
    } finally {
      // Only stop the main initial loading indicator
      if (isInitialLoad) setLoading(false);
    }
  };

  // --- Effect for Initial Fetch and Cleanup ---
  useEffect(() => {
    console.log("ReportList: Component mounted, initial fetch executing.");
    fetchReports(true); // Perform initial fetch when component mounts

    // Cleanup function: runs when the component unmounts
    return () => {
      if (pollInterval.current) {
         console.log("ReportList: Cleaning up polling interval on unmount.");
         clearInterval(pollInterval.current); // Clear interval to prevent memory leaks
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  // --- Download Handler ---
  const handleDownload = async (reportId) => {
    if (downloading === reportId) return; // Prevent double clicks
    setDownloading(reportId);
    setError(''); // Clear previous errors
    console.log(`ReportList: Requesting download URL for report ${reportId}`);
    try {
      // Axios should automatically send Auth token
      const response = await axios.get(`${API_REPORTS_URL}/${reportId}/download`);
      if (response.data?.downloadUrl) {
        console.log(`ReportList: Received download URL: ${response.data.downloadUrl}`);
        // Trigger download
        window.location.href = response.data.downloadUrl;
      } else {
         throw new Error('Download URL not found in backend response.');
      }
    } catch (err) {
       console.error(`Error downloading report ${reportId}:`, err);
       const message = err.response?.data?.message || err.message || 'Failed to get download link.';
       setError(`Download failed for report ${reportId}: ${message}`);
    } finally {
        setDownloading(null); // Clear loading state for button
    }
  };

  // --- Render Logic ---
  // Log state just before rendering
  console.log("ReportList: Rendering component. Current reports state count:", reports.length);

  if (loading) {
    return <p>Loading reports...</p>;
  }

  return (
    <div className="report-list-container">
      {/* Error display */}
      {error && <p className="error-message">Error: {error}</p>}
      {/* Message if no reports */}
      {reports.length === 0 && !error && <p>No reports generated yet.</p>}
      {/* Report Table */}
      {reports.length > 0 && (
        <table className="report-table">
          <thead>
            <tr>
              <th>Report ID</th>
              <th>Platform</th>
              <th>Target</th>
              <th>Created</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report._id}>
                <td><code>{report._id}</code></td>
                <td>{report.platform}</td>
                <td>{report.targetIdentifier}</td>
                <td>{new Date(report.createdAt).toLocaleString()}</td>
                <td>
                  {/* Status Badge */}
                  <span className={`status-badge status-${report.status?.toLowerCase() || 'unknown'}`}>
                    {report.status || 'Unknown'}
                  </span>
                  {/* Error Tooltip */}
                  {report.status === 'Failed' && report.errorMessage && (
                    <span className="error-tooltip" title={report.errorMessage}> ⚠️</span>
                  )}
                </td>
                <td>
                  {/* Download Button */}
                  {report.status === 'Completed' ? (
                    <button
                       onClick={() => handleDownload(report._id)}
                       disabled={downloading === report._id} // Disable only the specific button being clicked
                       className="download-button"
                    >
                      {downloading === report._id ? '...' : 'Download'}
                    </button>
                  ) : (
                    // Placeholder if not completed
                    <span className="status-note">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ReportList;
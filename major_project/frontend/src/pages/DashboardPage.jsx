// src/pages/DashboardPage.jsx
import React from 'react';
import ReportList from '../components/ReportList'; // <-- IMPORT
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Needed to clear default header on logout

function DashboardPage() {
  const navigate = useNavigate();
  const username = localStorage.getItem('username') || 'Examiner'; // Get username if stored

  const handleLogout = () => {
     console.log("Logging out...");
     // Clear stored auth data
     localStorage.removeItem('authToken');
     localStorage.removeItem('username');
     // Clear default axios header
     delete axios.defaults.headers.common['Authorization'];
     // Redirect to login
     navigate('/login');
  };

  return (
    // Use the auth-page class for consistent background/text color
    <div className="auth-page dashboard-page"> {/* Add dashboard-page class if needed for specific styles */}
      <h1>Dashboard</h1>
      <p>Welcome, {username}!</p>
      <button onClick={handleLogout} style={{marginBottom: '20px', padding: '5px 10px'}}>Logout</button>

      <h2>Generated Reports</h2>
      <ReportList /> {/* <-- USE ReportList Component */}
     </div>
   );
}
export default DashboardPage;
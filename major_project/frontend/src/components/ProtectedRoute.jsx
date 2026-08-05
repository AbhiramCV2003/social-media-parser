import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

// This component wraps routes that require authentication
function ProtectedRoute({ children }) {
  // Get the token from local storage
  const token = localStorage.getItem('authToken');
  // Get the current location to redirect back after login (optional)
  const location = useLocation();

  // Check if the token exists and is considered valid (basic check here)
  // In a real app, you might also decode the JWT to check expiration
  const isAuthenticated = !!token; // Simple check: is token present?

  if (!isAuthenticated) {
    // If not authenticated, redirect to the login page
    // We pass the current location in state so the login page can potentially
    // redirect back to the originally requested page after successful login.
    console.log('ProtectedRoute: Not authenticated, redirecting to login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
    // 'replace' prevents the protected route from being added to the browser history
  }

  // If authenticated, render the child components passed to this route
  // (e.g., the <DashboardPage /> component)
  return children;
}

export default ProtectedRoute;
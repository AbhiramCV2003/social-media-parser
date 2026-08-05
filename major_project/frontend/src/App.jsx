// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/ProtectedRoute'; // <-- IMPORT
import './App.css';

function App() {
  // Basic check for initial redirect logic (can be refined)
  const isLoggedIn = !!localStorage.getItem('authToken');

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Route for Dashboard */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute> {/* <-- WRAP with ProtectedRoute */}
                <DashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Default route */}
          {/* If logged in, go to dashboard, else go to login */}
          <Route
            path="*"
            element={<Navigate to={isLoggedIn ? "/dashboard" : "/login"} replace />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
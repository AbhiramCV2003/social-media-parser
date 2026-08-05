// src/components/AuthForm.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AuthForm.css'
// Define your backend base URL - ideally from an environment variable
const API_BASE_URL = 'http://localhost:5001/api/auth'; // Use your backend auth route base

function AuthForm({ isLogin }) {
  const [username, setUsername] = useState(''); // Or email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/login' : '/register';
    const payload = { username, password }; // Match backend expectations (username or email)

    try {
      const response = await axios.post(`${API_BASE_URL}${endpoint}`, payload);

      console.log(`${isLogin ? 'Login' : 'Register'} successful:`, response.data);

      if (isLogin && response.data.token) {
        // Login successful - Store token and redirect
        localStorage.setItem('authToken', response.data.token); // Store the token
        localStorage.setItem('username', response.data.username); // Optional: store username
        console.log('AuthForm: BEFORE setting Axios default header. Current default:', axios.defaults.headers.common['Authorization']); // Log before
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
        console.log('AuthForm: AFTER setting Axios default header. New default:', axios.defaults.headers.common['Authorization']);
        window.location.href = '/dashboard'; // Redirect to dashboard
      } else if (!isLogin) {
        // Registration successful - maybe auto-login or redirect to login page
        alert('Registration successful! Please log in.'); // Simple feedback
        navigate('/login');
      } else {
         // Handle unexpected success response format
         setError('Unexpected response from server.');
      }

    } catch (err) {
      console.error(`Error during ${isLogin ? 'login' : 'register'}:`, err);
      const message = err.response?.data?.message || err.message || 'An error occurred.';
      setError(message); // Show error message from backend or generic one
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <p className='error-message'>Error: {error}</p>}
      <div>
        <label htmlFor="username">Username:</label> {/* Or Email */}
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete={isLogin ? "username" : "username"}
        />
      </div>
      <div>
        <label htmlFor="password">Password:</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete={isLogin ? "current-password" : "new-password"}
        />
      </div>
      <button type="submit" disabled={loading}>
        {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
      </button>
    </form>
  );
}

export default AuthForm;
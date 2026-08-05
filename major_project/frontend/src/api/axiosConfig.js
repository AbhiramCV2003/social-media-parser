// src/api/axiosConfig.js
import axios from 'axios';

const setupAxiosInterceptors = () => {
  const token = localStorage.getItem('authToken');
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    console.log('Axios default Authorization header set.');
  } else {
     delete axios.defaults.headers.common['Authorization'];
     console.log('Axios default Authorization header removed.');
  }

  // Optional: Add interceptors to handle token expiration or global errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
         // Handle unauthorized errors, e.g., token expired
         console.error("Unauthorized request - logging out.");
         localStorage.removeItem('authToken');
         localStorage.removeItem('username');
         delete axios.defaults.headers.common['Authorization'];
         // Redirect to login, maybe with a message
         window.location.href = '/login?sessionExpired=true';
      }
      return Promise.reject(error);
    }
  );
};

export default setupAxiosInterceptors;
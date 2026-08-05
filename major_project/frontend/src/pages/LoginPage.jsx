// src/pages/LoginPage.jsx
import React from 'react';
import AuthForm from '../components/AuthForm'; // <-- MAKE SURE THIS IMPORT IS PRESENT & UNCOMMENTED

function LoginPage() {
  return (
    <div className='auth-page'>
      <h1>Investigator Login</h1>
      {/* <p>Login form will go here.</p> */} {/* Optional: Remove or keep placeholder text */}
      <AuthForm isLogin={true} /> {/* <-- MAKE SURE THIS COMPONENT IS USED */}
      <p>Don't have an account? <a href="/register">Register here</a></p>
    </div>
  );
}
export default LoginPage;
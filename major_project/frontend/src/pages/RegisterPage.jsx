// src/pages/RegisterPage.jsx
import React from 'react';
import AuthForm from '../components/AuthForm'; // <-- MAKE SURE THIS IMPORT IS PRESENT & UNCOMMENTED

function RegisterPage() {
   return (
    <div className='auth-page'>
      <h1>Investigator Registration</h1>
       {/* <p>Registration form will go here.</p> */} {/* Optional: Remove or keep placeholder text */}
       <AuthForm isLogin={false} /> {/* <-- MAKE SURE THIS COMPONENT IS USED */}
       <p>Already have an account? <a href="/login">Login here</a></p>
     </div>
   );
}
export default RegisterPage;
import { useRef, useState } from 'react';
import { Navigate, useNavigate, useLocation } from 'react-router-dom';
import { studentReturnFromSearch } from '../utils/studyNavigation';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import { needsProfileSetup } from '../utils/profileSetup';
import Alert from '../components/common/Alert';
export default function OnboardingPage() {
  const { user, refreshUser } = useAuth(); const navigate = useNavigate(); const { search } = useLocation();
  const [saving,setSaving]=useState(false); const [error,setError]=useState(''); const pending=useRef(false);
  const destination=studentReturnFromSearch(search);
  if (!needsProfileSetup(user)) return <Navigate to={destination || '/dashboard'} replace/>;
  const finish=async target=>{
    if(pending.current)return;pending.current=true;setSaving(true);setError('');
    try{await userService.finishOnboarding();await refreshUser();navigate(target,{replace:true});}
    catch(failure){setError(failure.message || 'Setup could not be saved. Try again.');}
    finally{pending.current=false;setSaving(false);}
  };
  return <section className="container-narrow onboarding"><span className="auth-form-eyebrow">A place for your learning</span><h1>Welcome to Acadova</h1><p>Start with your academic year, semester and subjects. Add learning materials when you are ready.</p><div className="card"><h2>Make it your workspace</h2><p>My Subjects keeps your terms, modules and resources private by default. You can manage each academic year independently.</p><p>Teaching skills and availability are optional. Add them later in Profile if you want to offer peer help.</p>{error&&<Alert type="danger" message={error}/>}<div className="onboarding-actions"><button className="btn btn-primary" disabled={saving} onClick={()=>finish(destination || '/subjects')}>{saving?'Saving...':destination?'Continue to your learning':'Set up my subjects'}</button><button className="btn btn-secondary" disabled={saving} onClick={()=>finish(destination || '/dashboard')}>Skip for now</button></div></div></section>;
}

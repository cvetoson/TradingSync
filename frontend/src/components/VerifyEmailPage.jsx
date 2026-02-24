import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import AuthCard from './AuthCard';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setError('Missing verification token');
      return;
    }

    api
      .verifyEmail(token)
      .then((res) => {
        login(res.token, res.user);
        setStatus('success');
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'Verification failed');
      });
  }, [searchParams, login, navigate]);

  if (status === 'verifying') {
    return (
      <AuthCard subtitle="Verifying your email...">
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white" />
        </div>
      </AuthCard>
    );
  }

  if (status === 'error') {
    return (
      <AuthCard subtitle="Verification failed">
        <div className="bg-red-500/20 border border-red-400/50 text-red-100 px-4 py-2 rounded-lg text-sm mb-4">
          {error}
        </div>
        <a
          href="/"
          className="block w-full text-center py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white transition"
        >
          Back to sign in
        </a>
      </AuthCard>
    );
  }

  return null;
}

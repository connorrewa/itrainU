'use client';
import { useUser } from '@auth0/nextjs-auth0/client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/');
    }
  }, [user, isLoading, router]);

  const handleLogin = () => {
    window.location.href = '/api/auth/login';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-[#A31B4B] to-[#8F153F] text-white text-2xl font-semibold">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#A31B4B] to-[#8F153F]">
      <div className="p-10 bg-white rounded-lg shadow-lg max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-[#A31B4B] rounded-full flex items-center justify-center">
            <img src="./logo.png" alt="logo" className="h-[100px] rounded-full" />
          </div>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-800 mb-4">Welcome to itrainU</h1>
        <p className="text-gray-600 mb-6">Sign in to access your personalized training dashboard.</p>
        <button
          onClick={handleLogin}
          className="w-full px-6 py-3 text-white bg-[#A31B4B] rounded-lg hover:bg-[#8F153F] transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-[#A31B4B] focus:ring-opacity-50"
        >
          Login with Auth0
        </button>
      </div>
    </div>
  );
}

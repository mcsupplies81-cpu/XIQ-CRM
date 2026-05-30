import { supabase } from '../supabase';

export default function LoginPage() {
  const handleSignIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <button
        type="button"
        onClick={handleSignIn}
        className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-900"
      >
        Sign in with Google
      </button>
    </div>
  );
}

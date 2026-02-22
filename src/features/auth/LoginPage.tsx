import { useMsal } from '@azure/msal-react';
import { loginRequest } from '@/auth/msalConfig';
import { BookOpen } from 'lucide-react';
import SakuraParticles from '@/components/anime/SakuraParticles';
import SparkleEffect from '@/components/anime/SparkleEffect';
import Button from '@/components/ui/Button';

export default function LoginPage() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((error) => {
      console.error('Login failed:', error);
    });
  };

  return (
    <div className="relative min-h-screen bookshop-bg flex items-center justify-center">
      <SakuraParticles />

      <div className="relative z-10 flex flex-col items-center gap-8 px-6">
        {/* Logo and title */}
        <div className="text-center">
          <SparkleEffect>
            <div className="flex items-center justify-center gap-3 mb-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              <h1 className="font-heading text-4xl text-primary">Lofi Books</h1>
            </div>
          </SparkleEffect>
          <p className="text-secondary font-medium">Your Cozy Story Studio</p>
          <p className="text-xs mt-1 opacity-40 font-handwriting text-lg">
            &#9749; chill vibes, great stories
          </p>
        </div>

        {/* Login card */}
        <div className="bg-surface rounded-2xl shadow-xl border-2 border-primary/20 p-8 w-full max-w-sm">
          <h2 className="font-heading text-xl text-indigo text-center mb-2">
            Welcome Back!
          </h2>
          <p className="text-indigo/50 text-sm text-center mb-6">
            Sign in with your Microsoft account to start writing
          </p>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleLogin}
          >
            Sign in with Microsoft
          </Button>

          <p className="text-indigo/30 text-xs text-center mt-4">
            Your stories are backed up to OneDrive automatically
          </p>
        </div>
      </div>
    </div>
  );
}

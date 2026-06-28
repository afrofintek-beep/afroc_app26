/**
 * Deep Link Landing Page
 * 
 * Handles web fallback for afroloc:// deep links.
 * Routes: /dl/address/:code, /dl/checkin/:id, /dl/verify/:code, /dl/qr/:code
 */

import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function DeepLinkRedirect() {
  const { action, code } = useParams<{ action: string; code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!action || !code) {
      navigate('/landing', { replace: true });
      return;
    }

    switch (action) {
      case 'address':
      case 'qr':
        navigate(`/identity/${code}`, { replace: true });
        break;
      case 'checkin':
        navigate(`/identity/${code}?action=checkin`, { replace: true });
        break;
      case 'verify':
        navigate(`/identity/${code}?action=verify`, { replace: true });
        break;
      default:
        navigate('/landing', { replace: true });
    }
  }, [action, code, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">A redirecionar...</p>
      </div>
    </div>
  );
}

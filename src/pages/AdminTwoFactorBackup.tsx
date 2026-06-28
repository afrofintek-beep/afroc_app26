import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowLeft, AlertTriangle } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import afrolocSymbol from "@/assets/afroloc-symbol.png";

export default function AdminTwoFactorBackup() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const userId = location.state?.userId;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("verify-backup-code", {
        body: { userId, code: code.trim() },
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Backup Code Verified",
          description: `Welcome back! You have ${data.remainingCodes} backup code${data.remainingCodes !== 1 ? 's' : ''} remaining.`,
        });
        
        if (data.remainingCodes <= 2) {
          toast({
            title: "Low Backup Codes",
            description: "Consider generating new backup codes soon.",
            variant: "destructive",
          });
        }
        
        navigate("/admin/import-divisions");
      } else {
        throw new Error(data.error || "Verification failed");
      }
    } catch (error: any) {
      toast({
        title: "Verification Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/10 to-muted/30 p-4">
      <div className="absolute top-4 left-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/2fa", { state: location.state })}
          title="Back to 2FA"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <Card className="w-full max-w-md border-primary/20 shadow-lg">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <img src={afrolocSymbol} alt="AFROLOC" className="h-14 w-14 object-cover rounded-xl shadow-md ring-1 ring-primary/20" />
              <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-1.5">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Use Backup Code</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter one of your recovery backup codes
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleVerify}>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-md p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-200">
                  <p className="font-semibold mb-1">One-Time Use</p>
                  <p>Each backup code can only be used once. After using a code, consider generating new backup codes.</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="backup-code">Backup Code</Label>
              <Input
                id="backup-code"
                type="text"
                placeholder="XXXX-XXXX"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                required
                maxLength={9}
                className="text-center text-xl tracking-widest font-mono"
                autoComplete="off"
                autoFocus
              />
              <p className="text-xs text-muted-foreground text-center">
                Format: XXXX-XXXX (8 characters)
              </p>
            </div>

            <div className="text-center text-sm">
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/admin/2fa", { state: location.state })}
                className="text-primary"
              >
                Back to verification code
              </Button>
            </div>
          </CardContent>

          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || code.length < 8}
            >
              {loading ? 'Verifying...' : 'Verify Backup Code'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, LogIn, ArrowLeft } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import afrolocSymbol from "@/assets/afroloc-symbol.png";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Check if user has any admin role (admin, admin_national, admin_province, admin_municipality)
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authData.user.id);

      const adminRoles = ['admin', 'admin_national', 'admin_province', 'admin_municipality'];
      const hasAdminRole = roleData?.some(r => adminRoles.includes(r.role));

      if (roleError || !hasAdminRole) {
        // Sign out the user if they're not an admin
        await supabase.auth.signOut();
        throw new Error('Access denied. Administrator privileges required.');
      }

      // Get user profile for 2FA preferences
      const { data: profileData } = await supabase
        .from('profiles')
        .select('two_factor_enabled, two_factor_method, phone')
        .eq('user_id', authData.user.id)
        .single();

      // If 2FA is enabled, send code and redirect to verification
      if (profileData?.two_factor_enabled) {
        const method = profileData.two_factor_method || 'email';
        
        // Send 2FA code
        const { error: sendError } = await supabase.functions.invoke('send-admin-2fa', {
          body: {
            userId: authData.user.id,
            method,
            email: method === 'email' ? authData.user.email : undefined,
            phone: method === 'sms' ? profileData.phone : undefined,
          },
        });

        if (sendError) throw sendError;

        toast({
          title: 'Verification Code Sent',
          description: `A verification code has been sent to your ${method}`,
        });

        // Navigate to 2FA verification page
        navigate('/admin/2fa', {
          state: {
            userId: authData.user.id,
            email: authData.user.email,
            phone: profileData.phone,
            method,
          },
        });
      } else {
        // No 2FA, proceed directly
        toast({
          title: 'Access Granted',
          description: 'Welcome to the administrative dashboard',
        });
        navigate("/admin/import-divisions");
      }
    } catch (error: any) {
      toast({
        title: 'Authentication Failed',
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
          onClick={() => navigate("/")}
          title="Back"
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
          <CardTitle className="text-2xl font-bold">Administrator Access</CardTitle>
          <CardDescription className="text-muted-foreground">
            Restricted area - authorized personnel only
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleAdminLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@afroloc.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="admin-password">Password</Label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            
            <div className="bg-muted/50 border border-border rounded-md p-3 text-xs text-muted-foreground">
              <p className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                This login portal is for system administrators only. All access attempts are logged and monitored.
              </p>
            </div>
          </CardContent>
          
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={loading}>
              <LogIn className="mr-2 h-4 w-4" />
              {loading ? 'Verifying credentials...' : 'Sign In as Administrator'}
            </Button>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Not an administrator?{" "}
                <Link to="/login" className="text-primary hover:underline">
                  Regular user login
                </Link>
              </p>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

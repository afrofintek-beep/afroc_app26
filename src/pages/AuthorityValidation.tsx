import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Shield, Send } from "lucide-react";
import { LevelGate } from "@/components/LevelGate";
import type { Database } from "@/integrations/supabase/types";

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

const validationSchema = z.object({
  validation_method: z.string().min(1, "Validation method is required"),
  authority_role: z.string().min(1, "Authority role is required"),
  authority_signature: z.string().min(3, "Signature must be at least 3 characters"),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
});

const VALIDATION_METHODS = [
  { value: "in_person", label: "In-Person Verification" },
  { value: "document_review", label: "Document Review" },
  { value: "site_visit", label: "Site Visit" },
  { value: "database_check", label: "Database Cross-Check" },
];

const AUTHORITY_ROLES = [
  { value: "municipal_officer", label: "Municipal Officer" },
  { value: "police_officer", label: "Police Officer" },
  { value: "community_leader", label: "Community Leader" },
  { value: "notary_public", label: "Notary Public" },
  { value: "government_official", label: "Government Official" },
];

export default function AuthorityValidation() {
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<AfrolocRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [validationMethod, setValidationMethod] = useState("");
  const [authorityRole, setAuthorityRole] = useState("");
  const [authoritySignature, setAuthoritySignature] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadRecord();
  }, [id]);

  const loadRecord = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("afroloc_records")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setRecord(data);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const validateForm = () => {
    try {
      validationSchema.parse({
        validation_method: validationMethod,
        authority_role: authorityRole,
        authority_signature: authoritySignature,
        notes,
      });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path[0]) {
            newErrors[issue.path[0] as string] = issue.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Create validation record
      const { error: validationError } = await supabase
        .from("afroloc_validations")
        .insert({
          afroloc_record_id: id!,
          validation_method: validationMethod,
          authority_role: authorityRole,
          authority_signature: authoritySignature,
          notes: notes || null,
          verified_at: new Date().toISOString(),
        });

      if (validationError) throw validationError;

      // Update record status to verified
      const { error: updateError } = await supabase
        .from("afroloc_records")
        .update({
          status: "verified",
          approved_at: new Date().toISOString(),
          approved_by_user_id: user.id,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Authority validation completed successfully",
      });

      navigate(`/identity/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!record) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/identity/${id}/verify`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-foreground">Authority Validation</h1>
                <p className="text-muted-foreground">Official validation for {record.code}</p>
              </div>
            </div>

            <LevelGate requiredLevel={2}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Validation Details
                  </CardTitle>
                  <CardDescription>
                    Provide official validation details to verify this identity
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="validation_method">
                        Validation Method <span className="text-destructive">*</span>
                      </Label>
                      <Select value={validationMethod} onValueChange={setValidationMethod}>
                        <SelectTrigger className={errors.validation_method ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select validation method" />
                        </SelectTrigger>
                        <SelectContent>
                          {VALIDATION_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.validation_method && (
                        <p className="text-sm text-destructive">{errors.validation_method}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authority_role">
                        Your Authority Role <span className="text-destructive">*</span>
                      </Label>
                      <Select value={authorityRole} onValueChange={setAuthorityRole}>
                        <SelectTrigger className={errors.authority_role ? "border-destructive" : ""}>
                          <SelectValue placeholder="Select your role" />
                        </SelectTrigger>
                        <SelectContent>
                          {AUTHORITY_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.authority_role && (
                        <p className="text-sm text-destructive">{errors.authority_role}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="authority_signature">
                        Digital Signature <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="authority_signature"
                        value={authoritySignature}
                        onChange={(e) => {
                          setAuthoritySignature(e.target.value);
                          setErrors({});
                        }}
                        placeholder="Enter your official signature or ID"
                        className={errors.authority_signature ? "border-destructive" : ""}
                      />
                      {errors.authority_signature && (
                        <p className="text-sm text-destructive">{errors.authority_signature}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        This will be recorded as the official validator signature
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes (Optional)</Label>
                      <Textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => {
                          setNotes(e.target.value);
                          setErrors({});
                        }}
                        placeholder="Additional validation notes or observations"
                        rows={4}
                        className={errors.notes ? "border-destructive" : ""}
                        maxLength={500}
                      />
                      {errors.notes && (
                        <p className="text-sm text-destructive">{errors.notes}</p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {notes.length}/500 characters
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-muted/50 p-4">
                      <h3 className="font-semibold mb-2">Validation Requirements:</h3>
                      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                        <li>You must be a verified authority (Level 2+)</li>
                        <li>The identity must have completed community verification</li>
                        <li>Your signature will be permanently recorded</li>
                        <li>This action will change the identity status to "verified"</li>
                      </ul>
                    </div>

                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => navigate(`/identity/${id}/verify`)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={loading} className="flex-1">
                        <Send className="mr-2 h-4 w-4" />
                        {loading ? "Validating..." : "Submit Validation"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </LevelGate>
          </div>
        </main>
      </DashboardLayout>
  );
}

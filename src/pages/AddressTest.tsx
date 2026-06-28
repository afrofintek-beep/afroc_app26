/**
 * Address Test Page - AFROLOC Address Core Testing UI
 * Copyright © 2025 AFROFINTEK GmbH. All rights reserved.
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle2, FileText, Loader2, Sparkles, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const COUNTRIES = [
  { code: "AO", name: "Angola" },
  { code: "NA", name: "Namíbia" },
  { code: "ZA", name: "África do Sul" },
  { code: "PT", name: "Portugal" },
];

interface Address {
  address_id?: string;
  country_code?: string;
  administrative_area?: string;
  locality?: string;
  dependent_locality?: string;
  thoroughfare_name?: string;
  thoroughfare_type?: string;
  thoroughfare_type_abbrev?: string;
  premise_number?: string;
  building_name?: string;
  sub_premise_type?: string;
  sub_premise_id?: string;
  post_code?: string;
  display?: string;
  label?: string;
  raw_input?: string;
}

interface NormalizationChange {
  field: string;
  original: string;
  normalized: string;
  rule: string;
}

interface ValidationError {
  code: string;
  field: string;
  message: string;
}

interface ValidationWarning {
  code: string;
  field: string;
  message: string;
}

type ResultType = "normalize" | "validate" | "format" | null;

interface TestResult {
  type: ResultType;
  address?: Address;
  changes?: NormalizationChange[];
  valid?: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
  lines?: string[];
  country?: string;
  template_id?: string;
}

export default function AddressTest() {
  const [country, setCountry] = useState<string>("AO");
  const [rawAddress, setRawAddress] = useState<string>("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleNormalize = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("normalize", {
        body: {
          country_code: country,
          input: rawAddress,
        },
      });

      if (error) {
        toast({
          title: "Erro na normalização",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setResult({
        type: "normalize",
        address: data.address,
        changes: data.changes,
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao chamar a função de normalização",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async () => {
    setIsProcessing(true);
    try {
      // First normalize to get an address object
      const { data: normalizeData, error: normalizeError } = await supabase.functions.invoke("normalize", {
        body: {
          country_code: country,
          input: rawAddress,
        },
      });

      if (normalizeError) {
        toast({
          title: "Erro na normalização",
          description: normalizeError.message,
          variant: "destructive",
        });
        return;
      }

      // Then validate the normalized address
      const { data, error } = await supabase.functions.invoke("validate", {
        body: normalizeData.address,
      });

      if (error) {
        toast({
          title: "Erro na validação",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setResult({
        type: "validate",
        address: normalizeData.address,
        valid: data.valid,
        errors: data.errors,
        warnings: data.warnings,
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao chamar a função de validação",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFormat = async () => {
    setIsProcessing(true);
    try {
      // First normalize to get an address object
      const { data: normalizeData, error: normalizeError } = await supabase.functions.invoke("normalize", {
        body: {
          country_code: country,
          input: rawAddress,
        },
      });

      if (normalizeError) {
        toast({
          title: "Erro na normalização",
          description: normalizeError.message,
          variant: "destructive",
        });
        return;
      }

      // Then format the normalized address
      const { data, error } = await supabase.functions.invoke("format", {
        body: {
          address: normalizeData.address,
          country: country,
        },
      });

      if (error) {
        toast({
          title: "Erro na formatação",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setResult({
        type: "format",
        address: normalizeData.address,
        lines: data.lines,
        country: data.country,
        template_id: data.template_id,
      });
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao chamar a função de formatação",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Address Test</h1>
          <p className="text-muted-foreground">
            Testar o módulo AFROLOC Address Core: normalização, validação e formatação via Edge Functions.
          </p>
        </div>

        {/* Input Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Entrada
            </CardTitle>
            <CardDescription>
              Introduza um endereço para testar as funções do Address Core.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Country Select */}
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger id="country" className="w-full md:w-[280px] bg-background">
                  <SelectValue placeholder="Selecione o país" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {c.code}
                        </Badge>
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Address Textarea */}
            <div className="space-y-2">
              <Label htmlFor="address">Endereço livre</Label>
              <Textarea
                id="address"
                placeholder="Ex: Avenida 4 de Fevereiro, 123, Apartamento 5B, Ingombota, Luanda"
                value={rawAddress}
                onChange={(e) => setRawAddress(e.target.value)}
                className="min-h-[100px] resize-y"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={handleNormalize}
                disabled={!rawAddress.trim() || isProcessing}
                className="gap-2"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Normalizar
              </Button>
              <Button
                onClick={handleValidate}
                disabled={!rawAddress.trim() || isProcessing}
                variant="secondary"
                className="gap-2"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Validar
              </Button>
              <Button
                onClick={handleFormat}
                disabled={!rawAddress.trim() || isProcessing}
                variant="outline"
                className="gap-2"
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
                Formatar etiqueta
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Card */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Resultado
                <Badge variant={result.type === "validate" && result.valid ? "default" : "secondary"}>
                  {result.type === "normalize" && "Normalização"}
                  {result.type === "validate" && "Validação"}
                  {result.type === "format" && "Formatação"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Errors & Warnings (Validate) */}
              {result.type === "validate" && (
                <div className="space-y-3">
                  <h4 className="font-medium">Status</h4>
                  <div className="flex items-center gap-2">
                    {result.valid ? (
                      <>
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                        <span className="text-green-600 dark:text-green-400">
                          Endereço válido
                        </span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-5 w-5 text-destructive" />
                        <span className="text-destructive">
                          Endereço inválido
                        </span>
                      </>
                    )}
                  </div>

                  {result.errors && result.errors.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-destructive">Erros</h5>
                      <ul className="space-y-1">
                        {result.errors.map((err, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <span>
                              <code className="text-xs bg-muted px-1 rounded">{err.code}</code>{" "}
                              <span className="text-muted-foreground">[{err.field}]</span>{" "}
                              {err.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.warnings && result.warnings.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-yellow-600 dark:text-yellow-500">Avisos</h5>
                      <ul className="space-y-1">
                        {result.warnings.map((warn, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                            <span>
                              <code className="text-xs bg-muted px-1 rounded">{warn.code}</code>{" "}
                              <span className="text-muted-foreground">[{warn.field}]</span>{" "}
                              {warn.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Format Preview */}
              {result.type === "format" && result.lines && (
                <div className="space-y-3">
                  <h4 className="font-medium">Preview da Etiqueta Postal</h4>
                  <div className="border rounded-lg p-4 bg-muted/30 font-mono text-sm uppercase">
                    {result.lines.map((line, i) => (
                      <div key={i} className="leading-relaxed">
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>País: <code>{result.country}</code></span>
                    <span>Template: <code>{result.template_id}</code></span>
                  </div>
                </div>
              )}

              {/* Normalization Changes */}
              {result.type === "normalize" && result.changes && result.changes.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Alterações Aplicadas</h4>
                  <ul className="space-y-1 text-sm">
                    {result.changes.map((change, i) => (
                      <li key={i} className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-xs">
                          {change.field}
                        </Badge>
                        <span className="line-through text-muted-foreground">{change.original}</span>
                        <span>→</span>
                        <span className="font-medium">{change.normalized}</span>
                        <span className="text-xs text-muted-foreground">({change.rule})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.type === "normalize" && (!result.changes || result.changes.length === 0) && (
                <div className="text-sm text-muted-foreground">
                  Nenhuma alteração de normalização aplicada.
                </div>
              )}

              {/* Display/Label Preview for Normalize */}
              {result.type === "normalize" && result.address && (
                <div className="space-y-3">
                  <h4 className="font-medium">Preview</h4>
                  <div className="space-y-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Display:</span>
                      <div className="border rounded-lg p-3 bg-muted/30 text-sm">
                        {result.address.display || "-"}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Label (uppercase):</span>
                      <div className="border rounded-lg p-3 bg-muted/30 font-mono text-sm uppercase">
                        {result.address.label || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* JSON Output */}
              <div className="space-y-3">
                <h4 className="font-medium">JSON do Address Canónico</h4>
                <ScrollArea className="h-[200px] w-full rounded-md border">
                  <pre className="p-4 text-xs font-mono">
                    {JSON.stringify(result.address, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}

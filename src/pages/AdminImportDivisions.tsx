import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, ArrowLeft } from 'lucide-react';

interface DivisionRow {
  country_code: string;
  level: number;
  code: string;
  name: string;
  parent_code?: string;
  parent_level?: number;
  metadata?: any;
  errors?: string[];
}

export default function AdminImportDivisions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<DivisionRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importStats, setImportStats] = useState({ success: 0, failed: 0, skipped: 0 });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setData([]);
    setValidationErrors([]);
    setImportComplete(false);

    const fileExtension = selectedFile.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'csv') {
      parseCSV(selectedFile);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      parseExcel(selectedFile);
    } else {
      toast({
        title: 'Invalid File Format',
        description: 'Please upload a CSV or Excel file',
        variant: 'destructive',
      });
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        processData(results.data as any[]);
      },
      error: (error) => {
        toast({
          title: 'Parse Error',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  };

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        processData(jsonData);
      } catch (error) {
        toast({
          title: 'Parse Error',
          description: 'Failed to parse Excel file',
          variant: 'destructive',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processData = (rawData: any[]) => {
    const errors: string[] = [];
    const processed: DivisionRow[] = rawData.map((row, index) => {
      const rowErrors: string[] = [];
      
      // Validate required fields
      if (!row.country_code) rowErrors.push('Missing country_code');
      if (!row.level) rowErrors.push('Missing level');
      if (!row.code) rowErrors.push('Missing code');
      if (!row.name) rowErrors.push('Missing name');
      
      // Validate level is a number between 1-5
      const level = parseInt(row.level);
      if (isNaN(level) || level < 1 || level > 5) {
        rowErrors.push('Level must be between 1 and 5');
      }

      // Validate parent_level if parent_code is provided
      if (row.parent_code && !row.parent_level) {
        rowErrors.push('parent_level required when parent_code is provided');
      }

      if (rowErrors.length > 0) {
        errors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`);
      }

      return {
        country_code: row.country_code?.toString().toUpperCase().trim(),
        level: level,
        code: row.code?.toString().trim(),
        name: row.name?.toString().trim(),
        parent_code: row.parent_code?.toString().trim() || null,
        parent_level: row.parent_level ? parseInt(row.parent_level) : null,
        metadata: row.metadata ? JSON.parse(row.metadata) : {},
        errors: rowErrors.length > 0 ? rowErrors : undefined,
      };
    });

    setData(processed);
    setValidationErrors(errors);
  };

  const handleImport = async () => {
    if (validationErrors.length > 0) {
      toast({
        title: 'Validation Errors',
        description: 'Please fix validation errors before importing',
        variant: 'destructive',
      });
      return;
    }

    setImporting(true);
    setProgress(0);
    const stats = { success: 0, failed: 0, skipped: 0 };

    // Process in batches of 50
    const batchSize = 50;
    const validData = data.filter(row => !row.errors || row.errors.length === 0);
    
    for (let i = 0; i < validData.length; i += batchSize) {
      const batch = validData.slice(i, i + batchSize);
      
      try {
        // Check for existing divisions to avoid duplicates
        const codes = batch.map(d => d.code);
        const { data: existing } = await supabase
          .from('administrative_divisions')
          .select('code')
          .in('code', codes);

        const existingCodes = new Set(existing?.map(e => e.code) || []);
        const newDivisions = batch.filter(d => !existingCodes.has(d.code));
        
        if (newDivisions.length > 0) {
          const { error } = await supabase
            .from('administrative_divisions')
            .insert(newDivisions.map(d => ({
              country_code: d.country_code,
              level: d.level,
              code: d.code,
              name: d.name,
              parent_code: d.parent_code || null,
              parent_level: d.parent_level || null,
              metadata: d.metadata || {},
            })));

          if (error) {
            console.error('Batch import error:', error);
            stats.failed += newDivisions.length;
          } else {
            stats.success += newDivisions.length;
          }
        }
        
        stats.skipped += batch.length - newDivisions.length;
        
      } catch (error) {
        console.error('Import error:', error);
        stats.failed += batch.length;
      }

      setProgress(Math.round(((i + batchSize) / validData.length) * 100));
    }

    setImporting(false);
    setImportComplete(true);
    setImportStats(stats);
    
    toast({
      title: 'Import Complete',
      description: `Successfully imported ${stats.success} divisions. ${stats.skipped} skipped (duplicates). ${stats.failed} failed.`,
    });
  };

  const downloadTemplate = () => {
    const template = [
      {
        country_code: 'AO',
        level: 1,
        code: 'AO-LUA',
        name: 'Luanda',
        parent_code: '',
        parent_level: '',
        metadata: '{}',
      },
      {
        country_code: 'AO',
        level: 2,
        code: 'AO-LUA-BEL',
        name: 'Belas',
        parent_code: 'AO-LUA',
        parent_level: 1,
        metadata: '{}',
      },
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'divisions_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/country-config')}
                  className="mb-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Country Config
                </Button>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                  <FileSpreadsheet className="h-8 w-8 text-primary" />
                  Import Administrative Divisions
                </h1>
                <p className="text-muted-foreground mt-1">
                  Bulk import provinces, municipalities, and communes from CSV or Excel files
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>

            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Upload File</CardTitle>
                <CardDescription>
                  Upload a CSV or Excel file containing administrative divisions. Required columns: country_code, level, code, name
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Select File (CSV or Excel)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                </div>

                {file && (
                  <Alert>
                    <Upload className="h-4 w-4" />
                    <AlertDescription>
                      File loaded: <strong>{file.name}</strong> ({data.length} rows)
                    </AlertDescription>
                  </Alert>
                )}

                {/* Column Guide */}
                <div className="p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2 text-sm">Column Guide:</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li><strong>country_code*</strong>: 2-letter country code (e.g., AO, CD)</li>
                    <li><strong>level*</strong>: Administrative level (1-5)</li>
                    <li><strong>code*</strong>: Unique code for the division (e.g., AO-LUA)</li>
                    <li><strong>name*</strong>: Division name</li>
                    <li><strong>parent_code</strong>: Parent division code (for level 2+)</li>
                    <li><strong>parent_level</strong>: Parent division level</li>
                    <li><strong>metadata</strong>: JSON object for additional data</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">* Required fields</p>
                </div>
              </CardContent>
            </Card>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Validation Errors ({validationErrors.length})</div>
                  <ul className="list-disc pl-5 space-y-1 max-h-40 overflow-y-auto">
                    {validationErrors.slice(0, 10).map((error, idx) => (
                      <li key={idx} className="text-sm">{error}</li>
                    ))}
                    {validationErrors.length > 10 && (
                      <li className="text-sm font-semibold">
                        ... and {validationErrors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Summary */}
            {importComplete && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="font-semibold text-green-600 mb-2">Import Complete!</div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Success:</span>{' '}
                      <strong className="text-green-600">{importStats.success}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Skipped:</span>{' '}
                      <strong>{importStats.skipped}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Failed:</span>{' '}
                      <strong className="text-red-600">{importStats.failed}</strong>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Data Preview */}
            {data.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Data Preview</CardTitle>
                      <CardDescription>
                        Review the data before importing ({data.length} rows)
                      </CardDescription>
                    </div>
                    <Button
                      onClick={handleImport}
                      disabled={importing || validationErrors.length > 0}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {importing ? 'Importing...' : 'Import Data'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {importing && (
                    <div className="mb-4 space-y-2">
                      <Progress value={progress} className="w-full" />
                      <p className="text-sm text-muted-foreground text-center">
                        Importing... {progress}%
                      </p>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-96 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Country</TableHead>
                            <TableHead>Level</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Parent Code</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.slice(0, 100).map((row, idx) => (
                            <TableRow key={idx}>
                              <TableCell>
                                {row.errors && row.errors.length > 0 ? (
                                  <Badge variant="destructive">Invalid</Badge>
                                ) : (
                                  <Badge variant="outline">Valid</Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs">{row.country_code}</TableCell>
                              <TableCell>{row.level}</TableCell>
                              <TableCell className="font-mono text-xs">{row.code}</TableCell>
                              <TableCell>{row.name}</TableCell>
                              <TableCell className="font-mono text-xs">{row.parent_code || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {data.length > 100 && (
                      <div className="p-2 text-center text-sm text-muted-foreground bg-muted">
                        Showing first 100 of {data.length} rows
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
    </DashboardLayout>
  );
}

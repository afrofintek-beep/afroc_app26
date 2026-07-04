import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileJson, CheckCircle, AlertCircle, Loader2, MapPin } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportResult {
  imported_id: number;
  feature_name: string;
}

interface GeoJSONFeature {
  type: string;
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties?: Record<string, unknown>;
}

interface GeoJSONData {
  type: string;
  features?: GeoJSONFeature[];
  geometry?: {
    type: string;
    coordinates: unknown;
  };
  properties?: Record<string, unknown>;
}

const AdminImportUrbanZones = () => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [file, setFile] = useState<File | null>(null);
  const [geojsonData, setGeojsonData] = useState<GeoJSONData | null>(null);
  const [source, setSource] = useState("geojson");
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setResults([]);

    try {
      const text = await selectedFile.text();
      const parsed = JSON.parse(text) as GeoJSONData;
      
      // Validate GeoJSON structure
      if (!parsed.type) {
        throw new Error(t('importzones_error_invalid_geojson'));
      }

      if (parsed.type === "FeatureCollection" && !parsed.features) {
        throw new Error(t('importzones_error_invalid_featurecollection'));
      }

      if (parsed.type === "Feature" && !parsed.geometry) {
        throw new Error(t('importzones_error_invalid_feature'));
      }
      
      setGeojsonData(parsed);
      
      toast({
        title: t('importzones_toast_file_loaded'),
        description: `${getFeatureCount(parsed)} ${t('importzones_toast_zones_found')}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('importzones_error_parse_file');
      setError(message);
      setGeojsonData(null);
      toast({
        title: t('importzones_error'),
        description: message,
        variant: "destructive",
      });
    }
  };

  const getFeatureCount = (data: GeoJSONData): number => {
    if (data.type === "FeatureCollection" && data.features) {
      return data.features.length;
    }
    if (data.type === "Feature" || data.type === "Polygon" || data.type === "MultiPolygon") {
      return 1;
    }
    return 0;
  };

  const handleImport = async () => {
    if (!geojsonData) return;

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error(t('importzones_error_session_expired'));
      }

      const response = await supabase.functions.invoke("import-urban-zones", {
        body: {
          geojson: geojsonData,
          source: source,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || t('importzones_error_import_zones'));
      }

      const data = response.data;

      if (data.success) {
        setResults(data.zones || []);
        toast({
          title: t('importzones_toast_import_complete'),
          description: `${data.imported} ${t('importzones_toast_zones_imported')}`,
        });
      } else {
        throw new Error(data.error || t('importzones_error_unknown'));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('importzones_error_importing');
      setError(message);
      toast({
        title: t('importzones_toast_import_error'),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setGeojsonData(null);
    setResults([]);
    setError(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t('importzones_page_title')}</h1>
            <p className="text-muted-foreground">
              {t('importzones_page_subtitle')}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin")}>
            {t('importzones_back')}
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                {t('importzones_upload_title')}
              </CardTitle>
              <CardDescription>
                {t('importzones_upload_description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="geojson-file">{t('importzones_label_file')}</Label>
                <Input
                  id="geojson-file"
                  type="file"
                  accept=".json,.geojson"
                  onChange={handleFileChange}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">{t('importzones_label_source')}</Label>
                <Input
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder={t('importzones_placeholder_source')}
                  disabled={isLoading}
                />
              </div>

              {geojsonData && (
                <div className="rounded-lg border p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <FileJson className="h-4 w-4 text-primary" />
                    <span className="font-medium">{file?.name}</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>{t('importzones_field_type')}: <Badge variant="secondary">{geojsonData.type}</Badge></p>
                    <p>{t('importzones_field_zones')}: <Badge>{getFeatureCount(geojsonData)}</Badge></p>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-destructive p-4 bg-destructive/10">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium">{t('importzones_error')}</span>
                  </div>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={!geojsonData || isLoading}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('importzones_btn_importing')}
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      {t('importzones_btn_import')}
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={resetForm} disabled={isLoading}>
                  {t('importzones_btn_clear')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {t('importzones_results_title')}
              </CardTitle>
              <CardDescription>
                {results.length > 0
                  ? `${results.length} ${t('importzones_results_count_suffix')}`
                  : t('importzones_results_empty_hint')
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {results.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {results.map((result, index) => (
                      <div
                        key={result.imported_id || index}
                        className="flex items-center gap-2 p-2 rounded-lg border bg-card"
                      >
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{result.feature_name}</p>
                          <p className="text-xs text-muted-foreground">ID: {result.imported_id}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                  <FileJson className="h-12 w-12 mb-4 opacity-50" />
                  <p>{t('importzones_empty_title')}</p>
                  <p className="text-sm">{t('importzones_empty_hint')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>{t('importzones_format_title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto">
{`{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Luanda Centro",
        "admin_path": "AO/LAD/LUA"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[13.2, -8.8], [13.3, -8.8], [13.3, -8.9], [13.2, -8.9], [13.2, -8.8]]]
      }
    }
  ]
}`}
            </pre>
            <p className="text-sm text-muted-foreground mt-4">
              {t('importzones_supported_props')}: <code>name</code> {t('importzones_or')} <code>NAME</code>, <code>admin_path</code> {t('importzones_or')} <code>ADM_PATH</code>
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminImportUrbanZones;

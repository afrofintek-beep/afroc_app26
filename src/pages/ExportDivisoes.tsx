import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import DashboardLayout from "@/components/DashboardLayout";
import { useLanguage } from '@/contexts/LanguageContext';

interface DivisionRow {
  provincia: string;
  provincia_code: string;
  municipio: string;
  municipio_code: string;
}

const ExportDivisoes = () => {
  const { t } = useLanguage();
  const [isExporting, setIsExporting] = useState(false);

  const { data: divisions, isLoading } = useQuery({
    queryKey: ["administrative-divisions-export"],
    queryFn: async () => {
      const { data: provinces, error: provError } = await supabase
        .from("administrative_divisions")
        .select("*")
        .eq("country_code", "AO")
        .eq("level", 1)
        .order("name");

      if (provError) throw provError;

      const { data: municipalities, error: munError } = await supabase
        .from("administrative_divisions")
        .select("*")
        .eq("country_code", "AO")
        .eq("level", 2)
        .order("name");

      if (munError) throw munError;

      // Combine data
      const rows: DivisionRow[] = [];
      
      provinces?.forEach(prov => {
        const provMunicipalities = municipalities?.filter(m => m.parent_code === prov.code) || [];
        
        if (provMunicipalities.length === 0) {
          rows.push({
            provincia: prov.name,
            provincia_code: prov.code,
            municipio: "",
            municipio_code: ""
          });
        } else {
          provMunicipalities.forEach(mun => {
            rows.push({
              provincia: prov.name,
              provincia_code: prov.code,
              municipio: mun.name,
              municipio_code: mun.code
            });
          });
        }
      });

      return {
        rows,
        stats: {
          provinces: provinces?.length || 0,
          municipalities: municipalities?.length || 0
        }
      };
    }
  });

  const handleExportExcel = async () => {
    if (!divisions?.rows) return;
    
    setIsExporting(true);
    try {
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Sheet 1: All divisions
      const wsData = [
        ["Província", "Código Província", "Município", "Código Município"],
        ...divisions.rows.map(row => [
          row.provincia,
          row.provincia_code,
          row.municipio,
          row.municipio_code
        ])
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set column widths
      ws["!cols"] = [
        { wch: 20 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 }
      ];
      
      XLSX.utils.book_append_sheet(wb, ws, "Divisões Administrativas");

      // Sheet 2: Summary by province
      const summaryData = [
        ["Província", "Código", "Nº Municípios"],
        ...Object.entries(
          divisions.rows.reduce((acc, row) => {
            if (!acc[row.provincia]) {
              acc[row.provincia] = { code: row.provincia_code, count: 0 };
            }
            if (row.municipio) acc[row.provincia].count++;
            return acc;
          }, {} as Record<string, { code: string; count: number }>)
        ).map(([name, data]) => [name, data.code, data.count])
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      wsSummary["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumo por Província");

      // Generate file
      const fileName = `Angola_Divisoes_Administrativas_Lei14_24_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success(t('exportdiv_toast_success'));
    } catch (error) {
      console.error("Export error:", error);
      toast.error(t('exportdiv_toast_error'));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{t('exportdiv_page_title')}</h1>
          <p className="text-muted-foreground">
            {t('exportdiv_page_subtitle')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('exportdiv_stat_provinces')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? "..." : divisions?.stats.provinces}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('exportdiv_stat_municipalities')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {isLoading ? "..." : divisions?.stats.municipalities}
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t('exportdiv_stat_legal_basis')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">Lei 14/24</div>
              <div className="text-sm text-muted-foreground">{t('exportdiv_legal_date')}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              {t('exportdiv_card_export_title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('exportdiv_sheets_intro')}
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground mb-6 space-y-1">
              <li>{t('exportdiv_sheet1_desc')}</li>
              <li>{t('exportdiv_sheet2_desc')}</li>
            </ul>
            
            <Button 
              onClick={handleExportExcel} 
              disabled={isLoading || isExporting || !divisions}
              size="lg"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('exportdiv_btn_exporting')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('exportdiv_btn_download')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ExportDivisoes;

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, FileSpreadsheet, TrendingUp, MapPin, Building, Calendar } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function csvUrl(path: string, params: Record<string, string | number | undefined>) {
  const filteredParams: Record<string, string> = {};
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'all') {
      filteredParams[key] = String(value);
    }
  });
  const qs = new URLSearchParams(filteredParams);
  const queryString = qs.toString();
  return `${SUPABASE_URL}/functions/v1/${path}${queryString ? `?${queryString}` : ''}`;
}

const KpisExport = () => {
  const { t } = useLanguage();
  
  // Filters state
  const [zone, setZone] = useState<string>('all');
  const [gridM, setGridM] = useState<string>('');
  const [period, setPeriod] = useState<string>('month');
  const [days, setDays] = useState<string>('90');
  const [months, setMonths] = useState<string>('6');
  const [country, setCountry] = useState<string>('AO');
  const [adminLevel, setAdminLevel] = useState<string>('municipality');
  const [limit, setLimit] = useState<string>('200');

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const commonParams = {
    zone: zone !== 'all' ? zone : undefined,
    grid_m: gridM ? parseInt(gridM) : undefined,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{t('kpis_export') || 'KPIs Export'}</h1>
            <p className="text-muted-foreground mt-1">
              {t('kpis_export_description') || 'Download KPI reports in CSV format'}
            </p>
          </div>
          <FileSpreadsheet className="h-10 w-10 text-primary" />
        </div>

        {/* Global Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t('global_filters') || 'Global Filters'}</CardTitle>
            <CardDescription>{t('global_filters_description') || 'These filters apply to all exports'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('zone') || 'Zone'}</Label>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('select_zone') || 'Select zone'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('all_zones') || 'All Zones'}</SelectItem>
                    <SelectItem value="urban">{t('urban') || 'Urban'}</SelectItem>
                    <SelectItem value="rural">{t('rural') || 'Rural'}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('grid_size') || 'Grid Size (m)'}</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="200" 
                  value={gridM}
                  onChange={(e) => setGridM(e.target.value)}
                  placeholder="1-200"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('country') || 'Country'}</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AO">Angola (AO)</SelectItem>
                    <SelectItem value="MZ">Mozambique (MZ)</SelectItem>
                    <SelectItem value="CV">Cape Verde (CV)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quick Export Pills */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
              <a
                href={csvUrl('kpis-summary-csv', commonParams)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-mono hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Summary CSV
              </a>
              <a
                href={csvUrl('kpis-timeseries-csv', { ...commonParams, period, days: parseInt(days) })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-mono hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Time Series CSV
              </a>
              <a
                href={csvUrl('kpis-growth-csv', { ...commonParams, months: parseInt(months), country })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-mono hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export Growth CSV
              </a>
              <a
                href={csvUrl('kpis-by-province-csv', { ...commonParams, country })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-mono hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export By-Province CSV
              </a>
              <a
                href={csvUrl('kpis-by-admin-csv', { ...commonParams, level: adminLevel, limit: parseInt(limit) })}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-mono hover:bg-primary/20 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                Export By-Admin CSV
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Summary CSV */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <CardTitle>{t('kpi_summary') || 'KPI Summary'}</CardTitle>
              </div>
              <CardDescription>
                {t('kpi_summary_description') || 'Overall metrics: total places, tiles, 30d/90d registrations'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleDownload(csvUrl('kpis-summary-csv', commonParams))}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('download_csv') || 'Download CSV'}
              </Button>
            </CardContent>
          </Card>

          {/* Timeseries CSV */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>{t('kpi_timeseries') || 'KPI Timeseries'}</CardTitle>
              </div>
              <CardDescription>
                {t('kpi_timeseries_description') || 'Daily/weekly/monthly aggregated data over time'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('period') || 'Period'}</Label>
                  <Select value={period} onValueChange={setPeriod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">{t('daily') || 'Daily'}</SelectItem>
                      <SelectItem value="week">{t('weekly') || 'Weekly'}</SelectItem>
                      <SelectItem value="month">{t('monthly') || 'Monthly'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('days') || 'Days'}</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="365" 
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={() => handleDownload(csvUrl('kpis-timeseries-csv', { 
                  ...commonParams, 
                  period, 
                  days: parseInt(days) 
                }))}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('download_csv') || 'Download CSV'}
              </Button>
            </CardContent>
          </Card>

          {/* Growth CSV */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle>{t('kpi_growth') || 'KPI Growth'}</CardTitle>
              </div>
              <CardDescription>
                {t('kpi_growth_description') || 'Monthly growth metrics with MoM rates and moving averages'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>{t('months') || 'Months'}</Label>
                <Input 
                  type="number" 
                  min="1" 
                  max="60" 
                  value={months}
                  onChange={(e) => setMonths(e.target.value)}
                />
              </div>
              <Button 
                onClick={() => handleDownload(csvUrl('kpis-growth-csv', { 
                  ...commonParams, 
                  months: parseInt(months),
                  country 
                }))}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('download_csv') || 'Download CSV'}
              </Button>
            </CardContent>
          </Card>

          {/* By Province CSV */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <CardTitle>{t('kpi_by_province') || 'KPI by Province'}</CardTitle>
              </div>
              <CardDescription>
                {t('kpi_by_province_description') || 'Metrics aggregated by province with status breakdown'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => handleDownload(csvUrl('kpis-by-province-csv', { 
                  ...commonParams, 
                  country 
                }))}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('download_csv') || 'Download CSV'}
              </Button>
            </CardContent>
          </Card>

          {/* By Admin CSV */}
          <Card className="md:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-primary" />
                <CardTitle>{t('kpi_by_admin') || 'KPI by Administrative Level'}</CardTitle>
              </div>
              <CardDescription>
                {t('kpi_by_admin_description') || 'Metrics by province, municipality, comuna, or full admin path'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('admin_level') || 'Administrative Level'}</Label>
                  <Select value={adminLevel} onValueChange={setAdminLevel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="province">{t('province') || 'Province'}</SelectItem>
                      <SelectItem value="municipality">{t('municipality') || 'Municipality'}</SelectItem>
                      <SelectItem value="comuna">{t('comuna') || 'Comuna'}</SelectItem>
                      <SelectItem value="admin_path">{t('admin_path') || 'Full Admin Path'}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('limit') || 'Limit'}</Label>
                  <Input 
                    type="number" 
                    min="1" 
                    max="2000" 
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                  />
                </div>
              </div>
              <Button 
                onClick={() => handleDownload(csvUrl('kpis-by-admin-csv', { 
                  ...commonParams, 
                  level: adminLevel,
                  limit: parseInt(limit)
                }))}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {t('download_csv') || 'Download CSV'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default KpisExport;

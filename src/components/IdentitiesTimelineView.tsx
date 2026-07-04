import { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, parseISO, isWithinInterval, subDays, subMonths } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Award, CheckCircle2, Clock, ArrowUpRight, ArrowDownRight, Minus, GitCompare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

type AfrolocRecord = Database["public"]["Tables"]["afroloc_records"]["Row"];

interface IdentitiesTimelineViewProps {
  records: AfrolocRecord[];
}

const COLORS = {
  draft: '#f59e0b',
  verified: '#3b82f6',
  certified: '#10b981',
  house: '#8b5cf6',
  apartment: '#ec4899',
  commercial: '#f97316',
  land: '#14b8a6',
  other: '#64748b'
};

export default function IdentitiesTimelineView({ records }: IdentitiesTimelineViewProps) {
  const { t } = useLanguage();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [groupBy, setGroupBy] = useState<'day' | 'month'>('day');
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonPeriod, setComparisonPeriod] = useState<'previous' | 'custom'>('previous');

  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();
    const ranges = {
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      'all': new Date(Math.min(...records.map(r => new Date(r.created_at).getTime())))
    };
    return { start: ranges[timeRange], end: now };
  }, [timeRange, records]);

  // Calculate comparison date range
  const comparisonDateRange = useMemo(() => {
    if (!showComparison) return null;
    
    const daysDiff = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const start = subDays(dateRange.start, daysDiff);
    const end = dateRange.start;
    
    return { start, end };
  }, [dateRange, showComparison]);

  // Filter records by date range
  const filteredRecords = useMemo(() => {
    return records.filter(record => 
      isWithinInterval(parseISO(record.created_at), dateRange)
    );
  }, [records, dateRange]);

  // Filter comparison records
  const comparisonRecords = useMemo(() => {
    if (!comparisonDateRange) return [];
    return records.filter(record => 
      isWithinInterval(parseISO(record.created_at), comparisonDateRange)
    );
  }, [records, comparisonDateRange]);

  // Creation timeline data
  const timelineData = useMemo(() => {
    if (groupBy === 'day') {
      const days = eachDayOfInterval(dateRange);
      return days.map(day => {
        const dayRecords = filteredRecords.filter(record => 
          format(parseISO(record.created_at), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
        );
        return {
          date: format(day, 'MMM dd'),
          fullDate: format(day, 'yyyy-MM-dd'),
          total: dayRecords.length,
          draft: dayRecords.filter(r => r.status === 'draft').length,
          verified: dayRecords.filter(r => r.status === 'verified').length,
          certified: dayRecords.filter(r => r.status === 'certified').length
        };
      });
    } else {
      const months = eachMonthOfInterval(dateRange);
      return months.map(month => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthRecords = filteredRecords.filter(record => 
          isWithinInterval(parseISO(record.created_at), { start: monthStart, end: monthEnd })
        );
        return {
          date: format(month, 'MMM yyyy'),
          fullDate: format(month, 'yyyy-MM'),
          total: monthRecords.length,
          draft: monthRecords.filter(r => r.status === 'draft').length,
          verified: monthRecords.filter(r => r.status === 'verified').length,
          certified: monthRecords.filter(r => r.status === 'certified').length
        };
      });
    }
  }, [filteredRecords, dateRange, groupBy]);

  // Status distribution
  const statusDistribution = useMemo(() => {
    const statuses = filteredRecords.reduce((acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(statuses).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[name as keyof typeof COLORS] || '#64748b'
    }));
  }, [filteredRecords]);

  // Property type distribution
  const propertyTypeDistribution = useMemo(() => {
    const types = filteredRecords.reduce((acc, record) => {
      const type = record.property_type || 'other';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(types).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: COLORS[name as keyof typeof COLORS] || '#64748b'
    }));
  }, [filteredRecords]);

  // Daily average and trends
  const statistics = useMemo(() => {
    const totalDays = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const dailyAverage = totalDays > 0 ? (filteredRecords.length / totalDays).toFixed(1) : '0';
    
    const sortedData = [...timelineData].sort((a, b) => b.total - a.total);
    const busiestPeriod = sortedData[0];
    
    return {
      total: filteredRecords.length,
      dailyAverage,
      busiestPeriod: busiestPeriod ? `${busiestPeriod.date} (${busiestPeriod.total})` : t('timeline_not_available')
    };
  }, [filteredRecords, dateRange, timelineData]);

  // Comparison statistics
  const comparisonStats = useMemo(() => {
    if (!showComparison || !comparisonDateRange) return null;

    const comparisonTotal = comparisonRecords.length;
    const currentTotal = filteredRecords.length;
    const totalChange = currentTotal - comparisonTotal;
    const totalChangePercent = comparisonTotal > 0 
      ? ((totalChange / comparisonTotal) * 100).toFixed(1)
      : currentTotal > 0 ? '100' : '0';

    const comparisonDays = Math.ceil((comparisonDateRange.end.getTime() - comparisonDateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const comparisonDailyAvg = comparisonDays > 0 ? (comparisonTotal / comparisonDays) : 0;
    const currentDailyAvg = parseFloat(statistics.dailyAverage);
    const dailyAvgChange = currentDailyAvg - comparisonDailyAvg;
    const dailyAvgChangePercent = comparisonDailyAvg > 0 
      ? ((dailyAvgChange / comparisonDailyAvg) * 100).toFixed(1)
      : currentDailyAvg > 0 ? '100' : '0';

    // Status comparison
    const currentStatusDist = filteredRecords.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const comparisonStatusDist = comparisonRecords.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalChange: parseInt(totalChangePercent),
      totalChangeValue: totalChange,
      dailyAvgChange: parseFloat(dailyAvgChangePercent),
      dailyAvgChangeValue: dailyAvgChange.toFixed(1),
      comparisonTotal,
      currentStatusDist,
      comparisonStatusDist
    };
  }, [showComparison, comparisonDateRange, filteredRecords, comparisonRecords, statistics]);

  const getChangeIcon = (change: number) => {
    if (change > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />;
    if (change < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('timeline_last_7_days')}</SelectItem>
              <SelectItem value="30d">{t('timeline_last_30_days')}</SelectItem>
              <SelectItem value="90d">{t('timeline_last_90_days')}</SelectItem>
              <SelectItem value="all">{t('timeline_all_time')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={(value: any) => setGroupBy(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('timeline_by_day')}</SelectItem>
              <SelectItem value="month">{t('timeline_by_month')}</SelectItem>
            </SelectContent>
          </Select>

          <Button 
            variant={showComparison ? "default" : "outline"}
            onClick={() => setShowComparison(!showComparison)}
            size="sm"
          >
            <GitCompare className="h-4 w-4 mr-2" />
            {showComparison ? t('timeline_hide') : t('timeline_compare')}
          </Button>
        </div>

        <div className="flex gap-2 text-xs">
          <Badge variant="outline">
            <Calendar className="h-3 w-3 mr-1" />
            {format(dateRange.start, 'MMM dd, yyyy')} - {format(dateRange.end, 'MMM dd, yyyy')}
          </Badge>
          {showComparison && comparisonDateRange && (
            <Badge variant="secondary">
              <Calendar className="h-3 w-3 mr-1" />
              {t('timeline_vs')} {format(comparisonDateRange.start, 'MMM dd, yyyy')} - {format(comparisonDateRange.end, 'MMM dd, yyyy')}
            </Badge>
          )}
        </div>
      </div>

      {/* Comparison Alert */}
      {showComparison && comparisonStats && (
        <Card className="bg-accent/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <GitCompare className="h-5 w-5" />
              <CardTitle className="text-lg">{t('timeline_period_comparison')}</CardTitle>
            </div>
            <CardDescription>
              {t('timeline_comparing_current_previous')} {timeRange === '7d' ? t('timeline_7_days') : timeRange === '30d' ? t('timeline_30_days') : timeRange === '90d' ? t('timeline_90_days') : t('timeline_period')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                <div>
                  <div className="text-sm text-muted-foreground">{t('timeline_total_change')}</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {comparisonStats.totalChangeValue > 0 ? '+' : ''}{comparisonStats.totalChangeValue}
                    {getChangeIcon(comparisonStats.totalChange)}
                  </div>
                  <div className={`text-sm font-medium ${getChangeColor(comparisonStats.totalChange)}`}>
                    {comparisonStats.totalChange > 0 ? '+' : ''}{comparisonStats.totalChange}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{t('timeline_current')}: {statistics.total}</div>
                  <div>{t('timeline_previous')}: {comparisonStats.comparisonTotal}</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-background">
                <div>
                  <div className="text-sm text-muted-foreground">{t('timeline_daily_avg_change')}</div>
                  <div className="text-2xl font-bold flex items-center gap-2">
                    {parseFloat(comparisonStats.dailyAvgChangeValue) > 0 ? '+' : ''}{comparisonStats.dailyAvgChangeValue}
                    {getChangeIcon(comparisonStats.dailyAvgChange)}
                  </div>
                  <div className={`text-sm font-medium ${getChangeColor(comparisonStats.dailyAvgChange)}`}>
                    {comparisonStats.dailyAvgChange > 0 ? '+' : ''}{comparisonStats.dailyAvgChange}%
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{t('timeline_current')}: {statistics.dailyAverage}{t('timeline_per_day_suffix')}</div>
                  <div>{t('timeline_previous')}: {(comparisonStats.comparisonTotal / Math.ceil((comparisonDateRange!.end.getTime() - comparisonDateRange!.start.getTime()) / (1000 * 60 * 60 * 24))).toFixed(1)}{t('timeline_per_day_suffix')}</div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-background">
                <div className="text-sm text-muted-foreground mb-2">{t('timeline_status_comparison')}</div>
                <div className="space-y-1 text-xs">
                  {Object.keys({...comparisonStats.currentStatusDist, ...comparisonStats.comparisonStatusDist}).map(status => {
                    const current = comparisonStats.currentStatusDist[status] || 0;
                    const previous = comparisonStats.comparisonStatusDist[status] || 0;
                    const change = current - previous;
                    return (
                      <div key={status} className="flex items-center justify-between">
                        <span className="capitalize">{status}</span>
                        <span className={`font-medium ${getChangeColor(change)}`}>
                          {change > 0 ? '+' : ''}{change}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('timeline_total_created')}</CardDescription>
            <CardTitle className="text-3xl">{statistics.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('timeline_in_selected_range')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('timeline_daily_average')}</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              {statistics.dailyAverage}
              <TrendingUp className="h-5 w-5 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('timeline_identities_per_day')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t('timeline_busiest_period')}</CardDescription>
            <CardTitle className="text-xl">{statistics.busiestPeriod}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('timeline_highest_creation_count')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="timeline">{t('timeline_tab_timeline')}</TabsTrigger>
          <TabsTrigger value="status">{t('timeline_tab_by_status')}</TabsTrigger>
          <TabsTrigger value="property">{t('timeline_tab_by_type')}</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('timeline_creation_timeline')}</CardTitle>
              <CardDescription>{t('timeline_number_created_over_time')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name={t('timeline_total')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="certified"
                    stroke={COLORS.certified}
                    strokeWidth={2}
                    name={t('timeline_certified')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="verified"
                    stroke={COLORS.verified}
                    strokeWidth={2}
                    name={t('timeline_verified')}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="draft"
                    stroke={COLORS.draft}
                    strokeWidth={2}
                    name={t('timeline_draft')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('timeline_status_breakdown_by_period')}</CardTitle>
              <CardDescription>{t('timeline_stacked_view_statuses')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="certified" stackId="a" fill={COLORS.certified} name={t('timeline_certified')} />
                  <Bar dataKey="verified" stackId="a" fill={COLORS.verified} name={t('timeline_verified')} />
                  <Bar dataKey="draft" stackId="a" fill={COLORS.draft} name={t('timeline_draft')} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('timeline_status_distribution')}</CardTitle>
              <CardDescription>{t('timeline_breakdown_by_status')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  {statusDistribution.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {item.name === 'Certified' && <Award className="h-4 w-4" />}
                            {item.name === 'Verified' && <CheckCircle2 className="h-4 w-4" />}
                            {item.name === 'Draft' && <Clock className="h-4 w-4" />}
                            {item.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {((item.value / filteredRecords.length) * 100).toFixed(1)}{t('timeline_percent_of_total')}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="property" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('timeline_property_type_distribution')}</CardTitle>
              <CardDescription>{t('timeline_breakdown_by_property_type')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={propertyTypeDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {propertyTypeDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="space-y-4">
                  {propertyTypeDistribution.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <div>
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {((item.value / filteredRecords.length) * 100).toFixed(1)}{t('timeline_percent_of_total')}
                          </div>
                        </div>
                      </div>
                      <Badge variant="secondary">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('timeline_property_types_over_time')}</CardTitle>
              <CardDescription>{t('timeline_trend_property_type_creation')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total" fill="#3b82f6" name={t('timeline_total_created')} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
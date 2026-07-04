import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCountries, Country } from '@/hooks/useCountries';
import { Globe, Plus, Edit, Power, Settings, Map, Shield, Phone, Languages, FileSpreadsheet, ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AdminCountryConfig() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { countries, isLoading, createCountry, updateCountry, toggleCountryStatus, isCreating, isUpdating } = useCountries();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [formData, setFormData] = useState<Partial<Country>>({
    country_code: '',
    country_name: '',
    is_active: true,
    admin_levels_count: 4,
    level1_label: 'Province',
    level2_label: 'Territory',
    level3_label: 'Commune',
    level4_label: 'Quartier',
    afro_id_format: '{COUNTRY}-{LEVEL1}-{NUMBER}',
    requires_authority_validation: true,
    requires_witness_validation: true,
    min_witnesses_required: 2,
    timezone: 'UTC',
    language_codes: ['en'],
  });

  const handleOpenDialog = (country?: Country) => {
    if (country) {
      setEditingCountry(country);
      setFormData(country);
    } else {
      setEditingCountry(null);
      setFormData({
        country_code: '',
        country_name: '',
        is_active: true,
        admin_levels_count: 4,
        level1_label: 'Province',
        level2_label: 'Territory',
        level3_label: 'Commune',
        level4_label: 'Quartier',
        afro_id_format: '{COUNTRY}-{LEVEL1}-{NUMBER}',
        requires_authority_validation: true,
        requires_witness_validation: true,
        min_witnesses_required: 2,
        timezone: 'UTC',
        language_codes: ['en'],
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingCountry) {
      updateCountry({ id: editingCountry.id, updates: formData });
    } else {
      createCountry(formData);
    }
    setDialogOpen(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/dashboard")}
                  className="flex-shrink-0 mt-1"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Globe className="h-8 w-8 text-primary" />
                    {t('country_configuration')}
                  </h1>
                  <p className="text-muted-foreground mt-1">
                    {t('country_configuration_desc')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate('/admin/import-divisions')}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  {t('import_divisions')}
                </Button>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('add_country')}
                </Button>
              </div>
            </div>

            {/* Countries List */}
            {isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-4 w-32" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {countries?.map((country) => (
                  <Card key={country.id} className={!country.is_active ? 'opacity-60' : ''}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {country.country_name}
                            <Badge variant={country.is_active ? 'default' : 'secondary'}>
                              {country.country_code}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {country.admin_levels_count} {t('administrative_levels')}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleCountryStatus({ id: country.id, is_active: !country.is_active })}
                          >
                            <Power className={`h-4 w-4 ${country.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(country)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Administrative Structure Hierarchy */}
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Map className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">{t('administrative_structure')}</span>
                        </div>
                        <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                          {[
                            { level: 1, label: country.level1_label },
                            { level: 2, label: country.level2_label },
                            { level: 3, label: country.level3_label },
                            { level: 4, label: country.level4_label },
                            ...(country.level5_label ? [{ level: 5, label: country.level5_label }] : [])
                          ].slice(0, country.admin_levels_count).map((item, idx) => (
                            <div key={item.level} className="flex items-center gap-2 text-sm">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                                {item.level}
                              </div>
                              <span className="font-medium">{item.label}</span>
                              {idx === 0 && <Badge variant="secondary" className="text-xs">{t('top_level')}</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Territorial Information */}
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-3">
                          <Globe className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">{t('territorial_information')}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              <span className="text-xs">{t('phone_code')}</span>
                            </div>
                            <p className="font-medium pl-5">{country.phone_country_code || t('not_set')}</p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Settings className="h-3 w-3" />
                              <span className="text-xs">{t('currency')}</span>
                            </div>
                            <p className="font-medium pl-5">{country.currency || t('not_set')}</p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              <span className="text-xs">{t('timezone')}</span>
                            </div>
                            <p className="font-medium pl-5">{country.timezone}</p>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <div className="flex items-center gap-2 text-muted-foreground">
                              <Languages className="h-3 w-3" />
                              <span className="text-xs">{t('languages')}</span>
                            </div>
                            <div className="flex flex-wrap gap-1 pl-5">
                              {country.language_codes.map((lang) => (
                                <Badge key={lang} variant="outline" className="text-xs">
                                  {lang.toUpperCase()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Validation Requirements */}
                      <div className="pt-3 border-t">
                        <div className="flex items-center gap-2 mb-3">
                          <Shield className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold">{t('validation_requirements')}</span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('authority_validation')}</span>
                            <Badge variant={country.requires_authority_validation ? 'default' : 'secondary'}>
                              {country.requires_authority_validation ? t('required') : t('optional')}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('witness_validation')}</span>
                            <Badge variant={country.requires_witness_validation ? 'default' : 'secondary'}>
                              {country.requires_witness_validation ? t('required') : t('optional')}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">{t('minimum_witnesses')}</span>
                            <Badge variant="outline">{country.min_witnesses_required}</Badge>
                          </div>
                        </div>
                      </div>

                      {/* AFROLOC Format */}
                      <div className="pt-3 border-t">
                        <p className="text-xs text-muted-foreground mb-2">{t('afro_id_format')}</p>
                        <code className="text-xs bg-muted px-2 py-1 rounded block font-mono">
                          {country.afro_id_format}
                        </code>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!isLoading && countries?.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">{t('no_countries_configured')}</p>
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t('add_first_country')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Add/Edit Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCountry ? t('edit_country_configuration') : t('add_new_country')}
            </DialogTitle>
            <DialogDescription>
              {t('country_configuration_desc')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">{t('basic')}</TabsTrigger>
              <TabsTrigger value="structure">{t('structure')}</TabsTrigger>
              <TabsTrigger value="validation">{t('validation')}</TabsTrigger>
              <TabsTrigger value="advanced">{t('advanced')}</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country_code">{t('country_code')} *</Label>
                  <Input
                    id="country_code"
                    value={formData.country_code}
                    onChange={(e) => setFormData({ ...formData, country_code: e.target.value.toUpperCase() })}
                    placeholder="CD"
                    maxLength={2}
                    disabled={!!editingCountry}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country_name">{t('country_name')} *</Label>
                  <Input
                    id="country_name"
                    value={formData.country_name}
                    onChange={(e) => setFormData({ ...formData, country_name: e.target.value })}
                    placeholder="Democratic Republic of Congo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone_country_code">{t('phone_country_code')}</Label>
                  <Input
                    id="phone_country_code"
                    value={formData.phone_country_code || ''}
                    onChange={(e) => setFormData({ ...formData, phone_country_code: e.target.value })}
                    placeholder="+243"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">{t('currency')}</Label>
                  <Input
                    id="currency"
                    value={formData.currency || ''}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    placeholder="CDF"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">{t('timezone')}</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  placeholder="Africa/Kinshasa"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">{t('active')}</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </TabsContent>

            <TabsContent value="structure" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="admin_levels_count">{t('number_of_administrative_levels')}</Label>
                <Select
                  value={formData.admin_levels_count?.toString()}
                  onValueChange={(value) => setFormData({ ...formData, admin_levels_count: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <SelectItem key={level} value={level.toString()}>
                        {level} {level > 1 ? t('countryconfig_levels') : t('countryconfig_level')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="level1_label">{t('level')} 1 {t('label')}</Label>
                  <Input
                    id="level1_label"
                    value={formData.level1_label}
                    onChange={(e) => setFormData({ ...formData, level1_label: e.target.value })}
                    placeholder="Province"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level2_label">{t('level')} 2 {t('label')}</Label>
                  <Input
                    id="level2_label"
                    value={formData.level2_label}
                    onChange={(e) => setFormData({ ...formData, level2_label: e.target.value })}
                    placeholder="Territory"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level3_label">{t('level')} 3 {t('label')}</Label>
                  <Input
                    id="level3_label"
                    value={formData.level3_label}
                    onChange={(e) => setFormData({ ...formData, level3_label: e.target.value })}
                    placeholder="Commune"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="level4_label">{t('level')} 4 {t('label')}</Label>
                  <Input
                    id="level4_label"
                    value={formData.level4_label}
                    onChange={(e) => setFormData({ ...formData, level4_label: e.target.value })}
                    placeholder="Quartier"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="validation" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="afro_id_format">{t('afro_id_format')}</Label>
                <Input
                  id="afro_id_format"
                  value={formData.afro_id_format}
                  onChange={(e) => setFormData({ ...formData, afro_id_format: e.target.value })}
                  placeholder="{COUNTRY}-{LEVEL1}-{NUMBER}"
                />
                <p className="text-xs text-muted-foreground">
                  {t('variables')}: {'{COUNTRY}'}, {'{LEVEL1}'}, {'{LEVEL2}'}, {'{LEVEL3}'}, {'{LEVEL4}'}, {'{NUMBER}'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min_witnesses">{t('minimum_witnesses_required')}</Label>
                <Select
                  value={formData.min_witnesses_required?.toString()}
                  onValueChange={(value) => setFormData({ ...formData, min_witnesses_required: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <SelectItem key={num} value={num.toString()}>
                        {num} {num > 1 ? t('countryconfig_witnesses') : t('countryconfig_witness')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requires_authority">{t('authority_validation_required')}</Label>
                    <p className="text-xs text-muted-foreground">{t('require_validation_by_local_authorities')}</p>
                  </div>
                  <Switch
                    id="requires_authority"
                    checked={formData.requires_authority_validation}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_authority_validation: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requires_witness">{t('witness_validation_required')}</Label>
                    <p className="text-xs text-muted-foreground">{t('require_witness_confirmation')}</p>
                  </div>
                  <Switch
                    id="requires_witness"
                    checked={formData.requires_witness_validation}
                    onCheckedChange={(checked) => setFormData({ ...formData, requires_witness_validation: checked })}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="language_codes">{t('language_codes_comma_separated')}</Label>
                <Input
                  id="language_codes"
                  value={formData.language_codes?.join(', ')}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    language_codes: e.target.value.split(',').map(l => l.trim()) 
                  })}
                  placeholder="en, fr, sw"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone_format">{t('phone_number_format')}</Label>
                <Input
                  id="phone_format"
                  value={formData.phone_number_format || ''}
                  onChange={(e) => setFormData({ ...formData, phone_number_format: e.target.value })}
                  placeholder="+243 XXX XXX XXX"
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating || isUpdating}>
              {editingCountry ? t('update') : t('create')} {t('country')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

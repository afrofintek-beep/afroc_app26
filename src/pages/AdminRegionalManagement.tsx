import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Users, Loader2, Plus, Building2, Globe, MapPinned, Home, LayoutGrid } from "lucide-react";
import { useLanguage } from '@/contexts/LanguageContext';

interface Profile {
  user_id: string;
  full_name: string | null;
}

interface Division {
  id: string;
  name: string;
  code: string;
  level: number;
  country_code: string;
  parent_code: string | null;
}

interface CountryConfig {
  country_code: string;
  country_name: string;
  level1_label: string | null;
  level2_label: string | null;
  level3_label: string | null;
  level4_label: string | null;
  admin_levels_count: number | null;
}

// Authorization level hierarchy (matches Angola's administrative structure)
const AUTHORIZATION_LEVELS = [
  { level: 5, name: "Nacional", description: "Controlo de todo o país", icon: Globe },
  { level: 4, name: "Provincial", description: "Administração de uma província", icon: Building2 },
  { level: 3, name: "Municipal", description: "Administração de um município", icon: MapPinned },
  { level: 2, name: "Comunal", description: "Administração de uma comuna", icon: LayoutGrid },
  { level: 1, name: "Local", description: "Administração de um bairro", icon: Home },
];

export default function AdminRegionalManagement() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>("");
  const [selectedCommune, setSelectedCommune] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");

  // Fetch all users (for assigning/updating levels)
  const { data: allUsers } = useQuery({
    queryKey: ['all-users-for-levels'],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .order('full_name');

      const { data: existingLevels } = await supabase
        .from('user_authorization_levels')
        .select('user_id');

      const existingUserIds = new Set(existingLevels?.map(l => l.user_id) || []);
      
      return profiles?.map(p => ({
        ...p,
        hasLevel: existingUserIds.has(p.user_id)
      })) || [];
    }
  });

  // Fetch existing regional admins
  const { data: regionalAdmins, isLoading } = useQuery({
    queryKey: ['regional-admins'],
    queryFn: async () => {
      const { data } = await supabase
        .from('user_authorization_levels')
        .select(`
          *,
          profiles:user_id (full_name)
        `)
        .order('current_level', { ascending: false });

      return data?.map(admin => ({
        ...admin,
        full_name: (admin.profiles as any)?.full_name || 'Unknown'
      }));
    }
  });

  // Fetch countries
  const { data: countries } = useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data } = await supabase
        .from('countries')
        .select('country_code, country_name, level1_label, level2_label, level3_label, level4_label, admin_levels_count')
        .eq('is_active', true);
      return data as CountryConfig[] || [];
    }
  });

  // Get current country config
  const currentCountryConfig = countries?.find(c => c.country_code === selectedCountry);

  // Fetch provinces (level 1)
  const { data: provinces } = useQuery({
    queryKey: ['provinces', selectedCountry],
    enabled: !!selectedCountry && selectedLevel <= 4,
    queryFn: async () => {
      const { data } = await supabase
        .from('administrative_divisions')
        .select('id, name, code, level, parent_code')
        .eq('country_code', selectedCountry)
        .eq('level', 1)
        .order('name');
      return data as Division[] || [];
    }
  });

  // Fetch municipalities (level 2) filtered by province
  const { data: municipalities } = useQuery({
    queryKey: ['municipalities', selectedCountry, selectedProvince],
    enabled: !!selectedCountry && !!selectedProvince && selectedLevel <= 3,
    queryFn: async () => {
      const { data } = await supabase
        .from('administrative_divisions')
        .select('id, name, code, level, parent_code')
        .eq('country_code', selectedCountry)
        .eq('level', 2)
        .eq('parent_code', selectedProvince)
        .order('name');
      return data as Division[] || [];
    }
  });

  // Fetch communes (level 3) filtered by municipality
  const { data: communes } = useQuery({
    queryKey: ['communes', selectedCountry, selectedMunicipality],
    enabled: !!selectedCountry && !!selectedMunicipality && selectedLevel <= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('administrative_divisions')
        .select('id, name, code, level, parent_code')
        .eq('country_code', selectedCountry)
        .eq('level', 3)
        .eq('parent_code', selectedMunicipality)
        .order('name');
      return data as Division[] || [];
    }
  });

  // Fetch neighborhoods (level 4) filtered by commune
  const { data: neighborhoods } = useQuery({
    queryKey: ['neighborhoods', selectedCountry, selectedCommune],
    enabled: !!selectedCountry && !!selectedCommune && selectedLevel === 1,
    queryFn: async () => {
      const { data } = await supabase
        .from('administrative_divisions')
        .select('id, name, code, level, parent_code')
        .eq('country_code', selectedCountry)
        .eq('level', 4)
        .eq('parent_code', selectedCommune)
        .order('name');
      return data as Division[] || [];
    }
  });

  // Reset child selections when parent changes
  useEffect(() => {
    setSelectedMunicipality("");
    setSelectedCommune("");
    setSelectedNeighborhood("");
  }, [selectedProvince]);

  useEffect(() => {
    setSelectedCommune("");
    setSelectedNeighborhood("");
  }, [selectedMunicipality]);

  useEffect(() => {
    setSelectedNeighborhood("");
  }, [selectedCommune]);

  // Reset all selections when level changes
  useEffect(() => {
    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedCommune("");
    setSelectedNeighborhood("");
  }, [selectedLevel, selectedCountry]);

  // Get division names for insertion
  const getSelectedDivisionNames = () => {
    const provinceDiv = provinces?.find(p => p.code === selectedProvince);
    const municipalityDiv = municipalities?.find(m => m.code === selectedMunicipality);
    const communeDiv = communes?.find(c => c.code === selectedCommune);
    const neighborhoodDiv = neighborhoods?.find(n => n.code === selectedNeighborhood);

    return {
      level1_code: selectedProvince || null,
      level1_name: provinceDiv?.name || null,
      level2_code: selectedMunicipality || null,
      level2_name: municipalityDiv?.name || null,
      level3_code: selectedCommune || null,
      level3_name: communeDiv?.name || null,
      level4_code: selectedNeighborhood || null,
      level4_name: neighborhoodDiv?.name || null,
    };
  };

  // Map authorization level to app_role
  const getLevelRole = (level: number): string => {
    const roleMap: Record<number, string> = {
      5: 'admin_national',
      4: 'admin_province',
      3: 'admin_municipality',
      2: 'operator_field',
      1: 'operator_field',
    };
    return roleMap[level] || 'user';
  };

  // Assign or update authorization level mutation
  const assignLevelMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      level: number;
      country: string;
      isUpdate?: boolean;
    }) => {
      const divisionData = getSelectedDivisionNames();
      
      // 1. Upsert authorization level with jurisdiction
      const { error: levelError } = await supabase
        .from('user_authorization_levels')
        .upsert({
          user_id: data.userId,
          current_level: data.level,
          jurisdiction_country: data.country,
          jurisdiction_level1_code: divisionData.level1_code,
          jurisdiction_level1_name: divisionData.level1_name,
          jurisdiction_level2_code: divisionData.level2_code,
          jurisdiction_level2_name: divisionData.level2_name,
          jurisdiction_level3_code: divisionData.level3_code,
          jurisdiction_level3_name: divisionData.level3_name,
          jurisdiction_level4_code: divisionData.level4_code,
          jurisdiction_level4_name: divisionData.level4_name,
        }, { onConflict: 'user_id' });

      if (levelError) throw levelError;

      // 2. Assign the corresponding regional role
      const newRole = getLevelRole(data.level);
      
      // Remove old regional roles first (if updating)
      if (data.isUpdate) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', data.userId)
          .in('role', ['admin_national', 'admin_province', 'admin_municipality', 'operator_field'] as any);
      }
      
      // Check if user already has this role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', data.userId)
        .eq('role', newRole as any)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: data.userId,
            role: newRole as any,
          });

        if (roleError) throw roleError;
      }
    },
    onSuccess: () => {
      toast.success(t('regionmgmt_toast_assign_success'));
      queryClient.invalidateQueries({ queryKey: ['regional-admins'] });
      queryClient.invalidateQueries({ queryKey: ['all-users-for-levels'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(t('regionmgmt_toast_assign_error'));
      console.error(error);
    }
  });

  const resetForm = () => {
    setSelectedUser("");
    setSelectedLevel(1);
    setSelectedCountry("");
    setSelectedProvince("");
    setSelectedMunicipality("");
    setSelectedCommune("");
    setSelectedNeighborhood("");
  };

  const validateForm = () => {
    if (!selectedUser) {
      toast.error(t('regionmgmt_validate_select_user'));
      return false;
    }
    if (!selectedCountry) {
      toast.error(t('regionmgmt_validate_select_country'));
      return false;
    }
    // Level 5 (Nacional) doesn't need subdivisions
    if (selectedLevel === 5) return true;
    
    // Level 4 (Provincial) needs province
    if (selectedLevel === 4 && !selectedProvince) {
      toast.error(t('regionmgmt_validate_select_province'));
      return false;
    }
    
    // Level 3 (Municipal) needs province + municipality
    if (selectedLevel === 3) {
      if (!selectedProvince) {
        toast.error(t('regionmgmt_validate_select_province'));
        return false;
      }
      if (!selectedMunicipality) {
        toast.error(t('regionmgmt_validate_select_municipality'));
        return false;
      }
    }
    
    // Level 2 (Comunal) needs province + municipality + commune (if communes exist)
    if (selectedLevel === 2) {
      if (!selectedProvince) {
        toast.error(t('regionmgmt_validate_select_province'));
        return false;
      }
      if (!selectedMunicipality) {
        toast.error(t('regionmgmt_validate_select_municipality'));
        return false;
      }
      // Commune is optional if none exist in DB
    }
    
    // Level 1 (Local) needs all levels
    if (selectedLevel === 1) {
      if (!selectedProvince) {
        toast.error(t('regionmgmt_validate_select_province'));
        return false;
      }
      if (!selectedMunicipality) {
        toast.error(t('regionmgmt_validate_select_municipality'));
        return false;
      }
      // Commune and neighborhood are optional if none exist in DB
    }
    
    return true;
  };

  const handleAssign = () => {
    if (!validateForm()) return;
    
    const userHasLevel = allUsers?.find(u => u.user_id === selectedUser)?.hasLevel;

    assignLevelMutation.mutate({
      userId: selectedUser,
      level: selectedLevel,
      country: selectedCountry,
      isUpdate: userHasLevel,
    });
  };

  const getLevelBadgeColor = (level: number) => {
    const colors: Record<number, string> = {
      5: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      4: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      2: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      1: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
    };
    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const getLevelName = (level: number) => {
    const slugMap: Record<number, string> = {
      5: 'regionmgmt_level_national',
      4: 'regionmgmt_level_provincial',
      3: 'regionmgmt_level_municipal',
      2: 'regionmgmt_level_communal',
      1: 'regionmgmt_level_local',
    };
    return slugMap[level] ? t(slugMap[level]) : t('regionmgmt_level_unknown');
  };

  const getLevelDescription = (level: number) => {
    const slugMap: Record<number, string> = {
      5: 'regionmgmt_leveldesc_national',
      4: 'regionmgmt_leveldesc_provincial',
      3: 'regionmgmt_leveldesc_municipal',
      2: 'regionmgmt_leveldesc_communal',
      1: 'regionmgmt_leveldesc_local',
    };
    return slugMap[level] ? t(slugMap[level]) : '';
  };

  const getLevelIcon = (level: number) => {
    const levelConfig = AUTHORIZATION_LEVELS.find(l => l.level === level);
    return levelConfig?.icon || MapPin;
  };

  // Get label for division level based on country config
  const getDivisionLabel = (divLevel: number) => {
    if (!currentCountryConfig) {
      const defaults: Record<number, string> = {
        1: t('regionmgmt_div_province'),
        2: t('regionmgmt_div_municipality'),
        3: t('regionmgmt_div_commune'),
        4: t('regionmgmt_div_neighborhood')
      };
      return defaults[divLevel] || `${t('regionmgmt_div_level')} ${divLevel}`;
    }

    const labels: Record<number, string | null> = {
      1: currentCountryConfig.level1_label,
      2: currentCountryConfig.level2_label,
      3: currentCountryConfig.level3_label,
      4: currentCountryConfig.level4_label,
    };
    return labels[divLevel] || `${t('regionmgmt_div_level')} ${divLevel}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{t('regionmgmt_title')}</h1>
              <p className="text-sm text-muted-foreground">
                {t('regionmgmt_subtitle')}
              </p>
            </div>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                {t('regionmgmt_assign_level_btn')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('regionmgmt_dialog_title')}</DialogTitle>
                <DialogDescription>
                  {t('regionmgmt_dialog_description')}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 pt-2">
                {/* User Selection */}
                <div className="space-y-2">
                  <Label>{t('regionmgmt_label_user')}</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('regionmgmt_placeholder_user')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers?.map((user) => (
                        <SelectItem key={user.user_id} value={user.user_id}>
                          <div className="flex items-center gap-2">
                            <span>{user.full_name || t('regionmgmt_no_name')}</span>
                            {user.hasLevel && (
                              <Badge variant="secondary" className="text-xs">{t('regionmgmt_badge_has_level')}</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {allUsers?.find(u => u.user_id === selectedUser)?.hasLevel && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {t('regionmgmt_user_has_level_warning')}
                    </p>
                  )}
                </div>

                {/* Authorization Level Selection */}
                <div className="space-y-2">
                  <Label>{t('regionmgmt_label_auth_level')}</Label>
                  <Select value={selectedLevel.toString()} onValueChange={(v) => setSelectedLevel(parseInt(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUTHORIZATION_LEVELS.map((level) => {
                        const Icon = level.icon;
                        return (
                          <SelectItem key={level.level} value={level.level.toString()}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4" />
                              <span>N{level.level} - {getLevelName(level.level)}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getLevelDescription(selectedLevel)}
                  </p>
                </div>

                {/* Country Selection */}
                <div className="space-y-2">
                  <Label>{t('regionmgmt_label_country')}</Label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('regionmgmt_placeholder_country')} />
                    </SelectTrigger>
                    <SelectContent>
                      {countries?.map((country) => (
                        <SelectItem key={country.country_code} value={country.country_code}>
                          {country.country_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Jurisdiction Selection - Cascading based on level */}
                {selectedCountry && selectedLevel < 5 && (
                  <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
                    <Label className="text-base font-semibold">{t('regionmgmt_geo_jurisdiction')}</Label>
                    
                    {/* Province (for levels 4, 3, 2, 1) */}
                    {selectedLevel <= 4 && provinces && provinces.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm">{getDivisionLabel(1)}</Label>
                        <Select value={selectedProvince} onValueChange={setSelectedProvince}>
                          <SelectTrigger>
                            <SelectValue placeholder={`${t('regionmgmt_select_prefix')} ${getDivisionLabel(1).toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {provinces.map((div) => (
                              <SelectItem key={div.id} value={div.code}>
                                {div.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          {provinces.length} {getDivisionLabel(1).toLowerCase()}s {t('regionmgmt_available')}
                        </p>
                      </div>
                    )}

                    {/* Municipality (for levels 3, 2, 1) */}
                    {selectedLevel <= 3 && selectedProvince && (
                      <div className="space-y-2">
                        <Label className="text-sm">{getDivisionLabel(2)}</Label>
                        {municipalities && municipalities.length > 0 ? (
                          <>
                            <Select value={selectedMunicipality} onValueChange={setSelectedMunicipality}>
                              <SelectTrigger>
                                <SelectValue placeholder={`${t('regionmgmt_select_prefix')} ${getDivisionLabel(2).toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {municipalities.map((div) => (
                                  <SelectItem key={div.id} value={div.code}>
                                    {div.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {municipalities.length} {getDivisionLabel(2).toLowerCase()}s {t('regionmgmt_in_f')} {getDivisionLabel(1).toLowerCase()} {t('regionmgmt_selected_f')}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            {t('regionmgmt_none_m')} {getDivisionLabel(2).toLowerCase()} {t('regionmgmt_available_for_f')} {getDivisionLabel(1).toLowerCase()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Commune (for levels 2, 1) */}
                    {selectedLevel <= 2 && selectedMunicipality && (
                      <div className="space-y-2">
                        <Label className="text-sm">{getDivisionLabel(3)}</Label>
                        {communes && communes.length > 0 ? (
                          <>
                            <Select value={selectedCommune} onValueChange={setSelectedCommune}>
                              <SelectTrigger>
                                <SelectValue placeholder={`${t('regionmgmt_select_prefix')} ${getDivisionLabel(3).toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {communes.map((div) => (
                                  <SelectItem key={div.id} value={div.code}>
                                    {div.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {communes.length} {getDivisionLabel(3).toLowerCase()}s {t('regionmgmt_in_m')} {getDivisionLabel(2).toLowerCase()} {t('regionmgmt_selected_m')}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            {t('regionmgmt_none_f')} {getDivisionLabel(3).toLowerCase()} {t('regionmgmt_registered_for_m')} {getDivisionLabel(2).toLowerCase()}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Neighborhood (for level 1) */}
                    {selectedLevel === 1 && selectedCommune && (
                      <div className="space-y-2">
                        <Label className="text-sm">{getDivisionLabel(4)}</Label>
                        {neighborhoods && neighborhoods.length > 0 ? (
                          <>
                            <Select value={selectedNeighborhood} onValueChange={setSelectedNeighborhood}>
                              <SelectTrigger>
                                <SelectValue placeholder={`${t('regionmgmt_select_prefix')} ${getDivisionLabel(4).toLowerCase()}`} />
                              </SelectTrigger>
                              <SelectContent>
                                {neighborhoods.map((div) => (
                                  <SelectItem key={div.id} value={div.code}>
                                    {div.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              {neighborhoods.length} {getDivisionLabel(4).toLowerCase()}s {t('regionmgmt_in_f')} {getDivisionLabel(3).toLowerCase()} {t('regionmgmt_selected_f')}
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            {t('regionmgmt_none_m')} {getDivisionLabel(4).toLowerCase()} {t('regionmgmt_registered_for_f')} {getDivisionLabel(3).toLowerCase()}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Summary Preview */}
                {selectedUser && selectedCountry && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium mb-1">{t('regionmgmt_summary_title')}</p>
                    <p className="text-sm text-muted-foreground">
                      <strong>{t('regionmgmt_summary_level')}</strong> {getLevelName(selectedLevel)} (N{selectedLevel})
                      <br />
                      <strong>{t('regionmgmt_summary_country')}</strong> {countries?.find(c => c.country_code === selectedCountry)?.country_name}
                      {selectedProvince && (
                        <>
                          <br />
                          <strong>{getDivisionLabel(1)}:</strong> {provinces?.find(p => p.code === selectedProvince)?.name}
                        </>
                      )}
                      {selectedMunicipality && (
                        <>
                          <br />
                          <strong>{getDivisionLabel(2)}:</strong> {municipalities?.find(m => m.code === selectedMunicipality)?.name}
                        </>
                      )}
                      {selectedCommune && (
                        <>
                          <br />
                          <strong>{getDivisionLabel(3)}:</strong> {communes?.find(c => c.code === selectedCommune)?.name}
                        </>
                      )}
                      {selectedNeighborhood && (
                        <>
                          <br />
                          <strong>{getDivisionLabel(4)}:</strong> {neighborhoods?.find(n => n.code === selectedNeighborhood)?.name}
                        </>
                      )}
                    </p>
                  </div>
                )}

                <Button onClick={handleAssign} className="w-full" disabled={assignLevelMutation.isPending}>
                  {assignLevelMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t('regionmgmt_assigning')}
                    </>
                  ) : (
                    t('regionmgmt_assign_level_btn')
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          {AUTHORIZATION_LEVELS.map((level) => {
            const Icon = level.icon;
            const count = regionalAdmins?.filter(a => a.current_level === level.level).length || 0;
            return (
              <Card key={level.level} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{getLevelName(level.level)}</p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                    <div className={`p-2 rounded-lg ${getLevelBadgeColor(level.level)}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t('regionmgmt_table_card_title')}
            </CardTitle>
            <CardDescription>
              {t('regionmgmt_table_card_description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : regionalAdmins?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('regionmgmt_empty_title')}</p>
                <p className="text-sm">{t('regionmgmt_empty_hint')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('regionmgmt_th_name')}</TableHead>
                      <TableHead>{t('regionmgmt_th_level')}</TableHead>
                      <TableHead>{t('regionmgmt_th_country')}</TableHead>
                      <TableHead>{t('regionmgmt_th_jurisdiction')}</TableHead>
                      <TableHead>{t('regionmgmt_th_assigned_at')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {regionalAdmins?.map((admin) => {
                      const Icon = getLevelIcon(admin.current_level);
                      return (
                        <TableRow key={admin.id}>
                          <TableCell className="font-medium">{admin.full_name}</TableCell>
                          <TableCell>
                            <Badge className={`${getLevelBadgeColor(admin.current_level)} flex items-center gap-1 w-fit`}>
                              <Icon className="h-3 w-3" />
                              N{admin.current_level} - {getLevelName(admin.current_level)}
                            </Badge>
                          </TableCell>
                          <TableCell>{admin.jurisdiction_country}</TableCell>
                          <TableCell className="text-sm max-w-xs">
                            {admin.current_level === 5 ? (
                              <span className="text-muted-foreground italic">{t('regionmgmt_whole_country')}</span>
                            ) : (
                              <div className="space-y-0.5">
                                {admin.jurisdiction_level1_name && (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3 text-muted-foreground" />
                                    <span>{admin.jurisdiction_level1_name}</span>
                                  </div>
                                )}
                                {admin.jurisdiction_level2_name && (
                                  <div className="flex items-center gap-1 pl-3">
                                    <MapPinned className="h-3 w-3 text-muted-foreground" />
                                    <span>{admin.jurisdiction_level2_name}</span>
                                  </div>
                                )}
                                {admin.jurisdiction_level3_name && (
                                  <div className="flex items-center gap-1 pl-6">
                                    <LayoutGrid className="h-3 w-3 text-muted-foreground" />
                                    <span>{admin.jurisdiction_level3_name}</span>
                                  </div>
                                )}
                                {admin.jurisdiction_level4_name && (
                                  <div className="flex items-center gap-1 pl-9">
                                    <Home className="h-3 w-3 text-muted-foreground" />
                                    <span>{admin.jurisdiction_level4_name}</span>
                                  </div>
                                )}
                                {!admin.jurisdiction_level1_name && (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {admin.assigned_at ? new Date(admin.assigned_at).toLocaleDateString('pt-BR') : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

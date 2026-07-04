import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, Users, Loader2, ArrowLeft, AlertCircle, Trash2, Search, Download, FileSpreadsheet, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import * as XLSX from 'xlsx';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";

type UserRole = 'admin' | 'moderator' | 'citizen';

interface Profile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

interface UserWithRole extends Profile {
  roles: UserRole[];
  current_level: number | null;
}

export default function AdminUserManagement() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; newRole: UserRole; userName: string } | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ userId: string; userName: string; phone: string | null } | null>(null);
  const [justification, setJustification] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const pageSize = 20;

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, created_at')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get roles for all users
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Get authorization levels
      const { data: levelsData } = await supabase
        .from('user_authorization_levels')
        .select('user_id, current_level');

      // Combine data
      const usersWithRoles: UserWithRole[] = profiles.map(profile => {
        const userRoles = rolesData
          ?.filter(r => r.user_id === profile.user_id)
          .map(r => r.role as UserRole) || [];
        
        const level = levelsData?.find(l => l.user_id === profile.user_id)?.current_level || null;

        return {
          ...profile,
          roles: userRoles.length > 0 ? userRoles : ['citizen'],
          current_level: level
        };
      });

      return usersWithRoles;
    }
  });

  // Check if admin can promote user based on jurisdiction
  const checkJurisdictionMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: UserRole }) => {
      const { data, error } = await supabase
        .rpc('can_promote_user_in_jurisdiction' as any, {
          _admin_user_id: user?.id,
          _target_user_id: userId,
          _requested_role: newRole
        });

      if (error) throw error;
      return data;
    }
  });

  // Mutation to create role change request
  const createRoleRequestMutation = useMutation({
    mutationFn: async ({ userId, newRole, currentRole, userName }: { 
      userId: string; 
      newRole: UserRole; 
      currentRole: UserRole;
      userName: string;
    }) => {
      setLoadingUserId(userId);

      // Check jurisdiction first
      const canPromote = await checkJurisdictionMutation.mutateAsync({ userId, newRole });
      
      if (!canPromote) {
        throw new Error(t('adminusers_err_no_jurisdiction'));
      }

      // Check if user already has this role
      const { data: existingRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', newRole)
        .maybeSingle();

      if (existingRoles) {
        return { userId, newRole, approved: true };
      }

      // For promotions to moderator or admin, create approval request
      if (newRole === 'admin' || newRole === 'moderator') {
        const { error: requestError } = await supabase
          .from('user_role_change_requests' as any)
          .insert({
            user_id: userId,
            requested_role: newRole,
            current_role: currentRole,
            requested_by_user_id: user?.id,
            justification: justification || `Promoção de ${currentRole} para ${newRole}`,
            status: 'pending'
          });

        if (requestError) throw requestError;

        return { userId, newRole, approved: false };
      }

      // For demotion to citizen, apply directly
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (insertError) throw insertError;

      // Log the change
      await supabase.rpc('log_role_change' as any, {
        _user_id: userId,
        _changed_by_user_id: user?.id,
        _old_role: currentRole,
        _new_role: newRole,
        _justification: justification || 'Mudança de papel administrativo'
      });

      return { userId, newRole, approved: true };
    },
    onSuccess: (data) => {
      if (data.approved) {
        toast.success(`${t('adminusers_toast_role_updated')} ${getRoleLabel([data.newRole])}`);
      } else {
        toast.success(t('adminusers_toast_promotion_sent'));
      }
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setLoadingUserId(null);
      setConfirmDialogOpen(false);
      setJustification("");
    },
    onError: (error: any) => {
      toast.error(error.message || t('adminusers_toast_role_error'));
      console.error(error);
      setLoadingUserId(null);
      setConfirmDialogOpen(false);
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId, reason }
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || t('adminusers_toast_delete_error'));

      return data;
    },
    onSuccess: () => {
      toast.success(t('adminusers_toast_delete_success'));
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      setDeleteReason("");
    },
    onError: (error: any) => {
      toast.error(error.message || t('adminusers_toast_delete_error'));
      console.error(error);
    }
  });

  const handleRoleChange = (userId: string, newRole: UserRole, userName: string, currentRoles: UserRole[]) => {
    setSelectedUser({ userId, newRole, userName });
    setConfirmDialogOpen(true);
  };

  const handleDeleteUser = (userProfile: UserWithRole) => {
    setUserToDelete({
      userId: userProfile.user_id,
      userName: userProfile.full_name || t('adminusers_no_name'),
      phone: userProfile.phone
    });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!userToDelete || !deleteReason.trim()) return;
    deleteUserMutation.mutate({ userId: userToDelete.userId, reason: deleteReason });
  };

  const confirmRoleChange = () => {
    if (!selectedUser) return;
    
    const user = users?.find(u => u.user_id === selectedUser.userId);
    if (!user) return;

    createRoleRequestMutation.mutate({
      userId: selectedUser.userId,
      newRole: selectedUser.newRole,
      currentRole: user.roles[0] || 'citizen',
      userName: selectedUser.userName
    });
  };

  // Filter users by search query and advanced filters
  const filteredUsers = users?.filter(u => {
    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!u.full_name?.toLowerCase().includes(query) && !u.phone?.toLowerCase().includes(query)) {
        return false;
      }
    }
    
    // Role filter
    if (roleFilter !== "all") {
      if (roleFilter === "citizen" && u.roles.length > 0 && !u.roles.includes('citizen')) return false;
      if (roleFilter !== "citizen" && !u.roles.includes(roleFilter as UserRole)) return false;
    }
    
    // Level filter
    if (levelFilter !== "all") {
      const level = parseInt(levelFilter);
      if (u.current_level !== level) return false;
    }
    
    // Date filters
    if (dateFrom) {
      const userDate = new Date(u.created_at);
      if (userDate < dateFrom) return false;
    }
    if (dateTo) {
      const userDate = new Date(u.created_at);
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (userDate > endOfDay) return false;
    }
    
    return true;
  });

  // Reset to page 1 when search changes
  const totalPages = Math.ceil((filteredUsers?.length || 0) / pageSize);
  const paginatedUsers = filteredUsers?.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Reset page when filter changes
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setRoleFilter("all");
    setLevelFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
    setCurrentPage(1);
  };

  const hasActiveFilters = roleFilter !== "all" || levelFilter !== "all" || dateFrom || dateTo;

  const getRoleBadgeVariant = (roles: UserRole[]) => {
    if (roles.includes('admin')) return 'default';
    if (roles.includes('moderator')) return 'secondary';
    return 'outline';
  };

  const getRoleLabel = (roles: UserRole[]) => {
    if (roles.includes('admin')) return t('adminusers_role_admin');
    if (roles.includes('moderator')) return t('adminusers_role_moderator');
    return t('adminusers_role_citizen');
  };

  const prepareExportData = () => {
    return (filteredUsers || []).map(u => ({
      [t('adminusers_col_name')]: u.full_name || t('adminusers_no_name'),
      [t('adminusers_col_phone')]: u.phone || '-',
      [t('adminusers_col_role')]: getRoleLabel(u.roles),
      [t('adminusers_col_level')]: u.current_level ? `${t('adminusers_level')} ${u.current_level}` : '-',
      [t('adminusers_col_registered_at')]: new Date(u.created_at).toLocaleDateString('pt-BR')
    }));
  };

  const exportToCSV = () => {
    const data = prepareExportData();
    if (data.length === 0) {
      toast.error(t('adminusers_toast_nothing_to_export'));
      return;
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h as keyof typeof row] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `utilizadores_afroloc_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('adminusers_toast_exported_csv'));
  };

  const exportToExcel = () => {
    const data = prepareExportData();
    if (data.length === 0) {
      toast.error(t('adminusers_toast_nothing_to_export'));
      return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('adminusers_sheet_name'));
    XLSX.writeFile(workbook, `utilizadores_afroloc_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success(t('adminusers_toast_exported_excel'));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">{t('adminusers_page_title')}</h1>
              <p className="text-muted-foreground">{t('adminusers_page_subtitle')}</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('adminusers_back')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('adminusers_all_users')} ({filteredUsers?.length || 0})
                </CardTitle>
                <CardDescription>
                  {t('adminusers_card_desc')}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToCSV}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToExcel}
                    className="flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </Button>
                </div>
                <div className="relative w-full sm:w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('adminusers_search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            
            {/* Advanced Filters */}
            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t items-end">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('adminusers_filter_role')}</Label>
                <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder={t('adminusers_all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('adminusers_all')}</SelectItem>
                    <SelectItem value="admin">{t('adminusers_role_admin')}</SelectItem>
                    <SelectItem value="moderator">{t('adminusers_role_moderator')}</SelectItem>
                    <SelectItem value="citizen">{t('adminusers_role_citizen')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('adminusers_level')}</Label>
                <Select value={levelFilter} onValueChange={(v) => { setLevelFilter(v); handleFilterChange(); }}>
                  <SelectTrigger className="w-[110px]">
                    <SelectValue placeholder={t('adminusers_all')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('adminusers_all')}</SelectItem>
                    <SelectItem value="1">{t('adminusers_level')} 1</SelectItem>
                    <SelectItem value="2">{t('adminusers_level')} 2</SelectItem>
                    <SelectItem value="3">{t('adminusers_level')} 3</SelectItem>
                    <SelectItem value="4">{t('adminusers_level')} 4</SelectItem>
                    <SelectItem value="5">{t('adminusers_level')} 5</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('adminusers_date_from')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                      {dateFrom ? dateFrom.toLocaleDateString('pt-BR') : t('adminusers_start')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => { setDateFrom(d); handleFilterChange(); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('adminusers_date_to')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                      {dateTo ? dateTo.toLocaleDateString('pt-BR') : t('adminusers_end')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => { setDateTo(d); handleFilterChange(); }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                  {t('adminusers_clear_filters')}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : paginatedUsers && paginatedUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-xl font-semibold mb-2">{t('no_users_found_title')}</h2>
                <p className="text-muted-foreground max-w-md">{t('no_users_found_desc')}</p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('adminusers_col_name')}</TableHead>
                      <TableHead>{t('adminusers_col_phone')}</TableHead>
                      <TableHead>{t('adminusers_th_current_role')}</TableHead>
                      <TableHead>{t('adminusers_level')}</TableHead>
                      <TableHead>{t('adminusers_th_registered')}</TableHead>
                      <TableHead>{t('adminusers_col_role')}</TableHead>
                      <TableHead className="text-right">{t('adminusers_th_actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUsers?.map((userRow) => (
                      <TableRow key={userRow.user_id}>
                        <TableCell className="font-medium">
                          {userRow.full_name || t('adminusers_no_name')}
                        </TableCell>
                        <TableCell>{userRow.phone || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={getRoleBadgeVariant(userRow.roles)}>
                            {getRoleLabel(userRow.roles)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {userRow.current_level ? `${t('adminusers_level')} ${userRow.current_level}` : '-'}
                        </TableCell>
                        <TableCell>
                          {new Date(userRow.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={userRow.roles[0] || 'citizen'}
                            onValueChange={(value: UserRole) => 
                              handleRoleChange(userRow.user_id, value, userRow.full_name || t('adminusers_no_name'), userRow.roles)
                            }
                            disabled={loadingUserId === userRow.user_id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="citizen">{t('adminusers_role_citizen')}</SelectItem>
                              <SelectItem value="moderator">{t('adminusers_role_moderator')}</SelectItem>
                              <SelectItem value="admin">{t('adminusers_role_admin')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteUser(userRow)}
                            disabled={userRow.user_id === user?.id}
                            title={userRow.user_id === user?.id ? t('adminusers_cannot_delete_self') : t('adminusers_delete_user')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 pt-4 border-t gap-2">
                  <p className="text-sm text-muted-foreground">
                    {t('adminusers_showing')} {((currentPage - 1) * pageSize) + 1} {t('adminusers_to')} {Math.min(currentPage * pageSize, filteredUsers?.length || 0)} {t('adminusers_of')} {filteredUsers?.length || 0} {t('adminusers_users_lower')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t('adminusers_previous')}
                    </Button>
                    <span className="text-sm px-2">
                      {t('adminusers_page')} {currentPage} {t('adminusers_of')} {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      {t('adminusers_next')}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
            )}
          </CardContent>
        </Card>

        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-warning" />
                {t('adminusers_confirm_role_title')}
              </DialogTitle>
              <DialogDescription>
                {t('adminusers_confirm_role_prefix')}{" "}
                <span className="font-semibold">{selectedUser?.userName}</span> {t('adminusers_confirm_role_to')}{" "}
                <span className="font-semibold">{selectedUser && getRoleLabel([selectedUser.newRole])}</span>.
                {selectedUser?.newRole === 'admin' && (
                  <span className="block mt-2 text-warning">
                    ⚠️ {t('adminusers_promo_national')}
                  </span>
                )}
                {selectedUser?.newRole === 'moderator' && (
                  <span className="block mt-2 text-warning">
                    ⚠️ {t('adminusers_promo_regional')}
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="justification">{t('adminusers_justification_label')}</Label>
                <Textarea
                  id="justification"
                  placeholder={t('adminusers_justification_placeholder')}
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                  required
                />
              </div>
              
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium mb-1">{t('adminusers_restrictions_title')}</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>{t('adminusers_restriction_geo')}</li>
                  <li>{t('adminusers_restriction_level')}</li>
                  <li>{t('adminusers_restriction_audit')}</li>
                  <li>{t('adminusers_restriction_cascade')}</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmDialogOpen(false);
                  setJustification("");
                }}
              >
                {t('adminusers_cancel')}
              </Button>
              <Button
                onClick={confirmRoleChange}
                disabled={!justification.trim() || createRoleRequestMutation.isPending}
              >
                {createRoleRequestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('adminusers_confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete User Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                {t('adminusers_delete_user_title')}
              </DialogTitle>
              <DialogDescription>
                {t('adminusers_delete_confirm_prefix')}{" "}
                <span className="font-semibold">{userToDelete?.userName}</span>
                {userToDelete?.phone && (
                  <span> ({userToDelete.phone})</span>
                )}?
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <p className="font-medium mb-1">⚠️ {t('adminusers_delete_warning')}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t('adminusers_delete_item_data')}</li>
                  <li>{t('adminusers_delete_item_addresses')}</li>
                  <li>{t('adminusers_delete_item_testimonials')}</li>
                  <li>{t('adminusers_delete_item_biometric')}</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deleteReason">{t('adminusers_delete_reason_label')}</Label>
                <Textarea
                  id="deleteReason"
                  placeholder={t('adminusers_delete_reason_placeholder')}
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setUserToDelete(null);
                  setDeleteReason("");
                }}
              >
                {t('adminusers_cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={!deleteReason.trim() || deleteUserMutation.isPending}
              >
                {deleteUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('adminusers_delete_permanently')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

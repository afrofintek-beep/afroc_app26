import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { AuthorizationLevelBadge } from "@/components/AuthorizationLevelBadge";
import { Search, TrendingUp, Users as UsersIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";

interface UserWithLevel {
  id: string;
  email: string;
  full_name: string;
  current_level: number;
  witness_count: number;
  validation_count: number;
  afroid_count: number;
  account_age_days: number;
}

const UserLevels = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: users, isLoading } = useQuery({
    queryKey: ["user-levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_authorization_levels")
        .select(`
          *,
          profiles!inner(full_name, user_id)
        `)
        .order("current_level", { ascending: false });

      if (error) throw error;

      const usersWithDetails: UserWithLevel[] = data.map((level: any) => {
        const profile = level.profiles;
        
        return {
          id: level.user_id,
          email: "user@example.com", // Email not available without admin API
          full_name: profile?.full_name || "N/A",
          current_level: level.current_level,
          witness_count: level.witness_count,
          validation_count: level.validation_count,
          afroid_count: level.afroid_count,
          account_age_days: level.account_age_days
        };
      });

      return usersWithDetails;
    },
  });

  const filteredUsers = users?.filter(user => 
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const levelStats = users?.reduce((acc, user) => {
    acc[user.current_level] = (acc[user.current_level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  return (
    <DashboardLayout>
      <div className="w-full max-w-7xl mx-auto px-0">
          <div className="mb-8 flex items-start gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/dashboard")}
              className="flex-shrink-0 mt-1"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t('user_authorization_levels')}</h1>
              <p className="text-muted-foreground">
                {t('view_manage_user_levels')}
              </p>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-5 mb-8">
            {[1, 2, 3, 4, 5].map(level => (
              <Card key={level}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    <AuthorizationLevelBadge level={level} size="sm" showTooltip={false} />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{levelStats?.[level] || 0}</div>
                  <p className="text-xs text-muted-foreground">{t('users')}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* User Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{t('all_users')}</CardTitle>
                  <CardDescription>{t('complete_list_users')}</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t('search_users')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('user')}</TableHead>
                      <TableHead>{t('email')}</TableHead>
                      <TableHead>{t('level')}</TableHead>
                      <TableHead className="text-center">{t('afrolocs')}</TableHead>
                      <TableHead className="text-center">{t('witnesses')}</TableHead>
                      <TableHead className="text-center">{t('validations')}</TableHead>
                      <TableHead className="text-center">{t('account_age')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <AuthorizationLevelBadge level={user.current_level} size="sm" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{user.afroid_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{user.witness_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{user.validation_count}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{user.account_age_days}d</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
    </DashboardLayout>
  );
};

export default UserLevels;

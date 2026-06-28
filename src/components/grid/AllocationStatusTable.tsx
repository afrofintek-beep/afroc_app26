/**
 * AFROLOC - African Digital Address Identification System
 * Allocation Status Table - Track cell allocation lifecycle with batch operations
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Filter, 
  CheckCircle, 
  Clock,
  XCircle,
  Eye,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  CheckCheck,
  X,
  AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface AllocationRecord {
  id: string;
  afroloc: string;
  zone: 'urban' | 'rural';
  status: 'pending' | 'allocated' | 'approved' | 'rejected';
  createdAt: string;
  allocatedAt?: string;
  approvedAt?: string;
  adminPath?: string;
  ownerEmail?: string;
}

interface AllocationStatusTableProps {
  countryCode: string;
}

type BatchAction = 'approve' | 'reject' | null;

export default function AllocationStatusTable({ countryCode }: AllocationStatusTableProps) {
  const [records, setRecords] = useState<AllocationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Batch action dialog state
  const [batchAction, setBatchAction] = useState<BatchAction>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRecords();
  }, [countryCode, statusFilter]);

  // Clear selection when records change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [records]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('afroloc_records')
        .select(`
          id, 
          afroloc_code, 
          metadata,
          status,
          created_at,
          updated_at,
          level1_name,
          level2_name,
          level3_name,
          profiles:user_id(email)
        `)
        .eq('country', countryCode)
        .order('created_at', { ascending: false })
        .limit(50);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as "approved" | "certified" | "draft" | "pending" | "pending_validation" | "rejected" | "verified");
      }

      const { data, error } = await query;

      if (error) throw error;

      const mapped: AllocationRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        afroloc: r.afroloc_code || r.metadata?.afroloc || 'N/A',
        zone: r.metadata?.zone || 'rural',
        status: r.status || 'pending',
        createdAt: r.created_at,
        allocatedAt: r.metadata?.allocated_at,
        approvedAt: r.status === 'approved' ? r.updated_at : undefined,
        adminPath: [r.level1_name, r.level2_name, r.level3_name].filter(Boolean).join(' > '),
        ownerEmail: r.profiles?.email,
      }));

      setRecords(mapped);
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: AllocationRecord['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'allocated':
        return <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" />Alocado</Badge>;
      case 'approved':
        return <Badge className="bg-primary text-primary-foreground"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejeitado</Badge>;
    }
  };

  const filteredRecords = records.filter(r => 
    r.afroloc.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.adminPath?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.ownerEmail?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Selection handlers
  const selectableRecords = filteredRecords.filter(r => r.status === 'pending' || r.status === 'allocated');
  
  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === selectableRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableRecords.map(r => r.id)));
    }
  }, [selectableRecords, selectedIds.size]);

  const handleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isAllSelected = selectableRecords.length > 0 && selectedIds.size === selectableRecords.length;
  const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < selectableRecords.length;

  // Batch action handlers
  const handleBatchApprove = () => {
    setBatchAction('approve');
  };

  const handleBatchReject = () => {
    setBatchAction('reject');
    setRejectionReason('');
  };

  const confirmBatchAction = async () => {
    if (selectedIds.size === 0) return;
    
    setProcessing(true);
    try {
      const newStatus = batchAction === 'approve' ? 'approved' : 'rejected';
      const ids = Array.from(selectedIds);
      
      const updates: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };

      // Add rejection reason to metadata if rejecting
      if (batchAction === 'reject' && rejectionReason.trim()) {
        // We need to update metadata with rejection reason
        // For now, we'll update status and handle metadata separately
      }

      const { error } = await supabase
        .from('afroloc_records')
        .update(updates)
        .in('id', ids);

      if (error) throw error;

      toast.success(
        batchAction === 'approve' 
          ? `${ids.length} células aprovadas com sucesso`
          : `${ids.length} células rejeitadas`
      );

      // Clear selection and refresh
      setSelectedIds(new Set());
      setBatchAction(null);
      setRejectionReason('');
      await fetchRecords();
    } catch (err) {
      console.error('Batch action error:', err);
      toast.error('Erro ao processar ação em lote');
    } finally {
      setProcessing(false);
    }
  };

  const handleSingleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('afroloc_records')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Célula aprovada');
      await fetchRecords();
    } catch (err) {
      console.error('Approve error:', err);
      toast.error('Erro ao aprovar');
    }
  };

  const handleSingleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('afroloc_records')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      toast.success('Célula rejeitada');
      await fetchRecords();
    } catch (err) {
      console.error('Reject error:', err);
      toast.error('Erro ao rejeitar');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Estado de Alocação
              </CardTitle>
              <CardDescription>
                Monitorizar ciclo de vida das células
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchRecords}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Batch Action Bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-muted border animate-in fade-in slide-in-from-top-2">
              <Badge variant="secondary" className="font-medium">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
              </Badge>
              <div className="flex-1" />
              <Button
                size="sm"
                variant="default"
                onClick={handleBatchApprove}
                className="gap-2"
              >
                <CheckCheck className="h-4 w-4" />
                Aprovar Selecionados
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBatchReject}
                className="gap-2"
              >
                <XCircle className="h-4 w-4" />
                Rejeitar Selecionados
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar código, região ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="allocated">Alocado</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) {
                            (el as unknown as HTMLInputElement).indeterminate = isPartiallySelected;
                          }
                        }}
                        onCheckedChange={handleSelectAll}
                        aria-label="Selecionar todos"
                        disabled={selectableRecords.length === 0}
                      />
                    </TableHead>
                    <TableHead>Código AFROLOC</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length > 0 ? (
                    filteredRecords.map(record => {
                      const isSelectable = record.status === 'pending' || record.status === 'allocated';
                      const isSelected = selectedIds.has(record.id);
                      
                      return (
                        <TableRow 
                          key={record.id}
                          className={isSelected ? 'bg-muted/50' : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => handleSelectOne(record.id)}
                              aria-label={`Selecionar ${record.afroloc}`}
                              disabled={!isSelectable}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {record.afroloc}
                          </TableCell>
                          <TableCell>
                            <Badge variant={record.zone === 'urban' ? 'default' : 'secondary'}>
                              {record.zone === 'urban' ? '10m' : '25m'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(record.status)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {record.adminPath || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(record.createdAt).toLocaleDateString('pt')}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                {isSelectable && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleSingleApprove(record.id)}>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Aprovar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => handleSingleReject(record.id)}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Rejeitar
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum registo encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          {/* Summary */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
            <span>{filteredRecords.length} registos</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-secondary" />
              {filteredRecords.filter(r => r.status === 'pending').length} pendentes
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" />
              {filteredRecords.filter(r => r.status === 'approved').length} aprovados
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Batch Approve Dialog */}
      <AlertDialog open={batchAction === 'approve'} onOpenChange={(open) => !open && setBatchAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCheck className="h-5 w-5 text-primary" />
              Confirmar Aprovação em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja aprovar <strong>{selectedIds.size}</strong> célula{selectedIds.size !== 1 ? 's' : ''}?
              Esta ação irá marcar todas as células selecionadas como aprovadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {Array.from(selectedIds).slice(0, 10).map(id => {
                const record = records.find(r => r.id === id);
                return (
                  <Badge key={id} variant="secondary" className="font-mono text-xs">
                    {record?.afroloc || id.slice(0, 8)}
                  </Badge>
                );
              })}
              {selectedIds.size > 10 && (
                <Badge variant="outline">+{selectedIds.size - 10} mais</Badge>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBatchAction}
              disabled={processing}
              className="gap-2"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              Aprovar {selectedIds.size} célula{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Reject Dialog */}
      <AlertDialog open={batchAction === 'reject'} onOpenChange={(open) => !open && setBatchAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Rejeição em Lote
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja rejeitar <strong>{selectedIds.size}</strong> célula{selectedIds.size !== 1 ? 's' : ''}?
              Esta ação não pode ser desfeita facilmente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
              {Array.from(selectedIds).slice(0, 8).map(id => {
                const record = records.find(r => r.id === id);
                return (
                  <Badge key={id} variant="secondary" className="font-mono text-xs">
                    {record?.afroloc || id.slice(0, 8)}
                  </Badge>
                );
              })}
              {selectedIds.size > 8 && (
                <Badge variant="outline">+{selectedIds.size - 8} mais</Badge>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motivo da rejeição (opcional)
              </label>
              <Textarea
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmBatchAction}
              disabled={processing}
              className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              Rejeitar {selectedIds.size} célula{selectedIds.size !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Database } from "@/integrations/supabase/types";

type ResidentRelationship = Database["public"]["Enums"]["resident_relationship"];

interface AddResidentDialogProps {
  afrolocRecordId: string;
  afrolocCode: string;
  maxResidents: number;
  currentResidents: number;
  onResidentAdded: () => void;
}

export function AddResidentDialog({
  afrolocRecordId,
  afrolocCode,
  maxResidents,
  currentResidents,
  onResidentAdded,
}: AddResidentDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState<ResidentRelationship | "">("");
  const { toast } = useToast();
  const { t } = useLanguage();

  const relationships: { value: ResidentRelationship; label: string }[] = [
    { value: 'spouse', label: t('relationship_spouse') || 'Cônjuge' },
    { value: 'child', label: t('relationship_child') || 'Filho/a' },
    { value: 'parent', label: t('relationship_parent') || 'Pai/Mãe' },
    { value: 'sibling', label: t('relationship_sibling') || 'Irmão/Irmã' },
    { value: 'other_family', label: t('relationship_other_family') || 'Outro Familiar' },
    { value: 'tenant', label: t('relationship_tenant') || 'Inquilino' },
    { value: 'cohabitant', label: t('relationship_cohabitant') || 'Coabitante' },
  ];

  const remainingSlots = maxResidents - currentResidents;
  const canAddMore = remainingSlots > 0;

  const reset = () => {
    setFullName("");
    setPhone("");
    setRelationship("");
  };

  const handleSubmit = async () => {
    // Grau de parentesco e nome são OBRIGATÓRIOS. O telefone é opcional.
    if (!fullName.trim() || !relationship) {
      toast({
        title: t('validation_error') || 'Erro de Validação',
        description: t('resident_name_relationship_required') || 'Indique o nome e o grau de parentesco.',
        variant: 'destructive',
      });
      return;
    }

    if (!canAddMore) {
      toast({
        title: t('limit_reached') || 'Limite Atingido',
        description: t('max_residents_reached') || 'Número máximo de residentes atingido',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Telefone OPCIONAL: se for indicado e existir uma conta com esse número,
      // liga-se essa conta (fluxo de co-residente com documentos). Caso contrário,
      // o membro fica registado apenas por NOME (agregado familiar sem conta).
      let linkedUserId: string | null = null;
      if (phone.trim()) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('phone', phone.trim())
          .maybeSingle();
        if (profile?.id) {
          linkedUserId = profile.id;
          // Evitar duplicar uma conta já residente neste endereço.
          const { data: existing } = await supabase
            .from('afroloc_residents')
            .select('id')
            .eq('afroloc_record_id', afrolocRecordId)
            .eq('user_id', profile.id)
            .not('status', 'in', '("rejected","revoked")')
            .maybeSingle();
          if (existing) {
            toast({
              title: t('already_resident') || 'Já Registado',
              description: t('user_already_resident') || 'Esta pessoa já está registada neste endereço',
              variant: 'destructive',
            });
            setLoading(false);
            return;
          }
        }
      }

      // Membro só-nome é aprovado de imediato (declarado pelo dono do agregado);
      // membro com conta ligada segue o fluxo de documentos/aprovação.
      const { error: insertError } = await supabase
        .from('afroloc_residents')
        .insert({
          afroloc_record_id: afrolocRecordId,
          user_id: linkedUserId,
          full_name: fullName.trim(),
          relationship: relationship as ResidentRelationship,
          is_primary: false,
          status: linkedUserId ? 'pending_documents' : 'approved',
        } as never);

      if (insertError) throw insertError;

      toast({
        title: t('resident_added') || 'Residente Adicionado',
        description: linkedUserId
          ? (t('resident_added_desc') || 'Pedido criado. A pessoa deve submeter os documentos.')
          : (t('resident_added_name_desc') || 'Membro do agregado adicionado ao endereço.'),
      });

      setOpen(false);
      reset();
      onResidentAdded();
    } catch (error: any) {
      console.error('Error adding resident:', error);
      toast({
        title: t('error') || 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button disabled={!canAddMore}>
          <UserPlus className="h-4 w-4 mr-2" />
          {t('add_resident') || 'Adicionar Residente'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('add_coresident') || 'Adicionar Membro do Agregado'}</DialogTitle>
          <DialogDescription>
            {t('add_coresident_desc') || 'Adicione um membro da família a este endereço AFROLOC. O telefone é opcional — só é preciso se a pessoa tiver conta própria.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informação de capacidade */}
          <Alert variant={canAddMore ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {canAddMore ? (
                <>
                  {t('remaining_slots') || 'Vagas disponíveis'}: <strong>{remainingSlots}</strong> de {maxResidents}
                </>
              ) : (
                t('no_slots_available') || 'Não há vagas disponíveis'
              )}
            </AlertDescription>
          </Alert>

          {/* Código AFROLOC */}
          <div className="space-y-2">
            <Label>{t('afroloc_code') || 'Código AFROLOC'}</Label>
            <Input value={afrolocCode} disabled className="font-mono" />
          </div>

          {/* Nome completo (OBRIGATÓRIO) */}
          <div className="space-y-2">
            <Label htmlFor="resident-name">{t('resident_full_name') || 'Nome completo'} <span className="text-destructive">*</span></Label>
            <Input
              id="resident-name"
              placeholder={t('resident_full_name_placeholder') || 'Ex.: Maria Dinguanza'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={!canAddMore}
            />
          </div>

          {/* Grau de parentesco (OBRIGATÓRIO) */}
          <div className="space-y-2">
            <Label>{t('relationship') || 'Grau de parentesco'} <span className="text-destructive">*</span></Label>
            <Select
              value={relationship}
              onValueChange={(val) => setRelationship(val as ResidentRelationship)}
              disabled={!canAddMore}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select_relationship') || 'Selecionar grau de parentesco'} />
              </SelectTrigger>
              <SelectContent>
                {relationships.map((rel) => (
                  <SelectItem key={rel.value} value={rel.value}>
                    {rel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Telefone (OPCIONAL) */}
          <div className="space-y-2">
            <Label htmlFor="phone">{t('resident_phone_optional') || 'Telefone (opcional)'}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+244 9XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canAddMore}
            />
            <p className="text-xs text-muted-foreground">
              {t('resident_phone_optional_hint') || 'Só se a pessoa tiver conta AFROLOC própria. Sem telefone, o membro fica registado só pelo nome.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel') || 'Cancelar'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !canAddMore}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('add_resident') || 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

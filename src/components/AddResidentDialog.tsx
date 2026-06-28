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

  const handleSubmit = async () => {
    if (!phone || !relationship) {
      toast({
        title: t('validation_error') || 'Erro de Validação',
        description: t('fill_all_fields') || 'Preencha todos os campos',
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
      // Encontrar utilizador pelo telefone
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .eq('phone', phone)
        .single();

      if (profileError || !profile) {
        toast({
          title: t('user_not_found') || 'Utilizador Não Encontrado',
          description: t('user_must_register') || 'Este utilizador deve primeiro registar-se no AFROLOC',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Verificar se já existe pedido para este utilizador
      const { data: existingResident } = await supabase
        .from('afroloc_residents')
        .select('id, status')
        .eq('afroloc_record_id', afrolocRecordId)
        .eq('user_id', profile.id)
        .not('status', 'in', '("rejected","revoked")')
        .single();

      if (existingResident) {
        toast({
          title: t('already_resident') || 'Já Registado',
          description: t('user_already_resident') || 'Este utilizador já está registado neste endereço',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Criar pedido de co-residência
      const { error: insertError } = await supabase
        .from('afroloc_residents')
        .insert({
          afroloc_record_id: afrolocRecordId,
          user_id: profile.id,
          relationship: relationship as ResidentRelationship,
          is_primary: false,
          status: 'pending_documents', // Começa a aguardar documentos
        });

      if (insertError) throw insertError;

      toast({
        title: t('resident_added') || 'Residente Adicionado',
        description: t('resident_added_desc') || 'O pedido foi criado. O utilizador deve agora submeter os documentos.',
      });

      setOpen(false);
      setPhone("");
      setRelationship("");
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={!canAddMore}>
          <UserPlus className="h-4 w-4 mr-2" />
          {t('add_resident') || 'Adicionar Residente'}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('add_coresident') || 'Adicionar Co-Residente'}</DialogTitle>
          <DialogDescription>
            {t('add_coresident_desc') || 'Adicione um membro da família ou inquilino a este endereço AFROLOC.'}
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

          {/* Telefone do novo residente */}
          <div className="space-y-2">
            <Label htmlFor="phone">{t('resident_phone') || 'Telefone do Residente'}</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+244 9XX XXX XXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={!canAddMore}
            />
            <p className="text-xs text-muted-foreground">
              {t('resident_must_be_registered') || 'O residente deve estar registado no AFROLOC'}
            </p>
          </div>

          {/* Relação */}
          <div className="space-y-2">
            <Label>{t('relationship') || 'Relação com o Endereço'}</Label>
            <Select
              value={relationship}
              onValueChange={(val) => setRelationship(val as ResidentRelationship)}
              disabled={!canAddMore}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('select_relationship') || 'Selecionar relação'} />
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel') || 'Cancelar'}
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !canAddMore}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t('send_request') || 'Enviar Pedido'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

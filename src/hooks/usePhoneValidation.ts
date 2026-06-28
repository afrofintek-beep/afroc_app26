import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PhoneValidationResult {
  isValid: boolean;
  operator: {
    name: string;
    code: string;
    country: string;
  } | null;
  error: string | null;
}

export const usePhoneValidation = () => {
  const [validating, setValidating] = useState(false);

  const validatePhone = async (phoneNumber: string): Promise<PhoneValidationResult> => {
    if (!phoneNumber || phoneNumber.length < 13) {
      return {
        isValid: false,
        operator: null,
        error: 'Número de telefone muito curto'
      };
    }

    setValidating(true);
    try {
      const { data, error } = await supabase
        .rpc('get_telecom_operator_by_phone', {
          phone_number: phoneNumber
        });

      if (error || !data || data.length === 0) {
        return {
          isValid: false,
          operator: null,
          error: 'Operadora não reconhecida'
        };
      }

      const operator = data[0];
      return {
        isValid: true,
        operator: {
          name: operator.operator_name,
          code: operator.operator_code,
          country: operator.country_code
        },
        error: null
      };
    } catch (error) {
      return {
        isValid: false,
        operator: null,
        error: 'Erro ao validar número'
      };
    } finally {
      setValidating(false);
    }
  };

  return {
    validatePhone,
    validating
  };
};

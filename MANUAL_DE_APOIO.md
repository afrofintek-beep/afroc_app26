# Manual Completo de Apoio - AFROLOC

## Índice
1. [Introdução ao Sistema](#1-introdução-ao-sistema)
2. [Estrutura Organizacional](#2-estrutura-organizacional)
3. [Hierarquia Administrativa](#3-hierarquia-administrativa)
4. [Sistema de Validação](#4-sistema-de-validação)
5. [Gestão de Utilizadores](#5-gestão-de-utilizadores)
6. [Processo de Registo de Endereços](#6-processo-de-registo-de-endereços)
7. [Ciclos de Verificação](#7-ciclos-de-verificação)
8. [Sistema de Autenticação](#8-sistema-de-autenticação)
9. [Segurança e Privacidade](#9-segurança-e-privacidade)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Introdução ao Sistema

### O que é o AFROLOC?
O AFROLOC é um sistema de identificação e validação de endereços físicos que permite:
- Registo único de endereços com código AFROLOC
- Validação através de testemunhas (vizinhos)
- Verificação periódica de endereços
- Gestão hierárquica administrativa
- Validação regional no terreno

### Objectivos Principais
- ✅ Criar identificação única para cada endereço
- ✅ Validar endereços através de comunidade local
- ✅ Manter base de dados actualizada
- ✅ Prevenir fraudes e duplicações
- ✅ Facilitar serviços baseados em localização

---

## 2. Estrutura Organizacional

### Dois Papéis Distintos

#### **Funcionário Administrativo (Admin)**
- **Função:** Administração do sistema
- **Responsabilidades:**
  - Gestão de utilizadores
  - Aprovação de registos
  - Configuração do sistema
  - Delegação de autoridade
  - Supervisão de operações
- **Acesso:** Dashboard administrativo completo
- **Hierarquia:** Níveis 1-5 (Bairro → Nacional)

#### **Validador Regional (Validator)**
- **Função:** Validação física de endereços
- **Responsabilidades:**
  - Receber solicitações de validação
  - Verificar endereços no terreno
  - Confirmar ou rejeitar testemunhos
  - Responder a chamadas/SMS regionais
- **Acesso:** Página de validação regional
- **Atribuição:** Número telefónico regional específico

### Diferenças Principais

| Aspecto | Funcionário Admin | Validador Regional |
|---------|-------------------|-------------------|
| **Foco** | Gestão administrativa | Verificação no terreno |
| **Autoridade** | Hierárquica (Níveis 1-5) | Territorial (divisão administrativa) |
| **Ferramentas** | Dashboard completo | Interface de validação |
| **Identificação** | Nível de autorização | Número telefónico regional |
| **Tabelas DB** | `user_roles` + `user_authorization_levels` | `validation_phone_numbers` |

**Nota:** Uma pessoa pode ter ambos os papéis simultaneamente.

---

## 3. Hierarquia Administrativa

### Níveis de Autorização (1-5)

#### **Nível 5 - Administrador Nacional**
- **Jurisdição:** País inteiro
- **Responsabilidades:**
  - Configuração nacional do sistema
  - Criação de administradores provinciais (Nível 4)
  - Supervisão geral
  - Gestão de divisões administrativas
  - Relatórios nacionais

#### **Nível 4 - Administrador Provincial/Estadual**
- **Jurisdição:** Província/Estado
- **Responsabilidades:**
  - Gestão provincial
  - Criação de administradores municipais (Nível 3)
  - Supervisão de municípios
  - Relatórios provinciais

#### **Nível 3 - Administrador Municipal**
- **Jurisdição:** Município
- **Responsabilidades:**
  - Gestão municipal
  - Criação de administradores comunais (Nível 2)
  - Supervisão de comunas
  - Relatórios municipais

#### **Nível 2 - Administrador Comunal**
- **Jurisdição:** Comuna/Distrito
- **Responsabilidades:**
  - Gestão comunal
  - Criação de administradores de bairro (Nível 1)
  - Supervisão de bairros
  - Relatórios comunais

#### **Nível 1 - Administrador de Bairro/Quarteirão**
- **Jurisdição:** Bairro/Quarteirão
- **Responsabilidades:**
  - Gestão local
  - Apoio directo aos cidadãos
  - Validação de registos locais
  - Relatórios de bairro

### Delegação de Autoridade

#### Princípios
1. **Cascata Descendente:** Cada nível só pode criar utilizadores do nível imediatamente inferior
2. **Mesma Jurisdição:** A jurisdição do subordinado deve estar dentro da jurisdição do superior
3. **Não-Revogável:** Níveis não podem ser rebaixados, apenas desactivados

#### Exemplo: Angola (21 Províncias)
```
Nível 5 (Nacional)
└── Angola
    ├── Nível 4 (Luanda)
    │   ├── Nível 3 (Icolo e Bengo)
    │   │   ├── Nível 2 (Catete)
    │   │   │   └── Nível 1 (Bairro Azul)
    │   │   └── Nível 2 (Quiçama)
    │   └── Nível 3 (Belas)
    └── Nível 4 (Benguela)
```

---

## 4. Sistema de Validação

### Fluxo de Validação de Endereços

#### Passo 1: Registo de Endereço
```
Cidadão → Cria AFROLOC → Fornece:
  - Coordenadas GPS
  - Divisão administrativa (Província, Município, etc.)
  - Número e nome da rua (opcional)
  - Tipo de propriedade
```

#### Passo 2: Adição de Testemunhas
```
Cidadão → Adiciona 2+ vizinhos → Sistema:
  1. Valida AFROLOC das testemunhas
  2. Verifica se testemunhas têm endereços próximos
  3. Gera contrato de testemunho
```

#### Passo 3: Notificação de Testemunhas
```
Sistema → Envia SMS para número regional → Contém:
  - Código AFROLOC do solicitante
  - Endereço a validar
  - Link para confirmação
  - Prazo de resposta
```

#### Passo 4: Confirmação de Testemunhas
```
Testemunha → Recebe OTP por SMS → Confirma:
  - Insere código OTP
  - Confirma ou rejeita endereço
  - Adiciona motivo (se rejeição)
```

#### Passo 5: Validação Regional
```
Validador Regional → Recebe notificação → Verifica:
  - Analisa testemunhos
  - Pode visitar endereço fisicamente
  - Aprova ou rejeita solicitação
  - Regista decisão no sistema
```

#### Passo 6: Finalização
```
Sistema → Notifica solicitante → Resultado:
  ✅ Aprovado: AFROLOC activado
  ❌ Rejeitado: Motivo fornecido + Opção de apelar
```

### Números de Validação Regional

#### O que são?
Números telefónicos atribuídos a divisões administrativas específicas para receber SMS de validação.

#### Como funcionam?
1. **Atribuição:** Admin atribui número a uma divisão (ex: Província de Luanda)
2. **Activação:** Validador regional é associado ao número
3. **Notificações:** Todas as solicitações dessa área são enviadas para esse número
4. **Rastreamento:** Sistema regista uso e última utilização

#### Tabela: `validation_phone_numbers`
```sql
- phone_number (text): Número regional
- administrative_division_id (uuid): Divisão associada
- validator_user_id (uuid): Validador responsável
- is_active (boolean): Estado activo
- verification_status (text): 'pending', 'verified'
- usage_count (integer): Quantidade de usos
- last_used_at (timestamp): Última utilização
```

---

## 5. Gestão de Utilizadores

### Criação do Primeiro Administrador Nacional

#### Via SQL (Após Signup)
```sql
-- 1. Registar utilizador no /signup
-- 2. Executar função SQL:
SELECT public.setup_first_admin(
  (SELECT id FROM auth.users WHERE email = 'admin@afroloc.ao'),
  'Nome do Administrador',
  '+244900000000'
);
```

#### O que a função faz:
- ✅ Cria/actualiza perfil
- ✅ Atribui role 'admin'
- ✅ Define nível 5 (Nacional)
- ✅ Configura jurisdição Angola

### Tipos de Utilizador

#### 1. Citizen (Cidadão)
- **Atribuição:** Automática no registo
- **Permissões:**
  - Criar AFROLOCs próprios
  - Ver próprios registos
  - Ser testemunha
  - Gerir perfil

#### 2. Admin (Funcionário)
- **Atribuição:** Por superior hierárquico
- **Permissões:**
  - Criar subordinados
  - Ver registos da jurisdição
  - Aprovar lotes
  - Gerar relatórios
  - Configurar sistema (se Nível 5)

#### 3. Validator (Validador)
- **Atribuição:** Por admin
- **Permissões:**
  - Ver solicitações da região
  - Aprovar/rejeitar testemunhos
  - Actualizar status de validação

### Gestão de Roles

#### Verificar Role de Utilizador
```sql
SELECT ur.role, p.full_name
FROM user_roles ur
JOIN profiles p ON p.user_id = ur.user_id
WHERE ur.user_id = 'uuid-do-utilizador';
```

#### Verificar Nível de Autorização
```sql
SELECT current_level, jurisdiction_country, 
       jurisdiction_level1_name, administrative_role
FROM user_authorization_levels
WHERE user_id = 'uuid-do-utilizador';
```

---

## 6. Processo de Registo de Endereços

### Categorias de Endereço

#### **Endereço Completo (Full Address)**
- **Critérios:**
  - ✅ Nome da rua preenchido
  - ✅ Número preenchido
- **Ciclo de Verificação:** 6 meses (2 vezes/ano)
- **Risco:** Menor

#### **Endereço Incompleto (Incomplete Address)**
- **Critérios:**
  - ❌ Falta nome da rua OU número
- **Ciclo de Verificação:** 3 meses (4 vezes/ano)
- **Risco:** Maior

### Campos do Registo

```typescript
interface AFROLOCRecord {
  // Identificação
  code: string;                    // Código AFROLOC único
  user_id: uuid;                   // Proprietário
  
  // Localização
  country: string;                 // País (ex: AO)
  level1_code: string;             // Província
  level2_code?: string;            // Município
  level3_code?: string;            // Comuna
  level4_code?: string;            // Bairro
  
  // Endereço
  street_name?: string;            // Nome da rua
  number?: string;                 // Número
  unit?: string;                   // Unidade (apto, etc.)
  
  // Geolocalização
  geo_lat: number;                 // Latitude
  geo_lon: number;                 // Longitude
  
  // Status e Verificação
  status: 'draft' | 'pending' | 'active' | 'suspended';
  last_verified_at?: timestamp;
  next_verification_due: timestamp;
  
  // Metadata
  property_type?: string;          // Tipo de propriedade
  metadata?: jsonb;                // Dados adicionais
}
```

### Status do Registo

- **draft:** Rascunho, não submetido
- **pending:** Aguardando validação
- **active:** Activo e validado
- **suspended:** Suspenso (verificação vencida, fraude, etc.)

---

## 7. Ciclos de Verificação

### Cálculo Automático

#### Função: `calculate_next_verification_date`
```sql
CREATE OR REPLACE FUNCTION calculate_next_verification_date(
  p_last_verified_at TIMESTAMP,
  p_street_name TEXT,
  p_number TEXT
) RETURNS TIMESTAMP
```

#### Lógica:
1. Determina categoria (full_address vs incomplete_address)
2. Define ciclo (6 meses ou 3 meses)
3. Calcula próxima data a partir de última verificação

#### Exemplo:
```sql
-- Endereço completo
-- Última verificação: 2025-01-01
-- Próxima: 2025-07-01 (6 meses depois)

-- Endereço incompleto
-- Última verificação: 2025-01-01
-- Próxima: 2025-04-01 (3 meses depois)
```

### Trigger Automático

```sql
CREATE TRIGGER update_verification_dates
BEFORE INSERT OR UPDATE ON afroid_records
FOR EACH ROW
EXECUTE FUNCTION update_verification_date();
```

**Dispara quando:**
- Novo registo criado
- Endereço modificado (street_name ou number)
- Verificação realizada

### Alertas de Verificação Vencida

#### Sistema de Risco
- **Score 90:** Verificação vencida (crítico)
- **Score 80:** Verificação vence em 7 dias (alto)
- **Score 70:** Endereço incompleto (médio)

#### Função: `check_risk_alerts`
Executada periodicamente (via cron job de Edge Function) para:
1. Calcular scores de risco
2. Gerar alertas
3. Notificar utilizadores e admins

---

## 8. Sistema de Autenticação

### Métodos de Autenticação

#### 1. Email + Password
- Registo tradicional
- Verificação de email (pode ser auto-confirmada em dev)

#### 2. Phone + OTP
- Registo via telefone
- OTP enviado por SMS (Twilio)
- Verificação de operadora telecom

#### 3. Biometria (Dispositivos Móveis)
- Fingerprint / Face ID
- Registo de dispositivo confiável
- Token de 90 dias

### Fluxo de Signup com Telefone

#### Passo 1: Input do Telefone
```typescript
// Formato: +244923303030 (com + e código do país)
const phone = "+244923303030";
```

#### Passo 2: Validação da Operadora
```sql
SELECT * FROM get_telecom_operator_by_phone('+244923303030');
-- Retorna: Unitel, UNITEL, twilio, AO
```

#### Passo 3: Envio de OTP
```typescript
// Edge Function: send-signup-otp
POST /functions/v1/send-signup-otp
Body: { phone: "+244923303030" }

// Resposta:
{
  success: true,
  expires_at: "2025-11-13T23:14:58Z",
  operator: { name: "Unitel", code: "UNITEL", country: "AO" }
}
```

#### Passo 4: Verificação de OTP
```typescript
// Edge Function: verify-signup-otp
POST /functions/v1/verify-signup-otp
Body: { phone: "+244923303030", otp_code: "123456" }

// Resposta:
{ success: true, message: "OTP verificado com sucesso" }
```

#### Passo 5: Criação da Conta
```typescript
// Com email (após verificação de telefone):
const { data, error } = await supabase.auth.signUp({
  email: "user@example.com",
  password: "SecurePassword123!",
  options: {
    data: {
      full_name: "Nome Completo",
      phone: "+244923303030", // Telefone verificado
      country: "AO"
    }
  }
});

// Ou apenas com telefone (email gerado):
const generatedEmail = `${phone.replace(/\+/g, '')}@afroid.system`;
```

### Segurança de OTP

#### Tabela: `phone_otp_verifications`
```sql
- phone_number (text): Telefone
- otp_code (text): Código de 6 dígitos
- expires_at (timestamp): Expiração (10 min)
- attempts (integer): Tentativas (máx 3)
- verified (boolean): Verificado?
- verified_at (timestamp): Data de verificação
```

#### Protecções:
- ✅ OTP expira em 10 minutos
- ✅ Máximo 3 tentativas
- ✅ Rate limiting por IP
- ✅ Rate limiting por telefone
- ✅ Validação de operadora

---

## 9. Segurança e Privacidade

### Row-Level Security (RLS)

#### Princípios
1. **Mínimo Privilégio:** Utilizadores só vêem seus próprios dados
2. **Segregação:** Admin e citizen têm acessos diferentes
3. **Auditoria:** Todas as acções são registadas

#### Exemplo: Tabela `profiles`
```sql
-- Utilizadores vêem apenas próprio perfil
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id);

-- Admins vêem todos os perfis
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

### Função: `has_role`

```sql
CREATE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

**Uso:**
- ✅ Security Definer: Executa com privilégios do dono
- ✅ Set search_path: Previne ataques de injection
- ✅ Não recursivo: Evita loops infinitos de RLS

### Eventos de Segurança

#### Tabela: `security_events`
```sql
- event_type (text): Tipo de evento
- severity (text): Gravidade (low, medium, high, critical)
- user_id (uuid): Utilizador envolvido
- ip_address (text): IP da requisição
- endpoint (text): Endpoint acedido
- details (jsonb): Detalhes adicionais
```

#### Eventos Rastreados:
- ❌ `auth_failure`: Falha de autenticação
- ⚠️ `rate_limit`: Limite de taxa excedido
- 🔐 `otp_max_attempts`: Tentativas de OTP excedidas
- 🔄 `phone_change_attempt`: Tentativa de troca de telefone
- ⚡ `otp_request`: Solicitação de OTP

#### Função: `log_security_event`
```sql
SELECT log_security_event(
  p_event_type := 'rate_limit',
  p_severity := 'medium',
  p_ip_address := '192.168.1.1',
  p_user_agent := 'Mozilla/5.0...',
  p_endpoint := '/functions/v1/send-signup-otp',
  p_details := '{"limit": 10, "period": "1 hour"}'::jsonb
);
```

### Auditoria

#### Tabela: `security_audit_log`
```sql
- action (text): Acção realizada
- function_name (text): Função executada
- user_id (uuid): Utilizador
- details (jsonb): Detalhes da acção
```

**Acções auditadas:**
- Alteração de níveis de autorização
- Criação de admins
- Alteração de telefone
- Validações regionais

---

## 10. Troubleshooting

### Problema 1: OTPs não chegam

#### Sintomas
- Utilizador não recebe SMS com código OTP
- Edge function retorna sucesso mas SMS não chega

#### Causas Possíveis
1. **Conta Twilio em Trial:**
   - Solução: Verificar número no console do Twilio OU actualizar para conta paga

2. **Credenciais Twilio incorrectas:**
   - Solução: Verificar secrets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

3. **Número de origem sem permissão:**
   - Solução: Verificar se número Twilio pode enviar SMS para o país de destino

4. **Operadora não reconhecida:**
   - Solução: Adicionar prefixos da operadora na tabela `telecom_operators`

#### Como Debugar
```sql
-- 1. Verificar logs de edge function
-- AFROLOC Cloud → Functions → send-signup-otp → Logs

-- 2. Verificar OTPs gerados
SELECT * FROM phone_otp_verifications
WHERE phone_number = '+244923303030'
ORDER BY created_at DESC;

-- 3. Verificar operadora detectada
SELECT * FROM get_telecom_operator_by_phone('+244923303030');

-- 4. Verificar eventos de segurança
SELECT * FROM security_events
WHERE endpoint LIKE '%send-signup-otp%'
ORDER BY created_at DESC
LIMIT 10;
```

---

### Problema 2: Erro "structure of query does not match function result type"

#### Sintomas
```json
{
  "code": "42804",
  "message": "Returned type character varying(255) does not match expected type text in column 3."
}
```

#### Causa
Função RPC `get_user_by_phone` retorna tipo `character varying(255)` mas esperava `text`.

#### Solução
```sql
-- Recriar função com tipos correctos
CREATE OR REPLACE FUNCTION get_user_by_phone(p_phone TEXT)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  afro_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.full_name,
    CAST(au.email AS TEXT),  -- Cast explícito
    p.phone,
    p.afro_id,
    p.created_at
  FROM profiles p
  LEFT JOIN auth.users au ON au.id = p.user_id
  WHERE p.phone = p_phone;
END;
$$;
```

---

### Problema 3: Utilizador não vê seus dados

#### Sintomas
- Query retorna vazio mesmo com dados existentes
- Erro de permissões

#### Causa
RLS (Row-Level Security) está bloqueando acesso.

#### Solução
```sql
-- 1. Verificar políticas RLS da tabela
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'nome_da_tabela';

-- 2. Verificar se utilizador está autenticado
SELECT auth.uid(); -- Deve retornar UUID, não NULL

-- 3. Verificar roles do utilizador
SELECT * FROM user_roles WHERE user_id = auth.uid();

-- 4. Testar query como utilizador
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub": "uuid-do-utilizador"}';
SELECT * FROM tabela_com_problema;
RESET ROLE;
```

---

### Problema 4: Admin não consegue ver dados de outros utilizadores

#### Sintomas
- Admin vê apenas próprios dados
- Falta política RLS para admin

#### Solução
```sql
-- Adicionar política para admins
CREATE POLICY "Admins can view all records"
ON nome_da_tabela FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Verificar função has_role
SELECT has_role(auth.uid(), 'admin'); -- Deve retornar true para admin
```

---

### Problema 5: Telefone duplicado

#### Sintomas
- Erro ao tentar registar com telefone já existente
- Vários perfis com mesmo telefone

#### Solução
```sql
-- 1. Verificar duplicados
SELECT phone, COUNT(*) as count
FROM profiles
WHERE phone IS NOT NULL
GROUP BY phone
HAVING COUNT(*) > 1;

-- 2. Executar merge de perfis duplicados
SELECT merge_duplicate_profiles();

-- 3. Adicionar constraint única
ALTER TABLE profiles
ADD CONSTRAINT profiles_phone_unique UNIQUE (phone);
```

---

### Problema 6: Verificação vencida não alertando

#### Sintomas
- Endereços com `next_verification_due` no passado
- Sem alertas de risco gerados

#### Solução
```sql
-- 1. Verificar registos vencidos
SELECT code, next_verification_due, 
       NOW() - next_verification_due as overdue_by
FROM afroid_records
WHERE next_verification_due < NOW()
ORDER BY next_verification_due;

-- 2. Executar verificação de risco manualmente
SELECT check_risk_alerts();

-- 3. Verificar alertas gerados
SELECT * FROM risk_alerts_log
ORDER BY sent_at DESC;

-- 4. Configurar edge function para executar periodicamente
-- Criar edge function que chama check_risk_alerts() a cada hora
```

---

## Comandos SQL Úteis

### Gestão de Utilizadores

```sql
-- Listar todos os utilizadores com roles
SELECT 
  p.user_id,
  p.full_name,
  p.phone,
  p.country,
  ARRAY_AGG(ur.role::TEXT) as roles,
  ual.current_level as nivel_autorizacao,
  ual.administrative_role
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.user_id
LEFT JOIN user_authorization_levels ual ON ual.user_id = p.user_id
GROUP BY p.user_id, p.full_name, p.phone, p.country, ual.current_level, ual.administrative_role;

-- Promover utilizador a admin
INSERT INTO user_roles (user_id, role)
VALUES ('uuid-do-utilizador', 'admin');

-- Atribuir nível de autorização
INSERT INTO user_authorization_levels (
  user_id, current_level, jurisdiction_country, administrative_role
) VALUES (
  'uuid-do-utilizador', 4, 'AO', 'Administrador Provincial'
);
```

### Gestão de Validadores

```sql
-- Listar validadores com números regionais
SELECT 
  p.full_name,
  vpn.phone_number,
  ad.name as regiao,
  ad.level as nivel_regiao,
  vpn.is_active,
  vpn.usage_count,
  vpn.last_used_at
FROM validation_phone_numbers vpn
JOIN profiles p ON p.user_id = vpn.validator_user_id
JOIN administrative_divisions ad ON ad.id = vpn.administrative_division_id;

-- Atribuir número regional a validador
INSERT INTO validation_phone_numbers (
  phone_number,
  administrative_division_id,
  validator_user_id,
  country_code,
  is_active,
  verification_status
) VALUES (
  '+244900000001',
  (SELECT id FROM administrative_divisions WHERE code = 'AO-LUA'),
  'uuid-do-validador',
  'AO',
  true,
  'verified'
);
```

### Estatísticas e Relatórios

```sql
-- Estatísticas de validação por região
SELECT * FROM get_validation_stats_by_region(
  NOW() - INTERVAL '30 days',
  NOW()
);

-- Estatísticas por validador
SELECT * FROM get_validation_stats_by_validator(
  NOW() - INTERVAL '30 days',
  NOW()
);

-- Tendências de validação
SELECT * FROM get_validation_trends(
  NOW() - INTERVAL '90 days',
  NOW(),
  'week'
);

-- Métricas de fraude
SELECT * FROM get_fraud_detection_metrics(
  NOW() - INTERVAL '30 days',
  NOW()
);
```

---

## Contactos e Suporte

### Suporte Técnico
- **Email:** suporte@afroloc.ao
- **Telefone:** +244 900 000 000

### Documentação Adicional
- [Arquitectura do Sistema](./HIERARCHICAL_SYSTEM.md)
- [Sistema de Autorização](./AUTHORIZATION_SYSTEM.md)
- [Permissões de Câmera](./CAMERA_PERMISSIONS.md)
- [Validação de Traduções](./TRANSLATION_VALIDATION.md)

### Contribuir
Para contribuir com melhorias ou reportar bugs, contacte a equipa de desenvolvimento.

---

## 11. Gestão de Acessos

### Controlo de Acesso por Função

#### Cidadão (citizen)
```typescript
// Permissões no frontend
const citizenPermissions = {
  canCreateOwnAfroloc: true,
  canViewOwnRecords: true,
  canBeWitness: true,
  canManageProfile: true,
  canViewPublicDocs: true,
  canAccessAdminPanel: false,
  canManageUsers: false,
  canApproveRecords: false
};
```

#### Operador (operator)
```typescript
// Permissões de operador de campo
const operatorPermissions = {
  ...citizenPermissions,
  canCreateBatches: true,
  canRegisterMultipleAddresses: true,
  canWorkOffline: true,
  maxOfflineRegistrations: 50
};
```

#### Validador (validator)
```typescript
// Permissões de validador regional
const validatorPermissions = {
  ...citizenPermissions,
  canViewRegionalRequests: true,
  canApproveWitnesses: true,
  canRejectWitnesses: true,
  canPerformGPSValidation: true
};
```

#### Administrador (admin)
```typescript
// Permissões administrativas (variam por nível)
const adminPermissions = {
  ...citizenPermissions,
  canAccessAdminPanel: true,
  canViewUsersInJurisdiction: true,
  canCreateSubordinates: true,
  canApproveRecordsInJurisdiction: true,
  canGenerateReports: true,
  canConfigureSystem: (level === 5)
};
```

### Matriz de Acessos por Página

| Página | Cidadão | Operador | Validador | Admin L1-4 | Admin L5 |
|--------|---------|----------|-----------|------------|----------|
| /dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| /my-addresses | ✅ | ✅ | ✅ | ✅ | ✅ |
| /create-identity | ✅ | ✅ | ✅ | ✅ | ✅ |
| /admin/* | ❌ | ❌ | ❌ | ✅ | ✅ |
| /admin/system-setup | ❌ | ❌ | ❌ | ❌ | ✅ |
| /regional-validation | ❌ | ❌ | ✅ | ✅ | ✅ |
| /offline-create | ❌ | ✅ | ❌ | ✅ | ✅ |

### Verificação de Acesso no Frontend

```typescript
// hooks/useUserRole.ts
import { useAuth } from '@/contexts/AuthContext';

export const useUserRole = () => {
  const { user } = useAuth();
  
  const checkRole = async (requiredRole: string) => {
    const { data } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: requiredRole
    });
    return data;
  };
  
  const checkLevel = async (minLevel: number) => {
    const { data } = await supabase
      .from('user_authorization_levels')
      .select('current_level')
      .eq('user_id', user.id)
      .single();
    return data?.current_level >= minLevel;
  };
  
  return { checkRole, checkLevel };
};
```

---

## 12. Sistema de Testemunhas

### Requisitos para Testemunhas

#### Mínimo de Testemunhas
- **Endereço Formal:** 2 testemunhas
- **Endereço Informal:** 3 testemunhas
- **Endereço Digital:** 2 testemunhas

#### Critérios de Elegibilidade
```sql
-- Verificar se utilizador pode ser testemunha
CREATE OR REPLACE FUNCTION can_be_witness(
  p_witness_user_id UUID,
  p_afroloc_record_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_requester_lat NUMERIC;
  v_requester_lon NUMERIC;
  v_witness_lat NUMERIC;
  v_witness_lon NUMERIC;
  v_distance_km NUMERIC;
BEGIN
  -- Obter coordenadas do solicitante
  SELECT geo_lat, geo_lon INTO v_requester_lat, v_requester_lon
  FROM afroloc_records WHERE id = p_afroloc_record_id;
  
  -- Obter coordenadas da testemunha (endereço mais recente)
  SELECT geo_lat, geo_lon INTO v_witness_lat, v_witness_lon
  FROM afroloc_records 
  WHERE user_id = p_witness_user_id AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;
  
  -- Calcular distância (deve estar a menos de 1km)
  v_distance_km := ST_DistanceSphere(
    ST_MakePoint(v_requester_lon, v_requester_lat),
    ST_MakePoint(v_witness_lon, v_witness_lat)
  ) / 1000;
  
  RETURN v_distance_km <= 1.0;
END;
$$;
```

### Fluxo de Confirmação de Testemunha

#### Passo 1: Adição da Testemunha
```typescript
// AddWitness.tsx
const addWitness = async (witnessAfroId: string) => {
  // Validar AFROLOC da testemunha
  const { data: witness } = await supabase
    .from('afroloc_records')
    .select('user_id, geo_lat, geo_lon')
    .eq('code', witnessAfroId)
    .eq('status', 'active')
    .single();
  
  if (!witness) {
    throw new Error('AFROLOC da testemunha não encontrado');
  }
  
  // Adicionar testemunha
  await supabase.from('afroloc_witnesses').insert({
    afroloc_record_id: recordId,
    witness_user_id: witness.user_id,
    witness_afro_id: witnessAfroId,
    status: 'pending'
  });
};
```

#### Passo 2: Envio de OTP para Testemunha
```typescript
// Edge function: send-witness-otp
const sendWitnessOtp = async (witnessId: string) => {
  const { data, error } = await supabase.functions.invoke('send-witness-otp', {
    body: { witness_id: witnessId }
  });
  return data;
};
```

#### Passo 3: Confirmação pela Testemunha
```typescript
// ConfirmWitness.tsx
const confirmWitness = async (witnessId: string, otpCode: string) => {
  const { data } = await supabase.functions.invoke('verify-witness-otp', {
    body: { witness_id: witnessId, otp_code: otpCode }
  });
  
  if (data.success) {
    // Actualizar status da testemunha
    await supabase
      .from('afroloc_witnesses')
      .update({ 
        status: 'confirmed',
        confirmed_at: new Date().toISOString()
      })
      .eq('id', witnessId);
  }
};
```

### Reputação de Testemunhas

#### Cálculo do Score
```sql
-- Factores de reputação
reputation_score = 
  (confirmations_count * 10) +          -- Confirmações positivas
  (rejections_avoided * 5) -            -- Evitou rejeições
  (fraudulent_testimony * -50) +        -- Penalização por fraude
  (time_as_witness_months * 2) +        -- Antiguidade
  (verified_address_bonus * 20);        -- Endereço verificado

-- Níveis de reputação
CASE 
  WHEN reputation_score >= 100 THEN 'gold'
  WHEN reputation_score >= 50 THEN 'silver'
  WHEN reputation_score >= 20 THEN 'bronze'
  ELSE 'new'
END
```

#### Histórico de Reputação
```sql
-- Consultar histórico de reputação
SELECT 
  action_type,
  score_change,
  previous_score,
  new_score,
  reason,
  created_at
FROM witness_reputation_history
WHERE witness_user_id = 'uuid-da-testemunha'
ORDER BY created_at DESC;
```

---

## 13. Edge Functions

### Lista de Edge Functions Disponíveis

#### Autenticação
| Função | Descrição | Método |
|--------|-----------|--------|
| `send-signup-otp` | Envia OTP para registo | POST |
| `verify-signup-otp` | Verifica OTP de registo | POST |
| `phone-login` | Login via telefone | POST |
| `biometric-login` | Login biométrico | POST |
| `register-biometric-device` | Regista dispositivo biométrico | POST |
| `send-admin-2fa` | Envia código 2FA para admin | POST |
| `verify-admin-2fa` | Verifica código 2FA | POST |
| `generate-backup-codes` | Gera códigos de backup 2FA | POST |
| `verify-backup-code` | Verifica código de backup | POST |

#### Endereços e Validação
| Função | Descrição | Método |
|--------|-----------|--------|
| `address-create` | Cria novo endereço AFROLOC | POST |
| `address-verify` | Verifica endereço existente | POST |
| `address-gateway` | Gateway de operações de endereço | POST |
| `ats-score` | Calcula score ATS | POST |
| `ats-engine` | Motor de cálculo ATS | POST |

#### Testemunhas
| Função | Descrição | Método |
|--------|-----------|--------|
| `send-witness-otp` | Envia OTP para testemunha | POST |
| `verify-witness-otp` | Verifica OTP de testemunha | POST |
| `receive-witness-sms` | Recebe SMS de testemunha | POST |

#### Administração
| Função | Descrição | Método |
|--------|-----------|--------|
| `admin-users` | Gestão de utilizadores admin | POST |
| `delete-user` | Remove utilizador | DELETE |
| `recalculate-authorization-levels` | Recalcula níveis | POST |

#### Notificações
| Função | Descrição | Método |
|--------|-----------|--------|
| `send-push-notification` | Notificação push | POST |
| `send-risk-alert` | Alerta de risco | POST |
| `send-validation-reminder` | Lembrete de validação | POST |
| `notify-requester-validation` | Notifica resultado | POST |

### Estrutura de Edge Function

```typescript
// supabase/functions/exemplo/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Criar cliente Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter dados do request
    const { param1, param2 } = await req.json();

    // Lógica da função
    // ...

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 14. Integração com Mapbox

### Configuração

#### Token de Acesso
```typescript
// O token Mapbox é obtido via Edge Function
const getMapboxToken = async () => {
  const { data } = await supabase.functions.invoke('get-mapbox-token');
  return data.token;
};
```

### Componentes de Mapa

#### LocationMap
```typescript
// components/LocationMap.tsx
import mapboxgl from 'mapbox-gl';

interface LocationMapProps {
  latitude: number;
  longitude: number;
  zoom?: number;
  interactive?: boolean;
  onLocationSelect?: (lat: number, lon: number) => void;
}

const LocationMap: React.FC<LocationMapProps> = ({
  latitude,
  longitude,
  zoom = 15,
  interactive = true,
  onLocationSelect
}) => {
  // Inicialização do mapa...
};
```

#### QGSQGridMap
```typescript
// components/QGSQGridMap.tsx
// Mapa com grade cadastral QGSQ
// Mostra células de 10x10m (urbanas) ou 50x50m (rurais)
```

### Funcionalidades Geoespaciais

#### Verificação de Proximidade
```sql
-- Verificar se ponto está dentro de zona urbana
SELECT EXISTS (
  SELECT 1 FROM urban_zones
  WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint(lon, lat), 4326))
);
```

#### Cálculo de Distância
```sql
-- Distância entre dois pontos (em metros)
SELECT ST_DistanceSphere(
  ST_MakePoint(lon1, lat1),
  ST_MakePoint(lon2, lat2)
) as distance_meters;
```

---

## 15. Sistema Offline

### Capacidades Offline

#### Operações Disponíveis
- ✅ Criar novos endereços (rascunho)
- ✅ Capturar fotos com GPS
- ✅ Extrair metadados EXIF
- ✅ Guardar localmente até sincronizar
- ❌ Validar testemunhas
- ❌ Enviar OTPs
- ❌ Consultar base de dados central

#### Armazenamento Local
```typescript
// utils/offlineStorage.ts
import { openDB } from 'idb';

const DB_NAME = 'afroloc-offline';
const STORE_NAME = 'pending-records';

export const saveOfflineRecord = async (record: OfflineRecord) => {
  const db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
    }
  });
  
  await db.put(STORE_NAME, {
    ...record,
    localId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    syncStatus: 'pending'
  });
};

export const getPendingRecords = async () => {
  const db = await openDB(DB_NAME, 1);
  return db.getAll(STORE_NAME);
};

export const syncOfflineRecords = async () => {
  const pending = await getPendingRecords();
  
  for (const record of pending) {
    try {
      await supabase.from('afroloc_records').insert(record);
      await deleteOfflineRecord(record.localId);
    } catch (error) {
      console.error('Sync failed for record:', record.localId);
    }
  }
};
```

#### Limites de Armazenamento
- **Máximo de registos offline:** 50
- **Tamanho máximo por foto:** 5MB (comprimida)
- **Expiração:** 30 dias sem sincronização

### Sincronização

#### Fluxo de Sincronização
```
1. Detectar conectividade (hook useNetworkStatus)
2. Verificar registos pendentes
3. Sincronizar cada registo:
   a. Fazer upload de fotos
   b. Inserir registo na base de dados
   c. Remover do armazenamento local
4. Notificar utilizador do resultado
```

---

## 16. Auditoria e Logs

### Tabelas de Auditoria

#### security_audit_log
```sql
-- Acções críticas do sistema
CREATE TABLE security_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,               -- Tipo de acção
  function_name TEXT NOT NULL,        -- Função que executou
  user_id UUID,                       -- Utilizador que executou
  details JSONB,                      -- Detalhes adicionais
  ip_address TEXT,                    -- IP de origem
  user_agent TEXT,                    -- User agent
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### security_events
```sql
-- Eventos de segurança
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,           -- Tipo de evento
  severity TEXT NOT NULL,             -- low, medium, high, critical
  user_id UUID,
  ip_address TEXT,
  endpoint TEXT,
  details JSONB,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Consultas de Auditoria

#### Últimas Acções Administrativas
```sql
SELECT 
  sal.action,
  sal.function_name,
  p.full_name as admin_name,
  sal.details,
  sal.created_at
FROM security_audit_log sal
LEFT JOIN profiles p ON p.user_id = sal.user_id
ORDER BY sal.created_at DESC
LIMIT 100;
```

#### Eventos de Segurança Não Resolvidos
```sql
SELECT 
  event_type,
  severity,
  endpoint,
  details,
  created_at
FROM security_events
WHERE resolved = false
ORDER BY 
  CASE severity 
    WHEN 'critical' THEN 1 
    WHEN 'high' THEN 2 
    WHEN 'medium' THEN 3 
    ELSE 4 
  END,
  created_at DESC;
```

#### Estatísticas de Segurança (30 dias)
```sql
SELECT 
  event_type,
  severity,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE resolved) as resolved,
  COUNT(*) FILTER (WHERE NOT resolved) as pending
FROM security_events
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY event_type, severity
ORDER BY total DESC;
```

---

## 17. Resolução de Problemas Comuns

### Erros de Autenticação

#### "Invalid login credentials"
**Causa:** Email ou password incorrectos.
**Solução:**
1. Verificar se email existe
2. Usar funcionalidade "Esqueci password"
3. Verificar se conta está confirmada

#### "Email not confirmed"
**Causa:** Conta criada mas email não verificado.
**Solução:**
```sql
-- Confirmar email manualmente (apenas para dev)
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email = 'utilizador@exemplo.com';
```

#### "Phone already in use"
**Causa:** Telefone já registado noutra conta.
**Solução:**
```sql
-- Verificar contas com este telefone
SELECT user_id, full_name, phone, created_at
FROM profiles
WHERE phone = '+244923303030';
```

### Erros de Base de Dados

#### "violates row-level security policy"
**Causa:** Tentativa de acesso a dados sem permissão.
**Solução:**
1. Verificar se utilizador está autenticado
2. Verificar políticas RLS da tabela
3. Verificar roles do utilizador

#### "duplicate key value violates unique constraint"
**Causa:** Tentativa de inserir valor duplicado.
**Solução:**
```sql
-- Identificar o constraint violado
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'nome_do_constraint';
```

### Erros de Edge Functions

#### "Function not found"
**Causa:** Edge function não deployada.
**Solução:**
1. Verificar se função existe em `supabase/functions/`
2. Verificar deploy no AFROLOC Cloud
3. Verificar logs de deploy

#### "Internal Server Error" (500)
**Causa:** Erro na execução da função.
**Solução:**
1. Verificar logs da função
2. Verificar variáveis de ambiente (secrets)
3. Verificar permissões de acesso

### Erros de SMS/OTP

#### "Twilio: Invalid phone number"
**Causa:** Formato de telefone inválido.
**Solução:**
1. Verificar formato: `+[código país][número]`
2. Verificar se país é suportado pelo Twilio

#### "Rate limit exceeded"
**Causa:** Muitas tentativas de envio.
**Solução:**
1. Aguardar período de cooldown
2. Verificar eventos de rate limit:
```sql
SELECT * FROM security_events
WHERE event_type = 'rate_limit'
ORDER BY created_at DESC LIMIT 10;
```

---

## 18. Boas Práticas

### Segurança

1. **Nunca expor secrets no frontend**
2. **Usar sempre HTTPS**
3. **Implementar rate limiting em todas as APIs**
4. **Validar inputs no frontend E backend**
5. **Usar RLS em todas as tabelas com dados sensíveis**
6. **Auditar todas as acções administrativas**

### Performance

1. **Usar índices nas colunas mais consultadas**
2. **Implementar paginação em listagens**
3. **Comprimir imagens antes de upload**
4. **Usar cache para dados estáticos**
5. **Minimizar queries N+1**

### Manutenção

1. **Documentar todas as alterações de schema**
2. **Testar migrações em ambiente de staging**
3. **Manter backups regulares**
4. **Monitorar logs de erro**
5. **Actualizar dependências regularmente**

---

## Contactos e Suporte

### Suporte Técnico
- **Email:** suporte@afroloc.ao
- **Telefone:** +244 900 000 000
- **Horário:** Segunda a Sexta, 8h-18h

### Documentação Adicional
- [Arquitectura do Sistema](./HIERARCHICAL_SYSTEM.md)
- [Sistema de Autorização](./AUTHORIZATION_SYSTEM.md)
- [Permissões de Câmera](./CAMERA_PERMISSIONS.md)
- [Validação de Traduções](./TRANSLATION_VALIDATION.md)
- [Documentação Completa](./AFROLOC_DOCUMENTACAO_COMPLETA.md)

### Recursos Online
- **Portal de Documentos:** `/public-documents`
- **Manual de Apoio:** `/manual-download`
- **FAQ:** `/faq`

### Contribuir
Para contribuir com melhorias ou reportar bugs, contacte a equipa de desenvolvimento.

---

## 14. Documentação Adicional

Para informações mais detalhadas sobre aspectos específicos do sistema, consulte os seguintes documentos:

| Documento | Descrição |
|-----------|-----------|
| [Arquitectura do Sistema](./HIERARCHICAL_SYSTEM.md) | Sistema hierárquico de 5 níveis para gestão de identidades digitais |
| [Sistema de Autorização](./AUTHORIZATION_SYSTEM.md) | Sistema de 5 níveis de autorização baseado em confiança |
| [Permissões de Câmera](./CAMERA_PERMISSIONS.md) | Configuração de permissões de câmera para iOS e Android |
| [Validação de Traduções](./TRANSLATION_VALIDATION.md) | Ferramenta de validação de traduções para 13 idiomas |
| [Documentação Completa](./AFROLOC_DOCUMENTACAO_COMPLETA.md) | Documentação técnica completa do sistema AFROLOC |

### Resumo dos Documentos

#### Arquitectura do Sistema (HIERARCHICAL_SYSTEM.md)
- Estrutura hierárquica de 5 níveis (Nacional → Local)
- Responsabilidades de cada nível administrativo
- Fluxo de delegação de autoridade
- Políticas RLS para controle de acesso

#### Sistema de Autorização (AUTHORIZATION_SYSTEM.md)
- 5 níveis de autorização (Básico → Elite)
- Critérios de progressão entre níveis
- Permissões e restrições por nível
- Componentes UI (LevelGate, AuthorizationLevelBadge)

#### Permissões de Câmera (CAMERA_PERMISSIONS.md)
- Configuração para iOS (Info.plist)
- Configuração para Android (AndroidManifest.xml)
- Troubleshooting de permissões
- Qualidade e armazenamento de fotos

#### Validação de Traduções (TRANSLATION_VALIDATION.md)
- Suporte a 13 idiomas africanos
- Cálculo de taxa de completude
- Identificação de chaves em falta
- Geração de relatórios

---

**Versão:** 2.0.0  
**Última Actualização:** 25 de Dezembro de 2025  
**Autor:** Equipa AFROLOC

# Sistema Hierárquico Multi-Regional AFRO ID

## Visão Geral

O AFRO ID implementa um sistema hierárquico de 5 níveis para gestão continental/multi-nacional de identidades digitais. Este documento descreve a estrutura organizacional, fluxos de trabalho e implementação técnica.

## Arquitetura Hierárquica

### Modelo de 5 Níveis

```
Nível 5 (Nacional) ─────┐
                        │
Nível 4 (Provincial) ───┼───┐
                        │   │
Nível 3 (Territorial) ──┼───┼───┐
                        │   │   │
Nível 2 (Comunal) ──────┼───┼───┼───┐
                        │   │   │   │
Nível 1 (Local) ────────┴───┴───┴───┴
```

### Responsabilidades por Nível

#### Nível 5 - Administrador Nacional
- **Jurisdição**: Todo o país
- **Poderes**: 
  - Gestão completa do sistema a nível nacional
  - Criação de Administradores Provinciais (N4)
  - Supervisão de todos os níveis inferiores
  - Configuração de políticas nacionais
- **Exemplo**: Diretor Nacional do AFRO ID Angola

#### Nível 4 - Administrador Provincial
- **Jurisdição**: Província/Estado
- **Poderes**: 
  - Gestão da província
  - Criação de Administradores Territoriais (N3)
  - Supervisão de territórios e comunas
  - Relatórios provinciais
- **Exemplo**: Coordenador Provincial de Luanda

#### Nível 3 - Administrador Territorial  
- **Jurisdição**: Território/Município
- **Poderes**: 
  - Gestão do território
  - Criação de Administradores Comunais (N2)
  - Supervisão de comunas
  - Validação de identidades territoriais
- **Exemplo**: Chefe do Território de Belas

#### Nível 2 - Administrador Comunal
- **Jurisdição**: Comuna/Distrito
- **Poderes**: 
  - Gestão da comuna
  - Criação de Agentes Locais (N1)
  - Supervisão de bairros/quartiers
  - Validação de identidades comunais
- **Exemplo**: Administrador da Comuna de Talatona

#### Nível 1 - Agente Local
- **Jurisdição**: Quartier/Bairro
- **Poderes**: 
  - Registro de identidades locais
  - Validação de testemunhas
  - Verificação presencial de endereços
  - Atendimento direto à população
- **Exemplo**: Agente do Bairro de Viana

## Estrutura de Dados

### Tabelas Principais

#### `countries`
Configuração de países participantes:
```sql
- country_code: 'AO', 'MZ', 'CV', etc.
- country_name: Nome do país
- is_active: Se está operando
- admin_levels_count: Quantos níveis administrativos (1-4)
- level1_label: "Província", "Estado", etc.
- level2_label: "Território", "Município", etc.
- level3_label: "Comuna", "Distrito", etc.
- level4_label: "Quartier", "Bairro", etc.
```

#### `administrative_divisions`
Divisões geográficas hierárquicas:
```sql
- id: UUID
- country_code: Referência ao país
- level: 1 (Província), 2 (Território), 3 (Comuna), 4 (Quartier)
- code: Código único (ex: 'AO-LUA', 'AO-LUA-BEL')
- name: Nome da divisão
- parent_code: Código da divisão superior
```

#### `user_authorization_levels`
Níveis de autorização dos funcionários:
```sql
- user_id: UUID do usuário
- current_level: 1-5
- jurisdiction_country: 'AO', 'MZ', etc.
- jurisdiction_level1_code: Código da província
- jurisdiction_level2_code: Código do território
- jurisdiction_level3_code: Código da comuna
- jurisdiction_level4_code: Código do quartier
- assigned_by_user_id: Quem atribuiu este nível
- assigned_at: Data de atribuição
```

#### `user_roles`
Papéis no sistema:
```sql
- user_id: UUID
- role: 'citizen' | 'moderator' | 'admin'
```

**Importante**: 
- `citizen`: Usuário comum (pode registrar AFRO IDs)
- `moderator`: Funcionário com nível de autorização (N1-N5)
- `admin`: Administrador global do sistema

## Fluxo de Implementação

### Fase 1: Bootstrap do Sistema

1. **Criar Super Admin**
   ```sql
   -- Promover primeiro usuário a admin global
   INSERT INTO user_roles (user_id, role) 
   VALUES ('uuid-do-usuario', 'admin');
   ```

2. **Ativar Países**
   - Acessar `/admin/country-config`
   - Ativar países: Angola, Moçambique, Cabo Verde, etc.
   - Configurar rótulos de níveis administrativos por país

3. **Importar Divisões Administrativas**
   - Acessar `/admin/import-divisions`
   - Importar CSV com estrutura:
   ```csv
   country_code,level,code,name,parent_code
   AO,1,AO-LUA,Luanda,
   AO,2,AO-LUA-BEL,Belas,AO-LUA
   AO,3,AO-LUA-BEL-TAL,Talatona,AO-LUA-BEL
   ```

### Fase 2: Criação da Hierarquia Administrativa

1. **Administradores Nacionais** (Super Admin faz)
   - Acessar `/admin/regional-management`
   - Atribuir Nível 5 a usuários
   - Definir jurisdição: País completo
   - Exemplo: Admin Nacional Angola

2. **Delegação Cascata** (Cada nível cria o inferior)

   **Admin Nacional (N5) cria Provinciais (N4)**:
   - Seleciona usuário → Atribui N4
   - Define província específica
   - Exemplo: Coordenador da Província de Luanda

   **Admin Provincial (N4) cria Territoriais (N3)**:
   - Seleciona usuário → Atribui N3
   - Define território dentro da sua província
   - Exemplo: Chefe do Território de Belas

   **Admin Territorial (N3) cria Comunais (N2)**:
   - Seleciona usuário → Atribui N2
   - Define comuna dentro do seu território
   - Exemplo: Admin da Comuna de Talatona

   **Admin Comunal (N2) cria Locais (N1)**:
   - Seleciona usuário → Atribui N1
   - Define quartier/bairro dentro da sua comuna
   - Exemplo: Agente do Bairro X

### Fase 3: Configuração de Validadores

1. **Números de Validação**
   - Acessar `/admin/validation-numbers`
   - Atribuir números telefônicos a cada divisão
   - Vincular ao usuário validador responsável

2. **Fluxo de Validação SMS**
   - Usuário registra identidade
   - Sistema identifica divisão administrativa
   - Envia SMS ao número de validação daquela divisão
   - Validador confirma ou rejeita via SMS

## Controle de Acesso (RLS)

### Princípios de Segurança

1. **Hierarquia de Supervisão**
   - Cada nível pode ver e gerenciar níveis inferiores em sua jurisdição
   - Não pode ver níveis iguais ou superiores (exceto admin global)

2. **Segregação Geográfica**
   - Admin Provincial de Luanda não acessa dados de Benguela
   - Validado através de `jurisdiction_*_code`

3. **Auditoria Completa**
   - Todas as ações registradas em `security_audit_log`
   - Inclui quem fez, quando, e detalhes da ação

### Políticas RLS Implementadas

```sql
-- Apenas admins podem gerenciar user_roles
CREATE POLICY "Admins can manage user roles"
ON user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Usuários veem próprio perfil; admins veem todos
CREATE POLICY "Users view own profile"
ON profiles FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Admins veem todos os níveis de autorização
CREATE POLICY "Admins view all authorization levels"
ON user_authorization_levels FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

## Interface Administrativa

### `/admin/system-setup`
**Configuração Inicial do Sistema**
- Dashboard de progresso da configuração
- Guia passo-a-passo
- Verificação de status (países, divisões, admins)
- Ações rápidas para próximas etapas

### `/admin/user-management`
**Gerenciamento de Usuários**
- Visualizar todos os usuários
- Promover usuários a funcionários ou admins
- Alterar papéis (citizen → moderator → admin)
- Histórico de mudanças

### `/admin/regional-management`
**Gestão Regional**
- Atribuir níveis de autorização (1-5)
- Definir jurisdições geográficas
- Visualizar hierarquia de administradores
- Mapa de cobertura regional

### `/admin/country-config`
**Configuração de Países**
- Ativar/desativar países
- Configurar rótulos de níveis (Província, Comuna, etc.)
- Definir formatos de AFRO ID por país
- Configurações regionais (timezone, idiomas)

### `/admin/import-divisions`
**Importação de Divisões**
- Upload de CSV com divisões administrativas
- Validação de dados
- Preview antes de importar
- Logs de importação

## Cenários de Uso

### Cenário 1: Expansão para Novo País

1. Admin Global ativa Moçambique em `/admin/country-config`
2. Importa divisões administrativas de Moçambique
3. Cria Admin Nacional de Moçambique (N5)
4. Admin Nacional MZ cria Admins Provinciais
5. Cascata continua até Nível 1

### Cenário 2: Cobertura de Nova Província

1. Admin Nacional identifica necessidade em Benguela
2. Promove cidadão a Admin Provincial (N4) de Benguela
3. Admin Provincial Benguela recruta equipe local
4. Cria Admins Territoriais para municípios
5. Cascata continua localmente

### Cenário 3: Validação de Identidade

1. Cidadão João registra identidade em Talatona
2. Sistema identifica: AO > Luanda > Belas > Talatona
3. Busca número de validação da Comuna de Talatona
4. Envia SMS ao validador comunal (N2)
5. Validador confirma via link ou código
6. Identidade aprovada e AFRO ID gerado

## Métricas e Monitoramento

### KPIs por Nível

- **Nacional (N5)**: Total de identidades, cobertura provincial
- **Provincial (N4)**: Identidades na província, taxa de validação
- **Territorial (N3)**: Identidades no território, tempo médio de validação
- **Comunal (N2)**: Identidades na comuna, precisão de endereços
- **Local (N1)**: Registros diários, qualidade de dados

### Dashboards

- `/admin/reports`: Relatórios analíticos gerais
- `/admin/risk-dashboard`: Monitoramento de riscos
- `/admin/security`: Logs de segurança e auditoria

## Expansão Continental

### Roadmap de Cobertura

**Fase 1 - África Lusófona** (6 países)
- Angola ✓
- Moçambique
- Cabo Verde
- Guiné-Bissau
- São Tomé e Príncipe
- Guiné Equatorial

**Fase 2 - África Francófona** (21 países)
- RD Congo
- Senegal
- Camarões
- Costa do Marfim
- Mali
- [...]

**Fase 3 - África Anglófona** (21 países)
- África do Sul
- Nigéria
- Quénia
- Gana
- [...]

**Fase 4 - África Arabófona** (6 países)
- Egito
- Argélia
- Sudão
- Marrocos
- [...]

### Considerações Multi-Nacionais

1. **Idiomas**: Sistema multilíngue (PT, FR, EN, AR, + línguas locais)
2. **Fusos Horários**: Suporte para todos os fusos africanos
3. **Moedas**: Conversão e relatórios multi-moeda
4. **Regulamentações**: Conformidade com leis locais de proteção de dados
5. **Operadoras Telecom**: Integração com operadoras de cada país

## Manutenção e Suporte

### Responsabilidades por Nível

- **N5**: Políticas nacionais, expansão, parcerias governamentais
- **N4**: Coordenação provincial, recrutamento de equipes
- **N3**: Supervisão territorial, treinamento de agentes
- **N2**: Gestão comunal, suporte técnico local
- **N1**: Atendimento direto, registro de cidadãos

### Treinamento

Cada nível superior é responsável pelo treinamento do nível inferior:
- Manuais operacionais por nível
- Vídeos tutoriais
- Suporte via WhatsApp/Telegram por região
- Reuniões mensais de alinhamento

## Conclusão

Este sistema hierárquico permite:
- ✅ Expansão organizada e escalável
- ✅ Delegação clara de responsabilidades
- ✅ Controle de acesso baseado em jurisdição
- ✅ Auditoria completa de ações
- ✅ Cobertura continental sustentável
- ✅ Adaptação a contextos locais

Para iniciar a implementação, acesse `/admin/system-setup` e siga o guia passo-a-passo.

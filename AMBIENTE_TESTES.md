# 🧪 AMBIENTE DE TESTES AFROLOC

## Índice
1. [Credenciais de Acesso](#credenciais-de-acesso)
2. [Códigos AFROLOC de Teste](#códigos-afroloc-de-teste)
3. [Cenários de Demonstração](#cenários-de-demonstração)
4. [Fluxos de Teste](#fluxos-de-teste)

---

## 📱 Credenciais de Acesso

### Nota Importante
> **Senha padrão para todos os utilizadores de teste:** `Test@2024!`
> 
> O login é feito via número de telefone + OTP (em ambiente de teste, o OTP é automaticamente confirmado)

---

### 👑 Administradores Nacionais (Nível 5)

| Nome | Telefone | AFRO ID | Província |
|------|----------|---------|-----------|
| Administrador Nacional | +244900000001 | AO-ADM-LRT5X6 | Nacional |
| Administrador Nacional Angola | +244923828282 | - | Nacional |

**Permissões:** Acesso total ao sistema, gestão de todos os utilizadores e endereços a nível nacional.

---

### 🏛️ Administradores Provinciais (Nível 4)

| Nome | Telefone | AFRO ID | Província |
|------|----------|---------|-----------|
| Admin Provincial Luanda | +244900100001 | AO-ADM-Z8569E | Luanda |
| Administrador Provincial Luanda | +244900000002 | AO-ADM-NZMCQH | Luanda |
| Admin Provincial Bengo | +244900100002 | AO-ADM-9POHKE | Bengo |
| Admin Provincial Benguela | +244900100003 | AO-ADM-99TPK6 | Benguela |
| Admin Provincial Huambo | +244900100010 | AO-ADM-W9KVLE | Huambo |
| Admin Provincial Huíla | +244900100011 | AO-ADM-ZIUZLP | Huíla |
| Admin Provincial Cabinda | +244900100005 | AO-ADM-UEMEU0 | Cabinda |

**Permissões:** Gestão de utilizadores e endereços na sua província.

---

### 🏢 Administradores Municipais (Nível 3)

| Nome | Telefone | AFRO ID | Município |
|------|----------|---------|-----------|
| Admin Municipal Ingombota | +244900200001 | AO-ADM-G0007K | Ingombota |
| Admin Municipal Dande | +244900200006 | AO-ADM-DBZBYI | Dande |
| Admin Municipal Benguela | +244900200014 | AO-ADM-FNM53O | Benguela |
| Admin Municipal Huambo | +244900200009 | AO-ADM-W7BKTZ | Huambo |
| Admin Municipal Lubango | +244900200011 | AO-ADM-QQYSD0 | Lubango |

**Permissões:** Gestão de endereços e validações no seu município.

---

### 👷 Operadores de Campo (Nível 2)

| Nome | Telefone | AFRO ID | Função |
|------|----------|---------|--------|
| Operador de Campo | +244900000004 | AO-OPE-M484D3 | Registo de endereços |

**Permissões:** Criar e editar endereços, adicionar testemunhas.

---

### 👥 Testemunhas (Nível 1)

| Nome | Telefone | AFRO ID | Função |
|------|----------|---------|--------|
| Testemunha Vizinho 1 | +244900000010 | AO-TES-1Y33T8 | Testemunha de endereços |
| Testemunha Vizinho 2 | +244900000011 | AO-TES-TNJ9NW | Testemunha de endereços |

**Permissões:** Confirmar testemunhos de endereços.

---

### 🏠 Cidadãos (Utilizadores Regulares)

| Nome | Telefone | AFRO ID | Descrição |
|------|----------|---------|-----------|
| Maria Santos | +244923456789 | AO-MAR-0C0Y3X | Utilizadora com 3 endereços |
| João Pereira | +244912345678 | AO-JOÃ-8PSFLP | Utilizador com endereços digitais |
| Ana Costa | +244934567890 | AO-ANA-ECVVUB | Utilizadora em áreas rurais |
| Jessica Silva | +244900000013 | - | Utilizadora urbana |
| Antonio Henriques Silva | +244929000066 | - | Utilizador em Talatona |

---

## 📍 Códigos AFROLOC de Teste

### Nomenclatura Oficial
```
CC-MUN-COM-BAI-G10-X-Y
```
- **CC**: Código do país (AO = Angola)
- **MUN**: Código do município (3 letras)
- **COM**: Código da comuna (3 letras)
- **BAI**: Código do bairro (3 letras) ou **DIG** para digitais
- **G10/G25**: Tamanho da célula (10m urbano, 25m rural)
- **X-Y**: Coordenadas em Base36

---

### 🏛️ Endereços FORMAIS (com rua e número)

| Código AFROLOC | Proprietário | Localização | Endereço |
|----------------|--------------|-------------|----------|
| `AO-TAL-TAL-VID-G10-2ZP1-N1FTR` | Maria Santos | Talatona, Vida Pacífica | Rua Major Kanhangulo |
| `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6` | Maria Santos | Maianga, Prenda Nova | Avenida Central |
| `AO-VIA-ZAN-ZN1-G10-2ZXH-N1FQ6` | Maria Santos | Viana, Zango 1 | Rua da Missão |
| `AO-TAL-BNV-NOV-G10-2ZPV-N1FS0` | João Pereira | Talatona, Benfica Nova | Travessa dos Flores |
| `AO-TAL-LAR-PAT-G10-2ZP1-N1FTL` | Operador de Campo | Talatona, Lar Patriota | Rua do Golfe |
| `AO-ING-CEN-HIS-G10-2ZRO-N1FIZ` | Testemunha Vizinho 1 | Ingombota, Centro Histórico | Rua Rainha Ginga |
| `AO-MAI-PRE-ALT-G10-2ZRV-N1FI6` | Testemunha Vizinho 2 | Maianga, Prenda Alta | Avenida 21 de Janeiro |
| `AO-MAI-MAI-CEN-G10-2ZRV-N1FI8` | Jessica Silva | Maianga, Centro | Rua da Missão |
| `AO-KIL-CEN-KIL-G10-2ZLM-N1FAT` | Jessica Silva | Kilamba, Centralidade | Avenida Central K3 |

---

### 📱 Endereços DIGITAIS (só GPS, sem endereço formal)

| Código AFROLOC | Proprietário | Localização | Coordenadas |
|----------------|--------------|-------------|-------------|
| `AO-CAZ-HOJ-DIG-G10-2ZU9-N1FJM` | João Pereira | Cazenga, Hoji-Ya-Henda | -8.845, 13.289 |
| `AO-VIA-EST-DIG-G10-2ZXH-N1FPM` | João Pereira | Viana, Estalagem | -8.905, 13.372 |
| `AO-RAN-RAN-DIG-G10-2ZQD-N1FKD` | Ana Costa | Rangel | -8.852, 13.218 |
| `AO-SAM-SAM-DIG-G10-2ZRO-N1FIZ` | Admin Nacional | Sambizanga | -8.814, 13.235 |
| `AO-MAI-MAI-DIG-G10-2ZRV-N1FI6` | Ana Rafaela Silva | Maianga | -8.814, 13.235 |
| `AO-CAX-MUX-DIG-G25-K8DN-N9FTJ` | Testemunha Vizinho 1 | Bengo, Caxito | -8.578, 13.661 |
| `AO-CAX-CAX-DIG-G25-K8DN-N9HBI` | Ana Costa | Bengo, Caxito | -8.578, 13.661 |
| `AO-DAN-CAX-DIG-G25-K86S-N9COE` | Ana Costa | Bengo, Dande | -8.465, 13.542 |

---

## 🎬 Cenários de Demonstração

### Cenário 1: Registo de Endereço Formal
**Objetivo:** Demonstrar o registo completo de um endereço com rua e número.

**Passos:**
1. Login como **Maria Santos** (+244923456789)
2. Ir a "Criar Nova Identidade"
3. Preencher:
   - País: Angola
   - Província: Luanda
   - Município: Talatona
   - Bairro: Vida Pacífica
   - Rua: Rua das Palmeiras
   - Número: 45
4. Capturar GPS (usar mapa)
5. Submeter

**Resultado Esperado:** Código no formato `AO-TAL-TAL-VID-G10-XXXXX-NYYYY`

---

### Cenário 2: Registo de Endereço Digital
**Objetivo:** Demonstrar o registo de endereço sem rua/número formal (área informal).

**Passos:**
1. Login como **João Pereira** (+244912345678)
2. Ir a "Criar Nova Identidade"
3. Preencher:
   - País: Angola
   - Província: Luanda
   - Município: Cazenga
   - Bairro: (deixar vazio)
   - Rua: (deixar vazio)
4. Capturar GPS obrigatoriamente
5. Submeter

**Resultado Esperado:** Código no formato `AO-CAZ-XXX-DIG-G10-XXXXX-NYYYY`

---

### Cenário 3: Validação por Testemunhas
**Objetivo:** Demonstrar o processo de validação por testemunhas.

**Utilizadores envolvidos:**
- **Maria Santos** (proprietária do endereço)
- **Testemunha Vizinho 1** (+244900000010)
- **Testemunha Vizinho 2** (+244900000011)

**Passos:**
1. Maria Santos abre o endereço `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6`
2. Adiciona testemunhas pelo telefone
3. Testemunhas recebem notificação
4. Login como Testemunha Vizinho 1
5. Confirmar ou rejeitar o testemunho

**Dados de teste existentes:**
| Endereço | Testemunha | Status |
|----------|------------|--------|
| `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6` | Testemunha Vizinho 1 | ✅ Confirmado |
| `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6` | Testemunha Vizinho 2 | ✅ Confirmado |
| `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6` | Operador de Campo | ✅ Confirmado |

---

### Cenário 4: Validação Administrativa
**Objetivo:** Demonstrar o processo de validação por autoridades.

**Passos:**
1. Login como **Admin Municipal Ingombota** (+244900200001)
2. Ir a "Validações Pendentes"
3. Ver endereços da jurisdição
4. Validar GPS de um endereço
5. Aprovar ou rejeitar

---

### Cenário 5: Consulta de Endereço por QR Code
**Objetivo:** Demonstrar a verificação pública de um endereço AFROLOC.

**Passos:**
1. Abrir página de verificação pública
2. Escanear QR Code ou inserir código manualmente
3. Visualizar informações do endereço
4. Ver status de validação

**Códigos para testar:**
- `AO-TAL-TAL-VID-G10-2ZP1-N1FTR` (validado)
- `AO-CAZ-HOJ-DIG-G10-2ZU9-N1FJM` (digital)

---

### Cenário 6: Gestão Hierárquica
**Objetivo:** Demonstrar a hierarquia de permissões.

**Níveis de acesso:**
1. **Nacional** (Nível 5) → Vê tudo
2. **Provincial** (Nível 4) → Vê a sua província
3. **Municipal** (Nível 3) → Vê o seu município
4. **Operador** (Nível 2) → Regista endereços
5. **Cidadão** (Nível 1) → Os seus próprios endereços

**Teste:**
1. Login como Admin Provincial Luanda (+244900100001)
2. Verificar que só vê endereços de Luanda
3. Login como Admin Municipal Ingombota (+244900200001)
4. Verificar que só vê endereços de Ingombota

---

### Cenário 7: Visualização das Grids QGSQ
**Objetivo:** Demonstrar o sistema de grids geográficas para geocodificação.

**Conceitos Fundamentais:**
- **QG (Quadrant Grid):** Células de 10m (urbano) ou 25m (rural)
- **SQ (Sub-Quadrant):** Subdivisões para maior precisão
- **Base36:** Coordenadas X-Y codificadas em alfanumérico

**Acesso à página:**
- Rota: `/geospatial-grid`
- Também acessível via Dashboard → Grid Geoespacial

**Passos de Demonstração:**
1. Aceder a "Grid Geoespacial" no menu
2. Navegar no mapa até Luanda
3. Observar as células de grid sobrepostas
4. Clicar numa célula para ver:
   - Código AFROLOC gerado
   - Tamanho da célula (10m ou 25m)
   - Coordenadas X-Y em Base36
   - Limites (bbox) da célula

**Cores da Grid por Densidade:**
| Cor | Significado | Registos |
|-----|-------------|----------|
| 🔵 Azul | Fria | 0 registos |
| 🟢 Verde | Baixa | 1-2 registos |
| 🟡 Amarelo | Média | 3-5 registos |
| 🟠 Laranja | Alta | 6-10 registos |
| 🔴 Vermelho | Muito alta | 10+ registos |

**Exemplo Visual:**
```
┌─────────────────────────────────────────────────────────────┐
│                    MAPA DE LUANDA                           │
│  ┌───────┬───────┬───────┬───────┐                         │
│  │ 🔵    │ 🟢    │ 🔵    │ 🔵    │  ← Células 10m x 10m    │
│  │G10-A1 │G10-A2 │G10-A3 │G10-A4 │    (Zona Urbana)        │
│  ├───────┼───────┼───────┼───────┤                         │
│  │ 🔵    │ 🟡    │ 🟡    │ 🔵    │                         │
│  │G10-B1 │G10-B2 │G10-B3 │G10-B4 │                         │
│  ├───────┼───────┼───────┼───────┤                         │
│  │ 🔵    │ 🔴    │ 🟠    │ 🔵    │  ← Alta densidade       │
│  │G10-C1 │G10-C2 │G10-C3 │G10-C4 │    no centro            │
│  └───────┴───────┴───────┴───────┘                         │
└─────────────────────────────────────────────────────────────┘
```

**Coordenadas de Teste:**
| Localização | Lat | Lon | Código Esperado |
|-------------|-----|-----|-----------------|
| Talatona Centro | -8.8925 | 13.2106 | AO-TAL-...-G10-2ZP1-N1FTR |
| Ingombota | -8.8217 | 13.2369 | AO-ING-...-G10-2ZRO-N1FIZ |
| Caxito (Rural) | -8.578 | 13.661 | AO-CAX-...-G25-K8DN-N9HBI |

---

### Cenário 8: Validação de Proximidade das Testemunhas (100m)
**Objetivo:** Demonstrar a validação de que testemunhas estão a menos de 100m do endereço.

**Regras de Proximidade:**
| Zona | Raio Máximo | Tolerância |
|------|-------------|------------|
| Urbana | 100 metros | ±5m GPS |
| Rural | 500 metros | ±10m GPS |

**Acesso à página:**
- Rota: `/witness-proximity`
- Também: Dashboard → Mapa de Proximidade

**Passos de Demonstração:**
1. Login como **Admin Municipal Ingombota** (+244900200001)
2. Aceder a "Mapa de Proximidade"
3. Selecionar um endereço com testemunhas
4. Visualizar:
   - Círculo de 100m ao redor do endereço
   - Posições das testemunhas no momento da confirmação
   - Distância calculada para cada testemunha

**Visualização do Mapa:**
```
┌─────────────────────────────────────────────────────────────┐
│                   MAPA DE PROXIMIDADE                       │
│                                                             │
│              ╭─────────────────────╮                        │
│           ╭──┤   RAIO DE 100m      ├──╮                     │
│          ╱   ╰─────────────────────╯   ╲                    │
│         │    🟢 Testemunha 1 (45m)      │  ← Dentro ✅       │
│         │                               │                   │
│         │         🏠 ENDEREÇO           │                   │
│         │       (Ponto Central)         │                   │
│         │                               │                   │
│         │    🟢 Testemunha 2 (78m)      │  ← Dentro ✅       │
│          ╲                             ╱                    │
│           ╰───────────────────────────╯                     │
│                                                             │
│     🔴 Testemunha 3 (156m)              ← Fora ❌           │
│        (Rejeitada automaticamente)                          │
└─────────────────────────────────────────────────────────────┘
```

**Dados de Teste para Proximidade:**

| Endereço | Testemunha | Distância | Status |
|----------|------------|-----------|--------|
| `AO-TAL-TAL-VID-G10-2ZP1-N1FTR` | Testemunha 1 | 45m | ✅ Válida |
| `AO-TAL-TAL-VID-G10-2ZP1-N1FTR` | Testemunha 2 | 78m | ✅ Válida |
| `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6` | Testemunha 1 | 32m | ✅ Válida |
| `AO-MAI-PRD-NOV-G10-2ZRV-N1FI6` | Testemunha 2 | 89m | ✅ Válida |
| `AO-CAX-CAX-DIG-G25-K8DN-N9HBI` | Testemunha 1 | 230m | ✅ Válida (rural, <500m) |

**Fórmula de Cálculo (Haversine):**
```
distância = R × arccos(
  sin(lat1) × sin(lat2) + 
  cos(lat1) × cos(lat2) × cos(lon2 - lon1)
)

Onde R = 6.371.000 metros (raio da Terra)
```

**Estados de Proximidade:**
| Ícone | Cor | Significado |
|-------|-----|-------------|
| 🟢 | Verde | Dentro do raio (válida) |
| 🟡 | Amarelo | Limite do raio (atenção) |
| 🔴 | Vermelho | Fora do raio (inválida) |

**Alertas de Fraude por GPS:**
- Velocidade impossível entre confirmações
- Saltos de localização > 1km em < 1min
- GPS spoofing detectado

---

## 🔄 Fluxos de Teste

### Fluxo Completo de Certificação

```
┌─────────────────┐
│  1. REGISTO     │
│  (Cidadão)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. TESTEMUNHAS │
│  (2-3 vizinhos) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. VALIDAÇÃO   │
│  (Autoridade)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. CERTIFICADO │
│  (QR Code)      │
└─────────────────┘
```

### Estados do Endereço

| Estado | Descrição | Ação Necessária |
|--------|-----------|-----------------|
| `draft` | Rascunho | Completar informações |
| `pending_witnesses` | Aguarda testemunhas | Adicionar 2+ testemunhas |
| `pending_validation` | Aguarda validação | Autoridade deve validar |
| `validated` | Validado | Endereço certificado |
| `rejected` | Rejeitado | Ver motivo e corrigir |

---

## 📊 Métricas de Teste

### Endereços por Tipo
- **Formais:** 12 endereços
- **Digitais:** 9 endereços

### Endereços por Região
- **Luanda:** 18 endereços
- **Bengo:** 3 endereços

### Testemunhos
- **Confirmados:** 15
- **Pendentes:** 3

---

## 🔐 Notas de Segurança

1. **Ambiente de Teste:** Todos os dados são fictícios
2. **OTP Automático:** Em ambiente de teste, OTPs são confirmados automaticamente
3. **Senha Padrão:** `Test@2024!` para todos os utilizadores
4. **Reset:** Os dados podem ser resetados a qualquer momento

---

## 📞 Suporte

Para questões sobre o ambiente de teste:
- **Email:** suporte@afroloc.ao
- **WhatsApp:** +244 900 000 000

---

*Documento gerado automaticamente - Última atualização: Dezembro 2024*

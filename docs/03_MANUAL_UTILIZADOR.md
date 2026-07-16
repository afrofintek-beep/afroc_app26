# Manual 3 — Manual do Utilizador (AFROLOC)

| | |
|---|---|
| **Versão** | 1.0.0 |
| **Data** | 2026-07-08 |
| **Aplica-se a** | app 1.0.0 |
| **Estatuto** | Fonte da verdade |
| **Classificação** | Público (P) |

> Este manual descreve a app AFROLOC do ponto de vista de quem a usa: como criar a sua morada digital, o que significam os selos e níveis de confiança, e como partilhar o seu endereço. Está ancorado no que a app realmente faz. Onde um ponto não pôde ser confirmado no código, está assinalado com **⚠️ a validar**.
>
> Nota sobre nomes de ecrã: dentro da app, uma morada AFROLOC é por vezes chamada de "AFROLOC" ou "identidade de endereço". Neste manual usamos sobretudo a palavra **endereço** ou **morada**.

---

## 1. Âmbito

Com a AFROLOC dá um endereço digital verificável a qualquer local — mesmo a locais sem nome de rua ou número oficial. Este manual cobre:

- Criar um endereço (localização GPS ou seleção no mapa, fotografia da porta com metadados, tipo de propriedade, unidade/apartamento).
- O que significa um endereço estar **auto-atribuído / não verificado**.
- Os **níveis de confiança** (do endereço só declarado até totalmente certificado) e como subir de nível.
- Os **canais de entrega** (caixa postal, locker, ponto de recolha).
- **Partilhar** o seu endereço por código QR.

Não cobre funções de administração, de autoridade validadora nem de agente. Essas estão noutros manuais.

---

## 2. Criar um endereço (passo a passo)

Toque em **Criar** (ou "Criar Identidade") e preencha o formulário **Informações do Endereço**. Os campos marcados com `*` são obrigatórios.

### Passo 1 — País e tipo de endereço

1. Escolha o **País**.
2. Escolha o **Tipo de Endereço**:
   - **📍 Informal — sem rua ou número oficial** — para locais sem nome de rua ou número atribuído oficialmente.
   - **🏛️ Formal — tem rua e número oficiais** — para moradas com rua e número atribuídos pela administração.

   A caixa de informação no ecrã explica ainda um terceiro tipo, **Digital**: *"Tipo atribuído após certificação por autoridades (substitui Formal/Informal)"*. Ou seja, **não escolhe "Digital"** — é o sistema que o atribui automaticamente depois de o endereço ser certificado por uma autoridade.

### Passo 2 — Divisão administrativa

Preencha, de cima para baixo (cada campo ativa o seguinte):

- **Província** `*`
- **Município** `*`
- **Comuna** (opcional; pode não existir para todos os municípios)
- **Bairro** (opcional; campo de texto livre)

### Passo 3 — Rua, número e unidade

- **Nome da Rua** — obrigatório se escolheu tipo **Formal**. Ajuda no ecrã: *"Preencha se a rua tem nome oficial"*.
- **Número** —
  - No tipo **Formal**: campo obrigatório (ex: `123`).
  - No tipo **Informal**: o campo fica **bloqueado** com o texto *"Será atribuído pela Administração"*. A app avisa: *"O número será atribuído pela Administração do Estado após o agendamento e confirmação do seu registo."*
- **Unidade / Apartamento** — opcional. **Importante:** se escolher o tipo de propriedade **Apartamento**, este campo passa a ser exigido, porque é o que distingue vários registos no mesmo prédio.
- **Nome da Propriedade** — opcional (ex: nome de condomínio ou edifício). A app mostra o aviso: **"⚠️ Auto-atribuído — não verificado oficialmente"** (ver secção 3 sobre o que isto significa).

### Passo 4 — Tipo de Propriedade `*`

Escolha uma das opções:

- 🏠 **Residência (Moradia Individual)**
- 🏢 **Apartamento (Prédio/Edifício)**
- 🏪 **Comercial**
- 🌍 **Terreno**
- 📍 **Outro**

Regra importante mostrada no ecrã:
- **Apartamento**: *"permitem múltiplos registos na mesma localização (com unidades diferentes)"* — por isso é preciso indicar a **Unidade**.
- **Residência, Comercial e Terreno**: *"só permitem um registo por localização"*.

### Passo 5 — Localização GPS

Tem duas formas de marcar o ponto exato:

1. **Usar Localização Atual** — o botão pede a localização ao seu dispositivo e preenche automaticamente a latitude/longitude e a hierarquia administrativa. Se recusar a permissão de localização, a app avisa e não consegue capturar o GPS.
2. **Mapa** — pode tocar diretamente no mapa para escolher o ponto.

Os campos **Latitude** e **Longitude** são preenchidos automaticamente e são só de leitura.

### Passo 6 — Fotografia da Porta

Secção **Fotografia da Porta do Domicílio**: *"Capture a foto da entrada principal da propriedade. Os metadados EXIF serão extraídos automaticamente."*

- Use **Tirar Foto** (câmara) ou **Galeria**.
- A app extrai automaticamente os **metadados EXIF** da imagem: modelo do dispositivo, GPS da foto, data/hora e dimensões.
- Se a foto tiver GPS próprio e ainda não tiver marcado o local, a app usa o GPS da foto.
- A app **compara** o GPS do dispositivo com o GPS embebido na foto:
  - Se corresponderem: mostra *"Validação GPS Confirmada — GPS do dispositivo corresponde aos metadados EXIF."*
  - Se não corresponderem: mostra o alerta *"⚠️ ALERTA: Discrepância entre GPS do dispositivo e metadados EXIF da foto."*

Dicas apresentadas no ecrã para melhores resultados: boa iluminação natural; porta completa e número visível; câmara estável e focada; evitar sombras e reflexos.

> A fotografia é **opcional** — se o upload falhar, a criação do endereço não é cancelada. Mas a foto com EXIF ajuda a subir o nível de confiança (secção 3).

### Passo 7 — Canais de entrega (opcional)

Secção **Canais de Entrega**: *"Adicione pontos de entrega alternativos como caixas postais, lockers ou pontos de recolha."* Ver detalhe na secção 4. Estes só podem ser adicionados **depois** de gravar o endereço.

### Passo 8 — Criar

Toque em **Criar Identidade**. Quando termina, aparece a mensagem **"AFROLOC criado com sucesso"** e é levado para a lista dos seus endereços. O novo endereço começa como **não verificado** (ver secção seguinte).

---

## 3. Níveis de confiança e como subir

### 3.1 O que significa "auto-atribuído / não verificado"

Quando cria um endereço, algumas informações são apenas o que **você declarou** — ainda não foram confirmadas por ninguém. Exemplos:

- O **Nome da Propriedade** aparece com o aviso *"Auto-atribuído — não verificado oficialmente"*. A app explica: *"Nome auto-atribuído pelo utilizador. Não faz parte da hierarquia administrativa oficial."*
- Um endereço acabado de criar surge com o estado **"Não verificado"**.

Isto é normal e não é um erro: é o ponto de partida. A confiança sobe à medida que junta provas.

### 3.2 A Pontuação de Confiança do Endereço (ATS)

A app calcula uma **Pontuação de Confiança do Endereço (ATS)** de **0 a 100**. É *"uma pontuação ponderada (0-100) baseada em precisão GPS, sinais de telecomunicações, validação EXIF, confirmações de testemunhas e documentação."*

A pontuação divide-se em cinco componentes (o máximo de cada um está entre parêntesis):

| Componente | Máximo | O que mede |
|---|---|---|
| **GPS** | 25 | *"Precisão de localização e validação GPS"* |
| **Telecom** | 25 | *"Triangulação de sinal e validação cruzada"* |
| **EXIF** | 20 | *"Metadados da foto e verificação do dispositivo"* |
| **Testemunhas** | 15 | *"Confirmações de testemunhas da comunidade"* |
| **Auditoria** | 15 | *"Documentação e validação oficial"* |

> A pontuação é decidida no **servidor** (a app só a mostra), o que dificulta manipulações.

### 3.3 Os níveis de certificação (0 a 4)

A partir da pontuação, o endereço recebe um **nível de certificação de 0 a 4**, mostrado como um selo e numa pequena escala colorida no cartão da pontuação:

| Nível | Nome apresentado na app | Significado |
|---|---|---|
| **0** | Unverified | Sem verificação concluída |
| **1** | Basic Verified | Captura de GPS obtida, validação básica |
| **2** | Strong Verified | GPS + telecom/EXIF validados |
| **3** | Multi-Layer Verified | GPS, telecom, EXIF e testemunhas validados |
| **4** | Fully Certified | Todas as camadas concluídas, confiança máxima |

> **⚠️ a validar (linguagem):** No pedido, estes níveis foram descritos como "auto-declarado → bronze → prata → ouro → platina". Esse esquema de **medalhas não existe no código** atual. Na versão 1.0.0, os níveis chamam-se **0 Unverified · 1 Basic Verified · 2 Strong Verified · 3 Multi-Layer Verified · 4 Fully Certified**. Além disso, na app 1.0.0 estes nomes de nível aparecem **em inglês** (as traduções em português ainda não estão ligadas), embora os cinco componentes da pontuação (GPS, Telecom, EXIF, Testemunhas, Auditoria) já estejam em português. Se a intenção for usar nomes em português ou nomes de medalhas, isso precisa de ser confirmado/implementado.

Em paralelo, o endereço tem também um **estado**, visível na lista:

- **Pendente** — em processamento/aguarda validação.
- **Verificado** — validado.
- **Certificado** — certificado por autoridade (é neste ponto que passa a ser tratado como endereço "Digital").
- **Rejeitado** — não aprovado.

### 3.4 Como subir de nível

Cada uma destas ações reforça um componente da pontuação:

1. **Marque o GPS com precisão** — use **Usar Localização Atual** ou o mapa. Reforça o componente **GPS**.
2. **Adicione a fotografia da porta** — a foto com metadados EXIF (e GPS coincidente) reforça o componente **EXIF**. Ver Passo 6.
3. **Junte testemunhas** — convide vizinhos para confirmarem a sua morada (reforça o componente **Testemunhas**):
   - Ecrã **Adicionar Testemunha**: *"Convide um vizinho para confirmar a sua morada"*. Insere o **AFROLOC da Testemunha**.
   - Requisitos que a testemunha tem de cumprir:
     - *"Deve ter AFROLOC verificado ou certificado"*.
     - *"A testemunha deve ter a sua própria morada validada por autoridade ou outras testemunhas"*.
     - *"Deve residir dentro de 100 metros da sua localização"*.
     - *"Precisa de **3 testemunhas confirmadas** para validação"*.
   - A cada testemunha é pedido que confirme ou recuse ("1) SIM / 2) NÃO"). Quando confirma, é gerado um termo de compromisso legal.
4. **Envie documentos e obtenha validação oficial** — documentos comprovativos e a validação por uma autoridade reforçam o componente **Auditoria** e podem levar o endereço ao estado **Certificado**.
5. **Telecom** e a **presença diária (PoDP)** são reforçados de forma automática pelo sistema; não há um botão que precise de tocar.

> Depois de ter **3 testemunhas confirmadas**, o endereço fica pronto para avançar para verificação.

---

## 4. Certificado e caixa postal

### 4.1 Certificado de morada

**⚠️ a validar.** Na versão 1.0.0 **não foi encontrado um botão para o utilizador ver ou descarregar um "certificado de morada" próprio.** Existe:

- Um **tipo de documento** chamado **"Certificado de Residência"** dentro da lista de documentos (é uma etiqueta no modelo de dados, não um documento que a app gere para si automaticamente).
- Um **PDF de contrato de testemunha** (termo de compromisso legal) que é gerado quando uma testemunha confirma a sua morada.

Se o objetivo for oferecer ao utilizador um certificado de morada descarregável (PDF), essa funcionalidade ainda precisa de ser confirmada ou implementada.

### 4.2 Canais de entrega (caixa postal, locker, ponto de recolha)

Secção **Canais de Entrega**: *"Adicione caixas postais, lockers ou pontos de recolha ao seu endereço AFROLOC."* Servem para receber correio e encomendas num ponto alternativo ligado à sua morada.

Tipos disponíveis:

- **Caixa Postal** — *"Caixa postal tradicional nos correios"*.
- **Locker** — *"Armário automático de recolha"*.
- **Ponto de Recolha** — *"Loja ou ponto de recolha parceiro"*.

Como adicionar (o endereço já tem de estar gravado):

1. Toque em **Adicionar Canal de Entrega**.
2. Escolha o **Operador** e o **Tipo**, e indique o **Código** do ponto (obrigatório). Pode ainda dar um **Nome** e um **Endereço** ao ponto (opcionais).
3. Confirme com o **código OTP de 6 dígitos**: *"Introduza o código OTP de 6 dígitos enviado para confirmar o seu canal de entrega."*
4. Depois de confirmado, o canal fica **Ativo**. Enquanto não confirma, aparece como **Pendente OTP**.

Gestão dos canais:

- Pode marcar um como **Primário** (estrela) — é o ponto de entrega preferencial.
- Pode **revogar** (remover) um canal.
- Estados possíveis de um canal: **Ativo**, **Pendente OTP**, **Revogado**, **Expirado**.

---

## 5. Partilhar

Pode partilhar o seu endereço através de um **Código QR da Morada**.

O que o código QR contém: o **código AFROLOC**, a hierarquia administrativa completa (país, província, município, comuna, bairro), a rua/número/unidade, as **coordenadas GPS**, o tipo de propriedade e o estado.

O que vê no ecrã do QR:

- A imagem do código QR.
- O **código** da morada e o endereço completo por baixo.

Ações disponíveis:

- **Descarregar** — guarda o QR como imagem PNG (ficheiro `afroid-<código>.png`). Confirmação: *"Código QR descarregado com sucesso"*.
- **Partilhar** — usa o menu de partilha do telemóvel (envia a imagem do QR com o texto *"Morada AFROLOC: <código>"*). Em computadores, onde a partilha nativa não está disponível, a app copia a imagem para a área de transferência.

> **⚠️ a validar (partilha por link):** a partilha atual é feita por **imagem/código QR**, não por um *link/URL* clicável para o endereço. Se pretender partilha por link, isso ainda precisa de ser confirmado.

---

## 6. Perguntas frequentes

**Preciso de indicar rua e número?**
Só se escolher o tipo **Formal**. No tipo **Informal**, o número é atribuído mais tarde pela Administração e o campo aparece bloqueado.

**Porque diz "Auto-atribuído — não verificado" ao lado do nome que dei à propriedade?**
Porque é informação que **você** escreveu e ainda não foi confirmada oficialmente. Não faz parte da hierarquia administrativa oficial. É normal e não impede a criação do endereço.

**A fotografia é obrigatória?**
Não. Mas a foto da porta com metadados EXIF ajuda a subir a pontuação de confiança e é fortemente recomendada.

**Quantas testemunhas preciso?**
**3 testemunhas confirmadas**. Cada uma tem de ter um AFROLOC verificado ou certificado, morada validada, e residir a menos de 100 metros de si.

**O que significa o meu endereço estar "Certificado"?**
Foi certificado por uma autoridade. A partir daí é tratado como endereço **Digital** e tem o nível de confiança mais alto.

**Posso receber correio numa caixa postal?**
Sim. Adicione um **Canal de Entrega** do tipo Caixa Postal, Locker ou Ponto de Recolha, e confirme-o com o código OTP de 6 dígitos.

**Como envio o meu endereço a outra pessoa?**
Abra o **Código QR da Morada** e use **Descarregar** ou **Partilhar**.

**Os níveis chamam-se mesmo "bronze/prata/ouro/platina"?**
Não na versão 1.0.0. Os níveis são **0 a 4** (Unverified, Basic Verified, Strong Verified, Multi-Layer Verified, Fully Certified). Ver a nota **⚠️ a validar** na secção 3.3.

---

## 7. Changelog

| Versão | Data | Alterações |
|---|---|---|
| 1.0.0 | 2026-07-08 | Primeira edição do Manual do Utilizador, ancorada no código da app 1.0.0. Pontos assinalados com **⚠️ a validar**: nomenclatura dos níveis (medalhas vs. 0–4 / inglês), certificado de morada descarregável, e partilha por link. |

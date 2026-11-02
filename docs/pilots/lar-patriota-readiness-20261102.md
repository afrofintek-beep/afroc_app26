# Estado técnico do piloto Lar do Patriota

Verificação de 2 de Novembro de 2026, 18h43 de Luanda. O piloto está publicado na AFROLOC, mas permanece fechado à operação real. A documentação anterior que dizia «apenas staging» ficou ultrapassada. Não foram enviados SMS reais, criadas contas operacionais ou emitidos certificados reais nesta verificação.

## Estado comprovado

| Componente | Evidência actual | Situação |
| --- | --- | --- |
| AFROLOC produção | `ljcxqwjvjgobhisqkujr`; migrações `authorized_account_link`, `partner_certificate_lifecycle` e `lar_patriota_workflow`, registadas às 09h43–09h44 UTC | Instalado |
| Funções AFROLOC | `residence-pilot`, `account-phone`, `account-link-authority`, versão 3; respostas HTTP 401 sem autenticação | Publicadas |
| Página do piloto | `https://www.afroloc.ao/piloto/lar-do-patriota`; HTTP 200, módulo ResidencePilot presente, base de produção correcta | Publicada |
| Operação real | `residence_pilot_settings.enabled=false`; referência/versão de perímetro nulas; zero pessoas, pedidos, convites, declarações, certificados `resident` e desafios OTP | Fechada |
| Perímetro | `LDP-TAL-001`, `1.1-revisao-local`, `status=draft`, `locality_reviewed=false`, `certification_enabled=false` | Não aprovado no sistema |
| Responsáveis | `LDP-OP-01` e `LDP-OP-02`, ambos `unassigned`, sem utilizador ou email atribuído e sem autorização de emissão | Não atribuídos |
| YAMILOOK produção | `rfayqekonkovfbkwjjum`; sem tabelas de ligação/OTP e sem funções `account-link` e `account-phone`; ambas respondem HTTP 404 | Backend por publicar |
| PR YAMILOOK 122 | Integrada; `validEvidence` aceita `resident` com as mesmas verificações de identidade, destinatário e validade | Código disponível |

As seis tabelas centrais do piloto, o rascunho de perímetro e os lugares operacionais têm RLS activa e não concedem SELECT/INSERT directo a `anon` ou `authenticated`. As três RPC são SECURITY INVOKER e executáveis apenas por `service_role`. O actor é extraído da sessão por `getUser()` na função de servidor. A ausência de políticas de browser é intencional neste modelo de acesso pelo serviço.

O diagnóstico global Supabase continua a apresentar avisos herdados, incluindo `spatial_ref_sys` sem RLS, funções privilegiadas acessíveis e search paths. Isto não equivale a uma auditoria global aprovada nem invalida a verificação específica dos privilégios do piloto. Remediação oficial: https://supabase.com/docs/guides/database/database-linter .

## Bloqueios à abertura

**Autenticação legada.** `phone-login` de produção continua na versão 37, com o caminho antigo que usa telefone de perfil e substituição de password para criar sessão. A retirada segura existe no repositório, mas não está publicada nesse endpoint. `getUser()` no piloto não distingue a origem de uma sessão válida. Antes de confiar em contas de residentes, testemunhas ou revisores, resolver esta origem de sessões e o plano de recuperação das contas dependentes, preservando os UUID existentes; rever e invalidar sessões afectadas. Não restaurar o fluxo inseguro como mecanismo de recuperação. Não foram exploradas contas reais nesta auditoria.

**Perímetro.** A base regista que o proponente comunicou a conclusão da verificação local. Faltam o protocolo/evidências e nomes dos validadores. A versão 1.1 preserva a geometria anterior; o documento actual continua em rascunho. Não declarar o polígono corrigido/aprovado sem uma versão exacta, hash e validação documental. Não o usar para prova automática de residência, pertença territorial ou Banda YAMILOOK.

**Autoridade e separação de funções.** Os dois lugares são registos preparatórios; não são caixas de email, contas autenticadas ou permissões efectivas. A RPC continua a autorizar revisão/configuração/emissão através do papel genérico `admin`, sem consultar `residence_pilot_operator_slots`. Atribuir responsáveis não chega para estabelecer privilégio mínimo: ligar os papéis funcionais à autorização antes de delegar a operação. O emissor não pode ser requerente nem testemunha.

O comando `configure` verifica o preenchimento da referência e versão, mas não exige no código uma aprovação do rascunho cartográfico nem um registo de aprovação de privacidade. O bloqueio actual é a configuração fechada, que deve ser preservada. A abertura deve ganhar uma verificação técnica destes requisitos, além do procedimento operacional, antes de delegar a administração do piloto.

**Privacidade.** Aprovar aviso e versão de consentimento, fundamento e finalidade do tratamento, acesso aos depoimentos, canal de retirada/reclamação, tratamento Infobip, conservação e eliminação, excepções de auditoria e responsáveis. A retenção não está automatizada; 30/180 dias são propostas anteriores, não prazos implementados. O requerente consegue consultar as respostas das suas testemunhas; isto deve estar previsto no aviso e ser revisto quanto ao risco de pressão. Uma testemunha comum não recebe o depoimento da outra pelo seu painel.

**Configuração não comprovada nesta execução.** Não existe acesso disponível aos valores/estado dos segredos Edge ou à conta Infobip. O painel Supabase exige autenticação. A presença do código e um relato anterior de configuração não provam que `ACCOUNT_PHONE_OTP_PEPPER` esteja instalado, nem que as chaves, flags, origem, remetente e rotas estejam correctos. Guardar um segredo no 1Password não o instala no servidor. Não fornecer segredos por chat.

**Ensaios reais.** Não foram identificados números expressamente autorizados, contas de ensaio e recepção física dos SMS. A aprovação de envio a «números autorizados» não autoriza escolher contactos existentes. Falta uma allowlist de destinos e limite de despesa no fornecedor, além de testes Unitel/Africell/Movicel conforme as rotas realmente contratadas.

**YAMILOOK e recuperação.** Falta a migração `20261025121108_authorized_account_link.sql`, seguida de `account-phone` e `account-link`. O único branch adicional visível está em `MIGRATIONS_FAILED`; não constitui staging validado. Reparar/reproduzir a base de esquema num ambiente isolado antes do ensaio entre servidores. A disponibilidade de backup/PITR e uma restauração ensaiada não foram comprovadas.

## Testes realizados

| Ensaio | Resultado | Limite da prova |
| --- | --- | --- |
| Node AFROLOC | 81 passaram | PostgreSQL PGlite, lógica e fornecedor simulado |
| Formulário AFROLOC | 4 passaram | Interface com transporte simulado |
| Evidência YAMILOOK | 6 passaram | Aceitação `resident` e rejeição de evidência inválida |
| HTTP e SQL entre aplicações | Passou, SDK 2.90.1 | Handlers reais; Auth, SMS e rede simulados |
| PostgreSQL alojado AFROLOC staging | Passou com `service_role` e rollback | Dados sintéticos; não prova identidade humana ou SMS |
| Endpoints AFROLOC sem sessão | 401 nos três endpoints, produção e staging | Autenticação negativa; não valida configuração de SMS |
| Endpoint YAMILOOK | 404 em `account-phone` e `account-link` | Confirma dependências ainda ausentes |
| Build e ESLint dirigido AFROLOC | Passaram | Não é um typecheck global limpo nem teste móvel real |

O teste alojado executou contra as RPC efectivamente instaladas: piloto fechado; rejeição de browser roles e actor indevido; consentimento; auto-testemunho bloqueado; reserva de dois convites e intervalo de reenvio; declaração imutável; isolamento entre testemunhas; bloqueio de mesmo agregado com requerente; revisão humana obrigatória; emissão sintética `resident`; consentimento e consulta pelo parceiro; revogação pelo revisor; invalidação ao fechar o piloto; retirada de declaração. Todos os registos e configurações da transacção foram revertidos. No fim: piloto fechado e zero pessoas, pedidos, convites e certificados de teste. O controlo de parentesco/independência real e de agregados entre as duas testemunhas continua a depender da revisão humana; o campo `same_household` refere-se à relação com o requerente.

As definições das três RPC são idênticas entre produção e staging (comparação MD5 de `pg_get_functiondef`, apenas para detectar diferenças): `account_phone_action` = `60b2e3fe64fb49ed14eccbd1b0bc71dc`; `partner_link_action` = `d6fa7f5dee403300b2c4cf3584220066`; `residence_pilot_action` = `ecebd682dd4f4c58912dc273f2b91488`.

Reprodução local: `node --test tests/pilots/*.test.mjs tests/account-link/*.test.mjs`; `npx vitest run src/test/residencePilot.test.tsx`; `npx eslint src/pages/ResidencePilot.tsx supabase/functions/residence-pilot/*.ts`; `npm run build`. A integração HTTP é `tests/account-link/edge.integration.mjs`, com `YAMILOOK_REPO` e `ACCOUNT_LINK_TEST_SDK` apontando para o SDK exacto 2.90.1. O ensaio alojado está em `tests/pilots/hosted-rollback.sql`; executar exclusivamente no staging AFROLOC identificado, nunca em produção.

## Sequência segura de publicação

1. Manter o piloto fechado. Registar versões publicadas e cópia da configuração sem expor segredos; verificar backup, possibilidade de restauração e responsáveis. Resolver a origem insegura de sessões e os acessos funcionais antes de aceitar dados reais.
2. Formalizar perímetro corrigido, autoridade nominal e procedimentos de privacidade. Arquivar GeoJSON e versão/hash, evidências, nomes e datas de aprovação. Ensaiar endereços interiores, exteriores e de fronteira; qualquer divergência impede abertura. A geometria é apoio à revisão humana.
3. Preparar staging coerente das duas aplicações. Na AFROLOC, confirmar as três migrações já instaladas; não reaplicá-las cegamente com outros timestamps. Na YAMILOOK, aplicar a migração de ligação após validar a base do esquema. Verificar RLS, grants e ausência de alterações a perfis/mensagens/contactos existentes.
4. Publicar as funções com as flags desactivadas. Ordem: `account-phone` em cada aplicação; `account-link-authority` e `residence-pilot` na AFROLOC; `account-link` na YAMILOOK com o consumidor da PR 122. O consumidor só deve ser habilitado depois da autoridade compatível. Manter `afroloc-verify` legado suspenso.
5. Instalar segredos pelo canal seguro: peppers independentes, chave de parceiro comum apenas aos servidores, Infobip e remetente autorizado. Confirmar `AFROLOC_LINK_ENDPOINT`, `AFROLOC_CONSENT_URL` e `PILOT_PUBLIC_ORIGIN` no mesmo par de ambientes; não misturar staging com produção. Só depois habilitar flags de ensaio e o frontend correspondente.
6. Executar aceitação real restrita: residente, duas testemunhas distintas, revisor independente e conta YAMILOOK vinculada com consentimento. Cada titular introduz o seu OTP na aplicação. Confirmar recepção, link, conta errada, OTP errado/expirado/reutilizado, rejeição/desconhecimento, tentativas duplicadas, mudança de morada, identidade expirada, revogação, indisponibilidade e recuperação. Registar `messageId`, resultado e hora sem OTP ou corpo do SMS.
7. Publicar em produção o conjunto validado, começando pela migração YAMILOOK em falta e funções; confirmar configuração e testes negativos antes de expor controlos. Manter a certificação fechada até aprovação operacional registada. Abrir um lote pequeno apenas após todos os requisitos. Nenhum certificado activa automaticamente Banda, pagamentos ou benefícios.

## Recuperação em caso de falha

**Paragem de envios.** Desactivar `RESIDENCE_PILOT_SMS_ENABLED` suspende convites; o OTP de `account-phone` não usa essa flag. Suspender também o caminho de OTP, por `ACCOUNT_LINK_V1_ENABLED=false` no ambiente afectado ou mecanismo de bloqueio do fornecedor, conforme o incidente. Não bloquear a consulta/revogação indiscriminadamente sem avaliar o efeito no parceiro.

**Fecho e certificados.** A operação autenticada `configure` com `enabled=false`, preservando a referência/versão, revoga certificados do piloto na mesma transacção. Uma alteração directa da flag não deve substituir este procedimento. Qualquer nova abertura não revalida certificados revogados: exige novo processo autorizado. A YAMILOOK tem de falhar sem conceder certificação se não puder confirmar a fonte.

**Timeout de SMS.** Uma reserva pode ficar em `sending`; consultar Infobip e correlacionar referências antes de reenviar. O envio não é atomicamente transaccionável com a base. Não há webhook de entrega nem reconciliação automática; um timeout pode esconder aceitação e o reenvio pode duplicar SMS. Respeitar cinco minutos e quotas. O estado `accepted` significa aceitação do fornecedor, não recepção pelo telemóvel. Referência: https://www.infobip.com/docs/developer-resources/api-fundamentals/message-status-codes .

**Ligação ao parceiro.** Após timeout de troca, consultar `status` antes de repetir. Na revogação YAMILOOK, a desactivação local precede o pedido remoto; se a AFROLOC falhar, reconciliar a revogação pendente quando recuperar. Não transformar uma observação anterior em autorização permanente.

**Reversão da publicação.** Reverter frontend/função para versão compatível, mantendo migrações aditivas e evidências. Não eliminar tabelas, não reactivar o login inseguro e não remover a verificação de revogação. Se for indispensável restaurar dados, manter o serviço fechado, reaplicar revogações e retiradas posteriores ao ponto restaurado e reconciliar SMS antes de reabrir. Uma restauração sem isto pode ressuscitar um certificado revogado.

## Rastreabilidade e limites

Fontes primárias: consultas directas a Supabase de produção/staging, versões das funções, respostas HTTP e assets públicos; AFROLOC `077896ba0a72733a4bfe0c898759124269e7cff4`; YAMILOOK testada em `90d9876f559c445aec58bb35c7913acfdcc5c546`; PRs https://github.com/afrofintek-beep/afroc_app26/pull/6 e https://github.com/afrofintek-beep/yamilook-/pull/122 . O protocolo local v1.1 actual mantém a geometria anterior e os campos de formalização por preencher.

A API Vercel recusou a listagem de deployments com 403. O conteúdo público da AFROLOC foi confirmado directamente, mas o identificador do deployment e a configuração do build não foram validados no painel. A conta Infobip, remetente, saldo/limites, rotas, peppers, chave de parceiro, flags e recepção em telemóveis continuam sem comprovação operacional nesta execução. Não foram alterados dados/configurações de produção durante esta auditoria.

# Lar do Patriota: implementação do fluxo de residência

O piloto tem agora formulário de pedido, declaração autenticada da testemunha, revisão da autoridade, armazenamento privado, convite SMS e emissão no mecanismo AFROLOC de certificados revogáveis. Rota: `/piloto/lar-do-patriota`. O simulador anterior continua independente e nunca emite certificados.

## Fluxo disponível

1. A autoridade confere presencialmente identidade e maioridade e regista a referência do processo, nome, UUID da conta e, quando aplicável, referência independente da residência local. A conta deve confirmar o seu próprio telefone pelo componente OTP existente. O registo de identidade dura 90 dias; não guardar imagens de documentos nos campos de referência.
2. A autoridade regista a referência e versão do perímetro aprovado e abre o piloto. A verificação territorial desta primeira versão é manual: não existem coordenadas inventadas, geofence automático nem inferência de residência por GPS. Todos os pedidos exigem revisão da autoridade, inclusive depois do trigésimo.
3. O residente escolhe uma das suas moradas AFROLOC, fornece a descrição legível e consente na revisão. O servidor guarda conta, código e revisão exacta do registo. Limite de 100 participantes distintos; um pedido pendente por pessoa, no máximo um novo pedido por dia. Pode retirar um pedido para corrigir dados; o intervalo diário mantém-se.
4. O residente indica os telefones de duas testemunhas que aceitaram receber o convite. Cada uma deve estar identificada no piloto e ter telefone confirmado na própria conta. Convite: 72 horas; até três tentativas, separadas por cinco minutos; máximo agregado de seis tentativas por testemunha/dia. As tentativas são reservadas atomicamente antes do fornecedor.
5. O SMS contém apenas um link de convite. O identificador não é uma credencial: abrir o link exige a conta AFROLOC da testemunha. Não inclui nome, morada ou código do residente. O OTP confirma controlo do telefone; não certifica a residência. O código OTP é tratado pelo serviço `account-phone` existente, não pelo convite.
6. A testemunha vê nome, descrição, código e versão da morada. Pode confirmar, negar ou declarar que não sabe; indica relação, data desde quando conhece a pessoa e se partilham agregado familiar. Conhecer a pessoa e conhecer a residência são perguntas separadas. A declaração tem versão, data e fotografia lógica dos dados de identificação conferidos pela autoridade. É imutável, mas pode ser retirada. Máximo de cinco confirmações em 30 dias, mesmo se posteriormente retiradas.
7. A autoridade revê os dois depoimentos, independência e perímetro, registando fundamentação. Emissão exige duas confirmações actuais, agregados diferentes e pelo menos uma testemunha local verificada. Auto-testemunho, emissão pelo requerente/testemunha, reciprocidade, identidade expirada/revogada, mudança da morada e falta de consentimento bloqueiam o fluxo. Casos bloqueados podem ser rejeitados e reavaliados fora deste fluxo; não há botão para dispensar critérios.
8. A emissão chama `partner_link_action('issue')` na mesma transacção, liga o certificado ao pedido e classifica a relação como `resident`, nunca propriedade. Validade máxima: 90 dias, limitada pela identificação dos intervenientes. O residente autoriza a consulta pela sua conta YAMILOOK no fluxo de ligação já existente.
9. A consulta de parceiro volta a verificar estado, revisão da morada, identificação e telefone dos intervenientes, declarações e perímetro. Retirar declaração/pedido, revogar pessoa/certificado ou fechar/alterar o perímetro invalida o uso. O consumidor YAMILOOK requer a alteração complementar que aceita `resident`, mantendo todas as verificações de frescura, destinatário, titular e código. Não foram alteradas regras de pagamentos ou activados benefícios financeiros.

## Componentes

- `src/pages/ResidencePilot.tsx`: formulários do residente, testemunha e autoridade, mais confirmação telefónica existente.
- `supabase/functions/residence-pilot/`: autenticação `getUser`, lista fechada de acções, reserva e retorno do envio; adaptador Infobip SMS v3.
- Migração `lar_patriota_workflow`: seis tabelas com RLS, sem acesso directo de `anon`/`authenticated`; RPC `SECURITY INVOKER` apenas para `service_role`. O actor vem exclusivamente da sessão validada na função.
- `residence_pilot_events`: sequência de eventos da aplicação. Não é um registo inviolável contra administradores de base de dados. As referências de identidade só são apresentadas à autoridade.
- `partner_certificates.residence_relationship`: diferencia residência e propriedade; preserva certificados anteriores.

## Configuração e publicação

Estado revisto em 2 de Novembro de 2026, às 18h43 de Luanda: as migrações de ligação de contas, ciclo de certificados e piloto também estão instaladas em produção (`ljcxqwjvjgobhisqkujr`). As funções `residence-pilot`, `account-phone` e `account-link-authority` estão publicadas em produção na versão 3 desde cerca das 10h45 de Luanda; a página pública do piloto aponta para esse projecto. A configuração continua fechada, sem referência/versão de perímetro aprovado e com zero pessoas, pedidos, convites, declarações e certificados de residência. A integração da PR YAMILOOK #122 não publicou automaticamente as tabelas e funções correspondentes na produção YAMILOOK: continuam ausentes. Consultar a [auditoria e sequência segura de activação](lar-patriota-readiness-20261102.md), incluindo o bloqueio do login telefónico legado e os ensaios ainda necessários.

Para activar num ambiente seleccionado, publicar o frontend e a função, aplicar as migrações anteriores de ligação de contas e esta migração; configurar no servidor:

| Variável | Uso |
|---|---|
| `RESIDENCE_PILOT_ENABLED=true` | Habilita o endpoint após autenticação. |
| `RESIDENCE_PILOT_SMS_ENABLED=true` | Autoriza o caminho de envio real de convites. |
| `PILOT_PUBLIC_ORIGIN` | Origem HTTPS do frontend correspondente à mesma base de dados. |
| `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_SENDER` | Conta e remetente SMS autorizado para as redes de destino. |
| Configuração `account-phone` / `ACCOUNT_LINK_V1_ENABLED` | Manter o serviço de OTP e a ligação ao parceiro configurados nos dois ambientes. |

Não colocar segredos no browser. O piloto só abre depois de a autoridade guardar perímetro e activar a configuração. Não seleccionar um projecto de produção por aproximação ao nome.

O adaptador usa `/sms/3/messages` e a configuração da conta Infobip; não representa uma integração directa nem um acordo com Unitel, Africell ou Movicel. Cada rota/remetente tem de ser ensaiado em números de teste autorizados. O envio pode ter várias partes facturadas. Não foram enviados SMS reais durante a implementação.

A interface apresenta `accepted` como aceite pelo fornecedor, nunca como recebido pelo destinatário. Não há webhook de entrega nesta versão; a referência permite consulta no fornecedor. Não há repetição automática após timeout: o residente pode reenviar após o intervalo e dentro dos limites. Um timeout após aceitação pode dar origem a SMS duplicado num reenvio; não duplica a declaração nem o certificado.

Antes da abertura a residentes: validar remetente/rotas e OTP com contas de ensaio, aprovar perímetro e nomear autoridade, confirmar avisos de privacidade e política de retenção, ensaiar a ligação entre os dois ambientes. O prazo de retenção ainda não está automatizado; os 30/180 dias do plano são propostas, não uma garantia implementada. O piloto não substitui validação regulamentar ou aceitação pelas operadoras.

## Verificação

```bash
node --test tests/pilots/*.test.mjs tests/account-link/*.test.mjs
npx vitest run src/test/residencePilot.test.tsx
npx eslint src/pages/ResidencePilot.tsx supabase/functions/residence-pilot/*.ts
npm run build
```

Testes cobrem a migração em PostgreSQL/PGlite, isolamento de papéis, conta/morada, declarações, limites, emissão, consulta de parceiro, retirada, fornecedor rejeitado e formulário. As chamadas de SMS são substituídas por respostas artificiais; não provaram entrega em redes angolanas.

O build passa. O `typecheck` global tem 51 erros pré-existentes, com saída idêntica à base anterior sem estes ficheiros. Nenhum erro adicional foi introduzido. O advisor do staging mantém os avisos anteriores, incluindo PostGIS e funções existentes; as seis tabelas novas aparecem apenas como RLS sem políticas, intencional para acesso exclusivo do serviço e com privilégios de browser revogados. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Não tratar este resultado como auditoria global de produção.

Referências técnicas consultadas: https://supabase.com/docs/guides/database/postgres/row-level-security ; https://www.infobip.com/docs/developer-resources/quickstart ; https://www.infobip.com/docs/developer-resources/api-fundamentals/message-status-codes .

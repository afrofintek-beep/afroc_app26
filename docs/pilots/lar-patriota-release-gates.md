# Proteção da abertura e emissão — 2 de novembro de 2026

Esta alteração acrescenta condições obrigatórias à base de dados. Não aprova o perímetro, não nomeia pessoas, não envia SMS e não abre o piloto. O polígono de `residence_pilot_boundary_drafts` mantém-se separado e nunca é promovido por esta migração.

## Estado da entrega

- Implementação e testes locais preparados nesta PR. A migração foi gerada com a CLI Supabase.
- A tentativa de publicação em `authorized-account-link-staging` foi interrompida sem confirmação. A consulta posterior confirmou que a migração e a tabela de aprovações **não existem em staging**. Não foi repetida a publicação.
- Produção foi apenas consultada: piloto fechado; zero pessoas, pedidos e certificados residenciais; zero operadores atribuídos; a tabela nova não existe. Esta PR não está publicada em produção.
- Os testes de PostgreSQL local, incluindo o guião de rollback, usam dados sintéticos. Não comprovam entrega Infobip, autenticação humana, perímetro válido ou certificação real.
- Validação concluída: 84 testes Node de piloto/ligação e um teste adicional do guião de rollback; quatro testes da interface; ESLint do componente alterado e build de produção sem erros. O build mantém o aviso de tamanho de alguns bundles. O typecheck global, com falhas preexistentes registadas na auditoria, não foi repetido nesta alteração.

## Condições obrigatórias

`residence_pilot_release_approvals` é um registo operacional restrito a `service_role`, sem acesso direto de `anon` ou `authenticated`. A interface não escreve aprovações. Cada registo deve referenciar evidência verdadeira, guardada em local restrito e com responsável identificado.

| Registo | Evidência exigida antes do preenchimento |
| --- | --- |
| `boundary` | Aprovação formal do **perímetro corrigido**: referência, versão, SHA-256 do ficheiro aprovado e protocolo de revisão. O signatário deve ser o técnico territorial nomeado. Não usar a geometria preliminar ou a versão 1.1 sem correção e aprovação documentadas. |
| `privacy` | Procedimento aprovado de informação, consentimento, acesso, retirada e atendimento; referência separada de retenção e eliminação; aprovação por responsável autorizado. |
| `authentication` | Recuperação validada das contas dependentes, retirada do login telefónico inseguro, revisão das sessões potencialmente afetadas e ensaio de entrada das contas participantes. |
| `sms` | Credenciais por ambiente, remetente/rotas confirmados, números de ensaio autorizados, entrega real de OTP e convite, falhas e limites testados; referência ao relatório com dados minimizados. |

Todos os registos exigem UUID do signatário, data não futura e ausência de revogação. Os signatários de privacidade, autenticação e SMS devem manter o papel administrativo. Isto é um controlo técnico sobre registos de aprovação; não substitui a validação humana do conteúdo dos documentos.

Os dois lugares de `residence_pilot_operator_slots` devem ter contas distintas, nomeação e identificação verificadas. A autoridade deve ter o papel `admin` já exigido pelo fluxo e `can_issue_certificates=true`. O técnico territorial não pode receber capacidade de emissão. Não criar contas fictícias nem conceder administração apenas para contornar este bloqueio. A migração conserva os lugares desatribuídos.

## Comportamento

- A abertura exige correspondência exata entre referência/versão configuradas e aprovadas. Uma escrita direta em `residence_pilot_settings` também é bloqueada sem aprovação.
- Identificação de participantes e emissão exigem a autoridade nomeada, além das verificações já existentes. Outros administradores mantêm as ações de encerramento e revogação para resposta a incidentes.
- Novas operações positivas e a prova `resident` enviada à YAMILOOK verificam as condições atuais. A perda de um papel administrativo relevante também impede novas provas positivas.
- Qualquer escrita nas aprovações ou nos lugares operacionais fecha o piloto e revoga definitivamente os certificados `resident` ativos. Mesmo uma atualização sem alteração material deve ser tratada como intervenção operacional. Reabrir exige ação explícita; certificados revogados não são reativados.
- Fechar ou alterar a referência/versão diretamente nas definições também revoga os certificados residenciais ativos.
- Retirada de declarações, desistência, rejeição, revogação e consulta continuam disponíveis na RPC. No servidor, manter `RESIDENCE_PILOT_ENABLED=true` para essas operações; fechar o piloto pela base de dados e desligar `RESIDENCE_PILOT_SMS_ENABLED` para interromper envios. Desligar a função global bloqueia também essas operações HTTP e exige intervenção pelo canal operacional restrito.
- A função de consulta devolve somente os códigos das condições em falta. Não devolve documentos ou identidades dos signatários.

## Sequência de publicação

1. Rever esta PR. Guardar inventário de migrações, definições das funções, configuração e ponto de recuperação do ambiente. Confirmar piloto fechado, ausência de atividade concorrente e versão anterior das RPCs; a migração recusa piloto aberto e obtém o mesmo bloqueio transacional usado pelo fluxo.
2. Aplicar `20261102180551_lar_patriota_release_gates.sql` primeiro em `vxeydrzuvhouvjnttvgs`, com `apply_migration` ou o procedimento normal de migrações. Não reaplicar sem consultar o histórico caso falte confirmação.
3. Executar `tests/pilots/hosted-rollback.sql` **exclusivamente em staging**, como sessão operacional privilegiada. O guião usa `service_role` para o fluxo, verifica permissões e termina em rollback. Confirmar zero aprovações, atribuições, pessoas e certificados após o teste. O ensaio local deste ficheiro não equivale a execução hospedada.
4. Verificar advisors e privilégios. Ausência de políticas RLS nestas tabelas é intencional: não criar políticas de cliente para suprimir o aviso. Referência: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.
5. Só após staging passar, aplicar a mesma migração em produção, mantendo piloto fechado, lugares sem atribuição e registo de aprovações vazio. Publicar a interface com as novas mensagens. A função Edge conserva o contrato atual; esta alteração não exige nova versão dela.
6. Resolver autenticação e recuperação; nomear e verificar os responsáveis; aprovar perímetro corrigido e privacidade; preparar um ensaio controlado de SMS em staging com consentimento dos titulares. Registos sintéticos de aprovação são admissíveis apenas nos testes isolados e identificados como tais; nunca copiar esses registos para produção.
7. Só inserir aprovações operacionais de produção depois de existir a evidência correspondente. Todas as inserções mantêm o piloto fechado. Conferir `residence_pilot_release_status(referencia,versao)` e abrir explicitamente pela autoridade operacional, com lote inicial autorizado. Nenhuma aprovação é inferida da presença de um ficheiro ou de uma flag.
8. A YAMILOOK continua a necessitar das suas migrações e funções de ligação, segredos por ambiente e teste de ponta a ponta. A PR #122 reconhecer `resident` não basta para ativar essa integração. Não converter certificação em pertença territorial, elegibilidade económica ou autorização de pagamento.

## Recuperação e critérios de interrupção

Em falha de SMS, parar novos envios e reconciliar a aceitação/entrega com a Infobip antes de reenviar; timeout não significa que o SMS não saiu. Não repetir convites ou OTP automaticamente sem resolver o estado anterior. Os segredos nunca vão para o repositório, chat ou browser.

Em falha de autorização, perímetro, privacidade ou emissão, fechar a configuração na base de dados. As revogações são permanentes; conservar os registos e a evidência necessária segundo o procedimento de retenção. Restaurar o frontend ou a função anterior apenas com o piloto fechado; não remover os bloqueios de aprovação para recuperar serviço. Uma falha transacional na migração deve deixar a versão anterior intacta; confirmar histórico, funções e estado antes de repetir. Preferir migração corretiva a remoção de tabelas com evidência.

O login telefónico legado de produção foi novamente observado na versão 37. A consulta agregada aos domínios sintéticos `temp.afroid.app` e `phone.afroid.local` encontrou **três contas**, todas com entrada anterior e nenhuma com telefone nativo confirmado. Este número atualiza o inventário anterior de duas contas; não prova, por si só, quais os mecanismos alternativos disponíveis. Um operador deve verificar cada caso em canal restrito, preservar o UUID, comprovar o controlo por via independente e testar a recuperação antes da retirada. Não alterar passwords, perfis, identidades ou sessões a partir desta contagem.

Nenhuma recuperação de conta, atribuição real, entrega SMS ou aprovação foi executada nesta alteração.

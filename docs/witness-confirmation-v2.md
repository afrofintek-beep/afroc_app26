# Três testemunhas AFROLOC e estação digital de Talatona

Estado de entrega em 09/11/2026: migração aplicada e verificada em produção; estação digital 5051500 activa e operação SQL restrita ao serviço. Função witness-confirmation publicada. A publicação das páginas, a integração do portal da feira e o teste com testemunhas reais são etapas separadas, descritas abaixo.

Repositório de produção: `afrofintek-beep/afroc_app26`, projecto Vercel `afroloc`, domínio `www.afroloc.ao`. O piloto Lar do Patriota e as suas portas de activação permanecem inalterados.

## Comportamento

O titular indica três pessoas distintas através dos seus endereços AFROLOC. O servidor verifica a propriedade do endereço a validar, a morada validada de cada testemunha, a distância máxima de 100 metros, a ausência de auto-testemunho e o limite de três pedidos pendentes/confirmados. Pedidos repetidos devolvem o mesmo identificador.

O código é enviado apenas para o número angolano confirmado da testemunha, obtido de `account_verified_phones` ou de um telefone confirmado pelo Supabase Auth. Não se utiliza o telefone livre do perfil. A testemunha entra na sua própria conta, consulta a morada, indica o código, nome, assinatura e decisão. O titular não pode confirmar por ela.

Os códigos são gerados com Web Crypto, guardados apenas como hash com salt, expiram em dez minutos, aceitam até cinco tentativas e não podem ser reutilizados. Reenvios têm intervalo mínimo de um minuto e limite de dez por hora por conta. O fornecedor tem de aceitar a mensagem para o código poder ser usado. Ausência de configuração, telefone por confirmar, rejeição ou falha do fornecedor ficam explicitamente pendentes.

As tabelas de desafios e auditoria usam RLS e acesso exclusivo do serviço. A operação SQL usa SECURITY INVOKER e só pode ser executada por `service_role`. O JWT e a identidade são verificados na função antes da operação; MFA continua obrigatório para contas que o tenham. Nenhuma chave privilegiada, código, hash, assinatura ou telefone de outra pessoa é devolvido ao titular. O estado oficial do endereço não é alterado pelo testemunho comunitário.

A estação digital `5051500` está activa e associada a `AO-LDA-TALATONA` / `AO-LDA`, conforme o catálogo actual. A migração preservou o código existente e corrigiu a associação administrativa antiga. Não representa a abertura de uma estação física dos Correios. Caixas existentes e permissões de partilha permanecem inalteradas.

## Validação efectuada

- Testes HTTP com fornecedor simulado: identidade, propriedade, consentimento, ausência de SMS, rejeição do fornecedor, ausência de fugas de códigos e tratamento de pendências.
- Testes PostgreSQL locais com PGlite e a migração real: três confirmações independentes; duplicados; quarta testemunha; assinatura pelo titular; código não enviado, expirado ou bloqueado; repetição; alterações directas; acesso restrito; activação do código postal existente; endereço continua em `draft`.
- Sintaxe TypeScript/TSX e integração do portal de Natal verificadas.
- Nenhuma inscrição, testemunha ou SMS real foi criado/enviado em produção nos testes. Não houve teste completo com utilizadores reais nem execução com os restantes triggers de produção.

Execução dos testes (Node 22.13+):

```sh
npm ci --prefix tests/witness-v2
npm test --prefix tests/witness-v2
```

## Verificação de publicação

1. Migração já aplicada: `supabase/migrations/20261109020721_witness_confirmation_v2_and_talatona_postal.sql` no projecto AFROLOC `ljcxqwjvjgobhisqkujr`.
2. Privilégios, RLS e estação `5051500` verificados em produção.
3. Publicar `witness-confirmation`, `send-witness-otp` e `verify-witness-otp`, incluindo `_shared/witness-confirmation.ts`, com verificação de JWT activa. Não alterar os segredos Infobip já configurados por outro trabalho.
4. Integrar/publicar as páginas AFROLOC actualizadas. A interface antiga de confirmação não envia a declaração no corpo do pedido e deve ser actualizada em conjunto com o servidor.
5. Aplicar `docs/natal-yamilook-witness-v2.patch` ao Site `appgprj_6af0f8bc047081918bc14066326ee75c`, actualizar `fair-address-status` com a versão do patch e publicar a nova versão preservando a audiência privada.
6. Fazer o teste completo com titular e três testemunhas reais elegíveis, por acção das próprias pessoas. Confirmar entrega, confirmação, caixa postal e selo temporário. O acesso público e a certificação oficial continuam fora desta alteração.

O patch do Site foi preparado sobre o commit `7b80dcbd0b657b5f65c200201672eace61ac831e`. Reconciliar alterações posteriores antes da aplicação.

# Piloto Lar do Patriota em Talatona

Primeira entrega técnica: motor de regras e simulador offline. Não é o fluxo de
produção, não recolhe dados reais, não envia mensagens nem emite certificados.

## Executar

`node --test tests/pilots/lar-patriota.test.mjs`

`node scripts/pilots/simulate-lar-patriota.mjs input.json`

O ficheiro contém `request`, `context` e, opcionalmente, `now` em ISO 8601.
As fixtures nos testes documentam o contrato com identificadores fictícios.
Não colocar documentos ou contactos reais nos ficheiros de ensaio.

## Integração a concluir

1. Validar e versionar o perímetro real; nenhuma coordenada foi inventada.
2. Criar persistência protegida para pedido, endereço versionado, declarações e
   decisões, vinculada à autoridade de certificados existente.
3. Construir convites de uso único e consumo atómico, autenticação da testemunha,
   limites de tentativas e envio SMS autorizado. Não reutilizar como prova de
   identidade uma simples resposta OTP.
4. Apresentar requerente e residência exactos e recolher conhecer pessoa,
   conhecer residência, relação e período; incluir recusa e desconhecimento.
5. Alimentar o motor exclusivamente com provas e estados lidos pelo servidor.
   Nunca aceitar do browser `identity`, `localProof`, `boundaryApproved`,
   `initialAuditPassed` ou contagens como factos autorizativos.
6. Revalidar e bloquear registos numa transacção antes de emitir; esta função
   pura não resolve concorrência, expiração em trânsito ou revogação.
7. Autoridade AFROLOC emite; YAMILOOK verifica estado actual e Banda no uso.
   Aprovações históricas não são convertidas automaticamente.

Primeiros 30 casos: revisão humana. Limite do piloto: 100. Duas testemunhas
distintas, com identidade verificada e uma prova local independente. Falta de
testemunhas permite apoio assistido, mantendo a participação social disponível.

UNITEL, AFRICELL e MOVICEL são potenciais parceiras. Não há acesso presumido aos
seus cadastros. Perímetro, equipa, fornecedor de SMS e acordos seguem pendentes.

Plano operacional: https://chatgpt.com/space/page_24f45ab4217c8191afec228ab37fbdee

## Fluxo implementado posteriormente

O fluxo com formulários, SMS, declarações persistidas e emissão revogável está documentado em [lar-patriota-implementation.md](lar-patriota-implementation.md). O simulador desta página continua sem efeitos externos. A implementação foi instalada no ambiente de testes, com piloto fechado; a sua publicação não equivale à abertura do piloto ou à entrega de SMS em redes reais.

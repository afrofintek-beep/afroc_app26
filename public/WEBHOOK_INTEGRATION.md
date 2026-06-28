# AFROLOC Webhook Integration Guide

## Overview

O sistema de webhooks do AFROLOC notifica aplicações externas quando eventos importantes ocorrem no sistema de endereçamento. Cada notificação é assinada com HMAC-SHA256 para garantir autenticidade e integridade.

## Eventos Disponíveis

| Evento | Descrição |
|--------|-----------|
| `address.created` | Novo endereço AFROLOC criado |
| `address.status_changed` | Status do endereço alterado (ex: pending → approved → active) |
| `address.verified` | Verificação de endereço concluída |
| `address.certified` | Certificação concedida |
| `checkin.completed` | Check-in de residente concluído |
| `request.created` | Novo pedido AFROLOC recebido (via SMS/web) |
| `request.approved` | Pedido AFROLOC aprovado pelo admin |

## Formato do Payload

```json
{
  "event": "address.status_changed",
  "recordId": "uuid-do-registo",
  "code": "AO-LUA-ING-001-0042",
  "oldStatus": "pending",
  "newStatus": "approved",
  "userId": "uuid-do-utilizador",
  "timestamp": "2026-03-14T10:30:00.000Z"
}
```

## Headers de Segurança

Cada webhook inclui os seguintes headers:

| Header | Descrição |
|--------|-----------|
| `X-Afroloc-Signature` | HMAC-SHA256 (hex) do body usando o secret partilhado |
| `X-Afroloc-Event` | Tipo de evento (ex: `address.created`) |
| `X-Afroloc-Timestamp` | Timestamp ISO 8601 do envio |
| `Content-Type` | `application/json` |
| `User-Agent` | `AFROLOC-Webhook/1.0` |

## Validação da Assinatura

### TypeScript/Deno (Edge Functions)

```typescript
async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return expected === signature;
}
```

### Node.js

```javascript
const crypto = require('crypto');

function verifySignature(body, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected), Buffer.from(signature)
  );
}
```

### Python

```python
import hmac, hashlib

def verify_signature(body: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), body.encode(), hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

## Subscrição de Webhooks

### Via API (POST /yamioo-gateway)

```json
{
  "action": "subscribe",
  "url": "https://app.afroloc.example",
  "events": ["address.created", "address.status_changed"],
  "secret": "um-secret-seguro-partilhado",
  "name": "Minha App"
}
```

### Resposta Esperada

O seu endpoint deve responder com HTTP 200 em até 10 segundos. Respostas fora deste prazo ou com status >= 400 são registadas como falha.

## Boas Práticas

1. **Sempre valide a assinatura** antes de processar o evento
2. **Verifique o timestamp** — rejeite eventos com mais de 5 minutos
3. **Responda rapidamente** (< 10s) — processe assincronamente se necessário
4. **Idempotência** — o mesmo evento pode ser entregue mais de uma vez; use `recordId` + `event` como chave de deduplicação
5. **Guarde o secret** de forma segura — nunca exponha no frontend

## URL do Receptor (este projeto)

```
POST https://{project-id}.supabase.co/functions/v1/receive-webhook
```

Ou via `supabase.functions.invoke('receive-webhook', { body: payload })` para chamadas internas.

# QR / Card Privacy Decision

Applies to the QR code and the A6 PDF/PNG card generated in
`src/components/QRCodeDialog.tsx`.

## What the QR / card contains
- The AFROLOC code (the territorial digital identity).
- Country.
- The human-readable address: province, municipality, commune,
  neighbourhood (bairro), street, number and unit.
- `property_type` and `status`.

## What it deliberately omits
- **GPS coordinates (latitude / longitude).** They are never encoded in the
  QR nor printed on the card.

## Rationale
The human-readable address is included on purpose: partner apps such as
**Yamioo** need to read a usable postal address from the shared QR/card.

Raw coordinates are excluded by policy. In AFROLOC the *address is the
cell/code* (an "identidade digital territorial"), not a point on a map.
Exposing lat/lon in a freely shareable artifact would leak a person's precise
location and defeat the privacy model. See memory note
`afroloc-copy-no-coordinates`.

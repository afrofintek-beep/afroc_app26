# Checklist · App nativa + Presença em segundo plano (PoDP)

> Estado: **pendente — precisa de máquina com Xcode / Android Studio + dispositivo.**
> O código já está preparado (ver commit `491b9b7`): `capacitor.config.ts` aponta
> para `https://www.afroloc.ao`, o plugin `@capacitor-community/background-geolocation`
> está instalado, e `src/lib/podp/sampler.ts` já usa `BackgroundGeolocation.addWatcher`
> no nativo (com fallback para o intervalo em primeiro plano no web/PWA).
> Falta só o empacotamento nativo abaixo. Sem isto, o PoDP só amostra com a app
> aberta em primeiro plano (ver [[afroloc-podp]]).

## Porquê
O `@capacitor/geolocation` (e a PWA) só obtêm GPS em **primeiro plano**. A prova
de presença silenciosa (amostrar com a app fechada) exige um plugin de
background + permissões nativas. Hoje a adoção do PoDP está ~0 porque a recolha
só corre na app instalada e enquanto aberta.

## Passos

### 1. Gerar os projetos nativos
```bash
npm install
npm run build
npx cap add ios
npx cap add android
npx cap sync
```

### 2. iOS (`ios/App/App/Info.plist`)
- [ ] `NSLocationWhenInUseUsageDescription` — texto claro (ex.: "Para confirmar a presença no seu endereço AFROLOC.").
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription` — idem (obrigatório para background).
- [ ] **Background Modes → Location updates** (em Signing & Capabilities no Xcode, ou `UIBackgroundModes: [location]`).
- [ ] Justificação para a App Store (uso de localização em segundo plano é escrutinado).

### 3. Android (`android/app/src/main/AndroidManifest.xml`)
- [ ] `ACCESS_FINE_LOCATION` + `ACCESS_COARSE_LOCATION`.
- [ ] `ACCESS_BACKGROUND_LOCATION` (Android 10+).
- [ ] `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` (Android 14+) — o plugin corre um foreground service com notificação persistente.
- [ ] Pedir ao utilizador a isenção de otimização de bateria (senão o SO mata o serviço).

### 4. Consentimento (obrigatório, legal + lojas)
- [ ] Ecrã de consentimento explícito antes de iniciar a amostragem em segundo plano (o que é recolhido, para quê, como parar).
- [ ] Forma de **desativar** (parar o watcher → `stopPodpSampler`) e apagar dados.
- [ ] Rever contra [[afroloc-podp]] e a conformidade de dados (docs/11_CONFORMIDADE_PROTECAO_DADOS.md).

### 5. Testar em dispositivo real
- [ ] App em segundo plano/fechada → confirmar que chegam amostras (`podp_samples`) espaçadas ~15 min.
- [ ] Afinar `distanceFilter` (50 m no código) e o intervalo consoante o consumo de bateria.
- [ ] Confirmar o rollup diário (`podp-rollup`, cron 03:00) a produzir `podp_daily_rollup` com `hours_present` e `day_is_valid` (mínimo 6 h/dia, ciclo 14 dias — em `podp_config`).

### 6. Distribuição
- [ ] iOS: submeter à App Store (ou TestFlight para piloto).
- [ ] Android: gerar APK/AAB assinado (ver [[yamilook-android-app]] para o método Capacitor já usado no ecossistema).

## Notas de referência
- Config PoDP (live): amostra a cada **15 min**, mínimo **6 h/dia** para dia válido, ciclo **14 dias** (`podp_config` scope=global, enabled).
- Onde ver: admin em `/admin/podp`. Sampler: `src/lib/podp/sampler.ts`. Rollup: `supabase/functions/podp-rollup`.
- O sampler no web/PWA continua a funcionar em primeiro plano — este checklist é só para o **segundo plano nativo**.

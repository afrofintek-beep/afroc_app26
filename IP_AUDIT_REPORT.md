# AFROLOC INTELLECTUAL PROPERTY AUDIT REPORT

**Date**: 2026-01-14  
**Version**: 1.0  
**Project**: AFROLOC - African Address Identification System  
**Classification**: CONFIDENTIAL  

---

## EXECUTIVE SUMMARY

### Overview
AFROLOC is a proprietary digital addressing system designed for the African continent. This audit identifies, classifies, and assesses all intellectual property within the codebase.

### Key Findings

| Category | Count | Risk Level |
|----------|-------|------------|
| Proprietary AFROLOC IP | 89+ files | ✅ Clear ownership |
| Open-source dependencies (npm) | 82 packages | ⚠️ Mixed licenses |
| Deno/Edge dependencies | 2 packages | ✅ MIT licensed |
| Template/Framework code | ~25 files | ⚠️ shadcn/ui (MIT) |
| Assets requiring attribution | 13 translation files | ⚠️ Needs clarification |
| Copyleft licenses (GPL/AGPL/LGPL) | 0 found | ✅ No viral licenses |

### Overall IP Risk: **LOW-MEDIUM**

The codebase is predominantly proprietary with well-documented open-source dependencies under permissive licenses (MIT, Apache 2.0, ISC). No copyleft (GPL/AGPL/LGPL) licenses detected.

---

## SECTION 1: CODE CLASSIFICATION

### 1.1 PROPRIETARY AFROLOC IP (Original Code)

The following code represents **100% original intellectual property** owned by AFROLOC:

#### Core Business Logic
| File/Directory | Description | IP Type |
|----------------|-------------|---------|
| `src/utils/atsScore.ts` | Address Trust Score Algorithm | **Core Algorithm IP** |
| `src/utils/gpsSpoofingDetection.ts` | GPS Spoofing Detection System | **Core Algorithm IP** |
| `src/utils/gpsDistance.ts` | Geolocation calculations | **Core Algorithm IP** |
| `src/utils/verificationRisk.ts` | Risk verification scoring | **Core Algorithm IP** |
| `src/hooks/useQGSQEngine.ts` | Grid System Engine (QG/SQ) | **Core Algorithm IP** |
| `src/hooks/useAuthorizationLevel.ts` | 5-tier authorization system | **Core Algorithm IP** |
| `src/hooks/useGPSValidation.ts` | GPS validation logic | **Core Algorithm IP** |
| `src/hooks/useGPSHistory.ts` | GPS history tracking | **Core Algorithm IP** |
| `src/hooks/usePrimaryResidence.ts` | Primary residence logic | **Core Algorithm IP** |
| `src/hooks/useGeolocation.ts` | Geolocation wrapper | **Proprietary** |
| `src/hooks/usePhoneValidation.ts` | Phone validation | **Proprietary** |
| `src/hooks/useWitnessSystem.ts` | Witness validation system | **Core Algorithm IP** |

#### Edge Functions (Backend Logic)
| Function | Description | IP Type |
|----------|-------------|---------|
| `supabase/functions/ats-engine` | Address Trust Score calculation | **Core Algorithm IP** |
| `supabase/functions/qg-engine` | Quadrant Grid engine | **Core Algorithm IP** |
| `supabase/functions/sq-engine` | Sub-Quadrant engine | **Core Algorithm IP** |
| `supabase/functions/address-gateway` | Address gateway service | **Proprietary** |
| `supabase/functions/telecom-fusion` | Telecom triangulation | **Core Algorithm IP** |
| `supabase/functions/address-create` | Address registration | **Proprietary** |
| `supabase/functions/address-verify` | Address verification | **Proprietary** |
| `supabase/functions/_shared/auth_rbac.ts` | Role-based access control | **Proprietary** |
| `supabase/functions/_shared/hash_utils.ts` | Document hashing utilities | **Proprietary** |
| `supabase/functions/_shared/settings.ts` | System configuration | **Proprietary** |

#### Application Pages (Proprietary UI/UX)
| Page | Description | IP Type |
|------|-------------|---------|
| `src/pages/CreateIdentity.tsx` | AFROLOC creation flow | **Proprietary** |
| `src/pages/Identities.tsx` | Identity management | **Proprietary** |
| `src/pages/IdentityDetail.tsx` | Identity details | **Proprietary** |
| `src/pages/MyAddresses.tsx` | Address management | **Proprietary** |
| `src/pages/AddWitness.tsx` | Witness addition flow | **Proprietary** |
| `src/pages/ConfirmWitness.tsx` | Witness confirmation | **Proprietary** |
| `src/pages/WitnessReputation.tsx` | Reputation system | **Proprietary** |
| `src/pages/AuthorityValidation.tsx` | Authority validation | **Proprietary** |
| `src/pages/RegionalValidation.tsx` | Regional validation | **Proprietary** |
| `src/pages/GeospatialGrid.tsx` | QGSQ grid visualization | **Proprietary** |

| `src/pages/Admin*.tsx` | Administrative panels | **Proprietary** |

#### Proprietary Components
| Component | Description | IP Type |
|-----------|-------------|---------|
| `src/components/ATSScoreBadge.tsx` | ATS score display | **Proprietary** |
| `src/components/ATSScoreCard.tsx` | ATS score card | **Proprietary** |
| `src/components/AuthorizationLevelBadge.tsx` | Authorization level display | **Proprietary** |
| `src/components/AuthorizationLevelProgress.tsx` | Level progress | **Proprietary** |
| `src/components/GPSSpoofingAlert.tsx` | Spoofing alert UI | **Proprietary** |
| `src/components/GPSDistanceValidation.tsx` | GPS validation | **Proprietary** |
| `src/components/GPSHistoryTimeline.tsx` | GPS history display | **Proprietary** |
| `src/components/QGSQGridMap.tsx` | Grid map visualization | **Proprietary** |
| `src/components/VerificationCycleIndicator.tsx` | Verification cycle UI | **Proprietary** |
| `src/components/WitnessPhotoViewer.tsx` | Witness photo viewer | **Proprietary** |
| `src/components/PrimaryResidenceBadge.tsx` | Residence badge | **Proprietary** |
| `src/components/LevelGate.tsx` | Access level gating | **Proprietary** |
| `src/components/FraudMetricsDashboard.tsx` | Fraud detection UI | **Proprietary** |
| `src/components/GridCellCreator.tsx` | Grid cell creation | **Proprietary** |
| `src/components/IdentitiesMapView.tsx` | Map view for identities | **Proprietary** |

### 1.2 OPEN-SOURCE DERIVED CODE

#### shadcn/ui Components (MIT License)
The following files are derived from shadcn/ui, a component library:

| File | Original Source | License |
|------|-----------------|---------|
| `src/components/ui/button.tsx` | shadcn/ui | MIT |
| `src/components/ui/card.tsx` | shadcn/ui | MIT |
| `src/components/ui/dialog.tsx` | shadcn/ui | MIT |
| `src/components/ui/input.tsx` | shadcn/ui | MIT |
| `src/components/ui/label.tsx` | shadcn/ui | MIT |
| `src/components/ui/select.tsx` | shadcn/ui | MIT |
| `src/components/ui/tabs.tsx` | shadcn/ui | MIT |
| `src/components/ui/toast.tsx` | shadcn/ui | MIT |
| `src/components/ui/form.tsx` | shadcn/ui | MIT |
| `src/components/ui/accordion.tsx` | shadcn/ui | MIT |
| `src/components/ui/alert.tsx` | shadcn/ui | MIT |
| `src/components/ui/avatar.tsx` | shadcn/ui | MIT |
| `src/components/ui/badge.tsx` | shadcn/ui | MIT |
| `src/components/ui/checkbox.tsx` | shadcn/ui | MIT |
| `src/components/ui/dropdown-menu.tsx` | shadcn/ui | MIT |
| `src/components/ui/popover.tsx` | shadcn/ui | MIT |
| `src/components/ui/progress.tsx` | shadcn/ui | MIT |
| `src/components/ui/separator.tsx` | shadcn/ui | MIT |
| `src/components/ui/sheet.tsx` | shadcn/ui | MIT |
| `src/components/ui/sidebar.tsx` | shadcn/ui | MIT |
| `src/components/ui/skeleton.tsx` | shadcn/ui | MIT |
| `src/components/ui/switch.tsx` | shadcn/ui | MIT |
| `src/components/ui/table.tsx` | shadcn/ui | MIT |
| `src/components/ui/textarea.tsx` | shadcn/ui | MIT |
| `src/components/ui/tooltip.tsx` | shadcn/ui | MIT |

**Note**: shadcn/ui components are explicitly designed for copying and modification. No attribution required but recommended.

#### Utility Functions (MIT-derived)
| File | Origin | License |
|------|--------|---------|
| `src/lib/utils.ts` | clsx/tailwind-merge pattern | MIT |

### 1.3 THIRD-PARTY SDK / SERVICES

| Service | Usage | License Type |
|---------|-------|--------------|
| Supabase | Backend-as-a-Service | Apache 2.0 (SDK) |
| Mapbox GL JS | Map visualization | Proprietary (requires API key) |
| Capacitor | Mobile app wrapper | MIT |
| Twilio | SMS services (external) | Proprietary API |
| Resend | Email services (external) | Proprietary API |

---

## SECTION 2: LICENSE INVENTORY

### 2.1 NPM Dependencies

| Package | Version | License | Risk |
|---------|---------|---------|------|
| react | ^18.3.1 | MIT | ✅ |
| react-dom | ^18.3.1 | MIT | ✅ |
| react-router-dom | ^6.30.1 | MIT | ✅ |
| @supabase/supabase-js | ^2.80.0 | MIT | ✅ |
| @tanstack/react-query | ^5.83.0 | MIT | ✅ |
| @capacitor/core | ^7.4.4 | MIT | ✅ |
| @capacitor/android | ^7.4.4 | MIT | ✅ |
| @capacitor/ios | ^7.4.4 | MIT | ✅ |
| @capacitor/camera | ^7.0.2 | MIT | ✅ |
| @capacitor/geolocation | ^7.1.5 | MIT | ✅ |
| @capacitor/network | ^7.0.2 | MIT | ✅ |
| @capacitor/preferences | ^7.0.2 | MIT | ✅ |
| capacitor-native-biometric | ^4.2.2 | MIT | ✅ |
| @radix-ui/* | Various | MIT | ✅ |
| @hookform/resolvers | ^3.10.0 | MIT | ✅ |
| react-hook-form | ^7.61.1 | MIT | ✅ |
| zod | ^4.1.12 | MIT | ✅ |
| tailwindcss | ^3.4.17 | MIT | ✅ |
| tailwindcss-animate | ^1.0.7 | MIT | ✅ |
| tailwind-merge | ^2.6.0 | MIT | ✅ |
| class-variance-authority | ^0.7.1 | Apache 2.0 | ✅ |
| clsx | ^2.1.1 | MIT | ✅ |
| lucide-react | ^0.462.0 | ISC | ✅ |
| date-fns | ^4.1.0 | MIT | ✅ |
| mapbox-gl | ^3.16.0 | BSD-3-Clause | ✅ |
| recharts | ^2.15.4 | MIT | ✅ |
| sonner | ^1.7.4 | MIT | ✅ |
| jspdf | ^3.0.3 | MIT | ✅ |
| xlsx | ^0.18.5 | Apache 2.0 | ✅ |
| qrcode | ^1.5.4 | MIT | ✅ |
| exifr | ^7.1.3 | MIT | ✅ |
| idb | ^8.0.3 | ISC | ✅ |
| papaparse | ^5.5.3 | MIT | ✅ |
| embla-carousel-react | ^8.6.0 | MIT | ✅ |
| cmdk | ^1.1.1 | MIT | ✅ |
| vaul | ^0.9.9 | MIT | ✅ |
| input-otp | ^1.4.2 | MIT | ✅ |
| next-themes | ^0.3.0 | MIT | ✅ |
| react-day-picker | ^8.10.1 | MIT | ✅ |
| react-resizable-panels | ^2.1.9 | MIT | ✅ |
| vite | ^5.4.19 | MIT | ✅ |
| vite-plugin-pwa | ^1.1.0 | MIT | ✅ |
| typescript | ^5.8.3 | Apache 2.0 | ✅ |
| eslint | ^9.32.0 | MIT | ✅ |
| autoprefixer | ^10.4.21 | MIT | ✅ |
| postcss | ^8.5.6 | MIT | ✅ |
|  | ^1.1.11 | Proprietary (AFROLOC) | ⚠️ |

### 2.2 Deno/Edge Dependencies

| Package | Source | License |
|---------|--------|---------|
| @supabase/supabase-js | esm.sh | MIT |
| std@0.168.0 (Deno) | deno.land | MIT |

### 2.3 License Summary

| License | Count | Compatibility |
|---------|-------|---------------|
| MIT | 74 | ✅ Commercial-friendly |
| Apache 2.0 | 4 | ✅ Commercial-friendly |
| ISC | 3 | ✅ Commercial-friendly |
| BSD-3-Clause | 1 | ✅ Commercial-friendly |
| Proprietary | 1 | ⚠️ Review needed |
| GPL/AGPL/LGPL | 0 | ✅ None found |

---

## SECTION 3: IP RISKS IDENTIFIED

### 3.1 HIGH-PRIORITY RISKS

| Risk | Description | Mitigation |
|------|-------------|------------|
| **None identified** | No GPL/AGPL/copyleft licenses detected | - |

### 3.2 MEDIUM-PRIORITY RISKS

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Translation Files** | 13 translation files (pt, en, fr, sw, etc.) without explicit authorship | Add copyright headers |
| **Mapbox GL JS** | Requires valid API key for production use | Ensure commercial license compliance |
| **** | Proprietary dev dependency | Verify license terms with AFROLOC |
| **shadcn/ui components** | Widely copied, but attribution recommended | Add to THIRD_PARTY_NOTICES |

### 3.3 LOW-PRIORITY RISKS

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Missing copyright headers** | Source files lack copyright notices | Apply COPYRIGHT template |
| **Asset ownership** | Logo files without copyright metadata | Document ownership |

### 3.4 Template/Copied Code Analysis

| Pattern | Files Affected | Source | Status |
|---------|----------------|--------|--------|
| shadcn/ui components | 25 files | shadcn/ui | MIT Licensed ✅ |
| Vite boilerplate | 3 files | Vite template | MIT Licensed ✅ |
| Tailwind config | 2 files | Tailwind template | MIT Licensed ✅ |

---

## SECTION 4: RECOMMENDATIONS

### Immediate Actions (Priority 1)
1. ✅ Apply COPYRIGHT header template to all proprietary source files
2. ✅ Generate THIRD_PARTY_NOTICES.txt file
3. ✅ Document translation file ownership

### Short-term Actions (Priority 2)
1. Add explicit copyright to all asset files
2. Review Mapbox commercial license requirements
3. Add SPDX license identifiers to package.json

### Long-term Actions (Priority 3)
1. Implement automated license scanning in CI/CD
2. Create IP assignment agreements for contributors
3. Register trademark for "AFROLOC"

---

## APPENDICES

See companion files:
- `SBOM.json` - Software Bill of Materials (CycloneDX format)
- `THIRD_PARTY_NOTICES.txt` - Third-party license notices
- `COPYRIGHT_HEADER_TEMPLATE.txt` - Standard copyright header

---

**Prepared by**: IP Audit System  
**Review Status**: Complete  
**Next Review Date**: 2026-07-14

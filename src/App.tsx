import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Index = lazy(() => import("./pages/Index"));
const Landing = lazy(() => import("./pages/Landing"));
const Pricing = lazy(() => import("./pages/Pricing"));
const About = lazy(() => import("./pages/About"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Contact = lazy(() => import("./pages/Contact"));
const Login = lazy(() => import("./pages/Login"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminTwoFactor = lazy(() => import("./pages/AdminTwoFactor"));
const AdminTwoFactorBackup = lazy(() => import("./pages/AdminTwoFactorBackup"));
const AdminBackupCodes = lazy(() => import("./pages/AdminBackupCodes"));
const Signup = lazy(() => import("./pages/Signup"));
const PreSignup = lazy(() => import("./pages/PreSignup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Identities = lazy(() => import("./pages/Identities"));
const CreateIdentity = lazy(() => import("./pages/CreateIdentity"));
const IdentityDetail = lazy(() => import("./pages/IdentityDetail"));
const EditAddress = lazy(() => import("./pages/EditAddress"));
const AddWitness = lazy(() => import("./pages/AddWitness"));
const ConfirmWitness = lazy(() => import("./pages/ConfirmWitness"));
const UserLevels = lazy(() => import("./pages/UserLevels"));
const VerifyIdentity = lazy(() => import("./pages/VerifyIdentity"));
const AuthorityValidation = lazy(() => import("./pages/AuthorityValidation"));
const AuthorityGPSValidation = lazy(() => import("./pages/AuthorityGPSValidation"));
const DocumentVerification = lazy(() => import("./pages/DocumentVerification"));
const AdminDocuments = lazy(() => import("./pages/AdminDocuments"));
const AdminDocumentLibrary = lazy(() => import("./pages/AdminDocumentLibrary"));
const AdminContractDownloads = lazy(() => import("./pages/AdminContractDownloads"));
const AdminImportDivisions = lazy(() => import("./pages/AdminImportDivisions"));
const AdminTelecomOperators = lazy(() => import("./pages/AdminTelecomOperators"));
const AdminValidationNumbers = lazy(() => import("./pages/AdminValidationNumbers"));
const AdminCountryConfig = lazy(() => import("./pages/AdminCountryConfig"));
const RegionalValidation = lazy(() => import("./pages/RegionalValidation"));
const ValidationsDashboard = lazy(() => import("./pages/ValidationsDashboard"));
const AdminReports = lazy(() => import("./pages/AdminReports"));
const AdminRiskDashboard = lazy(() => import("./pages/AdminRiskDashboard"));
const AdminPodpDashboard = lazy(() => import("./pages/AdminPodpDashboard"));
const SecurityMonitoring = lazy(() => import("./pages/SecurityMonitoring"));
const ManualDownload = lazy(() => import("./pages/ManualDownload"));
const AppDownload = lazy(() => import("./pages/AppDownload"));
const SourceDownload = lazy(() => import("./pages/SourceDownload"));
const OfflineCreateIdentity = lazy(() => import("./pages/OfflineCreateIdentity"));
const OfflineSync = lazy(() => import("./pages/OfflineSync"));
const Install = lazy(() => import("./pages/Install"));
const Profile = lazy(() => import("./pages/Profile"));
const TranslationValidationPage = lazy(() => import("./pages/TranslationValidationPage"));
const ValidatorManagement = lazy(() => import("./pages/ValidatorManagement"));
const MyAddresses = lazy(() => import("./pages/MyAddresses"));
const ChangePhone = lazy(() => import("./pages/ChangePhone"));
const AdminUserManagement = lazy(() => import("./pages/AdminUserManagement"));
const AdminRoleApprovals = lazy(() => import("./pages/AdminRoleApprovals"));
const AdminSystemSetup = lazy(() => import("./pages/AdminSystemSetup"));
const AdminRegionalManagement = lazy(() => import("./pages/AdminRegionalManagement"));
const BrandGuidelines = lazy(() => import("./pages/BrandGuidelines"));
const CertificationKPIs = lazy(() => import("./pages/CertificationKPIs"));
const GeospatialGrid = lazy(() => import("./pages/GeospatialGrid"));
const AdminSecurityAudit = lazy(() => import("./pages/AdminSecurityAudit"));
const MapDemo = lazy(() => import("./pages/MapDemo"));
const PublicDocuments = lazy(() => import("./pages/PublicDocuments"));
const Documents = lazy(() => import("./pages/Documents"));
const AdminCellTowers = lazy(() => import("./pages/AdminCellTowers"));
const WitnessReputation = lazy(() => import("./pages/WitnessReputation"));
const AdminFraudFlags = lazy(() => import("./pages/AdminFraudFlags"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const KpisExport = lazy(() => import("./pages/KpisExport"));
const AdminImportUrbanZones = lazy(() => import("./pages/AdminImportUrbanZones"));
const GridManagementDashboard = lazy(() => import("./pages/GridManagementDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const TestEnvironmentPDF = lazy(() => import("./pages/TestEnvironmentPDF"));
const ExportDivisoes = lazy(() => import("./pages/ExportDivisoes"));
const WitnessProximityMap = lazy(() => import("./pages/WitnessProximityMap"));
const AfrolocRequests = lazy(() => import("./pages/AfrolocRequests"));
const AdminAutoTranslate = lazy(() => import("./pages/AdminAutoTranslate"));
const IPDocumentationPDF = lazy(() => import("./pages/IPDocumentationPDF"));
const AddressTest = lazy(() => import("./pages/AddressTest"));
const DeepLinkRedirect = lazy(() => import("./pages/DeepLinkRedirect"));
const ApiDocumentation = lazy(() => import("./pages/ApiDocumentation"));
const MyAfroloc = lazy(() => import("./pages/MyAfroloc"));
const TempAddressManager = lazy(() => import("./pages/TempAddressManager"));
const AdminYamiooAgents = lazy(() => import("./pages/AdminYamiooAgents"));
const GridSystemPDF = lazy(() => import("./pages/GridSystemPDF"));
const IPDrawingsPDF = lazy(() => import("./pages/IPDrawingsPDF"));
const YamiooApiDocs = lazy(() => import("./pages/YamiooApiDocs"));
const PatentClaims = lazy(() => import("./pages/PatentClaims"));
const TrustedDevices = lazy(() => import("./pages/TrustedDevices"));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <TooltipProvider>
          <LanguageProvider>
            <AuthProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <PWAInstallPrompt />
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/landing" replace />} />
                      <Route path="/landing" element={<Landing />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/faq" element={<FAQ />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/map-demo" element={<MapDemo />} />
                      <Route path="/documents" element={<Documents />} />
                      <Route path="/public-documents" element={<PublicDocuments />} />
                      <Route path="/dashboard" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/admin/login" element={<AdminLogin />} />
                      <Route path="/admin/setup" element={<AdminSetup />} />
                      <Route path="/admin/2fa" element={<AdminTwoFactor />} />
                      <Route path="/admin/2fa-backup" element={<AdminTwoFactorBackup />} />
                      <Route path="/admin/backup-codes" element={<ProtectedRoute requireAdmin><AdminBackupCodes /></ProtectedRoute>} />
                      <Route path="/pre-signup" element={<PreSignup />} />
                      <Route path="/presignup" element={<Navigate to="/pre-signup" replace />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route path="/forgot-password" element={<ForgotPassword />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="/identities" element={<Identities />} />
                      <Route path="/my-addresses" element={<MyAddresses />} />
                      <Route path="/identities/create" element={<CreateIdentity />} />
                      <Route path="/identity/:id" element={<IdentityDetail />} />
                      <Route path="/identity/:id/edit" element={<EditAddress />} />
                      <Route path="/identity/:id/add-witness" element={<AddWitness />} />
                      <Route path="/identity/:id/verify" element={<VerifyIdentity />} />
                      <Route path="/identity/:id/authority-validation" element={<AuthorityValidation />} />
                      <Route path="/authority/gps-validation" element={<ProtectedRoute><AuthorityGPSValidation /></ProtectedRoute>} />
                      <Route path="/identity/:id/document-verification" element={<DocumentVerification />} />
                      <Route path="/confirm-witness/:witnessId" element={<ConfirmWitness />} />
                      <Route path="/create-identity" element={<CreateIdentity />} />
                      <Route path="/user-levels" element={<UserLevels />} />
                      <Route path="/verify-identity" element={<ProtectedRoute requireAdmin><AdminDocuments /></ProtectedRoute>} />
                      <Route path="/admin/documents" element={<ProtectedRoute requireAdmin><AdminDocuments /></ProtectedRoute>} />
                      <Route path="/admin/document-library" element={<ProtectedRoute requireAdmin><AdminDocumentLibrary /></ProtectedRoute>} />
                      <Route path="/admin/contract-downloads" element={<ProtectedRoute requireAdmin><AdminContractDownloads /></ProtectedRoute>} />
                      <Route path="/admin/import-divisions" element={<ProtectedRoute requireAdmin><AdminImportDivisions /></ProtectedRoute>} />
                      <Route path="/admin/telecom-operators" element={<ProtectedRoute requireAdmin><AdminTelecomOperators /></ProtectedRoute>} />
                      <Route path="/admin/validation-numbers" element={<ProtectedRoute requireAdmin><AdminValidationNumbers /></ProtectedRoute>} />
                      <Route path="/admin/country-config" element={<ProtectedRoute requireAdmin><AdminCountryConfig /></ProtectedRoute>} />
                      <Route path="/regional-validation" element={<RegionalValidation />} />
                      <Route path="/validations-dashboard" element={<ValidationsDashboard />} />
                      <Route path="/admin/reports" element={<ProtectedRoute requireAdmin><AdminReports /></ProtectedRoute>} />
                      <Route path="/admin/risk-dashboard" element={<ProtectedRoute requireAdmin><AdminRiskDashboard /></ProtectedRoute>} />
                      <Route path="/admin/podp" element={<ProtectedRoute requireAdmin><AdminPodpDashboard /></ProtectedRoute>} />

                      <Route path="/admin/security" element={<ProtectedRoute requireAdmin><SecurityMonitoring /></ProtectedRoute>} />
                      <Route path="/admin/security-audit" element={<ProtectedRoute requireAdmin><AdminSecurityAudit /></ProtectedRoute>} />
                      <Route path="/admin/user-management" element={<ProtectedRoute requireAdmin><AdminUserManagement /></ProtectedRoute>} />
                      <Route path="/admin/role-approvals" element={<ProtectedRoute requireAdmin><AdminRoleApprovals /></ProtectedRoute>} />
                      <Route path="/admin/system-setup" element={<ProtectedRoute requireAdmin><AdminSystemSetup /></ProtectedRoute>} />
                      <Route path="/admin/regional-management" element={<ProtectedRoute requireAdmin><AdminRegionalManagement /></ProtectedRoute>} />
                      <Route path="/admin/cell-towers" element={<ProtectedRoute requireAdmin><AdminCellTowers /></ProtectedRoute>} />
                      <Route path="/admin/fraud-flags" element={<ProtectedRoute requireAdmin><AdminFraudFlags /></ProtectedRoute>} />
                      <Route path="/admin/import-urban-zones" element={<ProtectedRoute requireAdmin><AdminImportUrbanZones /></ProtectedRoute>} />
                      <Route path="/manual-download" element={<ProtectedRoute requireAdmin><ManualDownload /></ProtectedRoute>} />
                      <Route path="/offline-create" element={<OfflineCreateIdentity />} />
                      <Route path="/offline-sync" element={<OfflineSync />} />
                      <Route path="/install" element={<Install />} />
                      <Route path="/app-download" element={<AppDownload />} />
                      <Route path="/source-download" element={<ProtectedRoute requireAdmin><SourceDownload /></ProtectedRoute>} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/change-phone" element={<ChangePhone />} />
                      <Route path="/admin/translations" element={<ProtectedRoute requireAdmin><TranslationValidationPage /></ProtectedRoute>} />
                      <Route path="/admin/auto-translate" element={<ProtectedRoute requireAdmin><AdminAutoTranslate /></ProtectedRoute>} />
                      <Route path="/validators" element={<ValidatorManagement />} />
                      <Route path="/brand-guidelines" element={<BrandGuidelines />} />
                      <Route path="/certification-kpis" element={<ProtectedRoute><CertificationKPIs /></ProtectedRoute>} />
                      <Route path="/geospatial-grid" element={<ProtectedRoute><GeospatialGrid /></ProtectedRoute>} />
                      <Route path="/grid-management" element={<ProtectedRoute requireAdmin><GridManagementDashboard /></ProtectedRoute>} />
                      <Route path="/cadastral-grid-cells" element={<Navigate to="/geospatial-grid" replace />} />
                      <Route path="/cadastral_grid_cells" element={<Navigate to="/geospatial-grid" replace />} />
                      <Route path="/witness-reputation" element={<ProtectedRoute><WitnessReputation /></ProtectedRoute>} />
                      <Route path="/kpis-export" element={<ProtectedRoute requireAdmin><KpisExport /></ProtectedRoute>} />
                      <Route path="/test-environment" element={<TestEnvironmentPDF />} />
                      <Route path="/export-divisoes" element={<ProtectedRoute requireAdmin><ExportDivisoes /></ProtectedRoute>} />
                      <Route path="/witness-proximity" element={<ProtectedRoute><WitnessProximityMap /></ProtectedRoute>} />
                      <Route path="/afroloc-requests" element={<ProtectedRoute><AfrolocRequests /></ProtectedRoute>} />
                      <Route path="/ip-documentation" element={<IPDocumentationPDF />} />
                      <Route path="/address-test" element={<ProtectedRoute><AddressTest /></ProtectedRoute>} />
                      <Route path="/api-docs" element={<ApiDocumentation />} />
                      <Route path="/my-afroloc" element={<ProtectedRoute><MyAfroloc /></ProtectedRoute>} />
                      <Route path="/temp-address-manager" element={<ProtectedRoute requireAdmin><TempAddressManager /></ProtectedRoute>} />
                      <Route path="/admin/yamioo-agents" element={<ProtectedRoute requireAdmin><AdminYamiooAgents /></ProtectedRoute>} />
                      <Route path="/grid-system-pdf" element={<GridSystemPDF />} />
                      <Route path="/ip-drawings" element={<IPDrawingsPDF />} />
                      <Route path="/yamioo-api" element={<YamiooApiDocs />} />
                      <Route path="/patent-claims" element={<PatentClaims />} />
                      <Route path="/trusted-devices" element={<ProtectedRoute><TrustedDevices /></ProtectedRoute>} />
                      <Route path="/dl/:action/:code" element={<DeepLinkRedirect />} />
                      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </ErrorBoundary>
              </BrowserRouter>
            </AuthProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;

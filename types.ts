export type View =
  | "dashboard"
  | "project"
  | "contacts"
  | "settings"
  | "project-management"
  | "project-overview";

export type ProjectTab = "overview" | "tender-plan" | "pipeline" | "documents";

// Tender Plan Item
export interface TenderPlanItem {
  id: string;
  name: string; // Název VŘ
  dateFrom: string; // Od (datum)
  dateTo: string; // Do (datum)
  categoryId?: string; // Linked demand category ID (if created)
}

export interface StatusConfig {
  id: string;
  label: string;
  color: "green" | "red" | "yellow" | "blue" | "purple" | "slate";
}

export interface ContactPerson {
  id: string;
  name: string;
  phone: string;
  email: string;
  position?: string; // Pozice / Role
}

export interface Subcontractor {
  id: string;
  company: string; // Supplier (Dodavatel)
  specialization: string[]; // Type (Typ)
  contacts: ContactPerson[];
  ico?: string; // IČ
  region?: string;
  status: string; // Dynamic ID linking to StatusConfig

  // Legacy fields for backward compatibility / migration
  name?: string;
  phone?: string;
  email?: string;
}

export interface DemandDocument {
  id: string;
  name: string;
  url: string;
  size: number;
  uploadedAt: string;
}

export interface DemandCategory {
  id: string;
  title: string;
  budget: string; // Display string (legacy)
  sodBudget: number; // Price in contract with investor (Revenue)
  planBudget: number; // Internal target price (Target Cost)
  status: "open" | "negotiating" | "closed" | "sod";
  subcontractorCount: number;
  description: string;
  documents?: DemandDocument[];
  deadline?: string; // Termín pro podání nabídky (ISO date string)
  realizationStart?: string; // Termín realizace - začátek (ISO date string)
  realizationEnd?: string; // Termín realizace - konec (ISO date string)
}

export interface DocHubStructureV1 {
  pd: string;
  tenders: string;
  contracts: string;
  realization: string;
  archive: string;
  tendersInquiries: string;
  supplierEmail: string;
  supplierOffer: string;
  extraTopLevel?: string[]; // Optional additional folders in project root
  extraSupplier?: string[]; // Optional additional subfolders under supplier folder
}

export type BidStatus =
  | "contacted"
  | "sent"
  | "offer"
  | "shortlist"
  | "sod"
  | "rejected";

export interface Bid {
  id: string;
  subcontractorId: string;
  companyName: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  price?: string;
  priceHistory?: Record<number, string>; // Prices per round: { 1: "2095766 Kč", 2: "1372066 Kč" }
  notes?: string;
  tags?: string[];
  status: BidStatus;
  updateDate?: string; // Datum k zaslání úpravy (ISO date string)
  selectionRound?: number; // Kolo výběru: 1, 2, nebo 3
  contracted?: boolean; // True when contract is signed with this winner
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export type ProjectStatus = "tender" | "realization" | "archived";

export interface Project {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
  isDemo?: boolean;
  ownerId?: string;
  ownerEmail?: string;
  sharedWith?: string[];
}

export interface ContractDetails {
  maturity: number; // days
  warranty: number; // months
  retention: string; // e.g. "5+5 %"
  siteFacilities: number; // %
  insurance: number; // %
}

export interface Amendment {
  id: string;
  label: string; // e.g. "Dodatek č.1"
  price: number;
}

export interface InvestorFinancials {
  sodPrice: number; // Base contract price
  amendments: Amendment[];
}

export interface ProjectDetails {
  id?: string; // Optional linkage
  title: string;
  status?: ProjectStatus; // Added specific status field

  // Editable General Info
  investor?: string; // Investor
  technicalSupervisor?: string; // Technický dozor (TDI)
  location: string;
  finishDate: string;
  siteManager: string; // Hlavní stavbyvedoucí
  constructionManager?: string; // Stavbyvedoucí
  constructionTechnician?: string; // Stavební technik

  // Financials
  plannedCost?: number; // Interní plánovaný náklad (Cíl)

  // Documents
  documentationLink?: string; // Link to shared project documentation
  inquiryLetterLink?: string; // Link to inquiry letter template
  docHubEnabled?: boolean; // DocHub module enabled for this project
  docHubRootLink?: string; // Root link/path to the project's DocHub folder
  docHubProvider?: "gdrive" | "onedrive" | null; // Storage provider
  docHubMode?: "user" | "org" | null; // User drive vs organization/shared drive
  docHubRootId?: string | null; // Provider root folder/item ID (future backend)
  docHubRootName?: string | null; // Human-readable name for UI
  docHubDriveId?: string | null; // Shared drive / drive ID (provider-specific)
  docHubSiteId?: string | null; // SharePoint site ID (OneDrive/SharePoint)
  docHubRootWebUrl?: string | null; // Openable web URL (if available)
  docHubStatus?: "disconnected" | "connected" | "error"; // Connection state
  docHubLastError?: string | null; // Last error message
  docHubStructureVersion?: number; // Structure version for future migrations (default: 1)
  docHubStructureV1?: Partial<DocHubStructureV1> | null; // Custom folder naming (keeps structure keys)
  docHubAutoCreateEnabled?: boolean; // Auto-create & reconcile folders on toggle
  docHubAutoCreateLastRunAt?: string | null; // ISO datetime of last auto-create run
  docHubAutoCreateLastError?: string | null; // last auto-create error

  categories: DemandCategory[];
  contract?: ContractDetails;
  investorFinancials?: InvestorFinancials;
  bids?: Record<string, Bid[]>;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  primaryColor: string;
  backgroundColor: string;
}

export type SubscriptionTier = "free" | "pro" | "enterprise" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "demo";
  subscriptionTier?: SubscriptionTier;
  avatarUrl?: string;
  preferences?: UserPreferences;
}

export interface Template {
  id: string;
  name: string;
  subject: string;
  content: string;
  isDefault: boolean;
  lastModified: string;
}

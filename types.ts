export type View = "dashboard" | "project" | "contacts" | "settings" | "project-management";

export type ProjectTab = "overview" | "pipeline" | "documents";

export interface StatusConfig {
  id: string;
  label: string;
  color: "green" | "red" | "yellow" | "blue" | "purple" | "slate";
}

export interface Subcontractor {
  id: string;
  name: string; // Contact Person (Jméno)
  company: string; // Supplier (Dodavatel)
  specialization: string[]; // Type (Typ)
  phone: string;
  email: string;
  ico?: string; // IČ
  region?: string;
  status: string; // Dynamic ID linking to StatusConfig
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

export type BidStatus = 'contacted' | "sent" | "offer" | "shortlist" | "sod" | "rejected";

export interface Bid {
  id: string;
  subcontractorId: string;
  companyName: string;
  contactPerson: string;
  email?: string;
  phone?: string;
  price?: string;
  notes?: string;
  tags?: string[];
  status: BidStatus;
  updateDate?: string; // Datum k zaslání úpravy (ISO date string)
  selectionRound?: number; // Kolo výběru: 1, 2, nebo 3
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

  categories: DemandCategory[];
  contract?: ContractDetails;
  investorFinancials?: InvestorFinancials;
  bids?: Record<string, Bid[]>;
}

export interface UserPreferences {
  darkMode: boolean;
  primaryColor: string;
  backgroundColor: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
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

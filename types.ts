
export type View = 'dashboard' | 'project' | 'contacts' | 'settings';

export type ProjectTab = 'overview' | 'pipeline' | 'documents';

export interface Subcontractor {
  id: string;
  name: string;
  company: string;
  specialization: string;
  phone: string;
  email: string;
  status: 'available' | 'busy' | 'waiting';
}

export interface DemandCategory {
  id: string;
  title: string;
  budget: string;
  status: 'open' | 'negotiating' | 'closed' | 'sod';
  subcontractorCount: number;
  description: string;
}

export type BidStatus = 'sent' | 'offer' | 'shortlist' | 'sod' | 'rejected';

export interface Bid {
  id: string;
  subcontractorId: string;
  companyName: string;
  contactPerson: string;
  price?: string;
  notes?: string;
  tags?: string[];
  status: BidStatus;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

export type ProjectStatus = 'tender' | 'realization' | 'archived';

export interface Project {
  id: string;
  name: string;
  location: string;
  status: ProjectStatus;
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

  categories: DemandCategory[];
  contract?: ContractDetails;
  investorFinancials?: InvestorFinancials;
}
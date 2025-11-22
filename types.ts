
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

export interface Project {
  id: string;
  name: string;
  location: string;
}
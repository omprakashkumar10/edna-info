export type UserTypeOption =
  | 'Student'
  | 'Research Scholar'
  | 'Scientist'
  | 'Professor'
  | 'Environmental Researcher'
  | 'Biodiversity Expert'
  | 'Organisation'
  | 'Other';

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  mobileNumber?: string;
  country?: string;
  state?: string;
  institution?: string;
  department?: string;
  researchField?: string;
  userType: UserTypeOption;
  role: 'user' | 'admin';
  status: 'active' | 'deactivated' | 'suspended';
  emailVerified: boolean;
  photoUrl?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface UserPreferences {
  userId: string;
  theme: 'light' | 'dark' | 'system';
  emailNotifications: boolean;
  analysisAlerts: boolean;
  defaultReferenceDb: 'NCBI BLAST' | 'NCBI Taxonomy' | 'SILVA' | 'BOLD Systems' | 'UNITE';
  defaultConfidenceThreshold: number;
  updatedAt: unknown;
}

export interface AppNotification {
  id: string;
  userId: string;
  type:
    | 'registration'
    | 'verification'
    | 'upload'
    | 'analysis_started'
    | 'analysis_completed'
    | 'analysis_failed'
    | 'report'
    | 'account';
  title: string;
  message: string;
  read: boolean;
  linkView?: string;
  createdAt: unknown;
}

export interface ApplicationSettings {
  applicationName: string;
  tagline: string;
  maintenanceMode: boolean;
  maxUploadSizeMb: number;
  allowedFormats: string[];
  notificationsEnabled: boolean;
  updatedAt: unknown;
  updatedBy: string;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: unknown;
}

export interface SystemStatus {
  appName: string;
  tagline: string;
  supabaseConfigured: boolean;
  geminiConfigured: boolean;
  storageMode: string;
  maxUploadMb: number;
  allowedFormats: string[];
}

export interface ResearchProject {
  id: string;
  owner_uid: string;
  project_name: string;
  project_description: string;
  research_objective: string;
  study_location: string;
  start_date: string | null;
  end_date: string | null;
  environmental_type: 'Freshwater' | 'Marine' | 'Soil' | 'Air' | 'Sediment' | 'Other';
  researcher_name: string;
  researcher_institution: string;
  researcher_email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetRecord {
  id: string;
  owner_uid: string;
  project_id: string | null;
  dataset_name: string;
  original_filename: string;
  file_format: 'CSV' | 'FASTA' | 'FASTQ' | 'TSV' | 'TXT';
  file_size_bytes: number;
  storage_path: string;
  sample_id: string;
  collection_location: string;
  latitude: number | null;
  longitude: number | null;
  collection_date: string | null;
  environmental_type: 'Freshwater' | 'Marine' | 'Soil' | 'Air' | 'Sediment' | 'Other';
  sample_description: string;
  sequencing_platform: string;
  marker_gene: string;
  reference_database: string;
  additional_notes: string;
  processing_status: 'Uploaded' | 'Validating' | 'Queued' | 'Processing' | 'Completed' | 'Failed';
  sequence_count: number;
  total_reads: number;
  mean_quality_score: number | null;
  has_abundance_data: boolean;
  is_sample_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DnaSequenceRecord {
  id: string;
  dataset_id: string;
  sequence_identifier: string;
  sample_code: string;
  raw_sequence: string;
  sequence_length: number;
  gc_content: number;
  mean_phred_quality: number | null;
  abundance_count: number;
}

export interface TaxonomyResultRecord {
  id?: string;
  dataset_id?: string;
  sequence_identifier?: string;
  sequenceIdentifier?: string;
  sample_code?: string;
  sampleCode?: string;
  domain: string;
  kingdom: string;
  phylum: string;
  tax_class?: string;
  taxClass?: string;
  tax_order?: string;
  taxOrder?: string;
  family: string;
  genus: string;
  species_name?: string;
  speciesName?: string;
  taxonomic_id?: string;
  taxonomicId?: string;
  accession_number?: string;
  accessionNumber?: string;
  confidence_score?: number;
  confidenceScore?: number;
  identity_pct?: number;
  identityPct?: number;
  e_value?: string;
  eValue?: string;
  abundance_count?: number;
  abundanceCount?: number;
  reference_database?: string;
  referenceDatabase?: string;
  identification_status?: string;
  identificationStatus?: string;
  created_at?: string;
}

export interface BiodiversityMetricRecord {
  id: string;
  dataset_id: string;
  project_id: string | null;
  owner_uid: string;
  sample_code: string;
  species_richness: number;
  total_individuals: number;
  shannon_index: number;
  simpson_index: number;
  pielou_evenness: number;
  alpha_diversity: number;
  beta_bray_curtis_mean: number | null;
  has_abundance_data: boolean;
  limitations_note: string;
  taxonomic_composition: { group: string; count: number; percentage: number }[];
  relative_abundance: { species: string; count: number; relativePct: number }[];
  calculated_at: string;
}

export interface AnalysisJobRecord {
  id: string;
  dataset_id: string;
  owner_uid: string;
  job_type: string;
  reference_database: string;
  status: 'Uploaded' | 'Validating' | 'Queued' | 'Processing' | 'Completed' | 'Failed';
  progress_pct: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface SpeciesRecord {
  id: string;
  taxonomic_id: string;
  scientific_name: string;
  common_name: string;
  domain: string;
  kingdom: string;
  phylum: string;
  tax_class: string;
  tax_order: string;
  family: string;
  genus: string;
  species_epithet: string;
  reference_source: string;
  conservation_status: string;
  habitat_summary: string;
  detection_frequency: number;
}

export interface TaxonomyRefRecord {
  id: string;
  database_name: string;
  version_tag: string;
  marker_gene: string;
  accession_prefix: string;
  api_endpoint: string;
  description: string;
  is_active: boolean;
  updated_at: string;
}

export interface ReportMetadataRecord {
  id: string;
  owner_uid: string;
  project_id: string | null;
  dataset_id: string | null;
  report_title: string;
  report_format: 'PDF' | 'CSV' | 'Excel';
  researcher_name: string;
  summary_notes: string;
  generated_at: string;
}

export type DashboardView =
  | 'overview'
  | 'upload'
  | 'datasets'
  | 'dataset-detail'
  | 'taxonomy'
  | 'biodiversity'
  | 'history'
  | 'species'
  | 'projects'
  | 'reports'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'help';

export type PublicView =
  | 'landing'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'verify-email'
  | 'control-center';

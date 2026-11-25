-- eDNA BioScan Scientific PostgreSQL Schema (Supabase)
-- Run this migration in your Supabase SQL Editor to provision all 11 scientific tables and RLS policies.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Research Projects
CREATE TABLE IF NOT EXISTS public.research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  project_name TEXT NOT NULL CHECK (char_length(project_name) BETWEEN 2 AND 200),
  project_description TEXT NOT NULL DEFAULT '',
  research_objective TEXT NOT NULL DEFAULT '',
  study_location TEXT NOT NULL DEFAULT '',
  start_date DATE,
  end_date DATE,
  environmental_type TEXT NOT NULL CHECK (environmental_type IN ('Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other')),
  researcher_name TEXT NOT NULL DEFAULT '',
  researcher_institution TEXT NOT NULL DEFAULT '',
  researcher_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_projects_owner ON public.research_projects(owner_uid);
CREATE INDEX IF NOT EXISTS idx_research_projects_env ON public.research_projects(environmental_type);

-- 2. Datasets
CREATE TABLE IF NOT EXISTS public.datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE SET NULL,
  dataset_name TEXT NOT NULL CHECK (char_length(dataset_name) BETWEEN 2 AND 200),
  original_filename TEXT NOT NULL,
  file_format TEXT NOT NULL CHECK (file_format IN ('CSV', 'FASTA', 'FASTQ', 'TSV', 'TXT')),
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes >= 0),
  storage_path TEXT NOT NULL DEFAULT '',
  sample_id TEXT NOT NULL,
  collection_location TEXT NOT NULL DEFAULT '',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  collection_date DATE,
  environmental_type TEXT NOT NULL CHECK (environmental_type IN ('Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other')),
  sample_description TEXT NOT NULL DEFAULT '',
  sequencing_platform TEXT NOT NULL DEFAULT '',
  marker_gene TEXT NOT NULL DEFAULT '',
  reference_database TEXT NOT NULL DEFAULT 'NCBI BLAST',
  additional_notes TEXT NOT NULL DEFAULT '',
  processing_status TEXT NOT NULL DEFAULT 'Uploaded' CHECK (processing_status IN ('Uploaded', 'Validating', 'Queued', 'Processing', 'Completed', 'Failed')),
  sequence_count INTEGER NOT NULL DEFAULT 0,
  total_reads INTEGER NOT NULL DEFAULT 0,
  mean_quality_score DOUBLE PRECISION,
  has_abundance_data BOOLEAN NOT NULL DEFAULT false,
  is_sample_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_datasets_owner ON public.datasets(owner_uid);
CREATE INDEX IF NOT EXISTS idx_datasets_project ON public.datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_datasets_status ON public.datasets(processing_status);

-- 3. Dataset Samples
CREATE TABLE IF NOT EXISTS public.dataset_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  owner_uid TEXT NOT NULL,
  sample_code TEXT NOT NULL,
  collection_location TEXT NOT NULL DEFAULT '',
  environmental_type TEXT NOT NULL CHECK (environmental_type IN ('Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other')),
  collection_date DATE,
  read_depth INTEGER NOT NULL DEFAULT 0,
  gc_content_pct DOUBLE PRECISION,
  mean_phred_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dataset_samples_dataset ON public.dataset_samples(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dataset_samples_owner ON public.dataset_samples(owner_uid);

-- 4. DNA Sequences
CREATE TABLE IF NOT EXISTS public.dna_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  sample_id UUID REFERENCES public.dataset_samples(id) ON DELETE SET NULL,
  owner_uid TEXT NOT NULL,
  sequence_identifier TEXT NOT NULL,
  sample_code TEXT NOT NULL DEFAULT '',
  raw_sequence TEXT NOT NULL,
  sequence_length INTEGER NOT NULL CHECK (sequence_length >= 0),
  gc_content DOUBLE PRECISION NOT NULL DEFAULT 0,
  mean_phred_quality DOUBLE PRECISION,
  abundance_count INTEGER NOT NULL DEFAULT 1 CHECK (abundance_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dna_sequences_dataset ON public.dna_sequences(dataset_id);
CREATE INDEX IF NOT EXISTS idx_dna_sequences_owner ON public.dna_sequences(owner_uid);

-- 5. Taxonomy Reference Metadata
CREATE TABLE IF NOT EXISTS public.taxonomy_reference (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  database_name TEXT NOT NULL CHECK (database_name IN ('NCBI BLAST', 'NCBI Taxonomy', 'SILVA', 'BOLD Systems', 'UNITE')),
  version_tag TEXT NOT NULL DEFAULT '',
  marker_gene TEXT NOT NULL DEFAULT '',
  accession_prefix TEXT NOT NULL DEFAULT '',
  api_endpoint TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Species Catalog (verified / observed scientific taxa)
CREATE TABLE IF NOT EXISTS public.species (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  taxonomic_id TEXT UNIQUE NOT NULL,
  scientific_name TEXT NOT NULL,
  common_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT 'Eukaryota',
  kingdom TEXT NOT NULL DEFAULT '',
  phylum TEXT NOT NULL DEFAULT '',
  tax_class TEXT NOT NULL DEFAULT '',
  tax_order TEXT NOT NULL DEFAULT '',
  family TEXT NOT NULL DEFAULT '',
  genus TEXT NOT NULL DEFAULT '',
  species_epithet TEXT NOT NULL DEFAULT '',
  reference_source TEXT NOT NULL DEFAULT 'NCBI Taxonomy',
  conservation_status TEXT NOT NULL DEFAULT 'Not Evaluated',
  habitat_summary TEXT NOT NULL DEFAULT '',
  detection_frequency INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_species_scientific_name ON public.species(scientific_name);
CREATE INDEX IF NOT EXISTS idx_species_kingdom_phylum ON public.species(kingdom, phylum);

-- 7. Taxonomy Results
CREATE TABLE IF NOT EXISTS public.taxonomy_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  sequence_record_id UUID REFERENCES public.dna_sequences(id) ON DELETE CASCADE,
  species_id UUID REFERENCES public.species(id) ON DELETE SET NULL,
  owner_uid TEXT NOT NULL,
  sequence_identifier TEXT NOT NULL,
  sample_code TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT 'Unclassified',
  kingdom TEXT NOT NULL DEFAULT 'Unclassified',
  phylum TEXT NOT NULL DEFAULT 'Unclassified',
  tax_class TEXT NOT NULL DEFAULT 'Unclassified',
  tax_order TEXT NOT NULL DEFAULT 'Unclassified',
  family TEXT NOT NULL DEFAULT 'Unclassified',
  genus TEXT NOT NULL DEFAULT 'Unclassified',
  species_name TEXT NOT NULL DEFAULT 'Unclassified',
  taxonomic_id TEXT NOT NULL DEFAULT '',
  accession_number TEXT NOT NULL DEFAULT '',
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  identity_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
  e_value TEXT NOT NULL DEFAULT '',
  abundance_count INTEGER NOT NULL DEFAULT 1,
  reference_database TEXT NOT NULL DEFAULT 'NCBI BLAST',
  identification_status TEXT NOT NULL CHECK (identification_status IN ('Verified Reference Match', 'Probable Classification', 'Unclassified', 'Sample Demonstration Data')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_taxonomy_results_dataset ON public.taxonomy_results(dataset_id);
CREATE INDEX IF NOT EXISTS idx_taxonomy_results_owner ON public.taxonomy_results(owner_uid);
CREATE INDEX IF NOT EXISTS idx_taxonomy_results_status ON public.taxonomy_results(identification_status);

-- 8. Biodiversity Metrics
CREATE TABLE IF NOT EXISTS public.biodiversity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE SET NULL,
  owner_uid TEXT NOT NULL,
  sample_code TEXT NOT NULL DEFAULT 'ALL',
  species_richness INTEGER NOT NULL DEFAULT 0,
  total_individuals INTEGER NOT NULL DEFAULT 0,
  shannon_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  simpson_index DOUBLE PRECISION NOT NULL DEFAULT 0,
  pielou_evenness DOUBLE PRECISION NOT NULL DEFAULT 0,
  alpha_diversity DOUBLE PRECISION NOT NULL DEFAULT 0,
  beta_bray_curtis_mean DOUBLE PRECISION,
  has_abundance_data BOOLEAN NOT NULL DEFAULT false,
  limitations_note TEXT NOT NULL DEFAULT '',
  taxonomic_composition JSONB NOT NULL DEFAULT '[]'::jsonb,
  relative_abundance JSONB NOT NULL DEFAULT '[]'::jsonb,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_biodiversity_dataset ON public.biodiversity_metrics(dataset_id);
CREATE INDEX IF NOT EXISTS idx_biodiversity_owner ON public.biodiversity_metrics(owner_uid);

-- 9. Analysis Jobs
CREATE TABLE IF NOT EXISTS public.analysis_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  owner_uid TEXT NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'full_edna_pipeline',
  reference_database TEXT NOT NULL DEFAULT 'NCBI BLAST',
  status TEXT NOT NULL DEFAULT 'Uploaded' CHECK (status IN ('Uploaded', 'Validating', 'Queued', 'Processing', 'Completed', 'Failed')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_jobs_dataset ON public.analysis_jobs(dataset_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_owner ON public.analysis_jobs(owner_uid);

-- 10. Analysis Logs
CREATE TABLE IF NOT EXISTS public.analysis_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  owner_uid TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analysis_logs_job ON public.analysis_logs(job_id);

-- 11. Report Metadata
CREATE TABLE IF NOT EXISTS public.report_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_uid TEXT NOT NULL,
  project_id UUID REFERENCES public.research_projects(id) ON DELETE SET NULL,
  dataset_id UUID REFERENCES public.datasets(id) ON DELETE SET NULL,
  report_title TEXT NOT NULL,
  report_format TEXT NOT NULL CHECK (report_format IN ('PDF', 'CSV', 'Excel')),
  researcher_name TEXT NOT NULL DEFAULT '',
  summary_notes TEXT NOT NULL DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_metadata_owner ON public.report_metadata(owner_uid);

-- Enable Row Level Security on all scientific tables
ALTER TABLE public.research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxonomy_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biodiversity_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_metadata ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Owners access their own records; authenticated users can read reference metadata & species catalog.
-- Note: Server backend uses service_role key after verifying Firebase ID tokens and enforcing user/admin RBAC.
CREATE POLICY "Owners manage own research_projects" ON public.research_projects
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own datasets" ON public.datasets
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own dataset_samples" ON public.dataset_samples
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own dna_sequences" ON public.dna_sequences
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own taxonomy_results" ON public.taxonomy_results
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own biodiversity_metrics" ON public.biodiversity_metrics
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own analysis_jobs" ON public.analysis_jobs
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own analysis_logs" ON public.analysis_logs
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Owners manage own report_metadata" ON public.report_metadata
  FOR ALL USING (owner_uid = current_setting('request.jwt.claim.sub', true));

CREATE POLICY "Authenticated read taxonomy_reference" ON public.taxonomy_reference
  FOR SELECT USING (true);

CREATE POLICY "Authenticated read species" ON public.species
  FOR SELECT USING (true);

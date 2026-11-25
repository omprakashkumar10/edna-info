import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { CURATED_REFERENCE_TAXA } from './bioinformatics.ts';

export interface ResearchProjectRow {
  id: string;
  owner_uid: string;
  project_name: string;
  project_description: string;
  research_objective: string;
  study_location: string;
  start_date: string | null;
  end_date: string | null;
  environmental_type: string;
  researcher_name: string;
  researcher_institution: string;
  researcher_email: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DatasetRow {
  id: string;
  owner_uid: string;
  project_id: string | null;
  dataset_name: string;
  original_filename: string;
  file_format: string;
  file_size_bytes: number;
  storage_path: string;
  sample_id: string;
  collection_location: string;
  latitude: number | null;
  longitude: number | null;
  collection_date: string | null;
  environmental_type: string;
  sample_description: string;
  sequencing_platform: string;
  marker_gene: string;
  reference_database: string;
  additional_notes: string;
  processing_status: string;
  sequence_count: number;
  total_reads: number;
  mean_quality_score: number | null;
  has_abundance_data: boolean;
  is_sample_demo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DnaSequenceRow {
  id: string;
  dataset_id: string;
  owner_uid: string;
  sequence_identifier: string;
  sample_code: string;
  raw_sequence: string;
  sequence_length: number;
  gc_content: number;
  mean_phred_quality: number | null;
  abundance_count: number;
  created_at: string;
}

export interface TaxonomyResultRow {
  id: string;
  dataset_id: string;
  sequence_record_id: string | null;
  owner_uid: string;
  sequence_identifier: string;
  sample_code: string;
  domain: string;
  kingdom: string;
  phylum: string;
  tax_class: string;
  tax_order: string;
  family: string;
  genus: string;
  species_name: string;
  taxonomic_id: string;
  accession_number: string;
  confidence_score: number;
  identity_pct: number;
  e_value: string;
  abundance_count: number;
  reference_database: string;
  identification_status: string;
  created_at: string;
}

export interface BiodiversityMetricRow {
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

export interface AnalysisJobRow {
  id: string;
  dataset_id: string;
  owner_uid: string;
  job_type: string;
  reference_database: string;
  status: string;
  progress_pct: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface AnalysisLogRow {
  id: string;
  job_id: string;
  dataset_id: string;
  owner_uid: string;
  level: string;
  message: string;
  created_at: string;
}

export interface SpeciesCatalogRow {
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

export interface TaxonomyRefRow {
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

export interface ReportMetadataRow {
  id: string;
  owner_uid: string;
  project_id: string | null;
  dataset_id: string | null;
  report_title: string;
  report_format: string;
  researcher_name: string;
  summary_notes: string;
  generated_at: string;
}

class ScientificStore {
  private supabase: SupabaseClient | null = null;
  private sqlite: DatabaseSync;
  public readonly supabaseConfigured: boolean;
  private uploadDir: string;

  constructor() {
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    this.supabaseConfigured = Boolean(supabaseUrl && supabaseKey);

    if (this.supabaseConfigured) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    this.uploadDir = path.resolve('/tmp/edna_bioscan_uploads');
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    const dbPath = path.resolve('/tmp/edna_bioscan_workspace.sqlite');
    this.sqlite = new DatabaseSync(dbPath);
    this.initSqliteSchema();
  }

  private initSqliteSchema(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS admin_security (
        id TEXT PRIMARY KEY,
        passcode_hash TEXT NOT NULL,
        passcode_salt TEXT NOT NULL,
        claimed_by_uid TEXT NOT NULL,
        claimed_by_email TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS research_projects (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        project_name TEXT NOT NULL,
        project_description TEXT NOT NULL DEFAULT '',
        research_objective TEXT NOT NULL DEFAULT '',
        study_location TEXT NOT NULL DEFAULT '',
        start_date TEXT,
        end_date TEXT,
        environmental_type TEXT NOT NULL,
        researcher_name TEXT NOT NULL DEFAULT '',
        researcher_institution TEXT NOT NULL DEFAULT '',
        researcher_email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS datasets (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        project_id TEXT,
        dataset_name TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_format TEXT NOT NULL,
        file_size_bytes INTEGER NOT NULL,
        storage_path TEXT NOT NULL DEFAULT '',
        sample_id TEXT NOT NULL,
        collection_location TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        collection_date TEXT,
        environmental_type TEXT NOT NULL,
        sample_description TEXT NOT NULL DEFAULT '',
        sequencing_platform TEXT NOT NULL DEFAULT '',
        marker_gene TEXT NOT NULL DEFAULT '',
        reference_database TEXT NOT NULL DEFAULT 'NCBI BLAST',
        additional_notes TEXT NOT NULL DEFAULT '',
        processing_status TEXT NOT NULL DEFAULT 'Uploaded',
        sequence_count INTEGER NOT NULL DEFAULT 0,
        total_reads INTEGER NOT NULL DEFAULT 0,
        mean_quality_score REAL,
        has_abundance_data INTEGER NOT NULL DEFAULT 0,
        is_sample_demo INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dataset_samples (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        owner_uid TEXT NOT NULL,
        sample_code TEXT NOT NULL,
        collection_location TEXT NOT NULL DEFAULT '',
        environmental_type TEXT NOT NULL,
        collection_date TEXT,
        read_depth INTEGER NOT NULL DEFAULT 0,
        gc_content_pct REAL,
        mean_phred_score REAL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS dna_sequences (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        owner_uid TEXT NOT NULL,
        sequence_identifier TEXT NOT NULL,
        sample_code TEXT NOT NULL DEFAULT '',
        raw_sequence TEXT NOT NULL,
        sequence_length INTEGER NOT NULL,
        gc_content REAL NOT NULL DEFAULT 0,
        mean_phred_quality REAL,
        abundance_count INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS taxonomy_reference (
        id TEXT PRIMARY KEY,
        database_name TEXT NOT NULL,
        version_tag TEXT NOT NULL DEFAULT '',
        marker_gene TEXT NOT NULL DEFAULT '',
        accession_prefix TEXT NOT NULL DEFAULT '',
        api_endpoint TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS species (
        id TEXT PRIMARY KEY,
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
        detection_frequency INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS taxonomy_results (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        sequence_record_id TEXT,
        owner_uid TEXT NOT NULL,
        sequence_identifier TEXT NOT NULL,
        sample_code TEXT NOT NULL DEFAULT '',
        domain TEXT NOT NULL,
        kingdom TEXT NOT NULL,
        phylum TEXT NOT NULL,
        tax_class TEXT NOT NULL,
        tax_order TEXT NOT NULL,
        family TEXT NOT NULL,
        genus TEXT NOT NULL,
        species_name TEXT NOT NULL,
        taxonomic_id TEXT NOT NULL DEFAULT '',
        accession_number TEXT NOT NULL DEFAULT '',
        confidence_score REAL NOT NULL DEFAULT 0,
        identity_pct REAL NOT NULL DEFAULT 0,
        e_value TEXT NOT NULL DEFAULT '',
        abundance_count INTEGER NOT NULL DEFAULT 1,
        reference_database TEXT NOT NULL DEFAULT 'NCBI BLAST',
        identification_status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS biodiversity_metrics (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        project_id TEXT,
        owner_uid TEXT NOT NULL,
        sample_code TEXT NOT NULL DEFAULT 'ALL',
        species_richness INTEGER NOT NULL DEFAULT 0,
        total_individuals INTEGER NOT NULL DEFAULT 0,
        shannon_index REAL NOT NULL DEFAULT 0,
        simpson_index REAL NOT NULL DEFAULT 0,
        pielou_evenness REAL NOT NULL DEFAULT 0,
        alpha_diversity REAL NOT NULL DEFAULT 0,
        beta_bray_curtis_mean REAL,
        has_abundance_data INTEGER NOT NULL DEFAULT 0,
        limitations_note TEXT NOT NULL DEFAULT '',
        taxonomic_composition TEXT NOT NULL DEFAULT '[]',
        relative_abundance TEXT NOT NULL DEFAULT '[]',
        calculated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analysis_jobs (
        id TEXT PRIMARY KEY,
        dataset_id TEXT NOT NULL,
        owner_uid TEXT NOT NULL,
        job_type TEXT NOT NULL DEFAULT 'full_edna_pipeline',
        reference_database TEXT NOT NULL DEFAULT 'NCBI BLAST',
        status TEXT NOT NULL DEFAULT 'Uploaded',
        progress_pct INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS analysis_logs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        dataset_id TEXT NOT NULL,
        owner_uid TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS report_metadata (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        project_id TEXT,
        dataset_id TEXT,
        report_title TEXT NOT NULL,
        report_format TEXT NOT NULL,
        researcher_name TEXT NOT NULL DEFAULT '',
        summary_notes TEXT NOT NULL DEFAULT '',
        generated_at TEXT NOT NULL
      );
    `);

    this.seedReferenceData();
  }

  private seedReferenceData(): void {
    const refCountRow = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM taxonomy_reference').get() as { cnt: number };
    if (refCountRow.cnt === 0) {
      const now = new Date().toISOString();
      const refs = [
        {
          id: crypto.randomUUID(),
          database_name: 'NCBI BLAST',
          version_tag: 'nt_euk / core_nt 2026',
          marker_gene: 'COI, 12S, 16S, 18S, ITS',
          accession_prefix: 'NC_ / MK_ / AF_',
          api_endpoint: 'https://blast.ncbi.nlm.nih.gov/Blast.cgi',
          description: 'National Center for Biotechnology Information nucleotide sequence alignment service.',
        },
        {
          id: crypto.randomUUID(),
          database_name: 'NCBI Taxonomy',
          version_tag: 'Entrez Taxonomy v2',
          marker_gene: 'All Taxa',
          accession_prefix: 'txid',
          api_endpoint: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/',
          description: 'Curated phylogenetic classification and nomenclature hierarchy.',
        },
        {
          id: crypto.randomUUID(),
          database_name: 'SILVA',
          version_tag: 'SILVA 138.2 SSU/LSU',
          marker_gene: '16S / 18S rRNA',
          accession_prefix: 'NR_',
          api_endpoint: 'https://www.arb-silva.de/',
          description: 'High-quality ribosomal RNA sequence reference database for Bacteria, Archaea, and Eukarya.',
        },
        {
          id: crypto.randomUUID(),
          database_name: 'BOLD Systems',
          version_tag: 'BOLD v4 Public COI',
          marker_gene: 'COI-5P',
          accession_prefix: 'BOLD:',
          api_endpoint: 'https://v3.boldsystems.org/index.php/API_Public/',
          description: 'Barcode of Life Data System curated animal and eukaryotic COI barcode library.',
        },
        {
          id: crypto.randomUUID(),
          database_name: 'UNITE',
          version_tag: 'UNITE v10.0 ITS',
          marker_gene: 'ITS1 / ITS2',
          accession_prefix: 'SH',
          api_endpoint: 'https://unite.ut.ee/',
          description: 'Unified system for DNA-based fungal species identification.',
        },
      ];
      const stmt = this.sqlite.prepare(
        `INSERT INTO taxonomy_reference (id, database_name, version_tag, marker_gene, accession_prefix, api_endpoint, description, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      );
      for (const r of refs) {
        stmt.run(r.id, r.database_name, r.version_tag, r.marker_gene, r.accession_prefix, r.api_endpoint, r.description, now);
      }
    }

    const spCountRow = this.sqlite.prepare('SELECT COUNT(*) as cnt FROM species').get() as { cnt: number };
    if (spCountRow.cnt === 0) {
      const stmt = this.sqlite.prepare(
        `INSERT OR IGNORE INTO species (id, taxonomic_id, scientific_name, common_name, domain, kingdom, phylum, tax_class, tax_order, family, genus, species_epithet, reference_source, conservation_status, habitat_summary, detection_frequency)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      );
      for (const sp of CURATED_REFERENCE_TAXA) {
        stmt.run(
          crypto.randomUUID(),
          sp.taxonomicId,
          sp.scientificName,
          sp.commonName,
          sp.domain,
          sp.kingdom,
          sp.phylum,
          sp.taxClass,
          sp.taxOrder,
          sp.family,
          sp.genus,
          sp.speciesEpithet,
          sp.referenceDatabase,
          sp.conservationStatus,
          sp.habitatSummary,
        );
      }
    }
  }

  public getAdminPasscodeState(): { hasClaimedHash: boolean; record: { passcode_hash: string; passcode_salt: string; claimed_by_email: string } | null } {
    const row = this.sqlite
      .prepare('SELECT passcode_hash, passcode_salt, claimed_by_email FROM admin_security WHERE id = ?')
      .get('primary') as { passcode_hash: string; passcode_salt: string; claimed_by_email: string } | undefined;
    return { hasClaimedHash: Boolean(row), record: row || null };
  }

  public claimAdminPasscode(hash: string, salt: string, uid: string, email: string): boolean {
    const existing = this.getAdminPasscodeState();
    if (existing.hasClaimedHash) return false;
    this.sqlite
      .prepare(
        `INSERT INTO admin_security (id, passcode_hash, passcode_salt, claimed_by_uid, claimed_by_email, created_at)
         VALUES ('primary', ?, ?, ?, ?, ?)`,
      )
      .run(hash, salt, uid, email, new Date().toISOString());
    return true;
  }

  public async storeRawFile(datasetId: string, filename: string, buffer: Buffer): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
    const storagePath = `${datasetId}/${safeName}`;

    if (this.supabase) {
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'edna-datasets';
      const { error } = await this.supabase.storage.from(bucket).upload(storagePath, buffer, {
        upsert: true,
        contentType: 'text/plain',
      });
      if (!error) {
        return `supabase://${bucket}/${storagePath}`;
      }
    }

    const destDir = path.resolve(this.uploadDir, datasetId);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    const resolved = path.resolve(destDir, safeName);
    if (!resolved.startsWith(destDir + path.sep)) {
      throw new Error('Invalid file path');
    }
    fs.writeFileSync(resolved, buffer);
    return resolved;
  }

  // Projects
  public async listProjects(ownerUid: string, isAdmin: boolean): Promise<ResearchProjectRow[]> {
    if (this.supabase) {
      let query = this.supabase.from('research_projects').select('*').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as ResearchProjectRow[];
    }
    if (isAdmin) {
      return this.sqlite.prepare('SELECT * FROM research_projects ORDER BY created_at DESC').all() as unknown as ResearchProjectRow[];
    }
    return this.sqlite
      .prepare('SELECT * FROM research_projects WHERE owner_uid = ? ORDER BY created_at DESC')
      .all(ownerUid) as unknown as ResearchProjectRow[];
  }

  public async createProject(project: Omit<ResearchProjectRow, 'id' | 'created_at' | 'updated_at'>): Promise<ResearchProjectRow> {
    const now = new Date().toISOString();
    const row: ResearchProjectRow = {
      id: crypto.randomUUID(),
      ...project,
      created_at: now,
      updated_at: now,
    };
    if (this.supabase) {
      const { data, error } = await this.supabase.from('research_projects').insert(row).select().single();
      if (error) throw new Error(error.message);
      return data as ResearchProjectRow;
    }
    this.sqlite
      .prepare(
        `INSERT INTO research_projects (id, owner_uid, project_name, project_description, research_objective, study_location, start_date, end_date, environmental_type, researcher_name, researcher_institution, researcher_email, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.owner_uid,
        row.project_name,
        row.project_description,
        row.research_objective,
        row.study_location,
        row.start_date,
        row.end_date,
        row.environmental_type,
        row.researcher_name,
        row.researcher_institution,
        row.researcher_email,
        row.status,
        row.created_at,
        row.updated_at,
      );
    return row;
  }

  public async deleteProject(id: string, ownerUid: string, isAdmin: boolean): Promise<void> {
    if (this.supabase) {
      let query = this.supabase.from('research_projects').delete().eq('id', id);
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { error } = await query;
      if (error) throw new Error(error.message);
      return;
    }
    if (isAdmin) {
      this.sqlite.prepare('DELETE FROM research_projects WHERE id = ?').run(id);
    } else {
      this.sqlite.prepare('DELETE FROM research_projects WHERE id = ? AND owner_uid = ?').run(id, ownerUid);
    }
  }

  // Datasets
  public async listDatasets(ownerUid: string, isAdmin: boolean): Promise<DatasetRow[]> {
    if (this.supabase) {
      let query = this.supabase.from('datasets').select('*').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as DatasetRow[];
    }
    const rows = isAdmin
      ? (this.sqlite.prepare('SELECT * FROM datasets ORDER BY created_at DESC').all() as Record<string, unknown>[])
      : (this.sqlite
          .prepare('SELECT * FROM datasets WHERE owner_uid = ? ORDER BY created_at DESC')
          .all(ownerUid) as Record<string, unknown>[]);
    return rows.map((r) => ({
      ...(r as unknown as DatasetRow),
      has_abundance_data: Boolean(r.has_abundance_data),
      is_sample_demo: Boolean(r.is_sample_demo),
    }));
  }

  public async getDataset(id: string, ownerUid: string, isAdmin: boolean): Promise<DatasetRow | null> {
    if (this.supabase) {
      let query = this.supabase.from('datasets').select('*').eq('id', id);
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error(error.message);
      return data as DatasetRow | null;
    }
    const r = (
      isAdmin
        ? this.sqlite.prepare('SELECT * FROM datasets WHERE id = ?').get(id)
        : this.sqlite.prepare('SELECT * FROM datasets WHERE id = ? AND owner_uid = ?').get(id, ownerUid)
    ) as Record<string, unknown> | undefined;
    if (!r) return null;
    return {
      ...(r as unknown as DatasetRow),
      has_abundance_data: Boolean(r.has_abundance_data),
      is_sample_demo: Boolean(r.is_sample_demo),
    };
  }

  public async insertDataset(dataset: DatasetRow): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('datasets').insert(dataset);
      if (error) throw new Error(error.message);
      return;
    }
    this.sqlite
      .prepare(
        `INSERT INTO datasets (id, owner_uid, project_id, dataset_name, original_filename, file_format, file_size_bytes, storage_path, sample_id, collection_location, latitude, longitude, collection_date, environmental_type, sample_description, sequencing_platform, marker_gene, reference_database, additional_notes, processing_status, sequence_count, total_reads, mean_quality_score, has_abundance_data, is_sample_demo, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        dataset.id,
        dataset.owner_uid,
        dataset.project_id,
        dataset.dataset_name,
        dataset.original_filename,
        dataset.file_format,
        dataset.file_size_bytes,
        dataset.storage_path,
        dataset.sample_id,
        dataset.collection_location,
        dataset.latitude,
        dataset.longitude,
        dataset.collection_date,
        dataset.environmental_type,
        dataset.sample_description,
        dataset.sequencing_platform,
        dataset.marker_gene,
        dataset.reference_database,
        dataset.additional_notes,
        dataset.processing_status,
        dataset.sequence_count,
        dataset.total_reads,
        dataset.mean_quality_score,
        dataset.has_abundance_data ? 1 : 0,
        dataset.is_sample_demo ? 1 : 0,
        dataset.created_at,
        dataset.updated_at,
      );
  }

  public async updateDatasetStatus(id: string, status: string): Promise<void> {
    const now = new Date().toISOString();
    if (this.supabase) {
      const { error } = await this.supabase
        .from('datasets')
        .update({ processing_status: status, updated_at: now })
        .eq('id', id);
      if (error) throw new Error(error.message);
      return;
    }
    this.sqlite.prepare('UPDATE datasets SET processing_status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
  }

  public async deleteDataset(id: string, ownerUid: string, isAdmin: boolean): Promise<void> {
    if (this.supabase) {
      let query = this.supabase.from('datasets').delete().eq('id', id);
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { error } = await query;
      if (error) throw new Error(error.message);
      return;
    }
    if (isAdmin) {
      this.sqlite.prepare('DELETE FROM datasets WHERE id = ?').run(id);
    } else {
      this.sqlite.prepare('DELETE FROM datasets WHERE id = ? AND owner_uid = ?').run(id, ownerUid);
    }
    this.sqlite.prepare('DELETE FROM dna_sequences WHERE dataset_id = ?').run(id);
    this.sqlite.prepare('DELETE FROM taxonomy_results WHERE dataset_id = ?').run(id);
    this.sqlite.prepare('DELETE FROM biodiversity_metrics WHERE dataset_id = ?').run(id);
    this.sqlite.prepare('DELETE FROM analysis_jobs WHERE dataset_id = ?').run(id);
    this.sqlite.prepare('DELETE FROM analysis_logs WHERE dataset_id = ?').run(id);
  }

  public async insertSequences(rows: DnaSequenceRow[]): Promise<void> {
    if (rows.length === 0) return;
    if (this.supabase) {
      const { error } = await this.supabase.from('dna_sequences').insert(rows);
      if (error) throw new Error(error.message);
      return;
    }
    const stmt = this.sqlite.prepare(
      `INSERT INTO dna_sequences (id, dataset_id, owner_uid, sequence_identifier, sample_code, raw_sequence, sequence_length, gc_content, mean_phred_quality, abundance_count, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      stmt.run(
        r.id,
        r.dataset_id,
        r.owner_uid,
        r.sequence_identifier,
        r.sample_code,
        r.raw_sequence,
        r.sequence_length,
        r.gc_content,
        r.mean_phred_quality,
        r.abundance_count,
        r.created_at,
      );
    }
  }

  public async getSequencesForDataset(datasetId: string): Promise<DnaSequenceRow[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('dna_sequences').select('*').eq('dataset_id', datasetId);
      if (error) throw new Error(error.message);
      return (data || []) as DnaSequenceRow[];
    }
    return this.sqlite.prepare('SELECT * FROM dna_sequences WHERE dataset_id = ?').all(datasetId) as unknown as DnaSequenceRow[];
  }

  public async insertTaxonomyResults(rows: TaxonomyResultRow[]): Promise<void> {
    if (rows.length === 0) return;
    if (this.supabase) {
      const { error } = await this.supabase.from('taxonomy_results').insert(rows);
      if (error) throw new Error(error.message);
      return;
    }
    const stmt = this.sqlite.prepare(
      `INSERT INTO taxonomy_results (id, dataset_id, sequence_record_id, owner_uid, sequence_identifier, sample_code, domain, kingdom, phylum, tax_class, tax_order, family, genus, species_name, taxonomic_id, accession_number, confidence_score, identity_pct, e_value, abundance_count, reference_database, identification_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const r of rows) {
      stmt.run(
        r.id,
        r.dataset_id,
        r.sequence_record_id,
        r.owner_uid,
        r.sequence_identifier,
        r.sample_code,
        r.domain,
        r.kingdom,
        r.phylum,
        r.tax_class,
        r.tax_order,
        r.family,
        r.genus,
        r.species_name,
        r.taxonomic_id,
        r.accession_number,
        r.confidence_score,
        r.identity_pct,
        r.e_value,
        r.abundance_count,
        r.reference_database,
        r.identification_status,
        r.created_at,
      );
    }

    // Increment species detection frequency
    const incStmt = this.sqlite.prepare('UPDATE species SET detection_frequency = detection_frequency + 1 WHERE taxonomic_id = ?');
    for (const r of rows) {
      if (r.taxonomic_id) incStmt.run(r.taxonomic_id);
    }
  }

  public async listTaxonomyResults(ownerUid: string, isAdmin: boolean, datasetId?: string): Promise<TaxonomyResultRow[]> {
    if (this.supabase) {
      let query = this.supabase.from('taxonomy_results').select('*').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      if (datasetId) query = query.eq('dataset_id', datasetId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as TaxonomyResultRow[];
    }
    if (datasetId) {
      return isAdmin
        ? (this.sqlite.prepare('SELECT * FROM taxonomy_results WHERE dataset_id = ? ORDER BY confidence_score DESC').all(datasetId) as unknown as TaxonomyResultRow[])
        : (this.sqlite.prepare('SELECT * FROM taxonomy_results WHERE dataset_id = ? AND owner_uid = ? ORDER BY confidence_score DESC').all(datasetId, ownerUid) as unknown as TaxonomyResultRow[]);
    }
    return isAdmin
      ? (this.sqlite.prepare('SELECT * FROM taxonomy_results ORDER BY created_at DESC LIMIT 1000').all() as unknown as TaxonomyResultRow[])
      : (this.sqlite.prepare('SELECT * FROM taxonomy_results WHERE owner_uid = ? ORDER BY created_at DESC LIMIT 1000').all(ownerUid) as unknown as TaxonomyResultRow[]);
  }

  public async insertBiodiversityMetrics(row: BiodiversityMetricRow): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('biodiversity_metrics').insert(row);
      if (error) throw new Error(error.message);
      return;
    }
    this.sqlite
      .prepare(
        `INSERT INTO biodiversity_metrics (id, dataset_id, project_id, owner_uid, sample_code, species_richness, total_individuals, shannon_index, simpson_index, pielou_evenness, alpha_diversity, beta_bray_curtis_mean, has_abundance_data, limitations_note, taxonomic_composition, relative_abundance, calculated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.dataset_id,
        row.project_id,
        row.owner_uid,
        row.sample_code,
        row.species_richness,
        row.total_individuals,
        row.shannon_index,
        row.simpson_index,
        row.pielou_evenness,
        row.alpha_diversity,
        row.beta_bray_curtis_mean,
        row.has_abundance_data ? 1 : 0,
        row.limitations_note,
        JSON.stringify(row.taxonomic_composition),
        JSON.stringify(row.relative_abundance),
        row.calculated_at,
      );
  }

  public async listBiodiversityMetrics(ownerUid: string, isAdmin: boolean, datasetId?: string): Promise<BiodiversityMetricRow[]> {
    if (this.supabase) {
      let query = this.supabase.from('biodiversity_metrics').select('*').order('calculated_at', { ascending: false });
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      if (datasetId) query = query.eq('dataset_id', datasetId);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as BiodiversityMetricRow[];
    }
    let rows: Record<string, unknown>[];
    if (datasetId) {
      rows = (
        isAdmin
          ? this.sqlite.prepare('SELECT * FROM biodiversity_metrics WHERE dataset_id = ? ORDER BY calculated_at DESC').all(datasetId)
          : this.sqlite.prepare('SELECT * FROM biodiversity_metrics WHERE dataset_id = ? AND owner_uid = ? ORDER BY calculated_at DESC').all(datasetId, ownerUid)
      ) as Record<string, unknown>[];
    } else {
      rows = (
        isAdmin
          ? this.sqlite.prepare('SELECT * FROM biodiversity_metrics ORDER BY calculated_at DESC').all()
          : this.sqlite.prepare('SELECT * FROM biodiversity_metrics WHERE owner_uid = ? ORDER BY calculated_at DESC').all(ownerUid)
      ) as Record<string, unknown>[];
    }
    return rows.map((r) => ({
      ...(r as unknown as BiodiversityMetricRow),
      has_abundance_data: Boolean(r.has_abundance_data),
      taxonomic_composition: JSON.parse((r.taxonomic_composition as string) || '[]'),
      relative_abundance: JSON.parse((r.relative_abundance as string) || '[]'),
    }));
  }

  public async upsertAnalysisJob(job: AnalysisJobRow): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('analysis_jobs').upsert(job);
      if (error) throw new Error(error.message);
      return;
    }
    this.sqlite
      .prepare(
        `INSERT INTO analysis_jobs (id, dataset_id, owner_uid, job_type, reference_database, status, progress_pct, error_message, started_at, completed_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET status = excluded.status, progress_pct = excluded.progress_pct, error_message = excluded.error_message, started_at = excluded.started_at, completed_at = excluded.completed_at`,
      )
      .run(
        job.id,
        job.dataset_id,
        job.owner_uid,
        job.job_type,
        job.reference_database,
        job.status,
        job.progress_pct,
        job.error_message,
        job.started_at,
        job.completed_at,
        job.created_at,
      );
  }

  public async addAnalysisLog(log: Omit<AnalysisLogRow, 'id' | 'created_at'>): Promise<void> {
    const row: AnalysisLogRow = {
      id: crypto.randomUUID(),
      ...log,
      created_at: new Date().toISOString(),
    };
    if (this.supabase) {
      await this.supabase.from('analysis_logs').insert(row);
      return;
    }
    this.sqlite
      .prepare(
        `INSERT INTO analysis_logs (id, job_id, dataset_id, owner_uid, level, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, row.job_id, row.dataset_id, row.owner_uid, row.level, row.message, row.created_at);
  }

  public async listAnalysisJobs(ownerUid: string, isAdmin: boolean): Promise<AnalysisJobRow[]> {
    if (this.supabase) {
      let query = this.supabase.from('analysis_jobs').select('*').order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as AnalysisJobRow[];
    }
    return isAdmin
      ? (this.sqlite.prepare('SELECT * FROM analysis_jobs ORDER BY created_at DESC').all() as unknown as AnalysisJobRow[])
      : (this.sqlite.prepare('SELECT * FROM analysis_jobs WHERE owner_uid = ? ORDER BY created_at DESC').all(ownerUid) as unknown as AnalysisJobRow[]);
  }

  public async listSpeciesCatalog(): Promise<SpeciesCatalogRow[]> {
    if (this.supabase) {
      const { data } = await this.supabase.from('species').select('*').order('scientific_name');
      if (data && data.length > 0) return data as SpeciesCatalogRow[];
    }
    return this.sqlite.prepare('SELECT * FROM species ORDER BY scientific_name').all() as unknown as SpeciesCatalogRow[];
  }

  public async listTaxonomyReferences(): Promise<TaxonomyRefRow[]> {
    if (this.supabase) {
      const { data } = await this.supabase.from('taxonomy_reference').select('*').order('database_name');
      if (data && data.length > 0) return data as TaxonomyRefRow[];
    }
    const rows = this.sqlite.prepare('SELECT * FROM taxonomy_reference ORDER BY database_name').all() as Record<string, unknown>[];
    return rows.map((r) => ({ ...(r as unknown as TaxonomyRefRow), is_active: Boolean(r.is_active) }));
  }

  public async recordReport(report: Omit<ReportMetadataRow, 'id' | 'generated_at'>): Promise<ReportMetadataRow> {
    const row: ReportMetadataRow = {
      id: crypto.randomUUID(),
      ...report,
      generated_at: new Date().toISOString(),
    };
    if (this.supabase) {
      const { data, error } = await this.supabase.from('report_metadata').insert(row).select().single();
      if (error) throw new Error(error.message);
      return data as ReportMetadataRow;
    }
    this.sqlite
      .prepare(
        `INSERT INTO report_metadata (id, owner_uid, project_id, dataset_id, report_title, report_format, researcher_name, summary_notes, generated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        row.id,
        row.owner_uid,
        row.project_id,
        row.dataset_id,
        row.report_title,
        row.report_format,
        row.researcher_name,
        row.summary_notes,
        row.generated_at,
      );
    return row;
  }

  public async listReports(ownerUid: string, isAdmin: boolean): Promise<ReportMetadataRow[]> {
    if (this.supabase) {
      let query = this.supabase.from('report_metadata').select('*').order('generated_at', { ascending: false });
      if (!isAdmin) query = query.eq('owner_uid', ownerUid);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []) as ReportMetadataRow[];
    }
    return isAdmin
      ? (this.sqlite.prepare('SELECT * FROM report_metadata ORDER BY generated_at DESC').all() as unknown as ReportMetadataRow[])
      : (this.sqlite.prepare('SELECT * FROM report_metadata WHERE owner_uid = ? ORDER BY generated_at DESC').all(ownerUid) as unknown as ReportMetadataRow[]);
  }

  public async deleteAllUserData(ownerUid: string): Promise<void> {
    if (this.supabase) {
      await this.supabase.from('report_metadata').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('analysis_logs').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('analysis_jobs').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('biodiversity_metrics').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('taxonomy_results').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('dna_sequences').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('datasets').delete().eq('owner_uid', ownerUid);
      await this.supabase.from('research_projects').delete().eq('owner_uid', ownerUid);
      return;
    }
    const tables = [
      'report_metadata',
      'analysis_logs',
      'analysis_jobs',
      'biodiversity_metrics',
      'taxonomy_results',
      'dna_sequences',
      'dataset_samples',
      'datasets',
      'research_projects',
    ];
    for (const t of tables) {
      this.sqlite.prepare(`DELETE FROM ${t} WHERE owner_uid = ?`).run(ownerUid);
    }
  }
}

export const store = new ScientificStore();

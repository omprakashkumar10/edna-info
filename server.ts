import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  checkLoginAttempt,
  clearLoginAttempts,
  recordFailedLoginAttempt,
  requireAuth,
  verifyPasscodeScrypt,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  calculateBiodiversityMetrics,
  classifySequencesAgainstReferences,
  generateSampleDemoDataset,
  hashPasswordScrypt,
  lookupNcbiTaxonomy,
  parseEdnaDataset,
  type ParsedSequence,
} from './server/bioinformatics.ts';
import { generateScientificInterpretation } from './server/gemini.ts';
import { store } from './server/store.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));

// API rate limiter
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' },
});

app.use('/api', apiLimiter);

// Multer configuration for eDNA sequence datasets
const ALLOWED_EXTENSIONS = new Set(['.csv', '.fasta', '.fa', '.fna', '.fastq', '.fq', '.tsv', '.txt']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      cb(new Error(`Unsupported file format "${ext}". Allowed: CSV, FASTA, FASTQ, TSV, TXT.`));
      return;
    }
    cb(null, true);
  },
});

// Public system configuration status (no secrets exposed)
app.get('/api/system/status', (_req, res) => {
  res.json({
    appName: 'eDNA BioScan',
    tagline: 'Discover. Analyze. Conserve.',
    supabaseConfigured: store.supabaseConfigured,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    storageMode: store.supabaseConfigured ? 'Supabase PostgreSQL' : 'Local Scientific SQLite Workspace',
    maxUploadMb: 25,
    allowedFormats: ['CSV', 'FASTA', 'FASTQ', 'TSV', 'TXT'],
  });
});

// Login rate limiting / account lockout guard
app.post('/api/auth/login-guard', (req, res) => {
  const { action, email } = req.body as { action?: 'check' | 'fail' | 'success'; email?: string };
  const identifier = typeof email === 'string' ? email : req.ip || 'unknown';

  if (action === 'check') {
    res.json(checkLoginAttempt(identifier));
    return;
  }
  if (action === 'fail') {
    res.json(recordFailedLoginAttempt(identifier));
    return;
  }
  if (action === 'success') {
    clearLoginAttempts(identifier);
    res.json({ allowed: true, remainingAttempts: 5, retryAfterSec: 0 });
    return;
  }
  res.status(400).json({ error: 'Invalid login-guard action.' });
});

// Check current authenticated user's server-verified privileges
app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  const envPasscodeSet = Boolean((process.env.ADMIN_PASSCODE || '').trim());
  const claimedState = store.getAdminPasscodeState();
  res.json({
    uid: req.user!.uid,
    email: req.user!.email,
    emailVerified: req.user!.emailVerified,
    isAdmin: req.user!.isAdmin,
    adminPasscodeConfigured: envPasscodeSet || claimedState.hasClaimedHash,
    adminPasscodeSource: envPasscodeSet ? 'env' : claimedState.hasClaimedHash ? 'claimed' : 'unclaimed',
  });
});

// Run pipeline asynchronously on stored dataset
async function executeAnalysisPipeline(params: {
  datasetId: string;
  jobId: string;
  ownerUid: string;
  projectId: string | null;
  referenceDatabase: string;
  parsedSequences: ParsedSequence[];
  hasAbundanceData: boolean;
  isSampleDemo: boolean;
}): Promise<void> {
  const { datasetId, jobId, ownerUid, projectId, referenceDatabase, parsedSequences, hasAbundanceData, isSampleDemo } =
    params;
  const now = () => new Date().toISOString();

  try {
    await store.updateDatasetStatus(datasetId, 'Validating');
    await store.upsertAnalysisJob({
      id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      job_type: 'full_edna_pipeline',
      reference_database: referenceDatabase,
      status: 'Validating',
      progress_pct: 20,
      error_message: null,
      started_at: now(),
      completed_at: null,
      created_at: now(),
    });
    await store.addAnalysisLog({
      job_id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      level: 'info',
      message: `Validated ${parsedSequences.length} sequences. Quality metrics computed.`,
    });

    await store.updateDatasetStatus(datasetId, 'Processing');
    await store.upsertAnalysisJob({
      id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      job_type: 'full_edna_pipeline',
      reference_database: referenceDatabase,
      status: 'Processing',
      progress_pct: 60,
      error_message: null,
      started_at: now(),
      completed_at: null,
      created_at: now(),
    });

    const seqRows = parsedSequences.map((s) => ({
      id: crypto.randomUUID(),
      dataset_id: datasetId,
      owner_uid: ownerUid,
      sequence_identifier: s.sequenceIdentifier,
      sample_code: s.sampleCode,
      raw_sequence: s.rawSequence,
      sequence_length: s.sequenceLength,
      gc_content: s.gcContent,
      mean_phred_quality: s.meanPhredQuality,
      abundance_count: s.abundanceCount,
      created_at: now(),
    }));
    await store.insertSequences(seqRows);

    const matches = classifySequencesAgainstReferences(parsedSequences, referenceDatabase, isSampleDemo);
    const taxRows = matches.map((m, idx) => ({
      id: crypto.randomUUID(),
      dataset_id: datasetId,
      sequence_record_id: seqRows[idx]?.id || null,
      owner_uid: ownerUid,
      sequence_identifier: m.sequenceIdentifier,
      sample_code: m.sampleCode,
      domain: m.domain,
      kingdom: m.kingdom,
      phylum: m.phylum,
      tax_class: m.taxClass,
      tax_order: m.taxOrder,
      family: m.family,
      genus: m.genus,
      species_name: m.speciesName,
      taxonomic_id: m.taxonomicId,
      accession_number: m.accessionNumber,
      confidence_score: m.confidenceScore,
      identity_pct: m.identityPct,
      e_value: m.eValue,
      abundance_count: m.abundanceCount,
      reference_database: m.referenceDatabase,
      identification_status: m.identificationStatus,
      created_at: now(),
    }));
    await store.insertTaxonomyResults(taxRows);

    const bio = calculateBiodiversityMetrics(matches, hasAbundanceData);
    await store.insertBiodiversityMetrics({
      id: crypto.randomUUID(),
      dataset_id: datasetId,
      project_id: projectId,
      owner_uid: ownerUid,
      sample_code: bio.sampleCode,
      species_richness: bio.speciesRichness,
      total_individuals: bio.totalIndividuals,
      shannon_index: bio.shannonIndex,
      simpson_index: bio.simpsonIndex,
      pielou_evenness: bio.pielouEvenness,
      alpha_diversity: bio.alphaDiversity,
      beta_bray_curtis_mean: bio.betaBrayCurtisMean,
      has_abundance_data: bio.hasAbundanceData,
      limitations_note: bio.limitationsNote,
      taxonomic_composition: bio.taxonomicComposition,
      relative_abundance: bio.relativeAbundance,
      calculated_at: now(),
    });

    await store.updateDatasetStatus(datasetId, 'Completed');
    await store.upsertAnalysisJob({
      id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      job_type: 'full_edna_pipeline',
      reference_database: referenceDatabase,
      status: 'Completed',
      progress_pct: 100,
      error_message: null,
      started_at: now(),
      completed_at: now(),
      created_at: now(),
    });
    await store.addAnalysisLog({
      job_id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      level: 'info',
      message: `Pipeline completed: ${bio.speciesRichness} distinct taxa identified; Shannon H'=${bio.shannonIndex}.`,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Pipeline execution error';
    await store.updateDatasetStatus(datasetId, 'Failed');
    await store.upsertAnalysisJob({
      id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      job_type: 'full_edna_pipeline',
      reference_database: referenceDatabase,
      status: 'Failed',
      progress_pct: 100,
      error_message: errMsg,
      started_at: now(),
      completed_at: now(),
      created_at: now(),
    });
    await store.addAnalysisLog({
      job_id: jobId,
      dataset_id: datasetId,
      owner_uid: ownerUid,
      level: 'error',
      message: errMsg,
    });
  }
}

// Research Projects CRUD
app.get('/api/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await store.listProjects(req.user!.uid, req.user!.isAdmin && req.query.scope === 'all');
    res.json({ projects: rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list projects' });
  }
});

app.post('/api/projects', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as Record<string, string>;
    const projectName = (body.projectName || '').trim();
    if (projectName.length < 2 || projectName.length > 200) {
      res.status(400).json({ error: 'Project Name must be between 2 and 200 characters.' });
      return;
    }
    const envTypes = new Set(['Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other']);
    const environmentalType = envTypes.has(body.environmentalType) ? body.environmentalType : 'Freshwater';

    const created = await store.createProject({
      owner_uid: req.user!.uid,
      project_name: projectName,
      project_description: (body.projectDescription || '').slice(0, 2000),
      research_objective: (body.researchObjective || '').slice(0, 1000),
      study_location: (body.studyLocation || '').slice(0, 200),
      start_date: body.startDate || null,
      end_date: body.endDate || null,
      environmental_type: environmentalType,
      researcher_name: (body.researcherName || '').slice(0, 120),
      researcher_institution: (body.researcherInstitution || '').slice(0, 200),
      researcher_email: req.user!.email,
      status: 'active',
    });
    res.status(201).json({ project: created });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create project' });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await store.deleteProject(req.params.id, req.user!.uid, req.user!.isAdmin);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete project' });
  }
});

// Datasets Upload & Management
app.get('/api/datasets', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const datasets = await store.listDatasets(req.user!.uid, req.user!.isAdmin && req.query.scope === 'all');
    res.json({ datasets });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list datasets' });
  }
});

app.get('/api/datasets/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const dataset = await store.getDataset(req.params.id, req.user!.uid, req.user!.isAdmin);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    const [sequences, taxonomy, metrics] = await Promise.all([
      store.getSequencesForDataset(dataset.id),
      store.listTaxonomyResults(req.user!.uid, req.user!.isAdmin, dataset.id),
      store.listBiodiversityMetrics(req.user!.uid, req.user!.isAdmin, dataset.id),
    ]);
    res.json({
      dataset,
      sequences: sequences.slice(0, 200),
      taxonomy,
      metrics: metrics[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load dataset details' });
  }
});

app.post('/api/datasets/upload', requireAuth, upload.array('files', 5), async (req: AuthenticatedRequest, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'Please select at least one eDNA dataset file (FASTA, FASTQ, CSV, TSV, or TXT).' });
      return;
    }

    const body = req.body as Record<string, string>;
    const baseName = (body.datasetName || '').trim();
    if (baseName.length < 2) {
      res.status(400).json({ error: 'Dataset Name is required (minimum 2 characters).' });
      return;
    }

    const envTypes = new Set(['Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other']);
    const environmentalType = envTypes.has(body.environmentalType) ? body.environmentalType : 'Freshwater';
    const sampleId = (body.sampleId || 'SAMPLE-01').trim();
    const referenceDatabase = (body.referenceDatabase || 'NCBI BLAST').trim();
    const runAnalysis = body.runAnalysis !== 'false';

    const createdDatasets = [];

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const textContent = file.buffer.toString('utf-8');
      const parsed = parseEdnaDataset(file.originalname, textContent, sampleId);

      if (parsed.sequences.length === 0) {
        res.status(400).json({
          error: `File "${file.originalname}" did not contain any valid DNA sequences (>= 10 bp).`,
          warnings: parsed.warnings,
        });
        return;
      }

      const datasetId = crypto.randomUUID();
      const jobId = crypto.randomUUID();
      const storagePath = await store.storeRawFile(datasetId, file.originalname, file.buffer);
      const now = new Date().toISOString();

      const datasetRow = {
        id: datasetId,
        owner_uid: req.user!.uid,
        project_id: body.projectId || null,
        dataset_name: files.length > 1 ? `${baseName} (${idx + 1})` : baseName,
        original_filename: file.originalname,
        file_format: parsed.fileFormat,
        file_size_bytes: file.size,
        storage_path: storagePath,
        sample_id: sampleId,
        collection_location: (body.collectionLocation || '').slice(0, 200),
        latitude: body.latitude ? parseFloat(body.latitude) : null,
        longitude: body.longitude ? parseFloat(body.longitude) : null,
        collection_date: body.collectionDate || null,
        environmental_type: environmentalType,
        sample_description: (body.sampleDescription || '').slice(0, 1000),
        sequencing_platform: (body.sequencingPlatform || '').slice(0, 120),
        marker_gene: (body.markerGene || '').slice(0, 120),
        reference_database: referenceDatabase,
        additional_notes: (body.additionalNotes || '').slice(0, 1000),
        processing_status: runAnalysis ? 'Queued' : 'Uploaded',
        sequence_count: parsed.sequences.length,
        total_reads: parsed.totalReads,
        mean_quality_score: parsed.meanQualityScore,
        has_abundance_data: parsed.hasAbundanceData,
        is_sample_demo: false,
        created_at: now,
        updated_at: now,
      };

      await store.insertDataset(datasetRow);
      await store.upsertAnalysisJob({
        id: jobId,
        dataset_id: datasetId,
        owner_uid: req.user!.uid,
        job_type: 'full_edna_pipeline',
        reference_database: referenceDatabase,
        status: runAnalysis ? 'Queued' : 'Uploaded',
        progress_pct: runAnalysis ? 10 : 0,
        error_message: null,
        started_at: null,
        completed_at: null,
        created_at: now,
      });

      if (runAnalysis) {
        await executeAnalysisPipeline({
          datasetId,
          jobId,
          ownerUid: req.user!.uid,
          projectId: datasetRow.project_id,
          referenceDatabase,
          parsedSequences: parsed.sequences,
          hasAbundanceData: parsed.hasAbundanceData,
          isSampleDemo: false,
        });
      } else {
        await store.insertSequences(
          parsed.sequences.map((s) => ({
            id: crypto.randomUUID(),
            dataset_id: datasetId,
            owner_uid: req.user!.uid,
            sequence_identifier: s.sequenceIdentifier,
            sample_code: s.sampleCode,
            raw_sequence: s.rawSequence,
            sequence_length: s.sequenceLength,
            gc_content: s.gcContent,
            mean_phred_quality: s.meanPhredQuality,
            abundance_count: s.abundanceCount,
            created_at: now,
          })),
        );
      }

      const updatedDataset = await store.getDataset(datasetId, req.user!.uid, req.user!.isAdmin);
      createdDatasets.push(updatedDataset || datasetRow);
    }

    res.status(201).json({ datasets: createdDatasets });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Upload failed' });
  }
});

// Load clearly labelled Sample Demonstration Dataset
app.post('/api/datasets/load-demo', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const preset = (req.body as { preset?: 'freshwater' | 'marine' | 'soil' }).preset || 'freshwater';
    const demo = generateSampleDemoDataset(preset);
    const parsed = parseEdnaDataset(demo.filename, demo.content, 'DEMO-S1');
    const datasetId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const storagePath = await store.storeRawFile(datasetId, demo.filename, Buffer.from(demo.content, 'utf-8'));
    const now = new Date().toISOString();

    const datasetRow = {
      id: datasetId,
      owner_uid: req.user!.uid,
      project_id: null,
      dataset_name: demo.datasetName,
      original_filename: demo.filename,
      file_format: parsed.fileFormat,
      file_size_bytes: Buffer.byteLength(demo.content, 'utf-8'),
      storage_path: storagePath,
      sample_id: 'DEMO-S1',
      collection_location: demo.collectionLocation,
      latitude: null,
      longitude: null,
      collection_date: now.slice(0, 10),
      environmental_type: demo.environmentalType,
      sample_description: 'Curated sample demonstration eDNA transect dataset for workflow exploration.',
      sequencing_platform: demo.sequencingPlatform,
      marker_gene: demo.markerGene,
      reference_database: demo.referenceDatabase,
      additional_notes: 'Sample Demonstration Mode — clearly labelled sample reference sequences.',
      processing_status: 'Queued',
      sequence_count: parsed.sequences.length,
      total_reads: parsed.totalReads,
      mean_quality_score: parsed.meanQualityScore,
      has_abundance_data: parsed.hasAbundanceData,
      is_sample_demo: true,
      created_at: now,
      updated_at: now,
    };

    await store.insertDataset(datasetRow);
    await executeAnalysisPipeline({
      datasetId,
      jobId,
      ownerUid: req.user!.uid,
      projectId: null,
      referenceDatabase: demo.referenceDatabase,
      parsedSequences: parsed.sequences,
      hasAbundanceData: parsed.hasAbundanceData,
      isSampleDemo: true,
    });

    const finalDataset = await store.getDataset(datasetId, req.user!.uid, req.user!.isAdmin);
    res.status(201).json({ dataset: finalDataset });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load demonstration dataset' });
  }
});

// Trigger analysis on an Uploaded dataset
app.post('/api/datasets/:id/analyze', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const dataset = await store.getDataset(req.params.id, req.user!.uid, req.user!.isAdmin);
    if (!dataset) {
      res.status(404).json({ error: 'Dataset not found.' });
      return;
    }
    const seqs = await store.getSequencesForDataset(dataset.id);
    if (seqs.length === 0) {
      res.status(400).json({ error: 'Dataset has no parsed DNA sequences to analyze.' });
      return;
    }
    const jobId = crypto.randomUUID();
    await executeAnalysisPipeline({
      datasetId: dataset.id,
      jobId,
      ownerUid: dataset.owner_uid,
      projectId: dataset.project_id,
      referenceDatabase: (req.body as { referenceDatabase?: string }).referenceDatabase || dataset.reference_database,
      parsedSequences: seqs.map((s) => ({
        sequenceIdentifier: s.sequence_identifier,
        sampleCode: s.sample_code,
        rawSequence: s.raw_sequence,
        sequenceLength: s.sequence_length,
        gcContent: s.gc_content,
        meanPhredQuality: s.mean_phred_quality,
        abundanceCount: s.abundance_count,
      })),
      hasAbundanceData: dataset.has_abundance_data,
      isSampleDemo: dataset.is_sample_demo,
    });
    const updated = await store.getDataset(dataset.id, req.user!.uid, req.user!.isAdmin);
    res.json({ dataset: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Analysis failed' });
  }
});

app.delete('/api/datasets/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await store.deleteDataset(req.params.id, req.user!.uid, req.user!.isAdmin);
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete dataset' });
  }
});

// Direct Taxonomy Identification & Live NCBI Taxonomy Query
app.post('/api/taxonomy/analyze-sequence', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { sequenceInput, referenceDatabase, sampleId } = req.body as {
      sequenceInput?: string;
      referenceDatabase?: string;
      sampleId?: string;
    };
    const raw = (sequenceInput || '').trim();
    if (raw.length < 15) {
      res.status(400).json({ error: 'Provide a valid FASTA or nucleotide sequence (>= 15 bp).' });
      return;
    }
    const content = raw.startsWith('>') ? raw : `>DIRECT_QUERY_01 sample=${sampleId || 'DIRECT-01'}\n${raw}`;
    const parsed = parseEdnaDataset('direct_query.fasta', content, sampleId || 'DIRECT-01');
    if (parsed.sequences.length === 0) {
      res.status(400).json({ error: 'No valid DNA nucleotides found in sequence input.' });
      return;
    }
    const matches = classifySequencesAgainstReferences(parsed.sequences, referenceDatabase || 'NCBI BLAST', false);
    res.json({
      parsedSummary: {
        sequenceCount: parsed.sequences.length,
        totalReads: parsed.totalReads,
      },
      results: matches,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Sequence classification failed' });
  }
});

app.get('/api/taxonomy/ncbi-lookup', requireAuth, async (req, res) => {
  const taxon = String(req.query.taxon || '').trim();
  if (taxon.length < 2) {
    res.status(400).json({ error: 'Taxon query parameter is required.' });
    return;
  }
  const result = await lookupNcbiTaxonomy(taxon);
  if (!result) {
    res.json({ found: false, message: 'No matching record returned from NCBI Entrez Taxonomy or request timed out.' });
    return;
  }
  res.json({ found: true, record: result });
});

app.get('/api/taxonomy/results', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
    const results = await store.listTaxonomyResults(
      req.user!.uid,
      req.user!.isAdmin && req.query.scope === 'all',
      datasetId,
    );
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch taxonomy results' });
  }
});

app.get('/api/biodiversity/metrics', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const datasetId = req.query.datasetId ? String(req.query.datasetId) : undefined;
    const metrics = await store.listBiodiversityMetrics(
      req.user!.uid,
      req.user!.isAdmin && req.query.scope === 'all',
      datasetId,
    );
    res.json({ metrics });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch biodiversity metrics' });
  }
});

app.get('/api/analysis/jobs', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const jobs = await store.listAnalysisJobs(req.user!.uid, req.user!.isAdmin && req.query.scope === 'all');
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load analysis jobs' });
  }
});

app.get('/api/species', requireAuth, async (_req, res) => {
  try {
    const species = await store.listSpeciesCatalog();
    res.json({ species });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load species catalog' });
  }
});

app.get('/api/references', requireAuth, async (_req, res) => {
  try {
    const references = await store.listTaxonomyReferences();
    res.json({ references });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load reference metadata' });
  }
});

app.get('/api/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const reports = await store.listReports(req.user!.uid, req.user!.isAdmin && req.query.scope === 'all');
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load reports' });
  }
});

app.post('/api/reports', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as {
      projectId?: string | null;
      datasetId?: string | null;
      reportTitle: string;
      reportFormat: 'PDF' | 'CSV' | 'Excel';
      researcherName?: string;
      summaryNotes?: string;
    };
    const report = await store.recordReport({
      owner_uid: req.user!.uid,
      project_id: body.projectId || null,
      dataset_id: body.datasetId || null,
      report_title: (body.reportTitle || 'eDNA BioScan Scientific Report').slice(0, 200),
      report_format: body.reportFormat || 'PDF',
      researcher_name: (body.researcherName || '').slice(0, 120),
      summary_notes: (body.summaryNotes || '').slice(0, 1000),
    });
    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to log report' });
  }
});

// Server-side Gemini AI scientific interpretation
app.post('/api/ai/interpret', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { mode, contextPayload } = req.body as { mode?: 'taxonomy' | 'biodiversity'; contextPayload?: string };
    if (!contextPayload || contextPayload.trim().length < 10) {
      res.status(400).json({ error: 'Context data is required for AI ecological interpretation.' });
      return;
    }
    const result = await generateScientificInterpretation({
      mode: mode === 'biodiversity' ? 'biodiversity' : 'taxonomy',
      contextPayload: contextPayload.slice(0, 6000),
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI interpretation error' });
  }
});

// Safe account data deletion
app.delete('/api/account/cleanup', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    await store.deleteAllUserData(req.user!.uid);
    res.json({ cleaned: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Account cleanup failed' });
  }
});

// Hidden Control Center Admin Routes (/api/admin/*)
app.post('/api/admin/claim-passcode', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode) {
    res.status(409).json({ error: 'ADMIN_PASSCODE is already configured in server environment secrets.' });
    return;
  }
  const { passcode } = req.body as { passcode?: string };
  if (!passcode || passcode.length < 8) {
    res.status(400).json({ error: 'Control Center passcode must be at least 8 characters.' });
    return;
  }
  const { hash, salt } = hashPasswordScrypt(passcode);
  const ok = store.claimAdminPasscode(hash, salt, req.user!.uid, req.user!.email);
  if (!ok) {
    res.status(409).json({ error: 'Admin Control Center passcode has already been claimed.' });
    return;
  }
  res.json({ claimed: true });
});

app.post('/api/admin/verify-passcode', requireAuth, (req: AuthenticatedRequest, res) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  const { passcode } = req.body as { passcode?: string };
  if (!passcode) {
    res.status(400).json({ error: 'Passcode is required.' });
    return;
  }
  const envPasscode = (process.env.ADMIN_PASSCODE || '').trim();
  if (envPasscode) {
    const a = Buffer.from(passcode);
    const b = Buffer.from(envPasscode);
    const match = a.length === b.length && crypto.timingSafeEqual(a, b);
    if (!match) {
      res.status(403).json({ error: 'Invalid Control Center passcode.' });
      return;
    }
    res.json({ verified: true });
    return;
  }
  const state = store.getAdminPasscodeState();
  if (!state.record) {
    res.status(400).json({ error: 'Control Center passcode has not been claimed yet.' });
    return;
  }
  const match = verifyPasscodeScrypt(passcode, state.record.passcode_hash, state.record.passcode_salt);
  if (!match) {
    res.status(403).json({ error: 'Invalid Control Center passcode.' });
    return;
  }
  res.json({ verified: true });
});

app.get('/api/admin/overview', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!req.user!.isAdmin) {
    res.status(403).json({ error: 'Forbidden: Administrator role verified server-side is required.' });
    return;
  }
  try {
    const [datasets, jobs, projects, references] = await Promise.all([
      store.listDatasets(req.user!.uid, true),
      store.listAnalysisJobs(req.user!.uid, true),
      store.listProjects(req.user!.uid, true),
      store.listTaxonomyReferences(),
    ]);
    const totalBytes = datasets.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0);
    res.json({
      stats: {
        totalDatasets: datasets.length,
        totalAnalyses: jobs.length,
        completedAnalyses: jobs.filter((j) => j.status === 'Completed').length,
        failedAnalyses: jobs.filter((j) => j.status === 'Failed').length,
        totalProjects: projects.length,
        storageBytes: totalBytes,
      },
      datasets,
      jobs,
      projects,
      references,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Admin overview failed' });
  }
});

// Start Vite middleware in development or serve built dist/ in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`eDNA BioScan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

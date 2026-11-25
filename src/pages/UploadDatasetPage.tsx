import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileCode2, UploadCloud, X } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { apiFetch, uploadDatasetsWithProgress } from '../lib/api';
import type { DatasetRecord, ResearchProject } from '../types';

interface UploadProps {
  onUploadComplete: (datasetId: string) => void;
}

const ALLOWED_EXT = ['.csv', '.fasta', '.fa', '.fna', '.fastq', '.fq', '.tsv', '.txt'];

export const UploadDatasetPage: React.FC<UploadProps> = ({ onUploadComplete }) => {
  const { createNotification, preferences } = useApp();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const [meta, setMeta] = useState({
    datasetName: '',
    projectId: '',
    sampleId: 'SAMPLE-01',
    collectionLocation: '',
    collectionDate: new Date().toISOString().slice(0, 10),
    environmentalType: 'Freshwater',
    sampleDescription: '',
    sequencingPlatform: 'Illumina MiSeq 2x300 bp',
    markerGene: 'COI / 12S rRNA',
    referenceDatabase: (preferences?.defaultReferenceDb || 'NCBI BLAST') as string,
    additionalNotes: '',
    runAnalysis: true,
  });

  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    apiFetch<{ projects: ResearchProject[] }>('/api/projects')
      .then((res) => setProjects(res.projects || []))
      .catch(() => {});
  }, []);

  const validateAndAddFiles = async (incoming: FileList | File[]) => {
    setErrorMsg('');
    const list = Array.from(incoming);
    const accepted: File[] = [];

    for (const f of list) {
      const ext = `.${f.name.split('.').pop()?.toLowerCase() || ''}`;
      if (!ALLOWED_EXT.includes(ext)) {
        setErrorMsg(`File "${f.name}" is not supported. Accepted formats: CSV, FASTA, FASTQ, TSV, TXT.`);
        return;
      }
      if (f.size > 25 * 1024 * 1024) {
        setErrorMsg(`File "${f.name}" exceeds the 25 MB upload limit.`);
        return;
      }
      accepted.push(f);
    }

    const combined = [...files, ...accepted].slice(0, 5);
    setFiles(combined);

    if (combined.length > 0 && !meta.datasetName) {
      setMeta((prev) => ({ ...prev, datasetName: combined[0].name.replace(/\.[^.]+$/, '') }));
    }

    if (accepted[0]) {
      const slice = accepted[0].slice(0, 4096);
      const txt = await slice.text();
      setPreviewText(txt.split('\n').slice(0, 18).join('\n'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setStatusMessage('');

    if (files.length === 0) {
      setErrorMsg('Please select or drop at least one sequence dataset file.');
      return;
    }
    if (meta.datasetName.trim().length < 2) {
      setErrorMsg('Please provide a Dataset Name.');
      return;
    }

    setSubmitting(true);
    setUploadProgress(5);
    setStatusMessage('Uploading and validating sequence file...');

    try {
      const fd = new FormData();
      files.forEach((f) => fd.append('files', f));
      Object.entries(meta).forEach(([k, v]) => fd.append(k, String(v)));

      const result = await uploadDatasetsWithProgress(fd, (pct) => {
        setUploadProgress(pct);
        if (pct === 100) {
          setStatusMessage(
            meta.runAnalysis
              ? 'File uploaded. Running taxonomy alignment and biodiversity pipeline...'
              : 'File validated and stored as Uploaded.',
          );
        }
      });

      const created = (result.datasets || []) as DatasetRecord[];
      const first = created[0];
      if (first) {
        await createNotification({
          type: first.processing_status === 'Completed' ? 'analysis_completed' : 'upload',
          title:
            first.processing_status === 'Completed'
              ? `Analysis Completed: ${first.dataset_name}`
              : `Dataset Uploaded: ${first.dataset_name}`,
          message: `Processed ${first.sequence_count} sequences (${first.file_format}) from ${first.sample_id}.`,
          linkView: 'datasets',
        });
        onUploadComplete(first.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Dataset upload failed';
      setErrorMsg(msg);
      await createNotification({
        type: 'analysis_failed',
        title: 'Dataset Upload / Pipeline Error',
        message: msg,
        linkView: 'upload',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadDemoPreset = async (preset: 'freshwater' | 'marine' | 'soil') => {
    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await apiFetch<{ dataset: DatasetRecord }>('/api/datasets/load-demo', {
        method: 'POST',
        body: JSON.stringify({ preset }),
      });
      await createNotification({
        type: 'analysis_completed',
        title: `Sample Demo Loaded: ${res.dataset.dataset_name}`,
        message: 'Sample demonstration dataset analyzed. Records are explicitly marked as Sample Demonstration Data.',
        linkView: 'datasets',
      });
      onUploadComplete(res.dataset.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load sample demo');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upload eDNA Dataset</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Ingest FASTA, FASTQ, CSV, TSV, or TXT files with full environmental and sequencing metadata.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLoadDemoPreset('freshwater')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Load Freshwater Demo
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLoadDemoPreset('marine')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Load Marine Demo
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleLoadDemoPreset('soil')}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Load Soil Demo
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-sm text-rose-800 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Drag & Drop + Preview */}
        <div className="lg:col-span-5 space-y-5">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files) validateAndAddFiles(e.dataTransfer.files);
            }}
            className={`p-8 rounded-2xl border-2 border-dashed text-center transition-colors ${
              dragActive
                ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
            }`}
          >
            <UploadCloud className="w-10 h-10 mx-auto text-emerald-700 dark:text-emerald-400 mb-3" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Drag and drop sequencing files here
            </p>
            <p className="text-xs text-slate-500 mt-1">
              FASTA, FASTQ, CSV, TSV, TXT · Up to 5 files (25 MB max each)
            </p>
            <label className="mt-4 inline-block px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg cursor-pointer">
              Browse Files
              <input
                type="file"
                multiple
                accept=".csv,.fasta,.fa,.fna,.fastq,.fq,.tsv,.txt"
                onChange={(e) => e.target.files && validateAndAddFiles(e.target.files)}
                className="hidden"
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Selected Files ({files.length})
              </h3>
              {files.map((f, idx) => (
                <div
                  key={`${f.name}-${idx}`}
                  className="flex items-center justify-between text-xs py-1.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="truncate font-medium">{f.name}</span>
                    <span className="font-mono text-slate-400">
                      ({(f.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    className="text-slate-400 hover:text-rose-600"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {previewText && (
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
              <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">File Content Preview</h3>
              <pre className="text-[11px] font-mono bg-slate-50 dark:bg-slate-950 p-3 rounded-lg overflow-x-auto max-h-56 text-slate-700 dark:text-slate-300">
                {previewText}
              </pre>
            </div>
          )}
        </div>

        {/* Right: Metadata Form */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Dataset & Sample Metadata</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Dataset Name *
              </label>
              <input
                type="text"
                required
                value={meta.datasetName}
                onChange={(e) => setMeta({ ...meta, datasetName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="Columbia River 12S Transect"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Research Project
              </label>
              <select
                value={meta.projectId}
                onChange={(e) => setMeta({ ...meta, projectId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                <option value="">Standalone Dataset (No Project)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.project_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sample ID *
              </label>
              <input
                type="text"
                required
                value={meta.sampleId}
                onChange={(e) => setMeta({ ...meta, sampleId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono"
                placeholder="SAMPLE-01"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Collection Date
              </label>
              <input
                type="date"
                value={meta.collectionDate}
                onChange={(e) => setMeta({ ...meta, collectionDate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Collection Location
              </label>
              <input
                type="text"
                value={meta.collectionLocation}
                onChange={(e) => setMeta({ ...meta, collectionLocation: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="Upper Estuary Station 4 (45.6N, 122.7W)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Environmental Type *
              </label>
              <select
                value={meta.environmentalType}
                onChange={(e) => setMeta({ ...meta, environmentalType: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {['Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other'].map((env) => (
                  <option key={env} value={env}>
                    {env}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sequencing Platform
              </label>
              <input
                type="text"
                value={meta.sequencingPlatform}
                onChange={(e) => setMeta({ ...meta, sequencingPlatform: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="Illumina MiSeq / Oxford Nanopore"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Marker Gene
              </label>
              <input
                type="text"
                value={meta.markerGene}
                onChange={(e) => setMeta({ ...meta, markerGene: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="COI, 12S rRNA, 16S rRNA, ITS2"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reference Database
              </label>
              <select
                value={meta.referenceDatabase}
                onChange={(e) => setMeta({ ...meta, referenceDatabase: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              >
                {['NCBI BLAST', 'NCBI Taxonomy', 'SILVA', 'BOLD Systems', 'UNITE'].map((dbName) => (
                  <option key={dbName} value={dbName}>
                    {dbName}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sample Description
              </label>
              <textarea
                rows={2}
                value={meta.sampleDescription}
                onChange={(e) => setMeta({ ...meta, sampleDescription: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="Filtration volume, filter pore size (0.45 µm), water temperature..."
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Additional Notes
              </label>
              <input
                type="text"
                value={meta.additionalNotes}
                onChange={(e) => setMeta({ ...meta, additionalNotes: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                placeholder="Field blank controls, extraction kit lot, etc."
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={meta.runAnalysis}
              onChange={(e) => setMeta({ ...meta, runAnalysis: e.target.checked })}
              className="rounded border-slate-300 text-emerald-700"
            />
            Automatically run taxonomy identification & biodiversity calculation after upload
          </label>

          {submitting && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>{statusMessage}</span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-700 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submitting ? 'Processing Dataset...' : 'Upload & Register Dataset'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

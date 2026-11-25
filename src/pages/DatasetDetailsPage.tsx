import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Play } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/api';
import { exportScientificPdfReport, exportTaxonomyCsv } from '../lib/reportGenerator';
import type {
  BiodiversityMetricRecord,
  DatasetRecord,
  DnaSequenceRecord,
  TaxonomyResultRecord,
} from '../types';

interface DetailsProps {
  datasetId: string;
  onBack: () => void;
}

export const DatasetDetailsPage: React.FC<DetailsProps> = ({ datasetId, onBack }) => {
  const { profile } = useApp();
  const [loading, setLoading] = useState(true);
  const [dataset, setDataset] = useState<DatasetRecord | null>(null);
  const [sequences, setSequences] = useState<DnaSequenceRecord[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResultRecord[]>([]);
  const [metrics, setMetrics] = useState<BiodiversityMetricRecord | null>(null);
  const [running, setRunning] = useState(false);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        dataset: DatasetRecord;
        sequences: DnaSequenceRecord[];
        taxonomy: TaxonomyResultRecord[];
        metrics: BiodiversityMetricRecord | null;
      }>(`/api/datasets/${datasetId}`);
      setDataset(res.dataset);
      setSequences(res.sequences || []);
      setTaxonomy(res.taxonomy || []);
      setMetrics(res.metrics || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [datasetId]);

  const handleRunAnalysis = async () => {
    setRunning(true);
    try {
      await apiFetch(`/api/datasets/${datasetId}/analyze`, { method: 'POST', body: JSON.stringify({}) });
      await loadDetails();
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />;
  }

  if (!dataset) {
    return (
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <p className="text-sm text-slate-600 dark:text-slate-400">Dataset not found.</p>
        <button type="button" onClick={onBack} className="mt-3 text-xs font-semibold text-emerald-800 hover:underline">
          Back to My Datasets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-emerald-800"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to My Datasets
          </button>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{dataset.dataset_name}</h2>
          <p className="text-xs text-slate-500 font-mono">
            {dataset.original_filename} · {dataset.file_format} · {dataset.sample_id} · Status: {dataset.processing_status}
            {dataset.is_sample_demo ? ' · Sample Demonstration Mode' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {dataset.processing_status !== 'Completed' && (
            <button
              type="button"
              disabled={running}
              onClick={handleRunAnalysis}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'Running Pipeline...' : 'Run Analysis'}
            </button>
          )}
          <button
            type="button"
            onClick={() => exportTaxonomyCsv(taxonomy, `${dataset.sample_id}_taxonomy.csv`)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportScientificPdfReport({
                title: `eDNA Analysis Report — ${dataset.dataset_name}`,
                researcher: profile,
                project: null,
                dataset,
                taxonomy,
                biodiversity: metrics,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF Report
          </button>
        </div>
      </div>

      {/* Metadata & Quality Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Parsed Sequences</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{dataset.sequence_count}</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Total Read Depth</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums">{dataset.total_reads}</p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Mean Phred Quality</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums">
            {dataset.mean_quality_score !== null ? `Q${dataset.mean_quality_score}` : 'N/A'}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-500">Shannon Diversity (H&apos;)</p>
          <p className="mt-1 text-2xl font-bold font-mono tabular-nums">
            {metrics ? metrics.shannon_index.toFixed(4) : 'Pending'}
          </p>
        </div>
      </div>

      {/* Sequence Quality Table */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Parsed DNA Sequences Preview ({sequences.length})
        </h3>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="py-2 pr-3">Sequence ID</th>
                <th className="py-2 pr-3">Sample</th>
                <th className="py-2 pr-3 text-right">Length (bp)</th>
                <th className="py-2 pr-3 text-right">GC %</th>
                <th className="py-2 pr-3 text-right">Abundance</th>
                <th className="py-2">Sequence Fragment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sequences.slice(0, 25).map((s) => (
                <tr key={s.id}>
                  <td className="py-2 pr-3 font-mono font-medium">{s.sequence_identifier}</td>
                  <td className="py-2 pr-3 font-mono">{s.sample_code}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{s.sequence_length}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{s.gc_content}%</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums">{s.abundance_count}</td>
                  <td className="py-2 font-mono text-[11px] text-slate-500 truncate max-w-[260px]">
                    {s.raw_sequence}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Taxonomy Results */}
      <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Taxonomic Assignments ({taxonomy.length})
        </h3>
        {taxonomy.length === 0 ? (
          <p className="text-xs text-slate-500">
            This dataset has not been analyzed yet. Click &ldquo;Run Analysis&rdquo; to execute classification.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                  <th className="py-2 pr-3">Sequence ID</th>
                  <th className="py-2 pr-3">Kingdom</th>
                  <th className="py-2 pr-3">Phylum</th>
                  <th className="py-2 pr-3">Family</th>
                  <th className="py-2 pr-3">Species</th>
                  <th className="py-2 pr-3 text-right">Confidence</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {taxonomy.map((t, i) => (
                  <tr key={t.id || i}>
                    <td className="py-2 pr-3 font-mono">{t.sequence_identifier}</td>
                    <td className="py-2 pr-3">{t.kingdom}</td>
                    <td className="py-2 pr-3">{t.phylum}</td>
                    <td className="py-2 pr-3">{t.family}</td>
                    <td className="py-2 pr-3 italic font-medium">{t.species_name}</td>
                    <td className="py-2 pr-3 text-right font-mono tabular-nums">{t.confidence_score}%</td>
                    <td className="py-2">{t.identification_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

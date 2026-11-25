import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Play, Search, Trash2, Upload } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { DashboardView, DatasetRecord } from '../types';

interface DatasetsProps {
  onOpenDataset: (id: string) => void;
  onNavigate: (view: DashboardView) => void;
}

export const DatasetsPage: React.FC<DatasetsProps> = ({ onOpenDataset, onNavigate }) => {
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [envFilter, setEnvFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets');
      setDatasets(res.datasets || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return datasets.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        d.dataset_name.toLowerCase().includes(q) ||
        d.original_filename.toLowerCase().includes(q) ||
        d.sample_id.toLowerCase().includes(q) ||
        d.collection_location.toLowerCase().includes(q);
      const matchEnv = envFilter === 'All' || d.environmental_type === envFilter;
      const matchStatus = statusFilter === 'All' || d.processing_status === statusFilter;
      return matchSearch && matchEnv && matchStatus;
    });
  }, [datasets, envFilter, search, statusFilter]);

  const handleAnalyze = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/datasets/${id}/analyze`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    try {
      await apiFetch(`/api/datasets/${id}`, { method: 'DELETE' });
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">My Datasets</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Inspect uploaded sequencing files, monitor pipeline status, and launch analyses.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('upload')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap shrink-0"
        >
          <Upload className="w-4 h-4" />
          Upload Dataset
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by dataset name, sample ID, or location..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>

        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {['All', 'Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other'].map((e) => (
            <option key={e} value={e}>
              Biome: {e}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {['All', 'Uploaded', 'Validating', 'Queued', 'Processing', 'Completed', 'Failed'].map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="h-48 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
          No datasets match the current filters.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 bg-slate-50 dark:bg-slate-950/60">
                <th className="py-3 px-4 font-medium">Dataset Name</th>
                <th className="py-3 px-4 font-medium">Format</th>
                <th className="py-3 px-4 font-medium">Biome</th>
                <th className="py-3 px-4 font-medium text-right">Sequences</th>
                <th className="py-3 px-4 font-medium text-right">Reads</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((ds) => (
                <tr key={ds.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onOpenDataset(ds.id)}
                      className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline text-left"
                    >
                      {ds.dataset_name}
                    </button>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {ds.sample_id} · {ds.original_filename}
                      {ds.is_sample_demo ? ' · Sample Demo' : ''}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono">{ds.file_format}</td>
                  <td className="py-3 px-4">{ds.environmental_type}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{ds.sequence_count}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">{ds.total_reads}</td>
                  <td className="py-3 px-4 font-medium">{ds.processing_status}</td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenDataset(ds.id)}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="View Dataset Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {ds.processing_status !== 'Completed' && (
                        <button
                          type="button"
                          disabled={busyId === ds.id}
                          onClick={() => handleAnalyze(ds.id)}
                          className="p-1.5 rounded border border-emerald-300 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                          title="Run Analysis Pipeline"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === ds.id}
                        onClick={() => handleDelete(ds.id)}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title="Delete Dataset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

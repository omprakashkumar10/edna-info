import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowRight, Upload } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type {
  AnalysisJobRecord,
  BiodiversityMetricRecord,
  DashboardView,
  DatasetRecord,
  TaxonomyResultRecord,
} from '../types';

interface OverviewProps {
  onNavigate: (view: DashboardView) => void;
  onOpenDataset: (id: string) => void;
}

const CHART_COLORS = ['#059669', '#0F766E', '#047857', '#10B981', '#0D9488', '#34D399'];

export const OverviewPage: React.FC<OverviewProps> = ({ onNavigate, onOpenDataset }) => {
  const [loading, setLoading] = useState(true);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResultRecord[]>([]);
  const [metrics, setMetrics] = useState<BiodiversityMetricRecord[]>([]);
  const [demoLoading, setDemoLoading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dsRes, jobRes, taxRes, bioRes] = await Promise.all([
        apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
        apiFetch<{ jobs: AnalysisJobRecord[] }>('/api/analysis/jobs'),
        apiFetch<{ results: TaxonomyResultRecord[] }>('/api/taxonomy/results'),
        apiFetch<{ metrics: BiodiversityMetricRecord[] }>('/api/biodiversity/metrics'),
      ]);
      setDatasets(dsRes.datasets || []);
      setJobs(jobRes.jobs || []);
      setTaxonomy(taxRes.results || []);
      setMetrics(bioRes.metrics || []);
    } catch {
      // handled gracefully with empty states
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleLoadSampleDemo = async (preset: 'freshwater' | 'marine' | 'soil') => {
    setDemoLoading(true);
    try {
      await apiFetch('/api/datasets/load-demo', {
        method: 'POST',
        body: JSON.stringify({ preset }),
      });
      await loadAll();
    } finally {
      setDemoLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const completed = jobs.filter((j) => j.status === 'Completed').length;
    const pending = jobs.filter((j) =>
      ['Uploaded', 'Validating', 'Queued', 'Processing'].includes(j.status),
    ).length;
    const identifiedTaxa = taxonomy.filter(
      (t) => (t.identification_status || t.identificationStatus) !== 'Unclassified',
    ).length;
    const uniqueSpecies = new Set(
      taxonomy
        .map((t) => t.species_name || t.speciesName || '')
        .filter((s) => s && s !== 'Unclassified'),
    ).size;
    const avgShannon =
      metrics.length > 0
        ? (metrics.reduce((acc, m) => acc + (m.shannon_index || 0), 0) / metrics.length).toFixed(3)
        : '0.000';

    return {
      totalDatasets: datasets.length,
      completed,
      identifiedTaxa,
      uniqueSpecies,
      avgShannon,
      pending,
    };
  }, [datasets, jobs, metrics, taxonomy]);

  const speciesDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of taxonomy) {
      const sp = r.species_name || r.speciesName || 'Unclassified';
      if (sp === 'Unclassified') continue;
      counts.set(sp, (counts.get(sp) || 0) + (r.abundance_count || r.abundanceCount || 1));
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([name, reads]) => ({ name, reads }));
  }, [taxonomy]);

  const kingdomComposition = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of taxonomy) {
      const k = r.kingdom || 'Unclassified';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [taxonomy]);

  const envBreakdown = useMemo(() => {
    const map = new Map<string, { env: string; datasets: number; avgShannon: number; sumShannon: number; cnt: number }>();
    for (const ds of datasets) {
      const cur = map.get(ds.environmental_type) || {
        env: ds.environmental_type,
        datasets: 0,
        avgShannon: 0,
        sumShannon: 0,
        cnt: 0,
      };
      cur.datasets += 1;
      const m = metrics.find((x) => x.dataset_id === ds.id);
      if (m) {
        cur.sumShannon += m.shannon_index;
        cur.cnt += 1;
        cur.avgShannon = Number((cur.sumShannon / cur.cnt).toFixed(3));
      }
      map.set(ds.environmental_type, cur);
    }
    return Array.from(map.values());
  }, [datasets, metrics]);

  const timelineData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const ds of datasets) {
      const day = ds.created_at.slice(0, 10);
      byDate.set(day, (byDate.get(day) || 0) + 1);
    }
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, uploads]) => ({ date, uploads }));
  }, [datasets]);

  const statusStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      counts.set(j.status, (counts.get(j.status) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
  }, [jobs]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-24 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
          <div className="h-72 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Datasets', value: kpis.totalDatasets, unit: 'files' },
          { label: 'Completed Analyses', value: kpis.completed, unit: 'jobs' },
          { label: 'Identified Taxa', value: kpis.identifiedTaxa, unit: 'sequences' },
          { label: 'Total Species', value: kpis.uniqueSpecies, unit: 'unique' },
          { label: "Biodiversity Index (H')", value: kpis.avgShannon, unit: 'mean' },
          { label: 'Pending Analyses', value: kpis.pending, unit: 'queued' },
        ].map((card) => (
          <div
            key={card.label}
            className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{card.label}</p>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                {card.value}
              </span>
              <span className="text-[11px] font-mono text-slate-400">{card.unit}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State with explicit Sample Demonstration option */}
      {datasets.length === 0 ? (
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-5">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            No eDNA Datasets Uploaded Yet
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Upload your own FASTA, FASTQ, CSV, TSV, or TXT sequencing files to run taxonomic identification and biodiversity calculations, or load a clearly labelled Sample Demonstration Dataset to inspect the scientific pipeline.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('upload')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              <Upload className="w-4 h-4" />
              Upload eDNA Dataset
            </button>
            <button
              type="button"
              disabled={demoLoading}
              onClick={() => handleLoadSampleDemo('freshwater')}
              className="px-4 py-2.5 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              {demoLoading ? 'Loading Sample Demo...' : 'Load Freshwater Sample Demo'}
            </button>
            <button
              type="button"
              disabled={demoLoading}
              onClick={() => handleLoadSampleDemo('marine')}
              className="px-4 py-2.5 text-sm font-medium border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Load Marine Sample Demo
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Visualizations Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Species Distribution */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Species Read Distribution
                </h2>
                <span className="text-xs text-slate-500">Top detected taxa</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={speciesDistribution} layout="vertical" margin={{ left: 20, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="reads" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Taxonomic Composition */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Taxonomic Composition (Kingdom)
                </h2>
                <span className="text-xs text-slate-500">Sequence count</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={kingdomComposition}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={86}
                      paddingAngle={2}
                      label={({ name, value }) => `${name} (${value})`}
                    >
                      {kingdomComposition.map((entry, idx) => (
                        <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographic / Environmental Biodiversity */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Biodiversity Comparison by Biome
                </h2>
                <span className="text-xs text-slate-500">Mean Shannon H&apos;</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={envBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="env" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="avgShannon" name="Mean Shannon H'" fill="#0F766E" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="datasets" name="Datasets" fill="#34D399" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Dataset Activity Timeline & Analysis Status */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dataset Activity Timeline & Job Completion
                </h2>
                <span className="text-xs text-slate-500 font-mono">
                  {statusStats.map((s) => `${s.status}: ${s.count}`).join(' · ')}
                </span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="uploads" stroke="#059669" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Uploads & Recent Analysis History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Uploads</h2>
                <button
                  type="button"
                  onClick={() => onNavigate('datasets')}
                  className="text-xs font-medium text-emerald-800 dark:text-emerald-400 inline-flex items-center gap-1 hover:underline"
                >
                  View all <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">Dataset</th>
                      <th className="py-2 pr-3 font-medium">Biome</th>
                      <th className="py-2 pr-3 font-medium text-right">Sequences</th>
                      <th className="py-2 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {datasets.slice(0, 5).map((ds) => (
                      <tr key={ds.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 pr-3">
                          <button
                            type="button"
                            onClick={() => onOpenDataset(ds.id)}
                            className="font-medium text-emerald-800 dark:text-emerald-400 hover:underline text-left"
                          >
                            {ds.dataset_name}
                          </button>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {ds.file_format} · {ds.sample_id}
                            {ds.is_sample_demo ? ' · Sample Demo' : ''}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{ds.environmental_type}</td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{ds.sequence_count}</td>
                        <td className="py-2.5 text-right font-medium">{ds.processing_status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Analysis History</h2>
                <button
                  type="button"
                  onClick={() => onNavigate('history')}
                  className="text-xs font-medium text-emerald-800 dark:text-emerald-400 inline-flex items-center gap-1 hover:underline"
                >
                  Full history <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">Reference DB</th>
                      <th className="py-2 pr-3 font-medium text-right">Progress</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {jobs.slice(0, 5).map((job) => (
                      <tr key={job.id}>
                        <td className="py-2.5 pr-3 font-medium text-slate-800 dark:text-slate-200">
                          {job.reference_database}
                        </td>
                        <td className="py-2.5 pr-3 text-right font-mono tabular-nums">{job.progress_pct}%</td>
                        <td className="py-2.5 pr-3">{job.status}</td>
                        <td className="py-2.5 text-right font-mono text-slate-500">
                          {job.created_at.slice(0, 10)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

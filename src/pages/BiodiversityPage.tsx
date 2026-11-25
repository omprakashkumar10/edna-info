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
import { AlertTriangle, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type {
  BiodiversityMetricRecord,
  DatasetRecord,
  ResearchProject,
  TaxonomyResultRecord,
} from '../types';

const COLORS = ['#059669', '#0F766E', '#047857', '#10B981', '#14B8A6', '#34D399'];

export const BiodiversityPage: React.FC = () => {
  const [metrics, setMetrics] = useState<BiodiversityMetricRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResultRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [compareDimension, setCompareDimension] = useState<
    'dataset' | 'location' | 'environment' | 'project' | 'date'
  >('dataset');
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>('ALL');

  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState<{ explanation: string; disclaimer: string } | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ metrics: BiodiversityMetricRecord[] }>('/api/biodiversity/metrics'),
      apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
      apiFetch<{ projects: ResearchProject[] }>('/api/projects'),
      apiFetch<{ results: TaxonomyResultRecord[] }>('/api/taxonomy/results'),
    ])
      .then(([mRes, dRes, pRes, tRes]) => {
        setMetrics(mRes.metrics || []);
        setDatasets(dRes.datasets || []);
        setProjects(pRes.projects || []);
        setTaxonomy(tRes.results || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeMetric = useMemo(() => {
    if (metrics.length === 0) return null;
    if (selectedDatasetId === 'ALL') return metrics[0];
    return metrics.find((m) => m.dataset_id === selectedDatasetId) || metrics[0];
  }, [metrics, selectedDatasetId]);

  const comparisonData = useMemo(() => {
    const groups = new Map<string, { label: string; shannonSum: number; simpsonSum: number; richnessSum: number; count: number }>();

    for (const m of metrics) {
      const ds = datasets.find((d) => d.id === m.dataset_id);
      const proj = projects.find((p) => p.id === (m.project_id || ds?.project_id));
      let key = ds?.dataset_name || m.dataset_id;
      if (compareDimension === 'location') key = ds?.collection_location || 'Unspecified Location';
      if (compareDimension === 'environment') key = ds?.environmental_type || 'Freshwater';
      if (compareDimension === 'project') key = proj?.project_name || 'Standalone';
      if (compareDimension === 'date') key = ds?.collection_date || ds?.created_at.slice(0, 10) || 'Undated';

      const cur = groups.get(key) || { label: key, shannonSum: 0, simpsonSum: 0, richnessSum: 0, count: 0 };
      cur.shannonSum += m.shannon_index;
      cur.simpsonSum += m.simpson_index;
      cur.richnessSum += m.species_richness;
      cur.count += 1;
      groups.set(key, cur);
    }

    return Array.from(groups.values()).map((g) => ({
      name: g.label.slice(0, 26),
      shannon: Number((g.shannonSum / g.count).toFixed(3)),
      simpson: Number((g.simpsonSum / g.count).toFixed(3)),
      richness: Number((g.richnessSum / g.count).toFixed(1)),
    }));
  }, [compareDimension, datasets, metrics, projects]);

  // Pairwise sample Bray-Curtis heatmap from taxonomy rows
  const betaHeatmap = useMemo(() => {
    const sampleMap = new Map<string, Map<string, number>>();
    for (const r of taxonomy) {
      const sp = r.species_name || r.speciesName || '';
      if (!sp || sp === 'Unclassified') continue;
      const sample = r.sample_code || r.sampleCode || 'SAMPLE-1';
      if (!sampleMap.has(sample)) sampleMap.set(sample, new Map());
      const spCounts = sampleMap.get(sample)!;
      spCounts.set(sp, (spCounts.get(sp) || 0) + (r.abundance_count || r.abundanceCount || 1));
    }

    const samples = Array.from(sampleMap.keys()).slice(0, 6);
    const matrix: { row: string; cols: { col: string; value: number }[] }[] = [];
    for (const a of samples) {
      const cols: { col: string; value: number }[] = [];
      for (const b of samples) {
        if (a === b) {
          cols.push({ col: b, value: 0 });
        } else {
          const mapA = sampleMap.get(a)!;
          const mapB = sampleMap.get(b)!;
          const keys = new Set([...mapA.keys(), ...mapB.keys()]);
          let minSum = 0;
          let totSum = 0;
          for (const k of keys) {
            const va = mapA.get(k) || 0;
            const vb = mapB.get(k) || 0;
            minSum += Math.min(va, vb);
            totSum += va + vb;
          }
          const bc = totSum > 0 ? 1 - (2 * minSum) / totSum : 0;
          cols.push({ col: b, value: Number(bc.toFixed(2)) });
        }
      }
      matrix.push({ row: a, cols });
    }
    return { samples, matrix };
  }, [taxonomy]);

  const handleInterpretBiodiversity = async () => {
    if (!activeMetric) return;
    setAiError('');
    setAiLoading(true);
    try {
      const summary = [
        `Species Richness (S): ${activeMetric.species_richness}`,
        `Total Individuals/Reads (N): ${activeMetric.total_individuals}`,
        `Shannon Index (H'): ${activeMetric.shannon_index}`,
        `Simpson Index (1-D): ${activeMetric.simpson_index}`,
        `Pielou Evenness (J'): ${activeMetric.pielou_evenness}`,
        `Beta Bray-Curtis Mean: ${activeMetric.beta_bray_curtis_mean ?? 'Single sample'}`,
        `Has Abundance Data: ${activeMetric.has_abundance_data}`,
        `Top Species: ${activeMetric.relative_abundance
          .slice(0, 6)
          .map((s) => `${s.species} (${s.relativePct}%)`)
          .join(', ')}`,
      ].join('\n');
      const res = await apiFetch<{ explanation: string; disclaimer: string }>('/api/ai/interpret', {
        method: 'POST',
        body: JSON.stringify({ mode: 'biodiversity', contextPayload: summary }),
      });
      setAiNote(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate interpretation.');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Biodiversity Assessment</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Quantitative alpha & beta diversity metrics computed directly from classified taxon abundance counts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="ALL">Latest Analyzed Dataset</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dataset_name}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!activeMetric || aiLoading}
            onClick={handleInterpretBiodiversity}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 rounded-lg"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? 'Interpreting...' : 'Interpret Metrics'}
          </button>
        </div>
      </div>

      {!activeMetric ? (
        <div className="p-8 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
          No biodiversity metrics computed yet. Upload and analyze an eDNA dataset to calculate community indices.
        </div>
      ) : (
        <>
          {/* Limitation Notice */}
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">
                {activeMetric.has_abundance_data ? 'Abundance-Weighted Calculation: ' : 'Presence / Absence Limitation: '}
              </span>
              {activeMetric.limitations_note}
            </div>
          </div>

          {/* 6 Quantitative Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Species Richness (S)', val: activeMetric.species_richness },
              { label: "Shannon Diversity (H')", val: activeMetric.shannon_index.toFixed(4) },
              { label: 'Simpson Index (1 - D)', val: activeMetric.simpson_index.toFixed(4) },
              { label: "Pielou's Evenness (J')", val: activeMetric.pielou_evenness.toFixed(4) },
              { label: 'Alpha Diversity', val: activeMetric.alpha_diversity.toFixed(4) },
              {
                label: 'Beta Bray-Curtis Mean',
                val:
                  activeMetric.beta_bray_curtis_mean !== null
                    ? activeMetric.beta_bray_curtis_mean.toFixed(4)
                    : 'Single Sample',
              },
            ].map((m) => (
              <div
                key={m.label}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{m.label}</p>
                <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {m.val}
                </p>
              </div>
            ))}
          </div>

          {(aiNote || aiError) && (
            <div className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
              <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                {aiNote?.disclaimer || 'AI Interpretation'}
              </div>
              {aiError ? (
                <p className="text-xs text-rose-700">{aiError}</p>
              ) : (
                <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line">{aiNote?.explanation}</p>
              )}
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Species Relative Abundance Bar */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold mb-4">Relative Species Abundance (%)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activeMetric.relative_abundance.slice(0, 8)} layout="vertical" margin={{ left: 25 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis type="number" unit="%" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="species" type="category" width={135} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="relativePct" name="Relative %" fill="#059669" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Taxonomic Composition Pie */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold mb-4">Taxonomic Composition Breakdown</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeMetric.taxonomic_composition}
                      dataKey="count"
                      nameKey="group"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={(props) => `${props.name ?? ''} (${((props.percent ?? 0) * 100).toFixed(1)}%)`}
                    >
                      {activeMetric.taxonomic_composition.map((entry, idx) => (
                        <Cell key={entry.group} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Multi-dimensional Comparison Chart */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold">Diversity Comparison Across Studies</h3>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {(
                    [
                      ['dataset', 'Samples'],
                      ['location', 'Locations'],
                      ['environment', 'Biomes'],
                      ['project', 'Projects'],
                      ['date', 'Dates'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCompareDimension(key)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        compareDimension === key
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="shannon" name="Shannon H'" stroke="#059669" strokeWidth={2.5} />
                    <Line type="monotone" dataKey="simpson" name="Simpson 1-D" stroke="#0F766E" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Beta Diversity Bray-Curtis Heatmap */}
          {betaHeatmap.samples.length > 1 && (
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Beta Diversity Dissimilarity Heatmap (Bray-Curtis)</h3>
                <span className="text-xs text-slate-500">0.00 = Identical community · 1.00 = Completely distinct</span>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs font-mono border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-500">Sample</th>
                      {betaHeatmap.samples.map((s) => (
                        <th key={s} className="p-2 text-center text-slate-500">
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {betaHeatmap.matrix.map((r) => (
                      <tr key={r.row}>
                        <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">{r.row}</td>
                        {r.cols.map((c) => {
                          const intensity = Math.round(c.value * 100);
                          return (
                            <td
                              key={c.col}
                              className="p-2.5 text-center border border-white dark:border-slate-900 tabular-nums"
                              style={{
                                backgroundColor: `rgba(5, 150, 105, ${0.1 + (intensity / 100) * 0.75})`,
                                color: intensity > 55 ? '#ffffff' : 'inherit',
                              }}
                            >
                              {c.value.toFixed(2)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Mathematical Definitions */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Mathematical Definitions & Ecological Formulations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-semibold text-emerald-800 dark:text-emerald-400">Shannon Index (H&apos;)</div>
                <div className="font-mono mt-1 text-slate-700 dark:text-slate-300">H&apos; = -Σ (p_i · ln p_i)</div>
                <p className="mt-1.5 text-slate-500">Measures entropy combining species richness and relative abundance.</p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-semibold text-emerald-800 dark:text-emerald-400">Simpson Index (1 - D)</div>
                <div className="font-mono mt-1 text-slate-700 dark:text-slate-300">1 - Σ [n_i(n_i-1) / N(N-1)]</div>
                <p className="mt-1.5 text-slate-500">Probability that two randomly sampled sequences belong to different species.</p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-semibold text-emerald-800 dark:text-emerald-400">Pielou&apos;s Evenness (J&apos;)</div>
                <div className="font-mono mt-1 text-slate-700 dark:text-slate-300">J&apos; = H&apos; / ln(S)</div>
                <p className="mt-1.5 text-slate-500">Quantifies how evenly sequence counts are distributed across detected taxa (0 to 1).</p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="font-semibold text-emerald-800 dark:text-emerald-400">Bray-Curtis Beta (BC)</div>
                <div className="font-mono mt-1 text-slate-700 dark:text-slate-300">1 - 2Σmin(n_ij,n_ik) / Σ(n_ij+n_ik)</div>
                <p className="mt-1.5 text-slate-500">Compositional turnover between pairs of sampling stations.</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

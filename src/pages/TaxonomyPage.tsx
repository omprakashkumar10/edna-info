import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpDown, Download, Globe, Search, Sparkles } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { exportTaxonomyCsv } from '../lib/reportGenerator';
import type { DatasetRecord, TaxonomyResultRecord } from '../types';

export const TaxonomyPage: React.FC = () => {
  const [results, setResults] = useState<TaxonomyResultRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Direct sequence analyzer
  const [seqInput, setSeqInput] = useState('');
  const [refDb, setRefDb] = useState('NCBI BLAST');
  const [analyzingSeq, setAnalyzingSeq] = useState(false);
  const [directMatches, setDirectMatches] = useState<TaxonomyResultRecord[]>([]);
  const [seqError, setSeqError] = useState('');

  // Live NCBI Taxonomy lookup
  const [ncbiQuery, setNcbiQuery] = useState('');
  const [ncbiLoading, setNcbiLoading] = useState(false);
  const [ncbiResult, setNcbiResult] = useState<{
    found: boolean;
    message?: string;
    record?: { taxId: string; scientificName: string; commonName: string; lineage: string };
  } | null>(null);

  // Table search, sort, filter, pagination
  const [search, setSearch] = useState('');
  const [datasetFilter, setDatasetFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'confidence' | 'species' | 'seq'>('confidence');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 12;

  // Gemini advisory ecological interpretation
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<{ explanation: string; disclaimer: string } | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ results: TaxonomyResultRecord[] }>('/api/taxonomy/results'),
      apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
    ])
      .then(([taxRes, dsRes]) => {
        setResults(taxRes.results || []);
        setDatasets(dsRes.datasets || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAnalyzeDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setSeqError('');
    setAnalyzingSeq(true);
    try {
      const res = await apiFetch<{ results: TaxonomyResultRecord[] }>('/api/taxonomy/analyze-sequence', {
        method: 'POST',
        body: JSON.stringify({ sequenceInput: seqInput, referenceDatabase: refDb }),
      });
      setDirectMatches(res.results || []);
    } catch (err) {
      setSeqError(err instanceof Error ? err.message : 'Failed to classify sequence.');
    } finally {
      setAnalyzingSeq(false);
    }
  };

  const handleNcbiLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ncbiQuery.trim()) return;
    setNcbiLoading(true);
    setNcbiResult(null);
    try {
      const res = await apiFetch<{
        found: boolean;
        message?: string;
        record?: { taxId: string; scientificName: string; commonName: string; lineage: string };
      }>(`/api/taxonomy/ncbi-lookup?taxon=${encodeURIComponent(ncbiQuery.trim())}`);
      setNcbiResult(res);
    } finally {
      setNcbiLoading(false);
    }
  };

  const combinedRows = useMemo(() => {
    return [...directMatches, ...results];
  }, [directMatches, results]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return combinedRows
      .filter((r) => {
        const seqId = (r.sequence_identifier || r.sequenceIdentifier || '').toLowerCase();
        const sp = (r.species_name || r.speciesName || '').toLowerCase();
        const fam = (r.family || '').toLowerCase();
        const phy = (r.phylum || '').toLowerCase();
        const status = r.identification_status || r.identificationStatus || '';
        const matchSearch = !q || seqId.includes(q) || sp.includes(q) || fam.includes(q) || phy.includes(q);
        const matchDataset = datasetFilter === 'All' || r.dataset_id === datasetFilter;
        const matchStatus = statusFilter === 'All' || status === statusFilter;
        return matchSearch && matchDataset && matchStatus;
      })
      .sort((a, b) => {
        const mult = sortDir === 'asc' ? 1 : -1;
        if (sortBy === 'confidence') {
          const ca = Number(a.confidence_score ?? a.confidenceScore ?? 0);
          const cb = Number(b.confidence_score ?? b.confidenceScore ?? 0);
          return (ca - cb) * mult;
        }
        if (sortBy === 'species') {
          const sa = a.species_name || a.speciesName || '';
          const sb = b.species_name || b.speciesName || '';
          return sa.localeCompare(sb) * mult;
        }
        const qa = a.sequence_identifier || a.sequenceIdentifier || '';
        const qb = b.sequence_identifier || b.sequenceIdentifier || '';
        return qa.localeCompare(qb) * mult;
      });
  }, [combinedRows, datasetFilter, search, sortBy, sortDir, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (col: 'confidence' | 'species' | 'seq') => {
    if (sortBy === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const handleGeminiExplain = async () => {
    setAiError('');
    setAiLoading(true);
    try {
      const sampleSummary = filtered
        .slice(0, 15)
        .map(
          (r) =>
            `${r.species_name || r.speciesName} (${r.phylum}, ${r.family}) — ${
              r.confidence_score ?? r.confidenceScore
            }% [${r.identification_status || r.identificationStatus}]`,
        )
        .join('\n');
      const res = await apiFetch<{ explanation: string; disclaimer: string }>('/api/ai/interpret', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'taxonomy',
          contextPayload: sampleSummary || 'No classified sequences available yet.',
        }),
      });
      setAiResponse(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Unable to generate AI ecological interpretation.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Taxonomy Identification Engine</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Classify DNA sequences across 8 taxonomic ranks with explicit reference status and NCBI verification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGeminiExplain}
            disabled={aiLoading || filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border border-emerald-700 text-emerald-800 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/50 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {aiLoading ? 'Synthesizing...' : 'AI Ecological Interpretation'}
          </button>
          <button
            type="button"
            onClick={() => exportTaxonomyCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 rounded-lg whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Direct Sequence Query + Live NCBI Taxonomy Lookup */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAnalyzeDirect}
          className="lg:col-span-7 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Direct DNA / FASTA Query</h3>
            <select
              value={refDb}
              onChange={(e) => setRefDb(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              {['NCBI BLAST', 'NCBI Taxonomy', 'SILVA', 'BOLD Systems', 'UNITE'].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <textarea
            rows={4}
            value={seqInput}
            onChange={(e) => setSeqInput(e.target.value)}
            placeholder=">Query_Sequence_01&#10;GCTAGCGATAGGATTAGATACCCTACTATGCTTAGCCGTAAACTTTGATAGCACTATACCGATCCGCCAGGGTACTACGAGCATCAGCTTGAAACCCAAAGGACTTGACGGTGCCTTAGACCCACCTAGAGGAGCCTGTTCTAGAACCGATAACCCCCGTTAAACCTCACCACCTCTTGTTTTTCCCG"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
          />
          {seqError && <p className="text-xs text-rose-600">{seqError}</p>}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">
              Sequences &lt; 76% identity are marked Unclassified (no fabricated matches).
            </span>
            <button
              type="submit"
              disabled={analyzingSeq}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              {analyzingSeq ? 'Classifying...' : 'Identify Sequence'}
            </button>
          </div>
        </form>

        <form
          onSubmit={handleNcbiLookup}
          className="lg:col-span-5 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Live NCBI Entrez Taxonomy Lookup</h3>
          </div>
          <p className="text-xs text-slate-500">
            Verify scientific nomenclature and NCBI TaxID directly from NCBI E-utilities.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={ncbiQuery}
              onChange={(e) => setNcbiQuery(e.target.value)}
              placeholder="e.g., Salmo salar or Oncorhynchus mykiss"
              className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={ncbiLoading}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap"
            >
              {ncbiLoading ? 'Querying...' : 'Verify NCBI'}
            </button>
          </div>
          {ncbiResult && (
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
              {ncbiResult.found && ncbiResult.record ? (
                <div className="space-y-1">
                  <div className="font-semibold text-emerald-800 dark:text-emerald-400">
                    {ncbiResult.record.scientificName} (TaxID: {ncbiResult.record.taxId})
                  </div>
                  {ncbiResult.record.commonName && (
                    <div className="text-slate-600 dark:text-slate-400">
                      Common Name: {ncbiResult.record.commonName}
                    </div>
                  )}
                  <div className="text-slate-500">Division: {ncbiResult.record.lineage || 'N/A'}</div>
                </div>
              ) : (
                <p className="text-slate-600 dark:text-slate-400">{ncbiResult.message}</p>
              )}
            </div>
          )}
        </form>
      </div>

      {/* Gemini Advisory Interpretation Panel */}
      {(aiResponse || aiError) && (
        <div className="p-5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
          <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
            {aiResponse?.disclaimer || 'AI Ecological Interpretation Notice'}
          </div>
          {aiError ? (
            <p className="text-xs text-rose-700 dark:text-rose-300">{aiError}</p>
          ) : (
            <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {aiResponse?.explanation}
            </p>
          )}
        </div>
      )}

      {/* Search, Filter & Sort Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Filter by Sequence ID, Phylum, Family, or Species..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>

        <select
          value={datasetFilter}
          onChange={(e) => {
            setDatasetFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="All">All Datasets</option>
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.dataset_name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {[
            'All',
            'Verified Reference Match',
            'Probable Classification',
            'Unclassified',
            'Sample Demonstration Data',
          ].map((s) => (
            <option key={s} value={s}>
              Status: {s}
            </option>
          ))}
        </select>
      </div>

      {/* 8-Rank Taxonomy Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="h-48 animate-pulse" />
        ) : paged.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No taxonomic classification records found. Upload a dataset or paste a sequence above.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 bg-slate-50 dark:bg-slate-950/60">
                <th className="py-3 px-3">
                  <button type="button" onClick={() => toggleSort('seq')} className="inline-flex items-center gap-1 font-medium">
                    Sequence ID <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-medium">Sample ID</th>
                <th className="py-3 px-3 font-medium">Kingdom</th>
                <th className="py-3 px-3 font-medium">Phylum</th>
                <th className="py-3 px-3 font-medium">Class</th>
                <th className="py-3 px-3 font-medium">Order</th>
                <th className="py-3 px-3 font-medium">Family</th>
                <th className="py-3 px-3 font-medium">Genus</th>
                <th className="py-3 px-3">
                  <button type="button" onClick={() => toggleSort('species')} className="inline-flex items-center gap-1 font-medium">
                    Species <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button type="button" onClick={() => toggleSort('confidence')} className="inline-flex items-center gap-1 font-medium">
                    Confidence <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="py-3 px-3 font-medium">Reference DB</th>
                <th className="py-3 px-3 font-medium">Identification Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paged.map((r, idx) => {
                const status = r.identification_status || r.identificationStatus || 'Unclassified';
                const statusTone =
                  status === 'Verified Reference Match'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : status === 'Probable Classification'
                      ? 'text-amber-700 dark:text-amber-400'
                      : status === 'Sample Demonstration Data'
                        ? 'text-sky-700 dark:text-sky-400'
                        : 'text-slate-500';
                return (
                  <tr key={r.id || `${idx}-${r.sequenceIdentifier}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-medium">
                      {r.sequence_identifier || r.sequenceIdentifier}
                    </td>
                    <td className="py-2.5 px-3 font-mono">{r.sample_code || r.sampleCode}</td>
                    <td className="py-2.5 px-3">{r.kingdom}</td>
                    <td className="py-2.5 px-3">{r.phylum}</td>
                    <td className="py-2.5 px-3">{r.tax_class || r.taxClass}</td>
                    <td className="py-2.5 px-3">{r.tax_order || r.taxOrder}</td>
                    <td className="py-2.5 px-3">{r.family}</td>
                    <td className="py-2.5 px-3 italic">{r.genus}</td>
                    <td className="py-2.5 px-3 italic font-medium">{r.species_name || r.speciesName}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {Number(r.confidence_score ?? r.confidenceScore ?? 0).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3">{r.reference_database || r.referenceDatabase}</td>
                    <td className={`py-2.5 px-3 font-medium ${statusTone}`}>{status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length} records
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="font-mono">
              Page {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

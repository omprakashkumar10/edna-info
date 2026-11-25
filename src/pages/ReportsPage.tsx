import React, { useEffect, useState } from 'react';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/api';
import {
  exportExcelReport,
  exportScientificPdfReport,
  exportTaxonomyCsv,
} from '../lib/reportGenerator';
import type {
  BiodiversityMetricRecord,
  DatasetRecord,
  ReportMetadataRecord,
  ResearchProject,
  TaxonomyResultRecord,
} from '../types';

export const ReportsPage: React.FC = () => {
  const { profile, createNotification } = useApp();
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [reports, setReports] = useState<ReportMetadataRecord[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportTitle, setReportTitle] = useState('eDNA Biodiversity & Taxonomic Assessment Report');
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    const [dRes, pRes, rRes] = await Promise.all([
      apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
      apiFetch<{ projects: ResearchProject[] }>('/api/projects'),
      apiFetch<{ reports: ReportMetadataRecord[] }>('/api/reports'),
    ]);
    setDatasets(dRes.datasets || []);
    setProjects(pRes.projects || []);
    setReports(rRes.reports || []);
    if (dRes.datasets?.[0]) setSelectedDatasetId(dRes.datasets[0].id);
  };

  useEffect(() => {
    load();
  }, []);

  const handleGenerate = async (format: 'PDF' | 'CSV' | 'Excel') => {
    setGenerating(true);
    try {
      const ds = datasets.find((d) => d.id === selectedDatasetId) || null;
      const proj = projects.find((p) => p.id === selectedProjectId) || null;
      const [taxRes, bioRes] = await Promise.all([
        apiFetch<{ results: TaxonomyResultRecord[] }>(
          ds ? `/api/taxonomy/results?datasetId=${ds.id}` : '/api/taxonomy/results',
        ),
        apiFetch<{ metrics: BiodiversityMetricRecord[] }>(
          ds ? `/api/biodiversity/metrics?datasetId=${ds.id}` : '/api/biodiversity/metrics',
        ),
      ]);

      const payload = {
        title: reportTitle.trim() || 'eDNA BioScan Scientific Report',
        researcher: profile,
        project: proj,
        dataset: ds,
        taxonomy: taxRes.results || [],
        biodiversity: bioRes.metrics?.[0] || null,
      };

      if (format === 'PDF') {
        exportScientificPdfReport(payload);
      } else if (format === 'Excel') {
        await exportExcelReport(payload);
      } else {
        exportTaxonomyCsv(
          payload.taxonomy,
          `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.csv`,
        );
      }

      const logged = await apiFetch<{ report: ReportMetadataRecord }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          projectId: proj?.id || null,
          datasetId: ds?.id || null,
          reportTitle: payload.title,
          reportFormat: format,
          researcherName: profile?.fullName || '',
        }),
      });
      setReports((prev) => [logged.report, ...prev]);

      await createNotification({
        type: 'report',
        title: `${format} Report Generated`,
        message: `Exported "${payload.title}" (${payload.taxonomy.length} taxonomic rows).`,
        linkView: 'reports',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Scientific Reports</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Generate publication-structured PDF documents, CSV data tables, and multi-sheet Excel workbooks.
        </p>
      </div>

      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Configure & Export Report</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Report Title</label>
            <input
              type="text"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Scope: Dataset</label>
            <select
              value={selectedDatasetId}
              onChange={(e) => setSelectedDatasetId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">All My Datasets</option>
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.dataset_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Scope: Research Project</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              <option value="">None / Standalone</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.project_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerate('PDF')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
          >
            <FileText className="w-4 h-4" />
            Download PDF Report
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerate('Excel')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            Download Excel (.xlsx)
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => handleGenerate('CSV')}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg"
          >
            <FileDown className="w-4 h-4 text-slate-600" />
            Download CSV
          </button>
        </div>
      </div>

      {/* Report Export History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 text-sm font-semibold">
          Generated Report History
        </div>
        {reports.length === 0 ? (
          <div className="p-6 text-xs text-slate-500">No reports generated yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500">
                <th className="py-2.5 px-4">Title</th>
                <th className="py-2.5 px-4">Format</th>
                <th className="py-2.5 px-4">Researcher</th>
                <th className="py-2.5 px-4 text-right">Generated At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reports.map((r) => (
                <tr key={r.id}>
                  <td className="py-2.5 px-4 font-medium">{r.report_title}</td>
                  <td className="py-2.5 px-4 font-mono">{r.report_format}</td>
                  <td className="py-2.5 px-4">{r.researcher_name || 'N/A'}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                    {r.generated_at.replace('T', ' ').slice(0, 19)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

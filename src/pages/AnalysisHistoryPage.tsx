import React, { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';
import type { AnalysisJobRecord, DatasetRecord } from '../types';

export const AnalysisHistoryPage: React.FC<{ onOpenDataset: (id: string) => void }> = ({ onOpenDataset }) => {
  const [jobs, setJobs] = useState<AnalysisJobRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ jobs: AnalysisJobRecord[] }>('/api/analysis/jobs'),
      apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
    ])
      .then(([jRes, dRes]) => {
        setJobs(jRes.jobs || []);
        setDatasets(dRes.datasets || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analysis History</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Complete pipeline execution log across validation, taxonomic matching, and diversity calculation jobs.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
        {loading ? (
          <div className="h-44 animate-pulse" />
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No analysis jobs recorded yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-slate-500 bg-slate-50 dark:bg-slate-950/60">
                <th className="py-3 px-4 font-medium">Dataset</th>
                <th className="py-3 px-4 font-medium">Pipeline</th>
                <th className="py-3 px-4 font-medium">Reference DB</th>
                <th className="py-3 px-4 font-medium text-right">Progress</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {jobs.map((job) => {
                const ds = datasets.find((d) => d.id === job.dataset_id);
                return (
                  <tr key={job.id}>
                    <td className="py-3 px-4">
                      {ds ? (
                        <button
                          type="button"
                          onClick={() => onOpenDataset(ds.id)}
                          className="font-semibold text-emerald-800 dark:text-emerald-400 hover:underline"
                        >
                          {ds.dataset_name}
                        </button>
                      ) : (
                        <span className="font-mono text-slate-500">{job.dataset_id.slice(0, 8)}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono">{job.job_type}</td>
                    <td className="py-3 px-4">{job.reference_database}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{job.progress_pct}%</td>
                    <td className="py-3 px-4 font-medium">
                      <span
                        className={
                          job.status === 'Completed'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : job.status === 'Failed'
                              ? 'text-rose-600'
                              : 'text-amber-600'
                        }
                      >
                        {job.status}
                      </span>
                      {job.error_message && (
                        <div className="text-[11px] text-rose-500 mt-0.5">{job.error_message}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {(job.completed_at || job.created_at).replace('T', ' ').slice(0, 19)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

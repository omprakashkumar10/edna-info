import React, { useEffect, useState } from 'react';
import { Download, FolderPlus, Trash2 } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { apiFetch } from '../lib/api';
import { exportScientificPdfReport } from '../lib/reportGenerator';
import type {
  BiodiversityMetricRecord,
  DatasetRecord,
  ResearchProject,
  TaxonomyResultRecord,
} from '../types';

export const ProjectsPage: React.FC = () => {
  const { profile } = useApp();
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    projectName: '',
    projectDescription: '',
    researchObjective: '',
    studyLocation: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    environmentalType: 'Freshwater',
    researcherName: profile?.fullName || '',
    researcherInstitution: profile?.institution || '',
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, dRes] = await Promise.all([
        apiFetch<{ projects: ResearchProject[] }>('/api/projects'),
        apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
      ]);
      setProjects(pRes.projects || []);
      setDatasets(dRes.datasets || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (form.projectName.trim().length < 2) {
      setErrorMsg('Project Name must be at least 2 characters.');
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ project: ResearchProject }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setProjects((prev) => [res.project, ...prev]);
      setShowForm(false);
      setForm({
        ...form,
        projectName: '',
        projectDescription: '',
        researchObjective: '',
        studyLocation: '',
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleProjectPdf = async (proj: ResearchProject) => {
    const projDatasets = datasets.filter((d) => d.project_id === proj.id);
    const [taxRes, bioRes] = await Promise.all([
      apiFetch<{ results: TaxonomyResultRecord[] }>('/api/taxonomy/results'),
      apiFetch<{ metrics: BiodiversityMetricRecord[] }>('/api/biodiversity/metrics'),
    ]);
    const dsIds = new Set(projDatasets.map((d) => d.id));
    const projTax = (taxRes.results || []).filter((t) => t.dataset_id && dsIds.has(t.dataset_id));
    const projBio = (bioRes.metrics || []).find((m) => m.project_id === proj.id || (m.dataset_id && dsIds.has(m.dataset_id))) || null;

    exportScientificPdfReport({
      title: `Project Biodiversity Report — ${proj.project_name}`,
      researcher: profile,
      project: proj,
      dataset: projDatasets[0] || null,
      taxonomy: projTax,
      biodiversity: projBio,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Research Projects</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Organize multi-sample eDNA campaigns and export project-level biodiversity assessments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg whitespace-nowrap shrink-0"
        >
          <FolderPlus className="w-4 h-4" />
          {showForm ? 'Cancel' : 'New Research Project'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          {errorMsg && <div className="sm:col-span-2 text-xs text-rose-600">{errorMsg}</div>}
          <div>
            <label className="block text-xs font-medium mb-1">Project Name *</label>
            <input
              type="text"
              required
              value={form.projectName}
              onChange={(e) => setForm({ ...form, projectName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              placeholder="Cascade Watershed Salmonid Monitoring 2026"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Environmental Type *</label>
            <select
              value={form.environmentalType}
              onChange={(e) => setForm({ ...form, environmentalType: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            >
              {['Freshwater', 'Marine', 'Soil', 'Air', 'Sediment', 'Other'].map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Study Location</label>
            <input
              type="text"
              value={form.studyLocation}
              onChange={(e) => setForm({ ...form, studyLocation: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              placeholder="Columbia River Gorge Basin"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Research Objective</label>
            <input
              type="text"
              value={form.researchObjective}
              onChange={(e) => setForm({ ...form, researchObjective: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
              placeholder="Quantify seasonal vertebrate and macroinvertebrate richness using 12S and COI primers"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium mb-1">Project Description</label>
            <textarea
              rows={2}
              value={form.projectDescription}
              onChange={(e) => setForm({ ...form, projectDescription: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Lead Researcher</label>
            <input
              type="text"
              value={form.researcherName}
              onChange={(e) => setForm({ ...form, researcherName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Institution</label>
            <input
              type="text"
              value={form.researcherInstitution}
              onChange={(e) => setForm({ ...form, researcherInstitution: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg"
            >
              {saving ? 'Saving Project...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-40 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : projects.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
          No research projects created yet. Create a project above to group datasets by field study.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((p) => {
            const linked = datasets.filter((d) => d.project_id === p.id);
            return (
              <div
                key={p.id}
                className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">{p.project_name}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {p.environmental_type} · {p.study_location || 'Location unspecified'} · {linked.length} dataset(s)
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleProjectPdf(p)}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      title="Download Project PDF Report"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-700" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Delete Project"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {p.research_objective && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{p.research_objective}</p>
                )}
                <div className="text-[11px] font-mono text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  PI: {p.researcher_name || 'N/A'} · {p.start_date || 'N/A'}
                  {p.end_date ? ` to ${p.end_date}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import { Globe, Search } from 'lucide-react';
import { apiFetch } from '../lib/api';
import type { DatasetRecord, ResearchProject, SpeciesRecord, TaxonomyResultRecord } from '../types';

export const SpeciesExplorerPage: React.FC = () => {
  const [species, setSpecies] = useState<SpeciesRecord[]>([]);
  const [taxonomy, setTaxonomy] = useState<TaxonomyResultRecord[]>([]);
  const [datasets, setDatasets] = useState<DatasetRecord[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [kingdomFilter, setKingdomFilter] = useState('All');
  const [phylumFilter, setPhylumFilter] = useState('All');
  const [envFilter, setEnvFilter] = useState('All');
  const [locationFilter, setLocationFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [selected, setSelected] = useState<SpeciesRecord | null>(null);
  const [ncbiVerify, setNcbiVerify] = useState<string>('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ species: SpeciesRecord[] }>('/api/species'),
      apiFetch<{ results: TaxonomyResultRecord[] }>('/api/taxonomy/results'),
      apiFetch<{ datasets: DatasetRecord[] }>('/api/datasets'),
      apiFetch<{ projects: ResearchProject[] }>('/api/projects'),
    ])
      .then(([spRes, taxRes, dsRes, prRes]) => {
        setSpecies(spRes.species || []);
        setTaxonomy(taxRes.results || []);
        setDatasets(dsRes.datasets || []);
        setProjects(prRes.projects || []);
        if (spRes.species?.[0]) setSelected(spRes.species[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const kingdoms = useMemo(
    () => ['All', ...Array.from(new Set(species.map((s) => s.kingdom).filter(Boolean)))],
    [species],
  );
  const phyla = useMemo(
    () => ['All', ...Array.from(new Set(species.map((s) => s.phylum).filter(Boolean)))],
    [species],
  );
  const locations = useMemo(
    () => ['All', ...Array.from(new Set(datasets.map((d) => d.collection_location).filter(Boolean)))],
    [datasets],
  );

  // Map each taxonomic_id to user's observed sample distribution
  const speciesObservations = useMemo(() => {
    const map = new Map<string, { samples: Set<string>; envs: Set<string>; locations: Set<string>; projects: Set<string>; count: number }>();
    for (const t of taxonomy) {
      const taxId = t.taxonomic_id || t.taxonomicId || '';
      if (!taxId) continue;
      const ds = datasets.find((d) => d.id === t.dataset_id);
      if (!map.has(taxId)) {
        map.set(taxId, { samples: new Set(), envs: new Set(), locations: new Set(), projects: new Set(), count: 0 });
      }
      const entry = map.get(taxId)!;
      entry.count += 1;
      if (t.sample_code || t.sampleCode) entry.samples.add(t.sample_code || t.sampleCode || '');
      if (ds?.environmental_type) entry.envs.add(ds.environmental_type);
      if (ds?.collection_location) entry.locations.add(ds.collection_location);
      if (ds?.project_id) entry.projects.add(ds.project_id);
    }
    return map;
  }, [datasets, taxonomy]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return species.filter((sp) => {
      const obs = speciesObservations.get(sp.taxonomic_id);
      const matchSearch =
        !q ||
        sp.scientific_name.toLowerCase().includes(q) ||
        sp.common_name.toLowerCase().includes(q) ||
        sp.taxonomic_id.includes(q) ||
        sp.family.toLowerCase().includes(q);
      const matchK = kingdomFilter === 'All' || sp.kingdom === kingdomFilter;
      const matchP = phylumFilter === 'All' || sp.phylum === phylumFilter;
      const matchEnv = envFilter === 'All' || (obs && obs.envs.has(envFilter)) || sp.habitat_summary.toLowerCase().includes(envFilter.toLowerCase());
      const matchLoc = locationFilter === 'All' || (obs && obs.locations.has(locationFilter));
      const matchProj = projectFilter === 'All' || (obs && obs.projects.has(projectFilter));
      return matchSearch && matchK && matchP && matchEnv && matchLoc && matchProj;
    });
  }, [envFilter, kingdomFilter, locationFilter, phylumFilter, projectFilter, search, species, speciesObservations]);

  const handleVerifyNcbi = async (sciName: string) => {
    setNcbiVerify('Querying NCBI Entrez...');
    try {
      const res = await apiFetch<{ found: boolean; record?: { taxId: string; scientificName: string; division?: string } }>(
        `/api/taxonomy/ncbi-lookup?taxon=${encodeURIComponent(sciName)}`,
      );
      if (res.found && res.record) {
        setNcbiVerify(`Verified on NCBI Taxonomy: ${res.record.scientificName} (TaxID ${res.record.taxId})`);
      } else {
        setNcbiVerify('NCBI Entrez lookup unavailable or rate-limited.');
      }
    } catch {
      setNcbiVerify('NCBI Entrez query failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Species Explorer</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Verified reference organism catalog linked to your eDNA detections and NCBI taxonomic IDs.
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search scientific name, common name, TaxID..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
        </div>
        <select
          value={kingdomFilter}
          onChange={(e) => setKingdomFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {kingdoms.map((k) => (
            <option key={k} value={k}>
              Kingdom: {k}
            </option>
          ))}
        </select>
        <select
          value={phylumFilter}
          onChange={(e) => setPhylumFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {phyla.map((p) => (
            <option key={p} value={p}>
              Phylum: {p}
            </option>
          ))}
        </select>
        <select
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          {['All', 'Freshwater', 'Marine', 'Soil', 'Air', 'Sediment'].map((e) => (
            <option key={e} value={e}>
              Biome: {e}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
        >
          <option value="All">Project: All</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.project_name}
            </option>
          ))}
        </select>
        {locations.length > 1 && (
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 sm:col-span-2 lg:col-span-2"
          >
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                Location: {loc}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="h-64 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-pulse" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Species List */}
          <div className="lg:col-span-5 space-y-2 max-h-[620px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                No species records match the active filters.
              </div>
            ) : (
              filtered.map((sp) => {
                const isSel = selected?.id === sp.id;
                const obs = speciesObservations.get(sp.taxonomic_id);
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      setSelected(sp);
                      setNcbiVerify('');
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors ${
                      isSel
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-600'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold italic text-slate-900 dark:text-white">
                        {sp.scientific_name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">txid:{sp.taxonomic_id}</span>
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {sp.common_name || 'No common name'} · {sp.kingdom} / {sp.phylum}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1.5 font-mono">
                      Source: {sp.reference_source} · Detections: {obs?.count || sp.detection_frequency}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Species Detail Panel */}
          <div className="lg:col-span-7">
            {selected ? (
              <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="text-xl font-bold italic text-slate-900 dark:text-white">
                      {selected.scientific_name}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selected.common_name} · Conservation: {selected.conservation_status}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVerifyNcbi(selected.scientific_name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Globe className="w-3.5 h-3.5 text-emerald-700" />
                    Verify on NCBI
                  </button>
                </div>

                {ncbiVerify && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-emerald-800 dark:text-emerald-400">
                    {ncbiVerify}
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-semibold text-slate-500 mb-2">Taxonomic Classification Hierarchy</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {[
                      ['Domain', selected.domain],
                      ['Kingdom', selected.kingdom],
                      ['Phylum', selected.phylum],
                      ['Class', selected.tax_class],
                      ['Order', selected.tax_order],
                      ['Family', selected.family],
                      ['Genus', selected.genus],
                      ['Species', selected.species_epithet],
                    ].map(([rank, val]) => (
                      <div key={rank} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="text-[11px] text-slate-400">{rank}</div>
                        <div className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">{val || 'N/A'}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">Taxonomic ID</div>
                    <div className="font-mono font-semibold mt-0.5">{selected.taxonomic_id}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">Reference Source</div>
                    <div className="font-semibold mt-0.5">{selected.reference_source}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="text-slate-500">Detection Frequency</div>
                    <div className="font-mono font-semibold mt-0.5">
                      {speciesObservations.get(selected.taxonomic_id)?.count || selected.detection_frequency}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-500">Habitat & Ecological Context</h4>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    {selected.habitat_summary}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-slate-500">Observed Sample Distribution</h4>
                  <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                    {(() => {
                      const obs = speciesObservations.get(selected.taxonomic_id);
                      if (!obs || obs.samples.size === 0) {
                        return 'Not yet detected in your uploaded datasets.';
                      }
                      return `Samples: ${Array.from(obs.samples).join(', ')} · Biomes: ${Array.from(obs.envs).join(', ')}`;
                    })()}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

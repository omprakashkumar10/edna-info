import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Database,
  Dna,
  FileSpreadsheet,
  Globe2,
  Layers,
  Microscope,
  Moon,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { BioScanLogo } from '../components/BioScanLogo';
import { useApp } from '../contexts/AppContext';
import type { PublicView } from '../types';

interface LandingProps {
  onNavigate: (view: PublicView) => void;
}

export const LandingPage: React.FC<LandingProps> = ({ onNavigate }) => {
  const { theme, toggleTheme } = useApp();
  const [contactForm, setContactForm] = useState({ name: '', email: '', institution: '', message: '' });
  const [contactSent, setContactSent] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name.trim() || !contactForm.email.trim() || !contactForm.message.trim()) return;
    setContactSent(true);
    setContactForm({ name: '', email: '', institution: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: 3 clean zones */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a href="#top" className="shrink-0 focus-visible:outline-2 focus-visible:outline-emerald-600 rounded-lg">
            <BioScanLogo size={34} />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#about" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              About
            </a>
            <a href="#features" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              Features
            </a>
            <a href="#workflow" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              How It Works
            </a>
            <a href="#applications" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              Applications
            </a>
            <a href="#contact" className="hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors whitespace-nowrap shrink-0"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="px-4 py-2 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Register
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="top" className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-400">
              <span>Discover</span>
              <span aria-hidden="true">·</span>
              <span>Analyze</span>
              <span aria-hidden="true">·</span>
              <span>Conserve</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.12] text-balance">
              Environmental DNA Taxonomy and Biodiversity Intelligence
            </h1>

            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              eDNA BioScan equips researchers, conservation biologists, and environmental laboratories to parse raw sequencing datasets, resolve multi-rank taxonomic lineages, and compute rigorous community diversity indices.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => onNavigate('register')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Create Researcher Account
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign In to Workspace
              </button>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-emerald-950 to-slate-900">
              <img
                src="/src/assets/images/hero_edna_lab_1795609024651.jpg"
                alt="Environmental DNA water filtration and laboratory micropipetting bench"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* 4-column scientific specifications strip */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-slate-200 dark:border-slate-800 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Accepted Sequence Formats</p>
            <p className="mt-1.5 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              FASTA · FASTQ · CSV · TSV
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Taxonomic Hierarchy</p>
            <p className="mt-1.5 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              8 Ranks (Domain to Species)
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Ecological Indices</p>
            <p className="mt-1.5 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              Shannon · Simpson · Pielou · Beta
            </p>
          </div>
          <div className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Reference Frameworks</p>
            <p className="mt-1.5 text-lg font-semibold font-mono tabular-nums text-slate-900 dark:text-white">
              NCBI · SILVA · BOLD · UNITE
            </p>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 py-16">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 aspect-[4/3] bg-emerald-950">
              <img
                src="/src/assets/images/bioinformatics_sequencing_1795609025291.jpg"
                alt="Isometric optical genomic sequencing analyzer"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="lg:col-span-7 space-y-5">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Built for Transparent, Reproducible eDNA Science
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Environmental DNA metabarcoding captures trace genetic material shed into freshwater, marine, soil, sediment, and aerial habitats. eDNA BioScan separates verified reference sequence alignments from advisory AI explanations, preserves full metadata lineage, and highlights data limitations whenever presence/absence datasets are analyzed.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Fabricated Matches</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Sequences below threshold remain explicitly marked Unclassified rather than forced into guesses.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Database className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Dual Database Integrity</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Firebase manages authenticated researcher identity while relational SQL stores sequences and metrics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="py-16 max-w-7xl mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            End-to-End Scientific Capabilities
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2">
            Every stage from raw amplicon upload to peer-ready PDF, CSV, and Excel ecological reporting.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              icon: Dna,
              title: 'Multi-Format Sequence Ingestion',
              desc: 'Drag-and-drop FASTA, FASTQ, CSV, TSV, and TXT files with automatic Phred quality scoring, GC% calculation, and read-abundance extraction.',
            },
            {
              icon: Microscope,
              title: 'Taxonomic Classification Engine',
              desc: 'Resolves Domain through Species ranks against NCBI, SILVA, BOLD Systems, and UNITE with confidence scores and unclassified tracking.',
            },
            {
              icon: Layers,
              title: 'Quantitative Biodiversity Metrics',
              desc: 'Computes Species Richness, Shannon H′, Simpson 1−D, Pielou Evenness J′, Alpha diversity, and Bray-Curtis Beta dissimilarity matrices.',
            },
            {
              icon: Globe2,
              title: 'Species Explorer & Catalog',
              desc: 'Search detected organisms by Kingdom, Phylum, environmental biome, study location, and conservation status with live NCBI Taxonomy queries.',
            },
            {
              icon: FileSpreadsheet,
              title: 'Publication-Ready Reports',
              desc: 'Export complete scientific reports in PDF, CSV, and multi-sheet Excel formats with methodology, reference citations, and limitations.',
            },
            {
              icon: CheckCircle2,
              title: 'Advisory AI Interpretation',
              desc: 'Gemini-assisted ecological synthesis explains habitat indicators and sampling caveats while strictly separating AI notes from verified taxonomy.',
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <div
                key={feat.title}
                className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 space-y-3"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-800 dark:text-emerald-400">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">{feat.title}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How It Works */}
      <section id="workflow" className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-10">
            01–04. Standardized Research Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: '01. Field & Metadata Capture',
                detail: 'Register sampling coordinates, biome type, marker gene (COI, 12S, 16S, ITS2), and sequencing platform.',
              },
              {
                step: '02. Sequence Validation',
                detail: 'Backend pipeline parses FASTA/FASTQ/CSV reads, checks base validity, and logs Phred Q-scores.',
              },
              {
                step: '03. Taxonomic Assignment',
                detail: 'Queries align against reference databases, flagging Verified Matches, Probable taxa, or Unclassified reads.',
              },
              {
                step: '04. Diversity & Conservation',
                detail: 'Compare Alpha/Beta diversity across sites and export full ecological reports for conservation action.',
              },
            ].map((item) => (
              <div key={item.step} className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">{item.step}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{item.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Scientific Applications */}
      <section id="applications" className="py-16 max-w-7xl mx-auto px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-8">
          Scientific & Conservation Applications
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="aspect-[4/3] bg-emerald-950">
              <img
                src="/src/assets/images/marine_edna_sampling_1795609025207.jpg"
                alt="Marine water eDNA filtration manifold on research vessel"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Marine & Coastal Estuaries</span>
                <span aria-hidden="true">·</span>
                <span>12S / COI Metabarcoding</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Pelagic Megafauna & Reef Biodiversity Monitoring
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Detect elusive cetaceans, migratory fishes, and reef-building corals from filtered seawater without invasive capture.
              </p>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="aspect-[4/3] bg-emerald-950">
              <img
                src="/src/assets/images/forest_soil_biodiversity_1795609025274.jpg"
                alt="Temperate forest soil core sampling for biodiversity eDNA"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-6 space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>Terrestrial Soil & Freshwater</span>
                <span aria-hidden="true">·</span>
                <span>ITS2 / 16S rRNA</span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Mycorrhizal Fungi, Soil Microbiome & Watershed Health
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Track forest soil fungal symbioses, bioindicator macroinvertebrates, and watershed restoration trajectories across seasons.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/30 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Institutional & Research Inquiries</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 mb-6">
            Collaborating on large-scale eDNA biomonitoring or academic curriculum access? Send a note to our research desk.
          </p>

          {contactSent ? (
            <div className="p-5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-900 dark:text-emerald-200">
              Thank you for reaching out. Your institutional inquiry has been recorded. Create a free researcher account anytime to start analyzing datasets immediately.
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  placeholder="Dr. Elena Vance"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  placeholder="researcher@university.edu"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Institution / Organisation</label>
                <input
                  type="text"
                  value={contactForm.institution}
                  onChange={(e) => setContactForm({ ...contactForm, institution: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  placeholder="Marine Biodiversity Institute"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Message</label>
                <textarea
                  rows={3}
                  required
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                  placeholder="Describe your research project or institutional requirements..."
                />
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
                >
                  Send Inquiry
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <BioScanLogo size={26} />
            <span>Discover. Analyze. Conserve.</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#about" className="hover:text-slate-800 dark:hover:text-slate-200">About</a>
            <a href="#features" className="hover:text-slate-800 dark:hover:text-slate-200">Capabilities</a>
            <button type="button" onClick={() => onNavigate('login')} className="hover:text-slate-800 dark:hover:text-slate-200">
              Researcher Login
            </button>
            <button type="button" onClick={() => onNavigate('register')} className="hover:text-slate-800 dark:hover:text-slate-200">
              Register
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

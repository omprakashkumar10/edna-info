import React from 'react';

export const HelpDocsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Help and Documentation</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Scientific pipeline specification, supported sequence formats, ecological formulas, and infrastructure setup instructions.
        </p>
      </div>

      {/* Sequence Formats */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-base font-semibold">1. Supported eDNA Dataset Formats</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Upload FASTA (<code>.fasta</code>, <code>.fa</code>, <code>.fna</code>), FASTQ (<code>.fastq</code>, <code>.fq</code>), CSV, TSV, or TXT files up to 25 MB. Include optional <code>sample=SAMPLE_ID</code> and <code>abundance=N</code> tokens in FASTA headers or columns in CSV/TSV to unlock sample-level Beta diversity and abundance-weighted indices.
        </p>
        <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono overflow-x-auto">
{`>SEQ_001 sample=RIVER_A abundance=340
GCTAGCGATAGGATTAGATACCCTACTATGCTTAGCCGTAAACTTTGATAGCACTATACCGATCCGCCAGGGTACTACGAGCATCAGCTTG
>SEQ_002 sample=RIVER_B abundance=185
CCTCTATCTAGTATTTGGTGCCTGAGCCGGAATAGTGGGCACCGCCCTAAGCCTTCTTATTCGAGCAGAACTAAGCCAACCCGGCGCCCTT`}
        </pre>
      </section>

      {/* Classification Rules */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
        <h3 className="text-base font-semibold">2. Taxonomic Confidence & Scientific Integrity</h3>
        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 list-disc pl-5">
          <li><strong>Verified Reference Match (&ge; 90% identity):</strong> High-similarity alignment against curated NCBI, SILVA, BOLD, or UNITE marker accessions.</li>
          <li><strong>Probable Classification (76% – 89.9% identity):</strong> Genus-level or tentative assignment requiring confirmatory alignment.</li>
          <li><strong>Unclassified (&lt; 76% identity):</strong> Explicitly preserved as Unclassified; eDNA BioScan never fabricates species names.</li>
          <li><strong>AI Ecological Interpretation:</strong> Gemini synthesis provides ecological context only and is never labeled as verified taxonomy.</li>
        </ul>
      </section>

      {/* Complete Deployment & Integration Setup Instructions */}
      <section className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-base font-semibold">3. Production Infrastructure Setup Guide</h3>

        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">A. Google AI Studio & Gemini API</h4>
            <p>Set <code>GEMINI_API_KEY</code> in AI Studio Secrets. All Gemini calls run strictly on the Express backend via <code>@google/genai</code>.</p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">B. Firebase Project (Authentication, Firestore, Storage)</h4>
            <p>
              Enable <strong>Google</strong> and <strong>Email/Password</strong> providers in Firebase Console &rarr; Authentication &rarr; Sign-in method. Deploy the hardened <code>firestore.rules</code> file and enable Firebase Storage for user profile avatars.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">C. Supabase PostgreSQL & Storage</h4>
            <p>
              Create a Supabase project, open the SQL Editor, and execute <code>/supabase/migrations/001_initial_schema.sql</code> to create all 11 relational tables (<code>research_projects</code>, <code>datasets</code>, <code>dataset_samples</code>, <code>dna_sequences</code>, <code>taxonomy_results</code>, <code>taxonomy_reference</code>, <code>species</code>, <code>biodiversity_metrics</code>, <code>analysis_jobs</code>, <code>analysis_logs</code>, <code>report_metadata</code>) and RLS policies. Create a private storage bucket named <code>edna-datasets</code>.
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">D. Environment Variables</h4>
            <pre className="mt-1 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-[11px] overflow-x-auto">
{`GEMINI_API_KEY=...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_STORAGE_BUCKET=edna-datasets
ADMIN_EMAILS=admin@yourinstitution.org
ADMIN_PASSCODE=your-secure-control-center-passcode
NCBI_API_KEY=optional-ncbi-entrez-key`}
            </pre>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white">E. Backend Deployment & Admin Provisioning</h4>
            <p>
              Build the frontend with <code>npm run build</code> and start the Express server with <code>npm start</code> (<code>node server.ts</code>). Initial administrator access is restricted to verified emails in <code>ADMIN_EMAILS</code> (plus the provisioned creator account) and protected by a server-verified passcode on the separate <code>/control-center</code> route.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

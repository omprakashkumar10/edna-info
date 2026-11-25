import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import type {
  BiodiversityMetricRecord,
  DatasetRecord,
  ResearchProject,
  TaxonomyResultRecord,
  UserProfile,
} from '../types';

export interface ScientificReportPayload {
  title: string;
  researcher: UserProfile | null;
  project: ResearchProject | null;
  dataset: DatasetRecord | null;
  taxonomy: TaxonomyResultRecord[];
  biodiversity: BiodiversityMetricRecord | null;
  aiSummary?: string;
}

function getField(r: TaxonomyResultRecord, snake: keyof TaxonomyResultRecord, camel: keyof TaxonomyResultRecord): string {
  const v = r[snake] ?? r[camel];
  return v !== undefined && v !== null ? String(v) : '';
}

export function exportTaxonomyCsv(rows: TaxonomyResultRecord[], filename = 'edna_bioscan_taxonomy.csv'): void {
  const headers = [
    'Sequence ID',
    'Sample ID',
    'Domain',
    'Kingdom',
    'Phylum',
    'Class',
    'Order',
    'Family',
    'Genus',
    'Species',
    'Confidence (%)',
    'Identity (%)',
    'E-Value',
    'Abundance',
    'Reference Database',
    'Identification Status',
  ];

  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        getField(r, 'sequence_identifier', 'sequenceIdentifier'),
        getField(r, 'sample_code', 'sampleCode'),
        r.domain,
        r.kingdom,
        r.phylum,
        getField(r, 'tax_class', 'taxClass'),
        getField(r, 'tax_order', 'taxOrder'),
        r.family,
        r.genus,
        getField(r, 'species_name', 'speciesName'),
        getField(r, 'confidence_score', 'confidenceScore'),
        getField(r, 'identity_pct', 'identityPct'),
        getField(r, 'e_value', 'eValue'),
        getField(r, 'abundance_count', 'abundanceCount') || '1',
        getField(r, 'reference_database', 'referenceDatabase'),
        getField(r, 'identification_status', 'identificationStatus'),
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportExcelReport(payload: ScientificReportPayload): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'eDNA BioScan';
  wb.created = new Date();

  const summarySheet = wb.addWorksheet('Executive Summary');
  summarySheet.columns = [
    { header: 'Field', key: 'field', width: 28 },
    { header: 'Value', key: 'value', width: 65 },
  ];
  summarySheet.addRows([
    { field: 'Application', value: 'eDNA BioScan — Discover. Analyze. Conserve.' },
    { field: 'Report Title', value: payload.title },
    { field: 'Generated Date', value: new Date().toISOString() },
    { field: 'Researcher', value: payload.researcher?.fullName || 'N/A' },
    { field: 'Institution', value: payload.researcher?.institution || 'N/A' },
    { field: 'Project Name', value: payload.project?.project_name || 'Standalone Dataset Analysis' },
    { field: 'Dataset Name', value: payload.dataset?.dataset_name || 'All Selected Datasets' },
    { field: 'Environmental Type', value: payload.dataset?.environmental_type || payload.project?.environmental_type || 'N/A' },
    { field: 'Reference Database', value: payload.dataset?.reference_database || 'NCBI BLAST' },
    { field: 'Species Richness (S)', value: payload.biodiversity?.species_richness ?? 'N/A' },
    { field: 'Shannon Diversity Index (H)', value: payload.biodiversity?.shannon_index ?? 'N/A' },
    { field: 'Simpson Diversity Index (1-D)', value: payload.biodiversity?.simpson_index ?? 'N/A' },
    { field: 'Pielou Evenness Index (J)', value: payload.biodiversity?.pielou_evenness ?? 'N/A' },
    { field: 'Limitations', value: payload.biodiversity?.limitations_note || 'Standard eDNA PCR & reference limitations apply.' },
  ]);

  const taxSheet = wb.addWorksheet('Taxonomy Identifications');
  taxSheet.columns = [
    { header: 'Sequence ID', key: 'seqId', width: 20 },
    { header: 'Sample ID', key: 'sampleId', width: 18 },
    { header: 'Kingdom', key: 'kingdom', width: 14 },
    { header: 'Phylum', key: 'phylum', width: 16 },
    { header: 'Class', key: 'taxClass', width: 16 },
    { header: 'Order', key: 'taxOrder', width: 16 },
    { header: 'Family', key: 'family', width: 16 },
    { header: 'Genus', key: 'genus', width: 16 },
    { header: 'Species', key: 'species', width: 26 },
    { header: 'Confidence (%)', key: 'confidence', width: 14 },
    { header: 'Abundance', key: 'abundance', width: 12 },
    { header: 'Reference DB', key: 'refDb', width: 16 },
    { header: 'Status', key: 'status', width: 26 },
  ];

  for (const r of payload.taxonomy) {
    taxSheet.addRow({
      seqId: getField(r, 'sequence_identifier', 'sequenceIdentifier'),
      sampleId: getField(r, 'sample_code', 'sampleCode'),
      kingdom: r.kingdom,
      phylum: r.phylum,
      taxClass: getField(r, 'tax_class', 'taxClass'),
      taxOrder: getField(r, 'tax_order', 'taxOrder'),
      family: r.family,
      genus: r.genus,
      species: getField(r, 'species_name', 'speciesName'),
      confidence: Number(getField(r, 'confidence_score', 'confidenceScore') || 0),
      abundance: Number(getField(r, 'abundance_count', 'abundanceCount') || 1),
      refDb: getField(r, 'reference_database', 'referenceDatabase'),
      status: getField(r, 'identification_status', 'identificationStatus'),
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportScientificPdfReport(payload: ScientificReportPayload): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner with Forest Green Accent
  doc.setFillColor(11, 41, 30);
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Vector Emblem (DNA Helix + Leaf Mark)
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(14, 7, 18, 18, 3, 3, 'F');
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.line(18, 10, 28, 16);
  doc.line(28, 10, 18, 16);
  doc.line(18, 16, 28, 22);
  doc.line(28, 16, 18, 22);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('eDNA BioScan', 37, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(167, 243, 208);
  doc.text('Discover. Analyze. Conserve.  |  Environmental DNA Biodiversity Assessment Report', 37, 22);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 14, 15, { align: 'right' });

  // Report Title
  let y = 44;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(payload.title, 14, y);
  y += 8;

  // Section 1: Researcher & Project Details
  doc.setFontSize(11);
  doc.setTextColor(6, 95, 70);
  doc.text('1. Researcher, Project & Dataset Metadata', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [11, 41, 30], textColor: 255 },
    head: [['Attribute', 'Recorded Specification']],
    body: [
      ['Principal Researcher', `${payload.researcher?.fullName || 'Not specified'} (${payload.researcher?.userType || 'Researcher'})`],
      ['Institution / Department', `${payload.researcher?.institution || 'Not specified'} — ${payload.researcher?.department || 'General'}`],
      ['Research Project', payload.project?.project_name || 'Standalone Dataset Analysis'],
      ['Project Objective', payload.project?.research_objective || 'Taxonomic profiling & community biodiversity assessment'],
      ['Dataset Name & File', payload.dataset ? `${payload.dataset.dataset_name} (${payload.dataset.original_filename}, ${payload.dataset.file_format})` : 'Aggregated Analysis'],
      ['Collection Location & Environment', `${payload.dataset?.collection_location || payload.project?.study_location || 'N/A'} | ${payload.dataset?.environmental_type || payload.project?.environmental_type || 'N/A'}`],
      ['Sequencing Platform & Marker', `${payload.dataset?.sequencing_platform || 'Not specified'} | Marker: ${payload.dataset?.marker_gene || 'Multi-locus'}`],
      ['Reference Database', payload.dataset?.reference_database || 'NCBI BLAST / SILVA / BOLD / UNITE'],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  // Section 2: Biodiversity Metrics
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text('2. Quantitative Biodiversity Indices', 14, y);
  y += 3;

  const bio = payload.biodiversity;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    styles: { fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: [5, 150, 105], textColor: 255 },
    head: [['Ecological Metric', 'Value', 'Mathematical Definition']],
    body: [
      ['Species Richness (S)', bio ? String(bio.species_richness) : 'N/A', 'Total distinct classified taxa detected'],
      ['Total Sequence Abundance (N)', bio ? String(bio.total_individuals) : 'N/A', 'Sum of read counts across classified taxa'],
      ["Shannon Diversity Index (H')", bio ? bio.shannon_index.toFixed(4) : 'N/A', "-Sum(p_i * ln(p_i))"],
      ['Simpson Diversity Index (1 - D)', bio ? bio.simpson_index.toFixed(4) : 'N/A', '1 - Sum(n_i*(n_i-1) / N*(N-1))'],
      ["Pielou's Evenness Index (J')", bio ? bio.pielou_evenness.toFixed(4) : 'N/A', "H' / ln(S)"],
      ['Mean Beta Dissimilarity (Bray-Curtis)', bio?.beta_bray_curtis_mean != null ? bio.beta_bray_curtis_mean.toFixed(4) : 'Single sample', '1 - 2*Sum(min(n_ij,n_ik)) / Sum(n_ij+n_ik)'],
    ],
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;

  // Species distribution summary bars (drawn directly in PDF canvas)
  if (bio && bio.relative_abundance.length > 0) {
    if (y > 235) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 95, 70);
    doc.text('3. Species Relative Abundance Profile', 14, y);
    y += 5;

    const topSpecies = bio.relative_abundance.slice(0, 8);
    for (const sp of topSpecies) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(sp.species.slice(0, 32), 14, y + 3);
      doc.setFillColor(226, 232, 240);
      doc.rect(72, y, 90, 4, 'F');
      doc.setFillColor(5, 150, 105);
      doc.rect(72, y, Math.max(2, (sp.relativePct / 100) * 90), 4, 'F');
      doc.setFont('helvetica', 'normal');
      doc.text(`${sp.relativePct.toFixed(1)}% (n=${sp.count})`, 166, y + 3);
      y += 6.5;
    }
    y += 4;
  }

  // Section 4: Taxonomic Identification Table
  if (y > 220) {
    doc.addPage();
    y = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text('4. Taxonomic Identification Results', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    theme: 'striped',
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [11, 41, 30], textColor: 255 },
    head: [['Seq ID', 'Sample', 'Phylum', 'Family', 'Species', 'Conf %', 'Status']],
    body: payload.taxonomy.slice(0, 60).map((r) => [
      getField(r, 'sequence_identifier', 'sequenceIdentifier'),
      getField(r, 'sample_code', 'sampleCode'),
      r.phylum,
      r.family,
      getField(r, 'species_name', 'speciesName'),
      `${Number(getField(r, 'confidence_score', 'confidenceScore') || 0).toFixed(1)}%`,
      getField(r, 'identification_status', 'identificationStatus'),
    ]),
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  if (y > 235) {
    doc.addPage();
    y = 20;
  }

  // Section 5: Methodology, Reference Databases & Scientific Limitations
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 95, 70);
  doc.text('5. Methodology, Reference Databases & Limitations', 14, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const methodLines = doc.splitTextToSize(
    `Methodology: Uploaded nucleotide datasets (FASTA/FASTQ/CSV/TSV/TXT) undergo format verification, base-pair validation, GC-content profiling, and Phred quality scoring where available. Sequence alignment matches query reads against curated reference barcode databases (NCBI BLAST / NCBI Taxonomy, SILVA SSU/LSU, BOLD Systems COI, UNITE ITS) using strict identity thresholds (>=90% Verified Reference Match; 76-89.9% Probable Classification; <76% Unclassified).\n\nLimitations: ${
      bio?.limitations_note ||
      'Environmental DNA detections are subject to DNA persistence dynamics, primer amplification bias, incomplete reference coverage, and transport across hydrological gradients.'
    }${payload.aiSummary ? `\n\nAdvisory Ecological Synthesis (AI-Assisted, Non-Verified): ${payload.aiSummary}` : ''}`,
    pageWidth - 28,
  );
  doc.text(methodLines, 14, y);

  doc.save(`${payload.title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`);
}

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

const initialSummary = { imported: 0, skipped: 0, errors: 0 };
const roleValues = ['HC', 'AD', 'OC'];

export default function ImportPage() {
  const [summary, setSummary] = useState(initialSummary);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState('');

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setSummary(initialSummary);
    setMessage('');

    try {
      const rows = await parseFile(file);
      const normalizedRows = rows.map(normalizeRow).filter((row) => Object.values(row).some(Boolean));
      const nextSummary = await importRows(normalizedRows);
      setSummary(nextSummary);
      setMessage(`Processed ${normalizedRows.length} row${normalizedRows.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setSummary({ imported: 0, skipped: 0, errors: 1 });
      setMessage(error.message || 'Import failed.');
    } finally {
      setProcessing(false);
      event.target.value = '';
    }
  }

  async function importRows(rows) {
    const nextSummary = { ...initialSummary };

    for (const row of rows) {
      if (!row.name || !row.school_name) {
        nextSummary.errors += 1;
        continue;
      }

      if (row.email) {
        const { data: existingContact } = await supabase.from('contacts').select('id').eq('email', row.email).maybeSingle();
        if (existingContact) {
          nextSummary.skipped += 1;
          continue;
        }
      }

      const { data: school, error: schoolError } = await supabase
        .from('schools')
        .upsert({ name: row.school_name, city: row.city || null, state: row.state || null }, { onConflict: 'name' })
        .select('id')
        .single();

      if (schoolError || !school?.id) {
        nextSummary.errors += 1;
        continue;
      }

      const contactPayload = {
        school_id: school.id,
        name: row.name,
        role: roleValues.includes(row.role) ? row.role : null,
        email: row.email || null,
        phone: row.phone || null,
        x_handle: row.x_handle || null,
      };

      const { error: contactError } = await supabase.from('contacts').insert(contactPayload);
      if (contactError) {
        if (contactError.code === '23505') {
          nextSummary.skipped += 1;
        } else {
          nextSummary.errors += 1;
        }
      } else {
        nextSummary.imported += 1;
      }
    }

    return nextSummary;
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Import</h1>
        <p className="mt-1 text-sm text-gray-600">Upload CSV or XLSX files with school and contact columns.</p>
      </div>

      <div className="max-w-xl rounded-lg border border-gray-200 p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-gray-700">Contact file</span>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            disabled={processing}
            className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
          />
        </label>

        {processing && <p className="mt-4 text-sm text-gray-600">Importing contacts...</p>}
        {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}

        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <SummaryCard label="Imported" value={summary.imported} />
          <SummaryCard label="Skipped" value={summary.skipped} />
          <SummaryCard label="Errors" value={summary.errors} />
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}

function parseFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  if (extension === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        skipEmptyLines: true,
        complete: (results) => resolve(arrayRowsToObjects(results.data)),
        error: (error) => reject(error),
      });
    });
  }

  if (extension === 'xlsx') {
    return file.arrayBuffer().then((buffer) => {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
      return arrayRowsToObjects(rows);
    });
  }

  return Promise.reject(new Error('Use a .csv or .xlsx file.'));
}

function arrayRowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  return rows.slice(1).map((row) => {
    return headers.reduce((record, header, index) => {
      if (header) record[header] = String(row[index] ?? '').trim();
      return record;
    }, {});
  });
}

function normalizeHeader(header) {
  const value = String(header || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const mappings = {
    name: 'name',
    school: 'school_name',
    city: 'city',
    state: 'state',
    role: 'role',
    email: 'email',
    phone: 'phone',
    x_handle: 'x_handle',
    'x handle': 'x_handle',
  };
  return mappings[value] || value;
}

function normalizeRow(row) {
  return {
    name: row.name?.trim() || '',
    school_name: row.school_name?.trim() || '',
    city: row.city?.trim() || '',
    state: row.state?.trim() || '',
    role: row.role?.trim().toUpperCase() || '',
    email: row.email?.trim().toLowerCase() || '',
    phone: row.phone?.trim() || '',
    x_handle: row.x_handle?.trim() || '',
  };
}

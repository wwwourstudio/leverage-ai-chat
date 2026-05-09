'use client';

import { useState, useRef, useCallback } from 'react';

export interface FileAttachment {
  id: string;
  name: string;
  type: 'image' | 'csv' | 'text' | 'json';
  url: string;
  size: number;
  data?: { headers: string[]; rows: string[][] } | null;
  textContent?: string | null;
  imageBase64?: string | null;
  mimeType?: string | null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extractPdfText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const rawText = decoder.decode(arrayBuffer);
    const matches = rawText.match(/\(([^)]{1,300})\)\s*(?:Tj|TJ|'|")/g) ?? [];
    const extracted = matches
      .map(m => m.replace(/^\(/, '').replace(/\)\s*(?:Tj|TJ|'|")$/, ''))
      .join(' ')
      .replace(/\\[nrt]/g, ' ')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim();
    if (extracted.length > 50) return extracted.slice(0, 10000);
    return rawText
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .trim()
      .slice(0, 10000);
  } catch {
    return '';
  }
}

function parseDelimitedFile(text: string, delimiter: string = ','): { headers: string[]; rows: string[][] } {
  const MAX_BYTES = 5_000_000;
  const MAX_ROWS = 5_000;
  const MAX_COLS = 200;

  const safeText = text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;
  const lines = safeText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = lines[0].split(delimiter).map(h => h.trim()).slice(0, MAX_COLS);
  const dataLines = lines.slice(1, MAX_ROWS + 1);
  const rows = dataLines.map(line =>
    line.split(delimiter).map(cell => cell.trim()).slice(0, MAX_COLS)
  );
  return { headers, rows };
}

export interface UseFileHandlingResult {
  uploadedFiles: FileAttachment[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  processFiles: (fileList: FileList | File[]) => Promise<FileAttachment[]>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  removeAttachment: (id: string) => void;
  saveFileToProfile: (file: FileAttachment, onSuccess: (msg: string) => void, onError: (msg: string) => void) => void;
  setUploadedFiles: React.Dispatch<React.SetStateAction<FileAttachment[]>>;
}

export function useFileHandling(): UseFileHandlingResult {
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (fileList: FileList | File[]): Promise<FileAttachment[]> => {
    const files = Array.from(fileList);
    const newAttachments: FileAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileType = file.type;

      const isCsvOrTsv = fileType === 'text/csv' || fileType === 'text/tab-separated-values'
        || file.name.endsWith('.tsv') || file.name.endsWith('.csv');
      const isTextFile = fileType === 'text/plain' || file.name.endsWith('.txt');
      const isJsonFile = fileType === 'application/json' || fileType === 'text/json' || file.name.endsWith('.json');
      const isImage = fileType.startsWith('image/');
      const isPdf = fileType === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

      if (!isImage && !isCsvOrTsv && !isTextFile && !isJsonFile && !isPdf) {
        alert(`File type not supported: ${file.name}. Supported: images, CSV, TSV, TXT, JSON, PDF.`);
        continue;
      }

      const fileUrl = isImage ? URL.createObjectURL(file) : '';

      const attachment: FileAttachment = {
        id: `${Date.now()}-${i}`,
        name: file.name,
        type: isImage ? 'image' : isCsvOrTsv ? 'csv' : isJsonFile ? 'json' : 'text',
        url: fileUrl,
        size: file.size,
        mimeType: isImage ? fileType : undefined,
      };

      if (isImage) {
        try {
          attachment.imageBase64 = await readFileAsBase64(file);
        } catch { /* vision skipped */ }
      } else if (isCsvOrTsv) {
        const text = await file.text();
        const delimiter = file.name.endsWith('.tsv') || fileType === 'text/tab-separated-values' ? '\t' : ',';
        attachment.data = parseDelimitedFile(text, delimiter);
      } else if (isTextFile) {
        const text = await file.text();
        attachment.textContent = text.slice(0, 10000);
      } else if (isJsonFile) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          attachment.textContent = JSON.stringify(parsed, null, 2).slice(0, 10000);
        } catch {
          const text = await file.text();
          attachment.textContent = text.slice(0, 10000);
        }
      } else if (isPdf) {
        const pdfText = await extractPdfText(file);
        attachment.textContent = pdfText.length > 50
          ? `[PDF: ${file.name}]\n${pdfText}`
          : `[PDF: ${file.name} — text extraction limited. Please describe what you want analyzed from this document.]`;
      }

      newAttachments.push(attachment);
    }

    return newAttachments;
  }, []);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAttachments = await processFiles(files);
    setUploadedFiles(prev => [...prev, ...newAttachments]);
    console.log('[v0] Files uploaded:', newAttachments.length);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [processFiles]);

  const removeAttachment = useCallback((id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file && file.url) URL.revokeObjectURL(file.url);
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const saveFileToProfile = useCallback((
    file: FileAttachment,
    onSuccess: (msg: string) => void,
    onError: (msg: string) => void,
  ) => {
    try {
      const existing = JSON.parse(localStorage.getItem('leverage_saved_files') || '[]');
      const entry = {
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        data: file.data ?? null,
        textContent: file.textContent ?? null,
        savedAt: new Date().toISOString(),
      };
      const deduped = existing.filter((f: { name: string }) => f.name !== entry.name);
      localStorage.setItem('leverage_saved_files', JSON.stringify([entry, ...deduped].slice(0, 20)));
      onSuccess(`"${file.name}" saved to your profile`);
    } catch {
      onError('Could not save file to profile');
    }
  }, []);

  return { uploadedFiles, fileInputRef, processFiles, handleFileUpload, removeAttachment, saveFileToProfile, setUploadedFiles };
}

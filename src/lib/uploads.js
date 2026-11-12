import { uploadPolicy } from './storage-policy';
export async function uploadFile(file, { courseId } = {}) {
  if (!file?.size) return null;
  uploadPolicy(file.name, file.size);
  const response = await fetch('/api/storage/upload', {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
      'x-codeemy-upload': '1',
      'x-file-name': encodeURIComponent(file.name),
      ...(courseId ? { 'x-course-id': courseId } : {}),
    },
    body: file,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'File upload failed. Please retry.');
  return result;
}
export function downloadFileUrl(file) {
  return file.download || file.data;
}
export async function deleteStoredFile(file) {
  if (file?.storage !== 'r2') return;
  const response = await fetch(file.data, {
    method: 'DELETE',
    headers: { 'x-codeemy-upload': '1' },
  });
  if (!response.ok) throw new Error('Could not remove the Cloudflare file. Please retry.');
}

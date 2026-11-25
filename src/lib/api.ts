import { auth } from './firebase';

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const user = auth.currentUser;
  const headers = new Headers(options.headers || {});

  if (user) {
    const token = await user.getIdToken();
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let parsed: unknown = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { error: text };
  }

  if (!res.ok) {
    const errObj = parsed as { error?: string };
    throw new Error(errObj.error || `Request failed with status ${res.status}`);
  }

  return parsed as T;
}

export async function uploadDatasetsWithProgress(
  formData: FormData,
  onProgress: (pct: number) => void,
): Promise<{ datasets: unknown[] }> {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : '';

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/datasets/upload', true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || `Upload failed with status ${xhr.status}`));
        }
      } catch {
        reject(new Error('Unexpected response from upload endpoint.'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during dataset upload.'));
    xhr.send(formData);
  });
}

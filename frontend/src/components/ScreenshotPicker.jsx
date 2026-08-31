import { isNative, pickScreenshotFiles } from '../services/native';

export const MAX_SCREENSHOTS = 5;

/**
 * Multi-screenshot dropzone shared by the upload/update/add-holdings modals.
 * A long position list doesn't fit one phone screen, so users can attach up to
 * MAX_SCREENSHOTS scrolled views of the same account; the backend analyzes them
 * as one batch. Clicking again adds more; each file can be removed individually.
 */
export default function ScreenshotPicker({ files, onChange, disabled = false, inputId = 'screenshot-picker' }) {
  const addFiles = (list) => {
    const images = [...list].filter((f) => f.type.startsWith('image/'));
    const merged = [...files, ...images].slice(0, MAX_SCREENSHOTS);
    if (merged.length) onChange(merged);
    return images.length === [...list].length; // false → a non-image was dropped
  };

  const handleInput = (e) => {
    addFiles(e.target.files || []);
    e.target.value = ''; // allow re-picking the same file
  };

  // In the iOS shell the hidden <input type=file> opens the clunky web picker;
  // intercept and use the native multi-select photo library sheet instead.
  const handleNativePick = async (e) => {
    if (!isNative || disabled) { if (isNative) e.preventDefault(); return; }
    e.preventDefault();
    try {
      const picked = await pickScreenshotFiles(MAX_SCREENSHOTS - files.length);
      if (picked.length) addFiles(picked);
    } catch {
      /* picker unavailable: nothing to add */
    }
  };

  const removeAt = (idx) => onChange(files.filter((_, i) => i !== idx));

  return (
    <div>
      <div className="border-2 border-dashed dropzone rounded-md p-5 text-center transition-colors">
        <input type="file" accept="image/*" multiple onChange={handleInput} className="hidden" id={inputId} disabled={disabled} />
        <label htmlFor={inputId} className={`cursor-pointer block ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={handleNativePick}>
          {files.length ? (
            <div>
              <svg className="mx-auto h-10 w-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="mt-2 text-sm text-dim">
                {files.length} screenshot{files.length > 1 ? 's' : ''} selected
                {files.length < MAX_SCREENSHOTS && <span className="text-[var(--accent)]"> · add more</span>}
              </p>
            </div>
          ) : (
            <div>
              <svg className="mx-auto h-10 w-10 text-dim" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm text-dim"><span className="font-semibold">Click to upload</span> or drag and drop</p>
              <p className="text-xs text-dim">Up to {MAX_SCREENSHOTS} screenshots of the same account (scroll the list, snap each part)</p>
            </div>
          )}
        </label>
      </div>
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between text-xs text-mid px-2 py-1.5 rounded border border-app">
              <span className="truncate">{i + 1}. {f.name}</span>
              <button type="button" onClick={() => removeAt(i)} disabled={disabled}
                className="ml-2 shrink-0 text-dim hover:text-strong" title="Remove">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

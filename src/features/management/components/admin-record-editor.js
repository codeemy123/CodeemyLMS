'use client';
import { useEffect, useState } from 'react';
import { X, Pencil, Trash2, Save } from 'lucide-react';
import { adminResources } from '@/config/admin-resources';
import { api } from '@/features/database/api';
import { uploadFile } from '@/lib/uploads';
import { useWorkspace } from '@/features/workspace/context/workspace-context';
function inputValue(field, value) {
  if (value == null) return field.default ?? '';
  if (field.type === 'date') return new Date(value).toISOString().slice(0, 10);
  if (field.type === 'datetime-local') {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return String(value);
}
export function AdminRecordForm({ entity, record, onSaved, onCancel }) {
  const config = adminResources[entity];
  const [lookupReady, setLookupReady] = useState(
    !config.fields.some((field) => field.type === 'reference'),
  );
  const [references, setReferences] = useState(() =>
    Object.fromEntries(
      config.fields
        .filter((field) => field.type === 'reference')
        .map((field) => [field.name, record?.[field.name] || '']),
    ),
  );
  const [options, setOptions] = useState({}),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    api('/api/admin/record-options')
      .then((data) => {
        setOptions(data);
        setLookupReady(true);
      })
      .catch((e) => setMessage(e.message));
  }, []);
  return (
    <form
      className="auth-form admin-record-form"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget),
          body = {};
        for (const f of config.fields) {
          const value = f.type === 'checkbox' ? form.has(f.name) : form.get(f.name);
          body[f.name] =
            f.type === 'datetime-local' && value ? new Date(value).toISOString() : value;
        }
        setBusy(true);
        try {
          await api('/api/admin/records/' + entity + (record ? '/' + record.id : ''), {
            method: record ? 'PATCH' : 'POST',
            body: JSON.stringify(body),
          });
          setMessage(config.label + ' saved to database.');
          await onSaved?.();
        } catch (e) {
          setMessage(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {config.fields.map((field) => (
        <label key={field.name}>
          {field.label}
          {field.type === 'reference' ? (
            <select
              aria-label={field.label}
              name={field.name}
              value={references[field.name] || ''}
              onChange={(event) =>
                setReferences((current) => ({ ...current, [field.name]: event.target.value }))
              }
              required={field.required}
            >
              <option value="">Choose {field.label.toLowerCase()}</option>
              {(options[field.source] || []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
            </select>
          ) : field.type === 'select' ? (
            <select
              aria-label={field.label}
              name={field.name}
              defaultValue={record?.[field.name] || field.options[0]}
            >
              {field.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              aria-label={field.label}
              name={field.name}
              defaultValue={record?.[field.name] || ''}
              rows={3}
              required={field.required}
              maxLength={20000}
            />
          ) : field.type === 'checkbox' ? (
            <input name={field.name} type="checkbox" defaultChecked={!!record?.[field.name]} />
          ) : (
            <input
              aria-label={field.label}
              name={field.name}
              type={field.type === 'url' ? 'text' : field.type}
              defaultValue={inputValue(field, record?.[field.name])}
              required={field.required}
              min={field.min}
              max={field.type === 'number' ? field.max : undefined}
              step={field.type === 'number' ? 'any' : undefined}
              maxLength={field.type === 'text' ? field.max || 255 : undefined}
            />
          )}
        </label>
      ))}
      {config.fields
        .filter(
          (field) => field.type === 'url' && field.name !== 'meeting_url' && entity !== 'careers',
        )
        .map((field) => (
          <label key={'upload-' + field.name} className="admin-record-upload">
            Upload {field.label.toLowerCase()}
            <input
              type="file"
              aria-label={'Upload ' + field.label}
              disabled={busy}
              onChange={async (event) => {
                const input = event.currentTarget,
                  file = input.files?.[0],
                  form = input.form;
                if (!file) return;
                const values = new FormData(form);
                const courseId =
                  entity === 'lessons'
                    ? options.modules?.find((m) => m.id === values.get('module_id'))?.course_id
                    : values.get('course_id');
                if (entity !== 'certificates' && !courseId) {
                  setMessage('Choose a course or module before uploading.');
                  input.value = '';
                  return;
                }
                setBusy(true);
                try {
                  const saved = await uploadFile(
                    file,
                    entity === 'certificates' ? {} : { courseId },
                  );
                  form.elements[field.name].value = saved.data;
                  setMessage('File uploaded. Save the record to attach it.');
                } catch (error) {
                  setMessage(error.message);
                } finally {
                  setBusy(false);
                  input.value = '';
                }
              }}
            />
            <small>Videos up to 100 MB; other supported files up to 20 MB.</small>
          </label>
        ))}
      {entity === 'announcements' && (
        <p className="admin-record-hint">
          Choose a course or batch to target its members. Leave both empty to publish academy-wide.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="admin-record-buttons">
        <button className="btn" disabled={busy || !lookupReady}>
          <Save size={15} />
          {busy ? 'Saving...' : 'Save ' + config.label.toLowerCase()}
        </button>
        {onCancel && (
          <button className="btn secondary" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
export default function AdminRecordActions({
  entity,
  record,
  onSaved,
  edit = true,
  remove = true,
}) {
  const { role } = useWorkspace();
  const [editing, setEditing] = useState(false),
    [removing, setRemoving] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  if (role !== 'Admin') return null;
  const config = adminResources[entity],
    label = record.title || record.name || record.full_name || config.label;
  return (
    <div className="admin-record-actions">
      {edit && (
        <button
          className="btn secondary"
          aria-label={'Edit ' + config.label.toLowerCase() + ': ' + label}
          onClick={() => {
            setEditing(true);
            setMessage('');
          }}
        >
          <Pencil size={14} />
          Edit
        </button>
      )}
      {remove && (
        <button
          className="btn secondary admin-remove-button"
          aria-label={'Remove ' + config.label.toLowerCase() + ': ' + label}
          onClick={() => {
            setRemoving(true);
            setMessage('');
          }}
        >
          <Trash2 size={14} />
          {entity === 'people' ? 'Remove access' : 'Remove'}
        </button>
      )}
      {message && <p role="status">{message}</p>}
      {(editing || removing) && (
        <div className="admin-record-backdrop">
          <section
            className="admin-record-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={(editing ? 'Edit ' : 'Remove ') + config.label.toLowerCase()}
          >
            <div className="admin-record-heading">
              <h2>
                {editing ? 'Edit' : 'Remove'} {config.label.toLowerCase()}
              </h2>
              <button
                className="academy-text-button"
                aria-label="Close editor"
                onClick={() => {
                  setEditing(false);
                  setRemoving(false);
                }}
              >
                <X size={20} />
              </button>
            </div>
            {editing ? (
              <AdminRecordForm
                entity={entity}
                record={record}
                onSaved={async () => {
                  await onSaved?.();
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <>
                <p>
                  {entity === 'people' ? 'Remove portal access for' : 'Remove'}{' '}
                  <strong>{label}</strong>?
                </p>
                <p>
                  {entity === 'people'
                    ? 'The account becomes inactive. Existing academic history stays in place.'
                    : 'Linked academic records prevent deletion. Files and audit history are preserved.'}
                </p>
                {message && <p role="alert">{message}</p>}
                <div className="admin-record-buttons">
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await api('/api/admin/records/' + entity + '/' + record.id, {
                          method: 'DELETE',
                        });
                        await onSaved?.();
                        setRemoving(false);
                        setMessage(
                          entity === 'people' ? 'Account access removed.' : 'Record removed.',
                        );
                      } catch (e) {
                        setMessage(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Confirm {entity === 'people' ? 'remove access' : 'remove'}
                  </button>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={() => setRemoving(false)}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

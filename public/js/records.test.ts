import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Integration test for the REAL public/js/records.js.
 *
 * Injects public/index.html's <body> into vitest's jsdom global document,
 * stubs fetch/api responses, then imports records.js and fires
 * DOMContentLoaded so the module wires its real listeners. Exercises the
 * records page flows: initial load, filtering, edit/delete dialogs, and
 * view-chart navigation.
 */

const originalFetch = global.fetch;

const RECORD_1 = {
  id: 1,
  start_time: 1600000000,
  end_time: 1600003600,
  type: 'time_lag',
  notes: 'first divergence',
  tags: 'btc',
  created_at: 1,
  updated_at: 1,
};

const RECORD_2 = {
  id: 2,
  start_time: 1600004000,
  end_time: 1600007600,
  type: 'structural',
  notes: 'second',
  tags: 'eth',
  created_at: 2,
  updated_at: 2,
};

let fetchMock: ReturnType<typeof vi.fn>;

function stubApiResponse(data: unknown): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ ok: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

beforeAll(async () => {
  const html = fs.readFileSync(path.resolve(__dirname, '../../public/index.html'), 'utf-8');
  const bodyMatch = /<body[^>]*>([\s\S]*)<\/body>/.exec(html);
  if (!bodyMatch) throw new Error('index.html has no <body>');
  document.body.innerHTML = bodyMatch[1];

  // jsdom lacks showModal()/close() on <dialog> — polyfill so the real
  // openForm()/confirmDelete() flows can run.
  (HTMLDialogElement.prototype as unknown as { showModal: unknown }).showModal = function (
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
  (HTMLDialogElement.prototype as unknown as { close: unknown }).close = function (
    this: HTMLDialogElement,
  ) {
    this.removeAttribute('open');
  };
  // jsdom does not implement navigation; record the target instead by
// swapping window.location for a stub (its location.assign is read-only).
  Object.defineProperty(window, 'location', {
    value: { assign: vi.fn() },
    writable: true,
    configurable: true,
  });

  fetchMock = vi.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  stubApiResponse([RECORD_1, RECORD_2]);

  await import('./records.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
});

afterEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
  stubApiResponse([RECORD_1, RECORD_2]);
});

function el(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
}

describe('records.js DOM wiring (real file)', () => {
  it('loads and renders records into the table on init', async () => {
    await vi.waitFor(() => {
      const rows = document.querySelectorAll('#records-table tbody tr');
      expect(rows.length).toBe(2);
      expect(rows[0].textContent).toContain('first divergence');
    });
  });

  it('reloads with a type filter when #type-filter changes', async () => {
    fetchMock.mockClear();
    const select = el('type-filter') as HTMLSelectElement;
    select.value = 'structural';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('type=structural');
    });
  });

  it('reloads with a tag filter (debounced) when #tag-filter is typed', async () => {
    fetchMock.mockClear();
    const input = el('tag-filter') as HTMLInputElement;
    input.value = 'btc';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    await vi.waitFor(() => {
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('tag=btc');
    });
  });

  it('shows the filter error when the API call fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const select = el('type-filter') as HTMLSelectElement;
    select.value = 'structural';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    await vi.waitFor(() => {
      expect((el('filter-error') as HTMLElement).hidden).toBe(false);
    });
  });

  it('view-chart action navigates to charts.html with the record time range', async () => {
    const assignMock = vi.mocked((window as unknown as { location: { assign: ReturnType<typeof vi.fn> } }).location.assign);
    assignMock.mockClear();

    const viewBtn = document.querySelector('button[data-action="view-chart"]') as HTMLButtonElement;
    viewBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1);
      const target = assignMock.mock.calls[0][0] as string;
      expect(target).toContain('/charts.html?start=');
      expect(target).toContain('&end=');
    });
  });

  it('edit action opens the record dialog pre-filled with the record', async () => {
    const editBtn = document.querySelector('button[data-action="edit"]') as HTMLButtonElement;
    editBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(el('record-dialog').hasAttribute('open')).toBe(true);
    });
    expect((el('notes') as HTMLTextAreaElement).value).toBe('first divergence');
  });

  it('delete action opens the delete dialog with a summary', async () => {
    const deleteBtn = document.querySelector('button[data-action="delete"]') as HTMLButtonElement;
    deleteBtn.dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(el('delete-dialog').hasAttribute('open')).toBe(true);
    });
    expect(el('delete-summary').textContent).toContain('時間差');
  });

  it('saves a new record via POST and reloads the list', async () => {
    fetchMock.mockClear();
    const postRes = new Response(JSON.stringify({ ok: true, data: { ...RECORD_1, id: 3 } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
    fetchMock.mockResolvedValueOnce(postRes);
    stubApiResponse([RECORD_1, RECORD_2, { ...RECORD_1, id: 3, notes: 'new' }]);

    // Open the "new record" form (data-part pickers are populated from now()).
    (el('new-record') as HTMLButtonElement).dispatchEvent(new Event('click', { bubbles: true }));
    await vi.waitFor(() => expect(el('record-dialog').hasAttribute('open')).toBe(true));

    // Both pickers default to "now"; force start hour 0 / end hour 1 so
    // start_time < end_time passes records.js's client-side validation.
    const startPicker = document.querySelector('[data-picker="start"]');
    const endPicker = document.querySelector('[data-picker="end"]');
    startPicker!.querySelector('[data-part="hour"]').value = '0';
    endPicker!.querySelector('[data-part="hour"]').value = '1';

    (el('notes') as HTMLTextAreaElement).value = 'new';
    (el('tags') as HTMLInputElement).value = 'fresh';
    (el('save-record') as HTMLButtonElement).dispatchEvent(new Event('click', { bubbles: true }));

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/records', expect.objectContaining({ method: 'POST' }));
    });
    await vi.waitFor(() => {
      const rows = document.querySelectorAll('#records-table tbody tr');
      expect(rows.length).toBe(3);
    });
  });
});
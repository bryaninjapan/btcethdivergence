import { api, ApiError, describeApiError } from './api.js';
import { Timestamp } from './timestamp.js';
import {
  epochToParts,
  hourOptions,
  monthOptions,
  yearOptions,
} from './datetime.js';
import { recordToRange } from './managers/ChartManager.js';
import { DIVERGENCE_TYPES, TYPE_LABELS, MSB_LABELS } from './divergence.js';
import { createRecordsManager } from './records-state.js';
import { consoleSink, createBeaconSink, createLogger, installGlobalHandlers } from './logger.js';
import {
  fillSelect,
  rebuildDays,
  setPickerFromEpoch,
  pickerEpoch,
} from './datetime-helpers.js';

// Constants
const FILTER_DEBOUNCE_MS = 250;  // 250ms debounce for filter input

// Structured logger: dev console (structured JSON) + client-log beacon.
const logger = createLogger('records', { sinks: [consoleSink(), createBeaconSink()] });

// Records state factory instance
const recordsManager = createRecordsManager();

function formatTime(ts) {
  return new Date(ts * 1000).toISOString();
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
}

function msbLabel(msb) {
  return MSB_LABELS[msb] || msb;
}

/**
 * Populate the type filter <select> and the record-dialog type radios at
 * runtime from the shared DIVERGENCE_TYPES / TYPE_LABELS constants so the
 * frontend stays in sync with the backend single source of truth without
 * hardcoding divergence strings in index.html.
 */
function populateTypeOptions() {
  const filter = document.querySelector('#type-filter');
  for (const type of DIVERGENCE_TYPES) {
    const option = document.createElement('option');
    option.value = type;
    option.textContent = TYPE_LABELS[type] || type;
    filter.appendChild(option);
  }

  const options = document.querySelector('#type-options');
  options.replaceChildren();
  DIVERGENCE_TYPES.forEach((type, index) => {
    const label = document.createElement('label');
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'type';
    radio.value = type;
    if (index === 0) {
      radio.checked = true;
      radio.defaultChecked = true;
    }
    label.append(radio, ` ${TYPE_LABELS[type] || type}`);
    options.appendChild(label);
  });
}

function renderTable(records) {
  const tbody = document.querySelector('#records-table tbody');
  tbody.replaceChildren();
  for (const record of records) {
    const tr = document.createElement('tr');
    tr.dataset.id = String(record.id);
    const cells = [
      String(record.id),
      formatTime(record.start_time),
      formatTime(record.end_time),
      typeLabel(record.type),
      msbLabel(record.msb),
      record.notes,
      record.tags,
    ];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    const actionTd = document.createElement('td');
    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.textContent = '查看K線';
    viewBtn.dataset.action = 'view-chart';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '編輯';
    editBtn.dataset.action = 'edit';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '刪除';
    deleteBtn.dataset.action = 'delete';
    actionTd.append(viewBtn, editBtn, deleteBtn);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
  }
}

function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

async function loadRecords() {
  const requestToken = recordsManager.nextRequestToken();
  const params = new URLSearchParams();
  const type = document.querySelector('#type-filter').value;
  const tag = document.querySelector('#tag-filter').value.trim();
  if (type) params.set('type', type);
  if (tag) params.set('tag', tag);
  const qs = params.toString();
  try {
    const data = await api(qs ? `/api/records?${qs}` : '/api/records');
    if (requestToken !== recordsManager.getLatestRequestToken()) return;
    recordsManager.setRecords(data);
    renderTable(data);
  } catch (error) {
    logger.captureException('loadRecords.error', error, { type, tag });
    throw error;
  }
}

/**
 * Display error based on error type.
 */
function showFilterError(error) {
  const filterError = document.querySelector('#filter-error');
  if (!filterError) return;

  const message = describeApiError(error, 'Failed to load records');

  filterError.textContent = message;
  filterError.hidden = false;
}

function populatePicker(pickerEl) {
  fillSelect(pickerEl.querySelector('[data-part="year"]'), yearOptions());
  fillSelect(pickerEl.querySelector('[data-part="month"]'), monthOptions());
  fillSelect(pickerEl.querySelector('[data-part="hour"]'), hourOptions());
  const parts = epochToParts(Timestamp.now().toSeconds());
  pickerEl.querySelector('[data-part="year"]').value = String(parts.year);
  pickerEl.querySelector('[data-part="month"]').value = String(parts.month);
  pickerEl.querySelector('[data-part="hour"]').value = String(parts.hour);
  pickerEl.querySelector('[data-part="day"]').value = String(parts.day);
  rebuildDays(pickerEl);
}

function openForm(record = null) {
  const form = document.forms['record-form'];
  form.reset();
  if (record) {
    recordsManager.startEditing(record.id);
  } else {
    recordsManager.stopEditing();
  }
  document.querySelector('#dialog-title').textContent = record ? '編輯記錄' : '新增記錄';
  const startPicker = document.querySelector('[data-picker="start"]');
  const endPicker = document.querySelector('[data-picker="end"]');
  if (record) {
    setPickerFromEpoch(startPicker, record.start_time);
    setPickerFromEpoch(endPicker, record.end_time);
    const typeRadio = form.querySelector(`input[name="type"][value="${record.type}"]`);
    if (typeRadio) typeRadio.checked = true;
    const msbRadio = form.querySelector(`input[name="msb"][value="${record.msb}"]`);
    if (msbRadio) msbRadio.checked = true;
    document.querySelector('#notes').value = record.notes;
    document.querySelector('#tags').value = record.tags;
  } else {
    populatePicker(startPicker);
    populatePicker(endPicker);
  }
  document.querySelector('#form-error').hidden = true;
  document.querySelector('#record-dialog').showModal();
}

async function submitForm() {
  const formError = document.querySelector('#form-error');
  const start = pickerEpoch(document.querySelector('[data-picker="start"]'));
  const end = pickerEpoch(document.querySelector('[data-picker="end"]'));
  if (start >= end) {
    formError.textContent = '開始時間必須早於結束時間';
    formError.hidden = false;
    logger.warn('submitForm.validation', '開始時間必須早於結束時間', { start, end });
    return;
  }

  // Validate radio button selection
  const typeRadio = document.querySelector('input[name="type"]:checked');
  if (!typeRadio) {
    formError.textContent = '請選擇類型';
    formError.hidden = false;
    logger.warn('submitForm.validation', '請選擇類型', {});
    return;
  }

  const msbRadio = document.querySelector('input[name="msb"]:checked');
  if (!msbRadio) {
    formError.textContent = '請選擇 MSB';
    formError.hidden = false;
    logger.warn('submitForm.validation', '請選擇 MSB', {});
    return;
  }

  try {
    const payload = {
      start_time: start,
      end_time: end,
      type: typeRadio.value,
      msb: msbRadio.value,
      notes: document.querySelector('#notes').value,
      tags: document.querySelector('#tags').value,
    };
    const editingId = recordsManager.getEditingId();
    const saved = editingId
      ? await api(`/api/records/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) })
      : await api('/api/records', { method: 'POST', body: JSON.stringify(payload) });
    recordsManager.stopEditing();
    document.querySelector('#record-dialog').close();
    await loadRecords();
    // Redaction rule: never log notes/tags content — lengths only.
    logger.info(editingId ? 'submitForm.update' : 'submitForm.create', editingId ? 'Record updated' : 'Record created', {
      record_id: saved?.id ?? editingId ?? null,
      notes_len: payload.notes.length,
      tags_len: payload.tags.length,
    });
  } catch (error) {
    logger.captureException('submitForm.error', error, {
      record_id: recordsManager.getEditingId() ?? null,
      notes_len: document.querySelector('#notes').value.length,
      tags_len: document.querySelector('#tags').value.length,
    });
    const message = describeApiError(error, 'Failed to save record');

    formError.textContent = message;
    formError.hidden = false;
  }
}

function confirmDelete(record) {
  recordsManager.startDelete(record.id);
  document.querySelector('#delete-summary').textContent =
    `${typeLabel(record.type)} ${formatTime(record.start_time)} → ${formatTime(record.end_time)}`;
  document.querySelector('#delete-error').hidden = true;
  document.querySelector('#delete-dialog').showModal();
}

function closeDeleteDialog() {
  recordsManager.clearDelete();
  document.querySelector('#delete-dialog').close();
}

async function confirmDeleteAction() {
  const deleteId = recordsManager.getDeleteId();
  if (deleteId === null) return;
  const deleteError = document.querySelector('#delete-error');
  try {
    await api(`/api/records/${deleteId}`, { method: 'DELETE' });
    closeDeleteDialog();
    await loadRecords();
    logger.info('delete.success', 'Record deleted', { record_id: deleteId });
  } catch (error) {
    logger.captureException('delete.error', error, { record_id: deleteId });
    const message = describeApiError(error, 'Failed to delete record');

    deleteError.textContent = message;
    deleteError.hidden = false;
  }
}

function wireRowActions() {
  const tbody = document.querySelector('#records-table tbody');
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    const records = recordsManager.getRecords();
    const record = records.find((r) => r.id === id);
    if (!record) return;
    if (btn.dataset.action === 'view-chart') {
      const { startMs, endMs } = recordToRange(record);
      window.location.assign(`/charts.html?start=${startMs}&end=${endMs}`);
    }
    if (btn.dataset.action === 'edit') openForm(record);
    if (btn.dataset.action === 'delete') confirmDelete(record);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireRowActions();
  populateTypeOptions();
  document.querySelector('#type-filter').addEventListener('change', () => {
    loadRecords().catch(showFilterError);
  });
  document.querySelector('#tag-filter').addEventListener('input', debounce(() => {
    loadRecords().catch(showFilterError);
  }, FILTER_DEBOUNCE_MS));
  const startPicker = document.querySelector('[data-picker="start"]');
  const endPicker = document.querySelector('[data-picker="end"]');
  populatePicker(startPicker);
  populatePicker(endPicker);
  for (const pickerEl of [startPicker, endPicker]) {
    pickerEl
      .querySelector('[data-part="year"]')
      .addEventListener('change', () => rebuildDays(pickerEl));
    pickerEl
      .querySelector('[data-part="month"]')
      .addEventListener('change', () => rebuildDays(pickerEl));
  }
  document.querySelector('#new-record').addEventListener('click', () => openForm(null));
  document.querySelector('#save-record').addEventListener('click', submitForm);
  document.querySelector('#cancel-record').addEventListener('click', () => {
    document.querySelector('#record-dialog').close();
  });
  document.querySelector('#record-form').addEventListener('submit', (e) => e.preventDefault());
  document.querySelector('#confirm-delete').addEventListener('click', confirmDeleteAction);
  document.querySelector('#cancel-delete').addEventListener('click', closeDeleteDialog);
  document.querySelector('#delete-dialog').addEventListener('cancel', closeDeleteDialog);

  // Capture uncaught exceptions and unhandled rejections into the logger
  // (which also forwards them to the client-log beacon).
  installGlobalHandlers(logger);

  loadRecords().catch((e) => {
    logger.captureException('loadRecords.init', e, {});
    // Table remains empty with visible error, better than silent failure
  });
});
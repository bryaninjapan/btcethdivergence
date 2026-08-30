import { api } from './api.js';
import {
  buildUtcEpoch,
  dayOptions,
  daysInMonth,
  epochToParts,
  hourOptions,
  monthOptions,
  yearOptions,
} from './datetime.js';

const TYPE_LABELS = {
  time_lag: '時間差',
  structural: '結構背離',
  opposite: '完全反向',
};

let recordsCache = [];
let editingId = null;
let deleteId = null;
let latestRequestToken = 0;

function formatTime(ts) {
  return new Date(ts * 1000).toISOString();
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type;
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
      record.notes,
      record.tags,
    ];
    for (const text of cells) {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    }
    const actionTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '編輯';
    editBtn.dataset.action = 'edit';
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '刪除';
    deleteBtn.dataset.action = 'delete';
    actionTd.append(editBtn, deleteBtn);
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
  const requestToken = ++latestRequestToken;
  const params = new URLSearchParams();
  const type = document.querySelector('#type-filter').value;
  const tag = document.querySelector('#tag-filter').value.trim();
  if (type) params.set('type', type);
  if (tag) params.set('tag', tag);
  const qs = params.toString();
  const data = await api(qs ? `/api/records?${qs}` : '/api/records');
  if (requestToken !== latestRequestToken) return;
  recordsCache = data;
  renderTable(data);
}

function showFilterError(error) {
  const filterError = document.querySelector('#filter-error');
  if (filterError) {
    filterError.textContent = error.message || 'Failed to load records';
    filterError.hidden = false;
  }
}

function fillSelect(select, values) {
  select.replaceChildren();
  for (const v of values) {
    const opt = document.createElement('option');
    opt.value = String(v);
    opt.textContent = String(v);
    select.appendChild(opt);
  }
}

function rebuildDays(pickerEl) {
  const yearSel = pickerEl.querySelector('[data-part="year"]');
  const monthSel = pickerEl.querySelector('[data-part="month"]');
  const daySel = pickerEl.querySelector('[data-part="day"]');
  const max = daysInMonth(Number(yearSel.value), Number(monthSel.value));
  const prev = Number(daySel.value) || 1;
  fillSelect(daySel, dayOptions(Number(yearSel.value), Number(monthSel.value)));
  daySel.value = String(Math.min(prev, max));
}

function populatePicker(pickerEl) {
  fillSelect(pickerEl.querySelector('[data-part="year"]'), yearOptions());
  fillSelect(pickerEl.querySelector('[data-part="month"]'), monthOptions());
  fillSelect(pickerEl.querySelector('[data-part="hour"]'), hourOptions());
  const parts = epochToParts(Math.floor(Date.now() / 1000));
  pickerEl.querySelector('[data-part="year"]').value = String(parts.year);
  pickerEl.querySelector('[data-part="month"]').value = String(parts.month);
  pickerEl.querySelector('[data-part="hour"]').value = String(parts.hour);
  pickerEl.querySelector('[data-part="day"]').value = String(parts.day);
  rebuildDays(pickerEl);
}

function setPickerFromEpoch(pickerEl, ts) {
  const parts = epochToParts(ts);
  pickerEl.querySelector('[data-part="year"]').value = String(parts.year);
  pickerEl.querySelector('[data-part="month"]').value = String(parts.month);
  pickerEl.querySelector('[data-part="day"]').value = String(parts.day);
  pickerEl.querySelector('[data-part="hour"]').value = String(parts.hour);
  rebuildDays(pickerEl);
}

function pickerEpoch(pickerEl) {
  const year = Number(pickerEl.querySelector('[data-part="year"]').value);
  const month = Number(pickerEl.querySelector('[data-part="month"]').value);
  const day = Number(pickerEl.querySelector('[data-part="day"]').value);
  const hour = Number(pickerEl.querySelector('[data-part="hour"]').value);
  return buildUtcEpoch(year, month, day, hour);
}

function openForm(record = null) {
  const form = document.forms['record-form'];
  form.reset();
  editingId = record ? record.id : null;
  document.querySelector('#dialog-title').textContent = record ? '編輯記錄' : '新增記錄';
  const startPicker = document.querySelector('[data-picker="start"]');
  const endPicker = document.querySelector('[data-picker="end"]');
  if (record) {
    setPickerFromEpoch(startPicker, record.start_time);
    setPickerFromEpoch(endPicker, record.end_time);
    const typeRadio = form.querySelector(`input[name="type"][value="${record.type}"]`);
    if (typeRadio) typeRadio.checked = true;
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
    return;
  }
  try {
    const payload = {
      start_time: start,
      end_time: end,
      type: document.querySelector('input[name="type"]:checked').value,
      notes: document.querySelector('#notes').value,
      tags: document.querySelector('#tags').value,
    };
    if (editingId) {
      await api(`/api/records/${editingId}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/api/records', { method: 'POST', body: JSON.stringify(payload) });
    }
    editingId = null;
    document.querySelector('#record-dialog').close();
    await loadRecords();
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  }
}

function confirmDelete(record) {
  deleteId = record.id;
  document.querySelector('#delete-summary').textContent =
    `${typeLabel(record.type)} ${formatTime(record.start_time)} → ${formatTime(record.end_time)}`;
  document.querySelector('#delete-error').hidden = true;
  document.querySelector('#delete-dialog').showModal();
}

function closeDeleteDialog() {
  deleteId = null;
  document.querySelector('#delete-dialog').close();
}

async function confirmDeleteAction() {
  if (deleteId === null) return;
  const deleteError = document.querySelector('#delete-error');
  try {
    await api(`/api/records/${deleteId}`, { method: 'DELETE' });
    closeDeleteDialog();
    await loadRecords();
  } catch (error) {
    deleteError.textContent = error.message;
    deleteError.hidden = false;
  }
}

function wireRowActions() {
  const tbody = document.querySelector('#records-table tbody');
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    const record = recordsCache.find((r) => r.id === id);
    if (!record) return;
    if (btn.dataset.action === 'edit') openForm(record);
    if (btn.dataset.action === 'delete') confirmDelete(record);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  wireRowActions();
  document.querySelector('#type-filter').addEventListener('change', () => {
    loadRecords().catch(showFilterError);
  });
  document.querySelector('#tag-filter').addEventListener('input', debounce(() => {
    loadRecords().catch(showFilterError);
  }, 250));
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
  loadRecords().catch((e) => {
    console.error('Failed to load records on init:', e);
    // Table remains empty with visible error, better than silent failure
  });
});
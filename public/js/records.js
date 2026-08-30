import { api } from './api.js';

const TYPE_LABELS = {
  time_lag: '時間差',
  structural: '結構背離',
  opposite: '完全反向',
};

const MIN_UNIX_EPOCH = 1609459200; // 2021-01-01T00:00:00Z
const MAX_UNIX_EPOCH = 4102444800; // 2100-01-01T00:00:00Z

let recordsCache = [];
let editingId = null;
let deleteId = null;

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

async function loadRecords() {
  const data = await api('/api/records');
  recordsCache = data;
  renderTable(data);
}

function parseEpoch(value) {
  const trimmed = String(value).trim();
  if (/^\d+$/.test(trimmed)) {
    const sec = Number(trimmed);
    return sec >= MIN_UNIX_EPOCH && sec <= MAX_UNIX_EPOCH ? sec : null;
  }
  const ms = Date.parse(trimmed) / 1000;
  return Number.isNaN(ms) ? null : ms;
}

function openForm(record = null) {
  const form = document.forms['record-form'];
  form.reset();
  editingId = record ? record.id : null;
  document.querySelector('#dialog-title').textContent = record ? '編輯記錄' : '新增記錄';
  if (record) {
    document.querySelector('#start_time').value =
      new Date(record.start_time * 1000).toISOString().slice(0, 19) + 'Z';
    document.querySelector('#end_time').value =
      new Date(record.end_time * 1000).toISOString().slice(0, 19) + 'Z';
    const typeRadio = form.querySelector(`input[name="type"][value="${record.type}"]`);
    if (typeRadio) typeRadio.checked = true;
    document.querySelector('#notes').value = record.notes;
    document.querySelector('#tags').value = record.tags;
  }
  document.querySelector('#form-error').hidden = true;
  document.querySelector('#record-dialog').showModal();
}

async function submitForm() {
  const formError = document.querySelector('#form-error');
  const start = parseEpoch(document.querySelector('#start_time').value);
  const end = parseEpoch(document.querySelector('#end_time').value);
  if (start === null || end === null) {
    formError.textContent = '開始/結束時間需為 ISO-8601 UTC 或 unix 秒數';
    formError.hidden = false;
    return;
  }
  if (start >= end) {
    formError.textContent = '開始時間必須早於結束時間';
    formError.hidden = false;
    return;
  }
  const payload = {
    start_time: start,
    end_time: end,
    type: document.querySelector('input[name="type"]:checked').value,
    notes: document.querySelector('#notes').value,
    tags: document.querySelector('#tags').value,
  };
  try {
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
  document.querySelector('#new-record').addEventListener('click', () => openForm(null));
  document.querySelector('#save-record').addEventListener('click', submitForm);
  document.querySelector('#cancel-record').addEventListener('click', () => {
    document.querySelector('#record-dialog').close();
  });
  document.querySelector('#record-form').addEventListener('submit', (e) => e.preventDefault());
  document.querySelector('#confirm-delete').addEventListener('click', confirmDeleteAction);
  document.querySelector('#cancel-delete').addEventListener('click', closeDeleteDialog);
  document.querySelector('#delete-dialog').addEventListener('cancel', closeDeleteDialog);
  loadRecords();
});
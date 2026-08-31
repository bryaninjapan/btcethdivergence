---
phase: 4
title: "Records Core CRUD — Implementation Notes"
date: 2026-08-31
---

# Phase 4 Implementation Notes

Technical deep-dive for records CRUD frontend and API chokepoint pattern.

---

## API Chokepoint Pattern

### Single Entry Point for Fetch

```javascript
// public/js/api.js
export async function api(path, options = {}) {
  const res = await fetch(path, options);
  const data = await res.json();
  
  if (!data.ok) {
    throw new Error(data.error);
  }
  
  return data.data;
}

class ApiError extends Error {
  constructor(public code, message) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### Benefits

| Aspect | Benefit |
|--------|---------|
| **Error Centralization** | All `fetch()` → `api.js`; one place for error handling |
| **Response Parsing** | All responses go through `{ ok, data/error }` check |
| **Future Auth** | If auth needed, add once in `api.js` (not in every caller) |
| **Monitoring** | Can log all requests in one place |

### Usage

```javascript
// records.js
const records = await api('/api/records');  // GET with no body
const record = await api('/api/records', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(input)
});
```

### Discipline Enforcement

Grep check: ensure `fetch(` only appears in `api.js`:

```bash
rg -n "fetch\(" public/js/records.js  # Should be 0
rg -n "fetch\(" public/js/api.js      # Should be 1 (the real fetch)
rg -n "fetch\(" public/js/charts.js   # Should be 0 (uses api.js)
```

---

## CRUD Operations

### CREATE (POST /api/records)

```javascript
async function submitForm() {
  const formData = {
    start_time: Math.floor(new Date(startField.value).getTime() / 1000),
    end_time: Math.floor(new Date(endField.value).getTime() / 1000),
    type: document.querySelector('input[name="type"]:checked').value,
    notes: document.getElementById('notes').value,
    tags: document.getElementById('tags').value.split(',').map(t => t.trim())
  };
  
  try {
    const record = await api('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    closeDialog();
    await loadRecords();  // Re-fetch to show new record
  } catch (error) {
    showFormError(error.message);
  }
}
```

**Server-side (route):**
```typescript
export default router.post('/api/records', async (c) => {
  const input = createRecordSchema.parse(await c.req.json());  // Zod validation
  const record = await db.createRecord(c.env.DB, input);
  return jsonOk(record, 201);
});
```

### READ (GET /api/records)

```javascript
async function loadRecords() {
  try {
    const records = await api('/api/records');
    renderTable(records);
  } catch (error) {
    showError(`Failed to load records: ${error.message}`);
  }
}

function renderTable(records) {
  const tbody = document.querySelector('#records-table tbody');
  tbody.innerHTML = '';  // Safe: clearing with empty string
  
  records.forEach(record => {
    const tr = document.createElement('tr');
    tr.dataset.id = record.id;
    
    const tdStart = document.createElement('td');
    tdStart.textContent = formatTime(record.start_time);  // Safe: textContent
    tr.appendChild(tdStart);
    
    const tdEnd = document.createElement('td');
    tdEnd.textContent = formatTime(record.end_time);
    tr.appendChild(tdEnd);
    
    const tdType = document.createElement('td');
    tdType.textContent = record.type;
    tr.appendChild(tdType);
    
    const tdActions = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.dataset.action = 'edit';
    editBtn.textContent = '編輯';
    tdActions.appendChild(editBtn);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.dataset.action = 'delete';
    deleteBtn.textContent = '刪除';
    tdActions.appendChild(deleteBtn);
    
    tr.appendChild(tdActions);
    tbody.appendChild(tr);
  });
}
```

### UPDATE (PUT /api/records/:id)

```javascript
async function submitForm(recordId) {
  const formData = {
    start_time: parseEpoch(startField.value),
    end_time: parseEpoch(endField.value),
    type: document.querySelector('input[name="type"]:checked').value,
    notes: document.getElementById('notes').value,
    tags: document.getElementById('tags').value.split(',').map(t => t.trim())
  };
  
  try {
    if (recordId) {
      // Update existing
      const record = await api(`/api/records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } else {
      // Create new
      const record = await api('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    }
    
    closeDialog();
    await loadRecords();
  } catch (error) {
    showFormError(error.message);
  }
}
```

### DELETE (DELETE /api/records/:id)

```javascript
function confirmDelete(recordId) {
  const record = findRecord(recordId);
  document.getElementById('delete-summary').textContent = 
    `${formatTime(record.start_time)} - ${formatTime(record.end_time)} (${record.type})`;
  
  document.getElementById('delete-confirm-btn').onclick = async () => {
    await performDelete(recordId);
  };
  
  document.getElementById('delete-dialog').showModal();
}

async function performDelete(recordId) {
  try {
    await api(`/api/records/${recordId}`, {
      method: 'DELETE'
    });
    
    document.getElementById('delete-dialog').close();
    await loadRecords();
  } catch (error) {
    showError(`Delete failed: ${error.message}`);
  }
}
```

---

## XSS Prevention

### textContent vs innerHTML

| Operation | Safe | Unsafe |
|-----------|------|--------|
| Display user data | `textContent = value` | `innerHTML = value` |
| Clear container | `innerHTML = ''` | n/a |
| Create new elements | `document.createElement()` | n/a |

### Example: Safe vs Unsafe

```javascript
// ✅ SAFE
const td = document.createElement('td');
td.textContent = record.notes;  // Any content treated as text
table.appendChild(td);

// ❌ UNSAFE
const td = document.createElement('td');
td.innerHTML = record.notes;  // If notes contains <img onerror=alert()>, code runs!
table.appendChild(td);
```

### Discipline Enforcement

```bash
rg -n "innerHTML" public/
# Should only appear in:
# - tbody.innerHTML = '';  (clearing)
# - Possibly html-template content (pre-built, not user data)
```

---

## Event Delegation Pattern

### One Listener Per Table

```javascript
// Single click listener on tbody
document.querySelector('#records-table tbody').addEventListener('click', (event) => {
  const button = event.target;
  if (button.dataset.action === 'edit') {
    const row = button.closest('tr');
    const recordId = row.dataset.id;
    openForm(recordId);
  } else if (button.dataset.action === 'delete') {
    const row = button.closest('tr');
    const recordId = row.dataset.id;
    confirmDelete(recordId);
  }
});
```

### Why Not Per-Row Listeners?

```javascript
// ❌ WRONG: 1000 rows = 1000 listeners
records.forEach(record => {
  const deleteBtn = document.querySelector(`[data-id="${record.id}"] .delete-btn`);
  deleteBtn.addEventListener('click', () => confirmDelete(record.id));
});
// Problem: wasteful, hard to maintain, breaks when rows re-render
```

### Benefits of Delegation

- **Scales:** Adding 1000 rows adds 0 listeners
- **Maintainable:** Events wired in one place
- **Re-render friendly:** `loadRecords()` re-renders tbody; listeners still work

---

## Dialog Management

### Form Dialog

```html
<dialog id="record-dialog">
  <form>
    <fieldset>
      <legend>新增/編輯記錄</legend>
      
      <div class="form-group">
        <label>開始時間</label>
        <input id="start-time-input" type="text" placeholder="2024-01-15T12:00:00Z">
      </div>
      
      <div class="form-group">
        <label>類型</label>
        <input type="radio" name="type" value="time_lag"> Time Lag
        <input type="radio" name="type" value="sentiment_divergence"> Sentiment
      </div>
      
      <div id="form-error" style="display: none; color: red;"></div>
      
      <button type="button" onclick="closeRecordDialog()">取消</button>
      <button type="button" onclick="submitForm()">儲存</button>
    </fieldset>
  </form>
</dialog>
```

### Delete Confirmation Dialog

```html
<dialog id="delete-dialog">
  <h3>確認刪除</h3>
  <p id="delete-summary"></p>
  <div id="delete-error" style="display: none; color: red;"></div>
  <button onclick="closeDialog('delete-dialog')">取消</button>
  <button id="delete-confirm-btn" onclick="performDelete()">確認刪除</button>
</dialog>
```

### Dialog Control

```javascript
function openForm(recordId) {
  if (recordId) {
    // Load existing record for edit
    const record = findRecord(recordId);
    document.getElementById('start-time-input').value = formatTime(record.start_time);
    document.getElementById('end-time-input').value = formatTime(record.end_time);
    // ... etc
  } else {
    // Clear for create
    document.getElementById('record-dialog').reset();
  }
  document.getElementById('record-dialog').showModal();
}

function closeDialog(dialogId) {
  document.getElementById(dialogId).close();
}
```

---

## Troubleshooting

### Records Not Loading
1. Check network (DevTools → Network tab)
2. Verify API endpoint: `curl https://.../api/records`
3. Check console for errors: `console.error` should show details

### Form Submit Does Nothing
1. Verify button `onclick="submitForm()"` is wired
2. Check `api()` call isn't throwing silently
3. Add debug logs: `console.log('Submitting...', formData)`

### Delete Confirmation Never Shows
1. Ensure `#delete-dialog` exists in HTML
2. Verify `confirmDelete()` is called (add log)
3. Check `showModal()` works: `dialog.showModal()` is required for modal behavior

---

**Last Updated:** 2026-08-31

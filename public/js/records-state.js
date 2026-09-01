/**
 * Records state factory — encapsulates record management state
 * Provides isolated state management for records without global variables
 */

export function createRecordsManager() {
  const state = {
    recordsCache: [],
    editingId: null,
    deleteId: null,
    latestRequestToken: 0,
  };

  return {
    /**
     * Get a state value by key
     */
    get(key) {
      if (!(key in state)) {
        throw new Error(`Unknown state key: ${key}`);
      }
      return state[key];
    },

    /**
     * Set a state value by key
     */
    set(key, value) {
      if (!(key in state)) {
        throw new Error(`Unknown state key: ${key}`);
      }
      state[key] = value;
      return this;
    },

    /**
     * Get entire state as frozen object (read-only snapshot)
     * Deep-clones recordsCache to prevent mutation of internal state
     */
    getState() {
      return Object.freeze({ ...state, recordsCache: [...state.recordsCache] });
    },

    /**
     * Get cached records
     */
    getRecords() {
      return [...state.recordsCache];
    },

    /**
     * Update records cache
     */
    setRecords(records) {
      state.recordsCache = records;
      return this;
    },

    /**
     * Get editing record ID (null if not editing)
     */
    getEditingId() {
      return state.editingId;
    },

    /**
     * Start editing a record
     */
    startEditing(id) {
      state.editingId = id;
      return this;
    },

    /**
     * Stop editing
     */
    stopEditing() {
      state.editingId = null;
      return this;
    },

    /**
     * Get delete confirmation ID (null if not confirming)
     */
    getDeleteId() {
      return state.deleteId;
    },

    /**
     * Start delete confirmation
     */
    startDelete(id) {
      state.deleteId = id;
      return this;
    },

    /**
     * Clear delete confirmation
     */
    clearDelete() {
      state.deleteId = null;
      return this;
    },

    /**
     * Get latest request token (for deduplication)
     */
    getLatestRequestToken() {
      return state.latestRequestToken;
    },

    /**
     * Increment request token for deduplication
     */
    nextRequestToken() {
      state.latestRequestToken++;
      return state.latestRequestToken;
    },
  };
}

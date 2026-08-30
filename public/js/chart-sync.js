function isUsableRange(range) {
  return !!range && Number.isFinite(range.from) && Number.isFinite(range.to);
}

export function createRangeSync() {
  let syncing = false;
  function link(from, to) {
    return from.subscribeVisibleLogicalRangeChange((range) => {
      if (syncing || !isUsableRange(range)) return;
      syncing = true;
      try {
        to.setVisibleLogicalRange(range);
      } finally {
        syncing = false;
      }
    });
  }
  return { link, isSyncing: () => syncing };
}
const results = {};
let subscribed = false;

(async () => {
  if (subscribed) return;
  subscribed = true;
  chrome.runtime.onMessage.addListener(async req => {
    switch (req.type) {
      case "diff":
        return onDiffComplete(req);
      case "loaded":
        return onLoad();
      default:
        return;
    }
  });
})();

function onDiffComplete({ index, before, after, diff, scale }) {
  if (!results[location.href]) results[location.href] = [];
  if (!results[location.href][index]) return;
  results[location.href][index] = {
    before: {
      ...before,
      ...results[location.href][index].before
    },
    after: {
      ...after,
      ...results[location.href][index].after
    },
    diff,
    scale,
  };
  enableLinkByIndex(index);
}

function onLoad() {
  let backdrop = findBackdrop();
  if (!backdrop) appendBackdrop();
  window.onpopstate = disableBackdrop;
  findFiles().forEach(async (file, index) => {
    const iframe = findRenderFromFile(file);
    if (!iframe) return;
    const text = await fetch(iframe.src).then(src => src.text());
    const urls = getImageUrls(text);
    if (urls.length < 2) return;
    if (!hasLinkInFile(file)) appendLinkToFile(file);
    addLinkEventListener(file, addDiffImages.bind(this, index));
    const result = results[location.href];
    if (result && result[index]) {
      if (result[index].diff) enableLinkInFile(file);
      return;
    }
    if (!result) results[location.href] = [];
    results[location.href][index] = {
      index,
      before: { url: urls[0] },
      after: { url: urls[1] }
    };
    chrome.runtime.sendMessage({ index, urls });
  });
}

function addDiffImages(index, e) {
  e.preventDefault();
  enableBackdrop();
  const result = results[location.href][index];
  if (!result) return;
  appendImage({
    url: result.before.url,
    differences: result.diff.before,
    height: result.before.height,
    marginRight: 20,
    rgba: "255, 119, 119, 0.6",
    scale: result.scale,
  });
  appendImage({
    url: result.after.url,
    differences: result.diff.after,
    height: result.after.height,
    marginRight: 20,
    rgba: "99, 195, 99, 0.6",
    scale: result.scale,
  });
  const afterRatio = result.after.width / result.after.height;
  const beforeRatio = result.before.width / result.before.height;
  if (afterRatio > 1.5 && beforeRatio > 1.5) {
    setColumnStyle();
  } else {
    setRowStyle();
  }
}

function getImageUrls(text) {
  const lines = text.split("\n");
  const matches = [];
  for (line of lines) {
    const m = line.trim().match(/^data-file\d\s+=\s\"(.+)\"/);
    if (m) matches.push(m[1]);
    if (matches.length > 0 && !m) break;
  }
  return matches;
}



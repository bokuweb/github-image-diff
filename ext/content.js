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

function onDiffComplete({ index, before, after, diff }) {
  console.log(index, before, diff);
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
    diff
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
    rgba: "255, 119, 119, 0.6"
  });
  appendImage({
    url: result.after.url,
    differences: result.diff.after,
    height: result.after.height,
    rgba: "99, 195, 99, 0.6"
  });
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

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then(img => img.blob())
      .then(blob => {
        const objectURL = URL.createObjectURL(blob);
        const image = new Image();
        image.src = objectURL;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        image.addEventListener("load", () => {
          canvas.width = image.naturalWidth;
          canvas.height = image.naturalHeight;
          ctx.drawImage(image, 0, 0);
          resolve({
            url: objectURL,
            data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
            width: image.naturalWidth,
            height: image.naturalHeight
          });
        });
      });
  });
}

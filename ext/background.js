const VER = 100;
const SCALE_THRESHOLD = 800;
const MINIMUM_SCALE = 1;
const q = [];
const gpu = new GPU();

chrome.webNavigation.onDOMContentLoaded.addListener(() => {
  q.length = 0;
  chrome.tabs.query({ currentWindow: true, active: true }, tabArray => {
    if (!tabArray[0] || typeof tabArray[0].id === "undefined") return;
    chrome.tabs.sendMessage(tabArray[0].id, { type: "loaded" }, () => { });
  });
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (q.find(q => q.index === msg.index)) return;
  Promise.all(msg.urls.map(url => fetchImage(url))).then(images => {
    convertImages(images).then(convertedImages => {
      q.push({
        index: msg.index,
        before: convertedImages[0],
        after: convertedImages[1],
        scale: convertedImages[0].scale
      });
      run(sender.tab.id, convertedImages);
    });
  });
});

function convertImages(images) {
  return Promise.all(
    images.map(
      image =>
        new Promise(resolve => {
          const org = image.src;
          image.src = null;
          image.addEventListener("load", () => {
            const scale =
              SCALE_THRESHOLD > image.naturalHeight
                ? 1
                : SCALE_THRESHOLD / image.naturalHeight;
            resolve({ image, scale: Math.max(scale, MINIMUM_SCALE) });
          });
          image.src = org;
        })
    )
  ).then(res => {
    const min = Math.min(res[0].scale, res[1].scale);
    const scale = min > 1 ? 1 : min;
    return res.map(({ image }) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.scale(scale, scale);
      ctx.drawImage(image, 0, 0);
      return {
        url: image.src,
        data: ctx.getImageData(
          0,
          0,
          canvas.width * scale,
          canvas.height * scale
        ).data,
        width: image.naturalWidth,
        height: image.naturalHeight,
        scale
      };
    });
  });
}

function run(id, images) {
  if (typeof id === "undefined") return;
  console.log("[log] run");
  q.forEach(d => {
    console.time("diff");
    console.log("[log] data", d);
    const result = diff(d.before, d.after);
    console.timeEnd("diff");
    console.log("[log] diff result", result);
    const scale = d.scale;
    const data = {
      type: "diff",
      index: d.index,
      before: {
        width: images[0].width,
        height: images[0].height
      },
      after: {
        width: images[1].width,
        height: images[1].height
      },
      diff: {
        before: result.before.map(r =>
          r.map((s, i) => +((+s.toFixed() + i) / scale).toFixed())
        ),
        after: result.after.map(r =>
          r.map((s, i) => +((+s.toFixed() + i) / scale).toFixed())
        )
      },
      scale
    };
    console.log("[log]result", data);
    chrome.tabs.sendMessage(id, data);
  });
  q.length = 0;
}


/*
  @return i.e. 
  { 
    after: [[0, 499]],
    before: [[0, 100], [300. 400]],
  }
*/
function diff(before, after) {
  const diffRow = gpu.createKernel(function (a, b) {
    let sum = 0;
    let i = 0;

    while (i < this.constants.size) {
      if (a[i] !== b[i] ||
        a[i + 1] !== b[i + 1] ||
        a[i + 2] !== b[i + 2] ||
        a[i + 3] !== b[i + 3]) {
        sum++;
      }
      i += 4;
    }
    return sum;
  }, {
      constants: { size: 800 },
      output: [1],
    });

  console.log(diffRow(new Array(800).fill(0), new Array(800).fill(1)));


  return {
    after: [[0, 499]],
    before: [[0, 100], [300, 400]],
  };
}

function fetchImage(url) {
  return fetch(url)
    .then(img => img.blob())
    .then(blob => {
      const objectURL = URL.createObjectURL(blob);
      const image = new Image();
      image.src = objectURL;
      return image;
    });
}

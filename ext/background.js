const VER = 100;
const SCALE_THRESHOLD = 800;
const MINIMUM_SCALE = 0.5;
const url = "./diff.wasm";
let q = [];

const memory = new WebAssembly.Memory({ initial: 200 });
const imports = { js: { mem: memory } };

chrome.webNavigation.onDOMContentLoaded.addListener(() => {
  q = [];
  chrome.tabs.query({ currentWindow: true, active: true }, tabArray => {
    if (!tabArray[0] || typeof tabArray[0].id === "undefined") return;
    chrome.tabs.sendMessage(tabArray[0].id, { type: "loaded" }, () => {});
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
      if (!self.mod) return;
      run(sender.tab.id, convertedImages);
    });
  });
});

instantiateCachedURL(VER, url, imports).then(instance => {
  self.mod = instance;
  console.log(self.mod.exports.memory.buffer, "instantiated!!");
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
  q = [];
}

function diff(before, after) {
  const beforePtr = self.mod.exports.alloc(before.data.length);
  const afterPtr = self.mod.exports.alloc(after.data.length);
  const heap = new Uint8Array(self.mod.exports.memory.buffer);
  heap.set(before.data, beforePtr);
  heap.set(after.data, afterPtr);

  const resultPtr = self.mod.exports.diff(
    beforePtr,
    before.data.length,
    before.width,
    afterPtr,
    after.data.length,
    after.width
  );
  self.mod.exports.free(beforePtr, before.data.length);
  self.mod.exports.free(afterPtr, after.data.length);
  const resultBuf = new Uint8Array(self.mod.exports.memory.buffer, resultPtr);
  const getSize = buf => {
    let i = 0;
    while (buf[i] !== 0) i++;
    return i;
  };
  const resultSize = getSize(resultBuf);
  const json = String.fromCharCode.apply(null, resultBuf.slice(0, resultSize));
  const result = JSON.parse(json);
  self.mod.exports.free(resultPtr, resultSize);
  return result;
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

// 1. +++ fetchAndInstantiate() +++ //

// This library function fetches the wasm module at 'url', instantiates it with
// the given 'importObject', and returns the instantiated object instance

function fetchAndInstantiate(url, importObject) {
  return fetch(url)
    .then(response => response.arrayBuffer())
    .then(bytes => WebAssembly.instantiate(bytes, importObject))
    .then(results => results.instance);
}

// 2. +++ instantiateCachedURL() +++ //

// This library function fetches the wasm Module at 'url', instantiates it with
// the given 'importObject', and returns a Promise resolving to the finished
// wasm Instance. Additionally, the function attempts to cache the compiled wasm
// Module in IndexedDB using 'url' as the key. The entire site's wasm cache (not
// just the given URL) is versioned by dbVersion and any change in dbVersion on
// any call to instantiateCachedURL() will conservatively clear out the entire
// cache to avoid stale modules.
function instantiateCachedURL(dbVersion, url, importObject) {
  const dbName = "wasm-cache";
  const storeName = "wasm-cache";

  // This helper function Promise-ifies the operation of opening an IndexedDB
  // database and clearing out the cache when the version changes.
  function openDatabase() {
    return new Promise((resolve, reject) => {
      var request = indexedDB.open(dbName, dbVersion);
      request.onerror = reject.bind(null, "Error opening wasm cache database");
      request.onsuccess = () => {
        resolve(request.result);
      };
      request.onupgradeneeded = event => {
        var db = request.result;
        if (db.objectStoreNames.contains(storeName)) {
          console.log(`Clearing out version ${event.oldVersion} wasm cache`);
          db.deleteObjectStore(storeName);
        }
        console.log(`Creating version ${event.newVersion} wasm cache`);
        db.createObjectStore(storeName);
      };
    });
  }

  // This helper function Promise-ifies the operation of looking up 'url' in the
  // given IDBDatabase.
  function lookupInDatabase(db) {
    return new Promise((resolve, reject) => {
      var store = db.transaction([storeName]).objectStore(storeName);
      var request = store.get(url);
      request.onerror = reject.bind(null, `Error getting wasm module ${url}`);
      request.onsuccess = event => {
        if (request.result) resolve(request.result);
        else reject(`Module ${url} was not found in wasm cache`);
      };
    });
  }

  // This helper function fires off an async operation to store the given wasm
  // Module in the given IDBDatabase.
  function storeInDatabase(db, module) {
    var store = db.transaction([storeName], "readwrite").objectStore(storeName);
    try {
      var request = store.put(module, url);
      request.onerror = err => {
        console.log(`Failed to store in wasm cache: ${err}`);
      };
      request.onsuccess = err => {
        console.log(`Successfully stored ${url} in wasm cache`);
      };
    } catch (e) {
      console.warn("An error was thrown... in storing wasm cache...");
      console.warn(e);
    }
  }

  // This helper function fetches 'url', compiles it into a Module,
  // instantiates the Module with the given import object.
  function fetchAndInstantiate() {
    return fetch(url)
      .then(response => {
        return response.arrayBuffer();
      })
      .then(buffer => {
        return WebAssembly.instantiate(buffer, importObject);
      });
  }

  // With all the Promise helper functions defined, we can now express the core
  // logic of an IndexedDB cache lookup. We start by trying to open a database.
  return openDatabase().then(
    db => {
      // Now see if we already have a compiled Module with key 'url' in 'db':
      return lookupInDatabase(db).then(
        module => {
          // We do! Instantiate it with the given import object.
          console.log(`Found ${url} in wasm cache`);
          return WebAssembly.instantiate(module, importObject);
        },
        errMsg => {
          // Nope! Compile from scratch and then store the compiled Module in 'db'
          // with key 'url' for next time.
          console.log(errMsg);
          return fetchAndInstantiate().then(results => {
            setTimeout(() => storeInDatabase(db, results.module), 0);
            return results.instance;
          });
        }
      );
    },
    errMsg => {
      // If opening the database failed (due to permissions or quota), fall back
      // to simply fetching and compiling the module and don't try to store the
      // results.
      console.log(errMsg);
      return fetchAndInstantiate().then(results => results.instance);
    }
  );
}

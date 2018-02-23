const LINK_CLASS_NAME = "__diff";
const FILE_CLASS_NAME = "js-file";
const FILE_ACTIONS_CLASS_NAME = "file-actions";
const BACKDROP_CLASS_NAME = "__backdrop";
const RENDER_CLASS_NAME = "render-viewer";

function enableLinkByIndex(index) {
  const files = findFiles();
  const link = files[index].querySelector(`.${LINK_CLASS_NAME}`);
  enableLink(link);
}

function enableBackdrop() {
  const backdrop = findBackdrop();
  if (!backdrop) return;
  backdrop.textContent = null;
  backdrop.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function findFiles() {
  return document.querySelectorAll(`.${FILE_CLASS_NAME}`) || [];
}

function findRenderFromFile(file) {
  return file.querySelector(`.${RENDER_CLASS_NAME}`);
}

function enableLink(link) {
  link.style.pointerEvents = "auto";
  link.style.opacity = 1;
}

function hasLinkInFile(file) {
  return !!file.querySelector(`.${LINK_CLASS_NAME}`);
}

function enableLinkInFile(file) {
  const link = file.querySelector(`a.${LINK_CLASS_NAME}`);
  enableLink(link);
}

function appendLinkToFile(file) {
  const link = document.createElement("a");
  link.setAttribute("aria-label", "Diff");
  link.style.pointerEvents = "none";
  link.style.opacity = 0.4;
  link.classList.add(
    "btn",
    "btn-sm",
    "tooltipped",
    "tooltipped-nw",
    LINK_CLASS_NAME
  );
  link.innerText = "Diff";
  const actions = file.querySelector(`.${FILE_ACTIONS_CLASS_NAME}`);
  actions.insertBefore(link, actions.firstChild);
}

function findBackdrop() {
  return document.querySelector(`div.${BACKDROP_CLASS_NAME}`);
}

function appendBackdrop() {
  backdrop = document.createElement("div");
  backdrop.classList.add(BACKDROP_CLASS_NAME);
  backdrop.style.position = "fixed";
  backdrop.style.top = 0;
  backdrop.style.left = 0;
  backdrop.style.minWidth = "100%";
  backdrop.style.height = "100%";
  backdrop.style.display = "none";
  backdrop.style.flexDirection = "row";
  backdrop.style.justifyContent = "center";
  backdrop.style.padding = "100px 5% 0 5%";
  backdrop.style.zIndex = 9999;
  backdrop.style.overflow = "scroll";
  backdrop.style.cursor = "pointer";
  backdrop.style.background = "rgba(0,0,0,0.5)";
  backdrop.addEventListener("click", () => {
    backdrop.style.display = "none";
    document.body.style.overflow = "auto";
  });
  document.body.appendChild(backdrop);
}

function disableBackdrop() {
  const backdrop = findBackdrop();
  if (!backdrop) return;
  backdrop.style.display = "none";
  document.body.style.overflow = "auto";
}

function addLinkEventListener(file, cb) {
  const link = file.querySelector(`a.${LINK_CLASS_NAME}`);
  if (!link) return;
  link.addEventListener("click", cb);
}

function appendImage({ url, differences, height, marginRight, rgba, scale }) {
  const backdrop = findBackdrop();
  if (!backdrop) return;
  backdrop.style.flexDirection = "row";
  const wrapper = document.createElement("div");
  wrapper.style.maxWidth = "40%";
  wrapper.style.marginRight = `${marginRight}px`;
  wrapper.style.marginBottom = "20px";
  const inner = document.createElement("div");
  inner.style.position = "relative";
  const img = document.createElement("img");
  img.src = url;
  img.style.width = "100%";
  img.style.height = "auto";
  img.style.verticalAlign = "bottom";
  img.addEventListener("click", e => e.stopPropagation());
  inner.appendChild(img);
  wrapper.appendChild(inner);
  backdrop.appendChild(wrapper);
  differences.forEach(diff => {
    const top = `${diff[0] / height * 100 / scale}%`;
    const markHeight = `${(diff[1] - diff[0]) / height * 100 / scale}%`;
    const mark = document.createElement("div");
    mark.style.position = "absolute";
    mark.style.top = top;
    mark.style.width = "100%";
    mark.style.height = markHeight;
    mark.style.background = `rgba(${rgba})`;
    inner.appendChild(mark);
  });
}

function setColumnStyle() {
  const backdrop = findBackdrop();
  if (!backdrop) return;
  backdrop.style.flexDirection = "column";
  backdrop.style.justifyContent = "initial";
  backdrop.style.alignItems = "center";
  const wrappers = backdrop.querySelectorAll(`.${BACKDROP_CLASS_NAME} > div`);
  wrappers.forEach(w => (w.style.maxWidth = "60%"));
}

function setRowStyle() {
  const backdrop = findBackdrop();
  if (!backdrop) return;
  backdrop.style.flexDirection = "row";
  backdrop.style.justifyContent = "center";
  backdrop.style.alignItems = "initial";
}

const screenshots = {
  archive: {
    file: 'preview-archive.png',
    alt: '瞬览在 ZIP 压缩包中浏览目录，并直接预览其中的鲨鱼图片',
    caption: '压缩包里，也能直接看图。左侧浏览目录，右侧继续预览。',
  },
  code: {
    file: 'preview-code.png',
    alt: '瞬览预览 package-lock.json，显示语法高亮、行号与代码折叠',
    caption: '代码内容，清晰呈现。语法高亮、行号与结构化代码折叠。',
  },
  word: {
    file: 'preview-word.png',
    alt: '瞬览预览包含图片的 Word 日志系统使用指南，左侧显示文档大纲',
    caption: 'Word 页面与图片一起看，用左侧大纲找到需要的章节。',
  },
  pdf: {
    file: 'preview-pdf.png',
    alt: '瞬览以页面视图预览如何开发 AI 集成流程 PDF 文档',
    caption: 'PDF 页面阅读，保留内容层次，按需缩放与连续浏览。',
  },
  tar: {
    file: 'preview-tar.png',
    alt: '瞬览展开 TAR 归档目录，直接显示其中 start.sh 脚本的高亮源码',
    caption: '深入 TAR 的目录层级，直接查看其中的脚本源码。',
  },
  html: {
    file: 'preview-html.png',
    alt: '瞬览预览本地 HTML 网页，呈现网页中的深色布局和文字样式',
    caption: '本地 HTML 网页预览，展示静态布局与样式。',
  },
  settings: {
    file: 'preview-settings.png',
    alt: '瞬览通用设置页面，包含应用主题、开机自启动和资源管理器快捷键预览',
    caption: '明暗主题、窗口行为与启动选项，按习惯调整。',
  },
};

const tabs = [...document.querySelectorAll('[data-shot]')];
const image = document.querySelector('#preview-image');
const caption = document.querySelector('#preview-caption');
const panel = document.querySelector('#screenshot-panel');
const openImage = document.querySelector('.screenshot-open');
const dialog = document.querySelector('#image-dialog');
const dialogImage = document.querySelector('#dialog-image');

function selectScreenshot(tab) {
  const shot = screenshots[tab.dataset.shot];
  tabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  image.src = `assets/${shot.file}`;
  image.alt = shot.alt;
  openImage.href = image.src;
  caption.textContent = shot.caption;
  panel.setAttribute('aria-labelledby', tab.id);
}

tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectScreenshot(tab));
  tab.addEventListener('keydown', (event) => {
    let target;
    if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
    if (event.key === 'ArrowLeft') target = tabs[(index - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') target = tabs[0];
    if (event.key === 'End') target = tabs[tabs.length - 1];
    if (!target) return;
    event.preventDefault();
    selectScreenshot(target);
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  });
});

// 不支持 dialog 时保留图片链接的原生打开行为。
openImage.addEventListener('click', (event) => {
  if (typeof dialog.showModal !== 'function') return;
  event.preventDefault();
  dialogImage.src = image.src;
  dialogImage.alt = image.alt;
  document.querySelector('#dialog-caption').textContent = caption.textContent;
  dialog.showModal();
  document.body.style.overflow = 'hidden';
});

document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
    dialog.close();
});
dialog.addEventListener('close', () => {
  document.body.style.overflow = '';
  dialogImage.removeAttribute('src');
});

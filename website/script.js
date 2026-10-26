const demoContent = document.querySelector('#demo-content');
const demoFilename = document.querySelector('#demo-filename');
const demoButtons = document.querySelectorAll('[data-demo]');
const markdownContent = demoContent.innerHTML;

// 演示仅切换内置内容，不读取文件，也不加载远端资源。
const demos = {
  markdown: { filename: '灵感笔记.md', content: markdownContent },
  code: {
    filename: 'hello.ts',
    content: `<span class="paper-label">CODE / TYPESCRIPT</span>
      <h2>让想法，清晰可见。</h2><p>代码预览 · 语法高亮示意</p>
      <pre class="demo-code"><span class="code-key">type</span> Preview = {
  name: <span class="code-key">string</span>;
  local: <span class="code-key">boolean</span>;
};

<span class="code-key">const</span> app: Preview = {
  name: <span class="code-string">'SpacePreview'</span>,
  local: <span class="code-key">true</span>,
};

<span class="code-key">export default</span> app;</pre>`,
  },
  archive: {
    filename: '项目归档.zip',
    content: `<span class="paper-label">ARCHIVE / ZIP</span>
      <h2>先看一眼，再解压。</h2><p>压缩包目录预览示意</p>
      <table class="demo-table"><thead><tr><th>名称</th><th>大小</th></tr></thead>
      <tbody><tr><td>▸ assets/</td><td>—</td></tr><tr><td>▸ documents/</td><td>—</td></tr>
      <tr><td>▤ README.md</td><td>2.4 KB</td></tr><tr><td>◈ cover.png</td><td>128 KB</td></tr>
      <tr><td>▦ budget.csv</td><td>8.6 KB</td></tr></tbody></table>
      <blockquote>支持的内部文件，可以继续预览。</blockquote>`,
  },
};

demoButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const demo = demos[button.dataset.demo];
    demoFilename.textContent = demo.filename;
    demoContent.innerHTML = demo.content;
    demoButtons.forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    document.querySelector('.demo-outline').hidden = button.dataset.demo !== 'markdown';
    document.querySelector('.preview-body').style.gridTemplateColumns =
      button.dataset.demo === 'markdown' ? '' : '1fr';
  });
});

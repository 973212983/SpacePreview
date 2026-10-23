export function findText(text: string, query: string): { start: number; end: number }[] {
  if (!query) return [];
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
  return Array.from(text.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function findRanges(root: Element, query: string): Range[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: { node: Text; start: number; end: number }[] = [];
  const parts: string[] = [];
  let length = 0;
  let block: Element | null = null;
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const parent = node.parentElement;
    if (
      !node.length ||
      !parent ||
      parent.closest(
        'aside,nav,button,input,select,textarea,script,style,[hidden],[aria-hidden="true"],[data-file-search],.line-number,.continuous-line-numbers,.preview-message,.document-note',
      )
    )
      continue;
    const nextBlock = parent.closest('p,div,pre,li,td,th,h1,h2,h3,h4,h5,h6');
    if (nodes.length && nextBlock !== block) {
      parts.push('\n');
      length++;
    }
    block = nextBlock;
    nodes.push({ node, start: length, end: length + node.length });
    parts.push(node.data);
    length += node.length;
  }
  let index = 0;
  return findText(parts.join(''), query).flatMap((match) => {
    while (index < nodes.length && nodes[index].end <= match.start) index++;
    const first = nodes[index];
    let end = index;
    while (end < nodes.length && nodes[end].end < match.end) end++;
    if (!first || !nodes[end]) return [];
    const range = doc.createRange();
    range.setStart(first.node, match.start - first.start);
    range.setEnd(nodes[end].node, match.end - nodes[end].start);
    return [range];
  });
}

export function scrollToRange(range: Range) {
  if (!range.startContainer.isConnected || !range.endContainer.isConnected) return;
  const doc = range.startContainer.ownerDocument!;
  for (let parent = range.startContainer.parentElement; parent; parent = parent.parentElement) {
    const style = doc.defaultView!.getComputedStyle(parent);
    if (!/(auto|scroll)/.test(style.overflowY + style.overflowX)) continue;
    const rect = range.getBoundingClientRect(),
      box = parent.getBoundingClientRect();
    parent.scrollBy({
      top: rect.top - box.top - parent.clientHeight / 2,
      left:
        rect.left < box.left || rect.right > box.right
          ? rect.left - box.left - parent.clientWidth / 2
          : 0,
    });
    return;
  }
  doc.defaultView!.scrollBy(
    0,
    range.getBoundingClientRect().top - doc.defaultView!.innerHeight / 2,
  );
}

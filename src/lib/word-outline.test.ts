import { expect, it } from 'vitest';
import { buildWordOutline } from './word-outline';

const paragraph = (text: string, size = '12pt', bold = false) => ({
  type: 'paragraph',
  children: [
    {
      type: 'run',
      cssStyle: { 'font-size': size, 'font-weight': bold ? 'bold' : 'normal' },
      children: [{ type: 'text', text }],
    },
  ],
});

it('infers manually formatted titles and numbered sections without changing run styles', () => {
  const title = paragraph('项目说明', '18pt', true);
  const section = paragraph('一、项目背景', '16pt', true);
  const subsection = paragraph('（一）接入需求', '12pt', true);
  const numeric = paragraph('2.1 系统结构', '14pt', true);
  const body = {
    type: 'document',
    children: [
      title,
      section,
      subsection,
      numeric,
      paragraph('这是较长的正文内容，决定正文的常用字号。'.repeat(20)),
      paragraph('1. 普通编号列表'),
      paragraph('正文中的强调', '12pt', true),
      paragraph('加粗的长正文'.repeat(30), '16pt', true),
      { type: 'table', children: [paragraph('一、表格内容', '16pt', true)] },
    ],
  };
  const runStyle = { ...section.children[0].cssStyle };
  expect(buildWordOutline(body, []).map(({ title, level }) => ({ title, level }))).toEqual([
    { title: '项目说明', level: 1 },
    { title: '一、项目背景', level: 1 },
    { title: '（一）接入需求', level: 2 },
    { title: '2.1 系统结构', level: 2 },
  ]);
  expect(section.children[0].cssStyle).toEqual(runStyle);
  expect(section).toHaveProperty('className', ' word-heading-1');
});

it('keeps explicit heading levels, inherited styles and body-text overrides authoritative', () => {
  const styles = [
    { id: 'Heading1', name: 'heading 1', paragraphProps: { outlineLevel: 0 } },
    { id: 'Custom', basedOn: 'Heading1' },
    { id: 'Body', basedOn: 'Heading1', paragraphProps: { outlineLevel: 9 } },
  ];
  const body = {
    type: 'document',
    children: [
      { ...paragraph('继承标题'), styleName: 'Custom' },
      { ...paragraph('直接层级'), outlineLevel: 2 },
      { ...paragraph('正文覆盖'), styleName: 'Heading1', outlineLevel: 9 },
      { ...paragraph('一、显式正文', '18pt', true), styleName: 'Body' },
      paragraph('二、手动编号', '18pt', true),
    ],
  };
  expect(buildWordOutline(body, styles).map(({ title, level }) => ({ title, level }))).toEqual([
    { title: '继承标题', level: 1 },
    { title: '直接层级', level: 3 },
  ]);
});

it('does not treat mixed bold runs, empty headings or cyclic styles as headings', () => {
  const mixed = paragraph('一、部分加粗', '16pt', true);
  mixed.children.push(...paragraph('剩余正文').children);
  expect(
    buildWordOutline(
      {
        type: 'document',
        children: [
          mixed,
          { ...paragraph(''), outlineLevel: 0 },
          { ...paragraph('一、显式正文', '18pt', true), outlineLevel: 9 },
          { ...paragraph('普通内容'), styleName: 'A' },
        ],
      },
      [
        { id: 'A', basedOn: 'B' },
        { id: 'B', basedOn: 'A' },
      ],
    ),
  ).toEqual([]);
});

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { PreviewMenu } from './PreviewToolbar';
import { fontKeyDirection, resizeText } from '../lib/preview-gestures';

const families = {
  auto: 'var(--font-reading)',
  sans: '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  serif: 'Georgia, "Noto Serif CJK SC", "Source Han Serif SC", SimSun, serif',
  mono: 'var(--font-code)',
};
type Font = keyof typeof families;
const Appearance = createContext({
  active: true,
  size: 16,
  font: 'auto' as Font,
  setSize: (_size: number | ((size: number) => number)) => {},
  setFont: (_font: Font) => {},
});

export function TextAppearanceProvider({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [size, setSize] = useState(16);
  const [font, setFont] = useState<Font>('auto');
  return (
    <Appearance.Provider value={{ active, size, font, setSize, setFont }}>
      <div
        className="text-appearance-scope"
        style={
          {
            display: 'contents',
            '--preview-font-size': `${size}px`,
            '--preview-font-family': families[font],
            '--preview-code-family': font === 'auto' ? 'var(--font-code)' : families[font],
          } as CSSProperties
        }
      >
        {children}
      </div>
    </Appearance.Provider>
  );
}

export const useTextAppearance = () => useContext(Appearance);

export function usePreviewGestures(adjust: (direction: number) => void) {
  const { active } = useTextAppearance();
  const [adjusting, setAdjusting] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!active) {
      setAdjusting(false);
      return;
    }
    const show = () => {
      setAdjusting(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setAdjusting(false), 2000);
    };
    const key = (event: KeyboardEvent) => {
      const direction = fontKeyDirection(event);
      if (!direction || event.defaultPrevented) return;
      event.preventDefault();
      adjust(direction);
      show();
    };
    const wheel = (event: WheelEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.altKey ||
        !event.deltaY ||
        event.defaultPrevented
      )
        return;
      // Iframe gestures are deliberately forwarded to window; ordinary wheel
      // input must originate in the preview, excluding menus and preferences.
      if (
        event.target !== window &&
        !(event.target instanceof Element && event.target.closest('.preview-layer'))
      )
        return;
      event.preventDefault();
      adjust(event.deltaY < 0 ? 1 : -1);
      show();
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('wheel', wheel, { capture: true, passive: false });
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('wheel', wheel, true);
    };
  }, [active, adjust]);
  return active && adjusting;
}

export function PreviewAdjustmentIndicator({
  visible,
  label,
  value,
}: {
  visible: boolean;
  label: string;
  value: string;
}) {
  return visible ? (
    <div className="preview-adjustment" role="status" aria-live="polite" aria-atomic="true">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  ) : null;
}

export function TextAppearanceControls() {
  const { size, font, setSize, setFont } = useTextAppearance();
  const adjust = useCallback(
    (direction: number) => setSize((current) => resizeText(current, direction)),
    [setSize],
  );
  const adjusting = usePreviewGestures(adjust);
  return (
    <>
      <PreviewAdjustmentIndicator visible={adjusting} label="字号" value={`${size} px`} />
      <PreviewMenu>
        <label className="preview-menu-option">
          <span>字体</span>
          <select
            aria-label="阅读字体"
            value={font}
            onChange={(event) => setFont(event.target.value as Font)}
          >
            <option value="auto">默认字体</option>
            <option value="sans">现代字体</option>
            <option value="serif">书籍字体</option>
            <option value="mono">等宽字体</option>
          </select>
        </label>
        <label className="preview-menu-option">
          <span>字号</span>
          <select
            aria-label="阅读字号"
            value={size}
            onChange={(event) => setSize(Number(event.target.value))}
          >
            {Array.from({ length: 16 }, (_, index) => 10 + index * 2).map((value) => (
              <option key={value} value={value}>
                {value} px
              </option>
            ))}
          </select>
        </label>
      </PreviewMenu>
    </>
  );
}

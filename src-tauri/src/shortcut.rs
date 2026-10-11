use serde::Deserialize;
use std::sync::atomic::{AtomicU32, Ordering};

#[derive(Deserialize)]
pub struct Shortcut {
    code: String,
    ctrl: bool,
    alt: bool,
    meta: bool,
}

// One atomic snapshot keeps the key and its modifiers consistent on hook threads.
static CONFIG: AtomicU32 = AtomicU32::new(32 | (49 << 8));

impl Shortcut {
    fn packed(&self) -> Result<u32, String> {
        let keys: std::collections::HashMap<String, [u32; 2]> =
            serde_json::from_str(include_str!("../../src/lib/shortcut-keys.json"))
                .map_err(|e| e.to_string())?;
        let key = keys.get(&self.code).ok_or("不支持此按键")?;
        if self.code == "KeyO" && (self.ctrl || self.meta) && !self.alt {
            return Err("此快捷键用于选择文件".into());
        }
        Ok(key[0]
            | (key[1] << 8)
            | ((self.ctrl as u32 | (self.alt as u32) << 1 | (self.meta as u32) << 2) << 16))
    }
}

pub fn set(shortcut: Shortcut) -> Result<u32, String> {
    let packed = shortcut.packed()?;
    CONFIG.store(packed, Ordering::Relaxed);
    Ok(packed)
}

pub fn current() -> u32 {
    CONFIG.load(Ordering::Relaxed)
}

pub fn matches(packed: u32, ctrl: bool, alt: bool, meta: bool) -> bool {
    packed >> 16 == (ctrl as u32 | (alt as u32) << 1 | (meta as u32) << 2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_both_platforms_and_requires_exact_modifiers() {
        for (code, win, mac) in [("Space", 32, 49), ("KeyP", 80, 35), ("F8", 119, 100)] {
            let s = Shortcut {
                code: code.into(),
                ctrl: true,
                alt: true,
                meta: false,
            };
            let packed = s.packed().unwrap();
            assert_eq!(packed & 255, win);
            assert_eq!((packed >> 8) & 255, mac);
            assert!(matches(packed, true, true, false));
            assert!(!matches(packed, true, false, false));
            assert!(!matches(packed, true, true, true));
        }
    }

    #[test]
    fn rejects_navigation_modifiers_and_app_conflicts() {
        for code in [
            "Escape",
            "Enter",
            "ArrowLeft",
            "ShiftLeft",
            "Tab",
            "Unknown",
            "KeyO",
        ] {
            let s = Shortcut {
                code: code.into(),
                ctrl: true,
                alt: false,
                meta: false,
            };
            assert!(s.packed().is_err(), "{code}");
        }
    }
}

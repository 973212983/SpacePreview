//! Submit on release, before opening a window can change keyboard focus.
#[derive(Default, Clone, Copy)]
pub struct SpaceGesture {
    held: bool,
    pending: Option<(i32, bool)>,
}

impl SpaceGesture {
    pub fn keydown(&mut self, candidate: Option<(i32, bool)>, repeat: bool) -> bool {
        if !repeat {
            // A new physical press also recovers from a missing key-up (e.g. secure input).
            self.held = true;
            self.pending = candidate;
        } else if !self.held {
            // Never adopt a press that started before the event tap was installed.
            self.held = true;
            self.pending = None;
        }
        self.pending.is_some()
    }

    pub fn keyup(&mut self) -> Option<(i32, bool)> {
        self.held = false;
        self.pending.take()
    }
}

pub fn candidate(pid: i32, flags: u64, enabled: bool) -> Option<(i32, bool)> {
    // Control, Option and Command retain Finder's original shortcuts.
    (enabled && pid > 0 && flags & ((1 << 18) | (1 << 19) | (1 << 20)) == 0)
        .then_some((pid, flags & (1 << 17) != 0))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consecutive_previews_submit_once_on_release() {
        let mut gesture = SpaceGesture::default();
        for _ in 0..10 {
            assert!(gesture.keydown(candidate(42, 0, true), false));
            assert!(gesture.keydown(candidate(42, 0, true), true));
            assert_eq!(gesture.keyup(), Some((42, false)));
            assert_eq!(gesture.keyup(), None);
            // Closing the preview in its WebView must not leave held state behind.
            assert!(!gesture.keydown(None, false));
            assert_eq!(gesture.keyup(), None);
        }
    }

    #[test]
    fn typing_modifiers_disabled_and_late_repeat_pass_through() {
        for flags in [1 << 18, 1 << 19, 1 << 20] {
            assert_eq!(candidate(42, flags, true), None);
        }
        assert_eq!(candidate(0, 0, true), None);
        assert_eq!(candidate(42, 0, false), None);
        assert_eq!(candidate(42, 1 << 17, true), Some((42, true)));
        let mut gesture = SpaceGesture::default();
        assert!(!gesture.keydown(None, false));
        assert!(!gesture.keydown(candidate(42, 0, true), true));
        assert_eq!(gesture.keyup(), None);
        assert!(!gesture.keydown(candidate(42, 0, true), true));
        assert_eq!(gesture.keyup(), None);
        assert!(gesture.keydown(candidate(42, 0, true), false));
        // A disabled tap discards an unfinished gesture.
        gesture = SpaceGesture::default();
        assert_eq!(gesture.keyup(), None);
    }

    #[test]
    fn fresh_press_recovers_without_a_second_space() {
        let mut gesture = SpaceGesture::default();
        assert!(gesture.keydown(candidate(42, 0, true), false));
        // The first release was missed; a second physical press is still accepted.
        assert!(gesture.keydown(candidate(42, 1 << 17, true), false));
        assert_eq!(gesture.keyup(), Some((42, true)));
        assert_eq!(gesture.keyup(), None);
    }
}

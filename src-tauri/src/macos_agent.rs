//! Finder integration stays in-process so macOS attributes permissions to this app.
use std::{
    cell::Cell,
    ffi::{c_char, CStr},
    path::Path,
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        OnceLock,
    },
};
use tauri::{AppHandle, Emitter, Manager};

use crate::macos_gesture::{candidate, SpaceGesture};

extern "C" {
    fn sp_mac_start(callback: extern "C" fn(u32, u64, i32, bool) -> bool);
    fn sp_mac_set_shortcut(key: u32, flags: u64);
    fn sp_mac_status() -> u32;
    fn sp_mac_last_key_result() -> u32;
    fn sp_mac_request_permissions();
    fn sp_mac_frontmost_pid() -> i32;
    fn sp_mac_copy_selection() -> *mut c_char;
    fn sp_mac_free_string(value: *mut c_char);
    fn sp_mac_activate_finder(pid: i32);
}

static ENABLED: AtomicBool = AtomicBool::new(true);
static SOURCE_PID: std::sync::atomic::AtomicI32 = std::sync::atomic::AtomicI32::new(0);
static GENERATION: AtomicU64 = AtomicU64::new(0);
static APP: OnceLock<AppHandle> = OnceLock::new();
thread_local! { static SPACE: Cell<SpaceGesture> = Cell::new(SpaceGesture::default()); }

extern "C" fn keyboard_event(kind: u32, flags: u64, pid: i32, repeat: bool) -> bool {
    let mut gesture = SPACE.get();
    let suppress = match kind {
        10 => gesture.keydown(
            if crate::shortcut::matches(
                crate::shortcut::current(),
                flags & (1 << 18) != 0,
                flags & (1 << 19) != 0,
                flags & (1 << 20) != 0,
            ) {
                candidate(
                    pid,
                    flags & !((1 << 18) | (1 << 19) | (1 << 20)),
                    ENABLED.load(Ordering::Relaxed),
                )
            } else {
                None
            },
            repeat,
        ),
        11 => {
            let pending = gesture.keyup();
            // Reset BEFORE the worker can cause focus to change.
            SPACE.set(gesture);
            if let Some((pid, text)) = pending {
                if ENABLED.load(Ordering::Relaxed) {
                    queue_preview(pid, text);
                }
                return true;
            }
            return false;
        }
        _ => {
            SPACE.set(SpaceGesture::default());
            return false;
        }
    };
    SPACE.set(gesture);
    suppress
}

pub fn set_enabled(enabled: bool) {
    if ENABLED.swap(enabled, Ordering::Relaxed) != enabled {
        GENERATION.fetch_add(1, Ordering::Relaxed);
    }
}

pub fn set_shortcut(config: u32) {
    let mods = config >> 16;
    let flags = (((mods & 1) as u64) << 18)
        | ((((mods >> 1) & 1) as u64) << 19)
        | ((((mods >> 2) & 1) as u64) << 20);
    GENERATION.fetch_add(1, Ordering::Relaxed);
    unsafe { sp_mac_set_shortcut((config >> 8) & 255, flags) };
}

pub fn status() -> serde_json::Value {
    let native = unsafe { sp_mac_status() };
    serde_json::json!({
        "supported": true, "platform": "macos",
        "enabled": ENABLED.load(Ordering::Relaxed),
        "running": native & 7 == 7,
        "accessibility": native & 1 != 0,
        "automation": native & 4 != 0,
        "keyboard": native & 2 != 0,
        "lastKeyResult": unsafe { sp_mac_last_key_result() },
    })
}

pub fn request_permissions(app: AppHandle) -> tauri::Result<()> {
    app.run_on_main_thread(|| unsafe { sp_mac_request_permissions() })
}

pub fn hide_preview(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    let focused = window.is_focused().unwrap_or(false);
    window.hide()?;
    let pid = SOURCE_PID.swap(0, Ordering::Relaxed);
    // A blur close must not steal focus back from the user's chosen app.
    if focused && pid != 0 {
        window.app_handle().run_on_main_thread(move || unsafe {
            if sp_mac_frontmost_pid() == std::process::id() as i32 {
                sp_mac_activate_finder(pid);
            }
        })?;
    }
    Ok(())
}

fn selection() -> Result<Vec<String>, String> {
    let pointer = unsafe { sp_mac_copy_selection() };
    if pointer.is_null() {
        return Err("Finder 选择读取失败。".into());
    }
    let json = unsafe { CStr::from_ptr(pointer) }
        .to_string_lossy()
        .into_owned();
    unsafe { sp_mac_free_string(pointer) };
    let result: serde_json::Value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    if let Some(error) = result.get("error").and_then(|value| value.as_str()) {
        return Err(error.into());
    }
    let paths: Vec<String> =
        serde_json::from_value(result["paths"].clone()).map_err(|e| e.to_string())?;
    Ok(paths
        .into_iter()
        .filter(|path| Path::new(path).is_file() || Path::new(path).is_dir())
        .take(100)
        .collect())
}

fn queue_preview(pid: i32, text: bool) {
    let Some(app) = APP.get() else {
        return;
    };
    let generation = GENERATION.fetch_add(1, Ordering::Relaxed) + 1;
    let app_for_ui = app.clone();
    // The tap thread only schedules work; NSAppleScript runs on the main thread.
    let _ = app.run_on_main_thread(move || {
        let current = || {
            ENABLED.load(Ordering::Relaxed)
                && GENERATION.load(Ordering::Relaxed) == generation
                && unsafe { sp_mac_frontmost_pid() == pid }
        };
        if !current() {
            return;
        }
        let result = selection();
        if !current() {
            return;
        }
        match result {
            Ok(paths) if !paths.is_empty() => {
                SOURCE_PID.store(pid, Ordering::Relaxed);
                crate::show_preview_files(&app_for_ui, paths, text);
            }
            result => {
                let message = result
                    .err()
                    .unwrap_or_else(|| "请选择本地文件或文件夹；系统项目暂不支持预览。".into());
                if let Some(window) = app_for_ui.get_webview_window("main") {
                    SOURCE_PID.store(pid, Ordering::Relaxed);
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("agent-selection-error", message);
                }
            }
        }
    });
}

pub fn start(app: AppHandle) {
    if APP.set(app).is_err() {
        return;
    }
    unsafe { sp_mac_start(keyboard_event) };
}

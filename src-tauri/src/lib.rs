use serde::Serialize;
use std::{
    collections::HashSet,
    fs::{self, File},
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::Mutex,
    time::UNIX_EPOCH,
};
use tauri::{Emitter, Manager, State};

mod autostart;
mod diagnostics;
mod shortcut;
use autostart::{autostart_enabled, set_autostart};

#[tauri::command]
fn trace_preview(stage: String) {
    if matches!(
        stage.as_str(),
        "received"
            | "loaded"
            | "close"
            | "native-close"
            | "blur-close"
            | "dom-space"
            | "load-error"
    ) {
        diagnostics::record(format!("frontend {stage}"));
    }
}

#[cfg(target_os = "macos")]
mod macos_agent;
#[cfg(any(target_os = "macos", test))]
mod macos_gesture;
#[cfg(windows)]
mod windows_agent;
#[cfg(windows)]
mod windows_icons;
#[cfg(windows)]
mod windows_presentation;

#[tauri::command]
fn agent_status() -> serde_json::Value {
    #[cfg(windows)]
    {
        windows_agent::status()
    }
    #[cfg(target_os = "macos")]
    {
        macos_agent::status()
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        serde_json::json!({"supported": false, "enabled": false, "running": false})
    }
}

#[tauri::command]
fn set_agent_enabled(enabled: bool) {
    #[cfg(windows)]
    windows_agent::set_enabled(enabled);
    #[cfg(target_os = "macos")]
    macos_agent::set_enabled(enabled);
    #[cfg(not(any(windows, target_os = "macos")))]
    let _ = enabled;
}

#[tauri::command]
fn set_agent_shortcut(shortcut: shortcut::Shortcut) -> Result<(), String> {
    let config = shortcut::set(shortcut)?;
    #[cfg(target_os = "macos")]
    macos_agent::set_shortcut(config);
    #[cfg(not(target_os = "macos"))]
    let _ = config;
    Ok(())
}

#[tauri::command]
fn request_agent_permissions(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos_agent::request_permissions(app).map_err(|error| error.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Ok(())
    }
}

#[tauri::command]
fn hide_preview(window: tauri::WebviewWindow) -> tauri::Result<()> {
    #[cfg(windows)]
    {
        windows_agent::hide_preview(&window)
    }
    #[cfg(target_os = "macos")]
    {
        macos_agent::hide_preview(&window)
    }
    #[cfg(not(any(windows, target_os = "macos")))]
    {
        window.hide()
    }
}

const MAX_READ: usize = 32 * 1024 * 1024;
#[derive(Default)]
struct PreviewState {
    allowed: Mutex<HashSet<PathBuf>>,
    startup: Mutex<(bool, Option<(Vec<String>, bool)>)>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInfo {
    id: String,
    name: String,
    path: String,
    size: u64,
    modified: u64,
    mime: String,
}

fn metadata(path: &Path) -> Result<FileInfo, String> {
    let info = fs::metadata(path).map_err(|e| e.to_string())?;
    if !info.is_file() {
        return Err("请选择文件，暂不预览文件夹。".into());
    }
    let name = path
        .file_name()
        .ok_or("文件名无效")?
        .to_string_lossy()
        .to_string();
    let path = path.to_string_lossy().to_string();
    Ok(FileInfo {
        id: path.clone(),
        mime: mime_guess::from_path(&path)
            .first_or_octet_stream()
            .to_string(),
        path,
        name,
        size: info.len(),
        modified: info
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0),
    })
}

#[tauri::command]
fn inspect_file(
    path: String,
    app: tauri::AppHandle,
    state: State<PreviewState>,
) -> Result<FileInfo, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    let info = metadata(&path)?;
    // Authorize exact files, never an entire drive. Only the local application can invoke this command.
    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|e| e.to_string())?;
    state
        .allowed
        .lock()
        .map_err(|e| e.to_string())?
        .insert(path);
    Ok(info)
}

fn authorized(path: &str, state: &PreviewState) -> Result<PathBuf, String> {
    let path = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !state
        .allowed
        .lock()
        .map_err(|e| e.to_string())?
        .contains(&path)
    {
        return Err("请先选择此文件。".into());
    }
    Ok(path)
}

#[tauri::command]
async fn render_presentation(
    path: String,
    app: tauri::AppHandle,
    state: State<'_, PreviewState>,
) -> Result<FileInfo, String> {
    let source = authorized(&path, &state)?;
    let extension = source
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if ![
        "pptx", "pptm", "potx", "potm", "ppsx", "ppsm", "ppt", "pps", "pot",
    ]
    .contains(&extension.as_str())
    {
        return Err("此文件不是支持的 PowerPoint 文稿。".into());
    }
    #[cfg(windows)]
    {
        let cache = app
            .path()
            .app_cache_dir()
            .map_err(|error| error.to_string())?
            .join("presentations");
        let output = tauri::async_runtime::spawn_blocking(move || {
            windows_presentation::render(&source, &cache)
        })
        .await
        .map_err(|error| error.to_string())??;
        inspect_file(output.to_string_lossy().into_owned(), app, state)
    }
    #[cfg(not(windows))]
    {
        let _ = (source, app);
        Err("此系统暂未接入原始幻灯片页面渲染，已切换文字速览。".into())
    }
}

#[tauri::command]
async fn file_icon(
    path: Option<String>,
    name: String,
    folder: bool,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let path = path.map(|path| authorized(&path, &state)).transpose()?;
    #[cfg(windows)]
    {
        let bytes = tauri::async_runtime::spawn_blocking(move || {
            windows_icons::read(path.as_deref(), &name, folder)
        })
        .await
        .map_err(|error| error.to_string())??;
        Ok(tauri::ipc::Response::new(bytes))
    }
    #[cfg(not(windows))]
    {
        let _ = (path, name, folder);
        Ok(tauri::ipc::Response::new(Vec::new()))
    }
}

#[tauri::command]
async fn read_prefix(
    path: String,
    limit: usize,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let path = authorized(&path, &state)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_bounded(&path, limit))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

fn read_bounded(path: &Path, limit: usize) -> Result<Vec<u8>, String> {
    read_at(path, 0, limit)
}

#[tauri::command]
async fn read_range(
    path: String,
    offset: u64,
    limit: usize,
    state: State<'_, PreviewState>,
) -> Result<tauri::ipc::Response, String> {
    let path = authorized(&path, &state)?;
    let bytes = tauri::async_runtime::spawn_blocking(move || read_at(&path, offset, limit))
        .await
        .map_err(|e| e.to_string())??;
    Ok(tauri::ipc::Response::new(bytes))
}

fn read_at(path: &Path, offset: u64, limit: usize) -> Result<Vec<u8>, String> {
    if limit > MAX_READ {
        return Err("读取超过 32 MB 上限。".into());
    }
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    if !file.metadata().map_err(|e| e.to_string())?.is_file() {
        return Err("仅支持普通文件。".into());
    }
    let mut bytes = Vec::new();
    file.seek(SeekFrom::Start(offset))
        .map_err(|e| e.to_string())?;
    file.take(limit as u64)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    Ok(bytes)
}

#[tauri::command]
fn list_siblings(
    path: String,
    app: tauri::AppHandle,
    state: State<PreviewState>,
) -> Result<Vec<FileInfo>, String> {
    let current = authorized(&path, &state)?;
    let parent = current.parent().ok_or("找不到父目录")?;
    let mut paths: Vec<PathBuf> = fs::read_dir(parent)
        .map_err(|e| e.to_string())?
        .take(2001)
        .filter_map(Result::ok)
        .map(|e| e.path())
        .filter(|p| p.is_file())
        .collect();
    if paths.len() > 2000 {
        return Ok(vec![metadata(&current)?]);
    }
    paths.sort_by_key(|p| {
        p.file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase()
    });
    let mut results = Vec::new();
    for path in paths {
        if let Ok(canonical) = fs::canonicalize(path) {
            if let Ok(info) = metadata(&canonical) {
                app.asset_protocol_scope()
                    .allow_file(&canonical)
                    .map_err(|e| e.to_string())?;
                state
                    .allowed
                    .lock()
                    .map_err(|e| e.to_string())?
                    .insert(canonical);
                results.push(info);
            }
        }
    }
    Ok(results)
}

#[tauri::command]
fn open_default(path: String, state: State<PreviewState>) -> Result<(), String> {
    let path = authorized(&path, &state)?;
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    if [
        "exe",
        "com",
        "bat",
        "cmd",
        "ps1",
        "vbs",
        "vbe",
        "js",
        "jse",
        "wsf",
        "wsh",
        "msi",
        "scr",
        "lnk",
        "url",
        "sh",
        "command",
        "app",
        "py",
        "pyw",
        "pyc",
        "pyo",
        "pyz",
        "mjs",
        "cjs",
        "psm1",
        "rb",
        "rbw",
        "pl",
        "php",
        "lua",
        "jar",
        "jnlp",
        "hta",
        "reg",
        "cpl",
        "msc",
        "msp",
        "msix",
        "msixbundle",
        "appx",
        "appxbundle",
    ]
    .contains(&ext.as_str())
    {
        return Err("预览器不启动可执行文件或脚本，请在文件管理器中自行打开。".into());
    }
    open::that_detached(path).map_err(|e| e.to_string())
}

fn argument_paths(args: impl Iterator<Item = String>) -> Vec<String> {
    args.filter(|a| !a.starts_with('-'))
        .filter(|a| Path::new(a).is_file())
        .collect()
}

#[tauri::command]
fn initial_paths(state: State<PreviewState>) -> Result<serde_json::Value, String> {
    let mut startup = state.startup.lock().map_err(|error| error.to_string())?;
    let (paths, text) = startup.1.take().unwrap_or_else(|| {
        (
            argument_paths(std::env::args().skip(1)),
            std::env::args().any(|arg| arg == "--text"),
        )
    });
    startup.0 = true;
    Ok(serde_json::json!({ "paths": paths, "text": text }))
}

fn show_preview_files(app: &tauri::AppHandle, paths: Vec<String>, text: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
        if !paths.is_empty() {
            let state = app.state::<PreviewState>();
            if let Ok(mut startup) = state.startup.lock() {
                if startup.0 {
                    let _ = window.emit(
                        "preview-files",
                        serde_json::json!({ "paths": paths, "text": text }),
                    );
                } else {
                    // macOS can deliver Dock/Open With files before the WebView subscribes.
                    startup.1 = Some((paths, text));
                }
            };
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _| {
            if autostart::background_launch(&args) {
                return;
            }
            let text = args.iter().any(|a| a == "--text");
            let paths = argument_paths(args.into_iter().skip(1));
            show_preview_files(app, paths, text);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(PreviewState::default())
        .invoke_handler(tauri::generate_handler![
            inspect_file,
            file_icon,
            render_presentation,
            read_prefix,
            read_range,
            list_siblings,
            open_default,
            initial_paths,
            autostart_enabled,
            set_autostart,
            agent_status,
            trace_preview,
            hide_preview,
            set_agent_enabled,
            set_agent_shortcut,
            request_agent_permissions
        ])
        .setup(|app| {
            app.manage(autostart::configure()?);
            diagnostics::start();
            #[cfg(windows)]
            windows_agent::start(app.handle().clone());
            #[cfg(target_os = "macos")]
            {
                macos_agent::start(app.handle().clone());
                // Native edit menu supplies Cmd+C/V/A and the standard Cmd+Q action.
                app.set_menu(tauri::menu::Menu::default(app.handle())?)?;
            }
            use tauri::{
                menu::{Menu, MenuItem},
                tray::TrayIconBuilder,
            };
            let show = MenuItem::with_id(app, "show", "打开瞬览", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "退出瞬览", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("瞬览 SpacePreview");
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.on_menu_event(|app, event| match event.id.as_ref() {
                "show" => {
                    if let Some(w) = app.get_webview_window("main") {
                        let _ = w.show();
                        let _ = w.unminimize();
                        let _ = w.set_focus();
                    }
                }
                "quit" => app.exit(0),
                _ => (),
            })
            .build(app)?;
            if !autostart::background_launch(&std::env::args().collect::<Vec<_>>()) {
                if let Some(window) = app.get_webview_window("main") {
                    window.show()?;
                    window.set_focus()?;
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.emit("preview-closed", ());
                if let Some(webview) = window.app_handle().get_webview_window(window.label()) {
                    let _ = hide_preview(webview);
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("启动瞬览失败")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::Opened { urls } => {
                    let paths = urls
                        .into_iter()
                        .filter_map(|url| url.to_file_path().ok())
                        .filter(|path| path.is_file())
                        .take(100)
                        .map(|path| path.to_string_lossy().into_owned())
                        .collect();
                    show_preview_files(app, paths, false);
                }
                tauri::RunEvent::Reopen {
                    has_visible_windows,
                    ..
                } if !has_visible_windows => {
                    show_preview_files(app, Vec::new(), false);
                }
                _ => (),
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_reads_do_not_load_the_whole_file() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert_eq!(read_bounded(&path, 8).unwrap().len(), 8);
        assert!(read_bounded(&path, MAX_READ + 1).is_err());
        let all = fs::read(&path).unwrap();
        assert_eq!(read_at(&path, 4, 8).unwrap(), all[4..12]);
        assert!(read_at(&path, all.len() as u64 + 1, 8).unwrap().is_empty());
    }
    #[test]
    fn unselected_files_cannot_be_read() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert!(authorized(path.to_str().unwrap(), &PreviewState::default()).is_err());
    }
}

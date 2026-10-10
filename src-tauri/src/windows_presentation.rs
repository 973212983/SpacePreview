use std::{
    collections::hash_map::DefaultHasher,
    fs,
    hash::{Hash, Hasher},
    io::Read,
    os::windows::process::CommandExt,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant, SystemTime},
};

static CONVERSION: Mutex<()> = Mutex::new(());

fn cache_key(path: &Path, size: u64, modified: SystemTime) -> String {
    let mut hash = DefaultHasher::new();
    (path, size, modified).hash(&mut hash);
    format!("{:016x}", hash.finish())
}

fn valid_pdf(path: &Path) -> bool {
    let mut header = [0; 5];
    fs::File::open(path)
        .and_then(|mut file| file.read_exact(&mut header))
        .is_ok()
        && &header == b"%PDF-"
}

fn office_path(path: &Path) -> String {
    let path = path.to_string_lossy();
    if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{unc}")
    } else {
        path.strip_prefix(r"\\?\").unwrap_or(&path).to_string()
    }
}

pub fn render(source: &Path, cache: &Path) -> Result<PathBuf, String> {
    let _guard = CONVERSION.lock().map_err(|error| error.to_string())?;
    let info = fs::metadata(source).map_err(|error| error.to_string())?;
    let modified = info.modified().map_err(|error| error.to_string())?;
    let key = cache_key(source, info.len(), modified);
    fs::create_dir_all(cache).map_err(|error| error.to_string())?;
    let output = cache.join(format!("{key}.pdf"));
    if valid_pdf(&output) {
        return Ok(output);
    }
    let pending = cache.join(format!("{key}.pending.pdf"));
    // Paths are environment values, never interpolated into PowerShell code.
    let shell = PathBuf::from(std::env::var_os("SystemRoot").ok_or("无法定位 Windows 系统目录。")?)
        .join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut child = Command::new(shell)
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            include_str!("presentation.ps1"),
        ])
        .env("SPACEPREVIEW_PPT_SOURCE", office_path(source))
        .env("SPACEPREVIEW_PPT_OUTPUT", office_path(&pending))
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| error.to_string())?;
    let started = Instant::now();
    let success = loop {
        if let Some(status) = child.try_wait().map_err(|error| error.to_string())? {
            break status.success();
        }
        if started.elapsed() > Duration::from_secs(90) {
            // Stop only our helper; never terminate the user's PowerPoint process.
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_file(&pending);
            return Err("幻灯片页面转换超时，已切换文字速览。可使用默认应用查看。".into());
        }
        thread::sleep(Duration::from_millis(100));
    };
    if !success || !valid_pdf(&pending) {
        let _ = fs::remove_file(&pending);
        return Err("无法生成幻灯片页面，请确认已安装并激活 Microsoft PowerPoint，且文件没有密码保护。已切换文字速览。".into());
    }
    let updated = fs::metadata(source).map_err(|error| error.to_string())?;
    if updated.len() != info.len() || updated.modified().ok() != Some(modified) {
        let _ = fs::remove_file(&pending);
        return Err("转换期间文件发生变化，请重新打开预览。".into());
    }
    if output.exists() {
        fs::remove_file(&output).map_err(|error| error.to_string())?;
    }
    fs::rename(&pending, &output).map_err(|error| error.to_string())?;
    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cache_tracks_source_and_changes() {
        let path = Path::new("deck.pptx");
        let time = SystemTime::UNIX_EPOCH;
        let key = cache_key(path, 1, time);
        assert_eq!(key, cache_key(path, 1, time));
        assert_ne!(key, cache_key(Path::new("other.pptx"), 1, time));
        assert_ne!(key, cache_key(path, 2, time));
        assert_ne!(key, cache_key(path, 1, time + Duration::from_nanos(100)));
    }

    #[test]
    fn com_paths_preserve_local_and_unc_names() {
        assert_eq!(office_path(Path::new(r"\\?\E:\deck.pptx")), r"E:\deck.pptx");
        assert_eq!(
            office_path(Path::new(r"\\?\UNC\server\share\deck.pptx")),
            r"\\server\share\deck.pptx"
        );
    }

    #[test]
    #[ignore = "requires a local PowerPoint installation and SPACEPREVIEW_TEST_PPT"]
    fn converts_real_deck_and_reuses_cache_without_modifying_source() {
        let source = fs::canonicalize(std::env::var("SPACEPREVIEW_TEST_PPT").unwrap()).unwrap();
        let original = fs::read(&source).unwrap();
        let cache =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../test-results/presentation-cache");
        let pdf = render(&source, &cache).unwrap();
        assert!(valid_pdf(&pdf));
        let time = fs::metadata(&pdf).unwrap().modified().unwrap();
        assert_eq!(render(&source, &cache).unwrap(), pdf);
        assert_eq!(fs::metadata(&pdf).unwrap().modified().unwrap(), time);
        assert_eq!(fs::read(source).unwrap(), original);
    }
}

use auto_launch::{AutoLaunch, AutoLaunchBuilder};
use std::{env, path::Path};
use tauri::State;

pub fn configure() -> Result<AutoLaunch, String> {
    let executable = env::current_exe().map_err(|error| error.to_string())?;
    // Windows Run entries must quote executable paths containing spaces.
    #[cfg(windows)]
    let path = format!("\"{}\"", executable.display());
    #[cfg(not(windows))]
    let path = executable.to_string_lossy().into_owned();
    let mut builder = AutoLaunchBuilder::new();
    builder
        .set_app_name("SpacePreview")
        .set_app_path(&path)
        .set_args(&["--autostart"]);
    #[cfg(target_os = "macos")]
    builder.set_use_launch_agent(true);
    builder.build().map_err(|error| error.to_string())
}

pub fn background_launch(args: &[String]) -> bool {
    args.iter().any(|arg| arg == "--autostart")
        && !args
            .iter()
            .skip(1)
            .any(|arg| !arg.starts_with('-') && Path::new(arg).is_file())
}

#[tauri::command]
pub fn autostart_enabled(launch: State<'_, AutoLaunch>) -> Result<bool, String> {
    launch.is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_autostart(enabled: bool, launch: State<'_, AutoLaunch>) -> Result<bool, String> {
    if enabled {
        launch.enable().map_err(|error| error.to_string())?;
    } else if let Err(error) = launch.disable() {
        match error {
            auto_launch::Error::Io(error) if error.kind() == std::io::ErrorKind::NotFound => (),
            error => return Err(error.to_string()),
        }
    }
    launch.is_enabled().map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_login_start_without_files_stays_in_background() {
        assert!(!background_launch(&["SpacePreview.exe".into()]));
        assert!(background_launch(&[
            "SpacePreview.exe".into(),
            "--autostart".into()
        ]));
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("Cargo.toml");
        assert!(!background_launch(&[
            "SpacePreview.exe".into(),
            "--autostart".into(),
            path.to_string_lossy().into_owned()
        ]));
    }

    #[test]
    fn startup_command_points_to_this_executable() {
        let launch = configure().unwrap();
        let executable = env::current_exe().unwrap();
        #[cfg(windows)]
        assert_eq!(
            launch.get_app_path(),
            format!("\"{}\"", executable.display())
        );
        #[cfg(not(windows))]
        assert_eq!(launch.get_app_path(), executable.to_string_lossy());
    }
}

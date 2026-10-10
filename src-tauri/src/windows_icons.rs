//! Read Shell icons without opening the selected shortcut or application.
use std::{mem::size_of, path::Path, sync::Mutex};
use windows::{
    core::PCWSTR,
    Win32::{
        Graphics::Gdi::*,
        Storage::FileSystem::{FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_NORMAL},
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED},
        UI::{
            Shell::*,
            WindowsAndMessaging::{DestroyIcon, DrawIconEx, DI_NORMAL, HICON},
        },
    },
};

const SIDE: usize = 64;
// Serialize Shell requests and their icon lifetimes, including installed icon handlers.
static ICON_LOCK: Mutex<()> = Mutex::new(());
struct ShellIcon(HICON);
impl Drop for ShellIcon {
    fn drop(&mut self) {
        unsafe {
            let _ = DestroyIcon(self.0);
        }
    }
}

pub fn read(path: Option<&Path>, name: &str, folder: bool) -> Result<Vec<u8>, String> {
    let _guard = ICON_LOCK.lock().map_err(|error| error.to_string())?;
    unsafe {
        let initialized = CoInitializeEx(None, COINIT_APARTMENTTHREADED).is_ok();
        let result = read_inner(path, name, folder);
        if initialized {
            CoUninitialize();
        }
        result
    }
}

unsafe fn read_inner(path: Option<&Path>, name: &str, folder: bool) -> Result<Vec<u8>, String> {
    let query = if let Some(path) = path {
        let path = path.to_string_lossy();
        if let Some(unc) = path.strip_prefix(r"\\?\UNC\") {
            format!(r"\\{unc}")
        } else {
            path.strip_prefix(r"\\?\").unwrap_or(&path).to_string()
        }
    } else {
        let extension = Path::new(name)
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("");
        format!("preview.{}", extension.chars().take(32).collect::<String>())
    };
    let wide: Vec<u16> = query.encode_utf16().chain(Some(0)).collect();
    let mut info = SHFILEINFOW::default();
    let mut flags = SHGFI_ICON | SHGFI_LARGEICON | SHGFI_ADDOVERLAYS;
    if path.is_none() {
        flags |= SHGFI_USEFILEATTRIBUTES;
    }
    let attributes = if folder {
        FILE_ATTRIBUTE_DIRECTORY
    } else {
        FILE_ATTRIBUTE_NORMAL
    };
    if SHGetFileInfoW(
        PCWSTR(wide.as_ptr()),
        attributes,
        Some(&mut info),
        size_of::<SHFILEINFOW>() as u32,
        flags,
    ) == 0
    {
        if path.is_some() {
            return read_inner(None, name, folder);
        }
        return Err("系统图标不可用。".into());
    }
    let icon = ShellIcon(info.hIcon);
    let black = render(icon.0, 0)?;
    let white = render(icon.0, 255)?;
    let rgba = transparent_pixels(&black, &white);
    let mut png = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png, SIDE as u32, SIDE as u32);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| e.to_string())?;
        writer.write_image_data(&rgba).map_err(|e| e.to_string())?;
    }
    Ok(png)
}

unsafe fn render(icon: HICON, background: u8) -> Result<Vec<u8>, String> {
    let dc = CreateCompatibleDC(None);
    if dc.0.is_null() {
        return Err("无法绘制系统图标。".into());
    }
    let info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: SIDE as i32,
            biHeight: -(SIDE as i32),
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let mut bits = std::ptr::null_mut();
    let bitmap = match CreateDIBSection(Some(dc), &info, DIB_RGB_COLORS, &mut bits, None, 0) {
        Ok(bitmap) => bitmap,
        Err(error) => {
            let _ = DeleteDC(dc);
            return Err(error.to_string());
        }
    };
    let old = SelectObject(dc, HGDIOBJ(bitmap.0));
    let pixels = std::slice::from_raw_parts_mut(bits.cast::<u8>(), SIDE * SIDE * 4);
    pixels.fill(background);
    let result = DrawIconEx(dc, 0, 0, icon, SIDE as i32, SIDE as i32, 0, None, DI_NORMAL)
        .map_err(|error| error.to_string())
        .map(|_| {
            let _ = GdiFlush();
            pixels.to_vec()
        });
    let _ = SelectObject(dc, old);
    let _ = DeleteObject(HGDIOBJ(bitmap.0));
    let _ = DeleteDC(dc);
    result
}

fn transparent_pixels(black: &[u8], white: &[u8]) -> Vec<u8> {
    black
        .chunks_exact(4)
        .zip(white.chunks_exact(4))
        .flat_map(|(dark, light)| {
            // Two opaque backgrounds also preserve masks of old icons with no alpha channel.
            let alpha = 255
                - (0..3)
                    .map(|i| light[i].saturating_sub(dark[i]))
                    .max()
                    .unwrap();
            let color = |i| {
                if alpha == 0 {
                    0
                } else {
                    (dark[i] as u32 * 255 / alpha as u32).min(255) as u8
                }
            };
            [color(2), color(1), color(0), alpha]
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use windows::{
        core::Interface,
        Win32::System::Com::{CoCreateInstance, IPersistFile, CLSCTX_INPROC_SERVER},
    };

    #[test]
    fn shortcut_uses_custom_application_icon() {
        let path =
            std::env::temp_dir().join(format!("space-preview-icon-{}.lnk", std::process::id()));
        let icon = Path::new(env!("CARGO_MANIFEST_DIR")).join("icons/icon.ico");
        let wide = |path: &Path| {
            path.to_string_lossy()
                .encode_utf16()
                .chain(Some(0))
                .collect::<Vec<_>>()
        };
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok().unwrap();
            {
                let link: IShellLinkW =
                    CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).unwrap();
                let target = wide(&std::env::current_exe().unwrap());
                let location = wide(&icon);
                let destination = wide(&path);
                link.SetPath(PCWSTR(target.as_ptr())).unwrap();
                link.SetIconLocation(PCWSTR(location.as_ptr()), 0).unwrap();
                link.cast::<IPersistFile>()
                    .unwrap()
                    .Save(PCWSTR(destination.as_ptr()), true)
                    .unwrap();
            }
            CoUninitialize();
        }
        let bytes = read(Some(&path), "custom.lnk", false).unwrap();
        std::fs::remove_file(&path).unwrap();
        assert_ne!(bytes, read(None, "custom.lnk", false).unwrap());
        let mut decoder = png::Decoder::new(std::io::Cursor::new(&bytes))
            .read_info()
            .unwrap();
        let mut pixels = vec![0; decoder.output_buffer_size().unwrap()];
        decoder.next_frame(&mut pixels).unwrap();
        // The project icon has blue/green pixels, unlike the generic shortcut icon.
        assert!(pixels
            .chunks_exact(4)
            .any(|pixel| pixel[3] > 200 && pixel[2] > pixel[0].saturating_add(50)));
        let results = Path::new(env!("CARGO_MANIFEST_DIR")).join("../test-results");
        if results.is_dir() {
            std::fs::write(results.join("system-shortcut-icon.png"), bytes).unwrap();
        }
    }

    #[test]
    fn colors_and_transparency_survive_bgra_conversion() {
        assert_eq!(
            transparent_pixels(&[0, 0, 0, 0], &[255, 255, 255, 0]),
            [0, 0, 0, 0]
        );
        assert_eq!(
            transparent_pixels(&[10, 20, 30, 0], &[10, 20, 30, 0]),
            [30, 20, 10, 255]
        );
        assert_eq!(
            transparent_pixels(&[0, 0, 128, 0], &[127, 127, 255, 0]),
            [255, 0, 0, 128]
        );
    }

    #[test]
    fn executable_uses_embedded_application_icon() {
        let path = Path::new(&std::env::var_os("SystemRoot").unwrap()).join("explorer.exe");
        let bytes = read(Some(&path), "explorer.exe", false).unwrap();
        assert_ne!(bytes, read(None, "explorer.exe", false).unwrap());
        let mut decoder = png::Decoder::new(std::io::Cursor::new(&bytes))
            .read_info()
            .unwrap();
        let mut pixels = vec![0; decoder.output_buffer_size().unwrap()];
        decoder.next_frame(&mut pixels).unwrap();
        assert!(pixels
            .chunks_exact(4)
            .any(|pixel| pixel[3] > 200 && pixel[0].abs_diff(pixel[2]) > 50));
    }

    #[test]
    fn shell_icons_are_colored_pngs() {
        for (name, folder) in [
            ("note.txt", false),
            ("program.lnk", false),
            ("folder", true),
        ] {
            let bytes = read(None, name, folder).unwrap_or_else(|error| panic!("{name}: {error}"));
            assert!(bytes.starts_with(b"\x89PNG\r\n\x1a\n"));
            let mut decoder = png::Decoder::new(std::io::Cursor::new(bytes))
                .read_info()
                .unwrap();
            let mut pixels = vec![0; decoder.output_buffer_size().unwrap()];
            let frame = decoder.next_frame(&mut pixels).unwrap();
            assert_eq!((frame.width, frame.height), (64, 64));
            assert!(pixels.chunks_exact(4).any(|pixel| pixel[3] != 0));
            assert!(pixels.chunks_exact(4).any(|pixel| pixel[3] == 0));
        }
    }
}

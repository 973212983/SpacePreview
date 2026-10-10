fn main() {
    println!("cargo:rerun-if-changed=src/macos_native.m");
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        cc::Build::new()
            .file("src/macos_native.m")
            .flag("-fobjc-arc")
            .flag("-fblocks")
            .compile("spacepreview_macos");
        for framework in ["AppKit", "Foundation", "ApplicationServices", "Carbon"] {
            println!("cargo:rustc-link-lib=framework={framework}");
        }
    }
    tauri_build::build()
}

//! Opt-in local input trace. Hook callbacks only enqueue; disk writes use a worker.
use std::{
    io::Write,
    sync::{
        mpsc::{sync_channel, SyncSender},
        OnceLock,
    },
    time::Instant,
};

static TRACE: OnceLock<SyncSender<String>> = OnceLock::new();

pub fn start() {
    let Some(path) = std::env::var_os("SPACE_PREVIEW_TRACE") else {
        return;
    };
    let Ok(mut file) = std::fs::File::create(path) else {
        return;
    };
    let (sender, receiver) = sync_channel::<String>(256);
    if TRACE.set(sender).is_err() {
        return;
    }
    std::thread::spawn(move || {
        let start = Instant::now();
        let mut bytes = 0;
        while let Ok(message) = receiver.recv() {
            let line = format!("{}ms {message}\n", start.elapsed().as_millis());
            bytes += line.len();
            if bytes > 1024 * 1024 {
                break;
            }
            let _ = file.write_all(line.as_bytes());
            let _ = file.flush();
        }
    });
    record("trace-start");
}

pub fn record(message: impl Into<String>) {
    if let Some(sender) = TRACE.get() {
        let _ = sender.try_send(message.into());
    }
}

pub fn enabled() -> bool {
    TRACE.get().is_some()
}

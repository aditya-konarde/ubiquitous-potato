//! amdgpu-exporter — Prometheus metrics exporter for AMD GPUs
//!
//! Reads telemetry from Linux sysfs (`/sys/class/drm/card*/device/`).
//! Zero external dependencies at runtime — no ROCm, no libdrm.
//! Optimized for Strix Halo / Radeon 8060S iGPUs and all amdgpu cards.

use std::fmt::Write;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tiny_http::{Header, Response, Server};

// ─── GPU detection ─────────────────────────────────────────

/// A discovered AMD GPU with its sysfs base path.
#[derive(Debug, Clone)]
struct AmdGpu {
    index: u32,
    card_name: String,
    sysfs: PathBuf,
    hwmon: Option<PathBuf>,
    pci_id: String,
    device_name: String,
    vbios: String,
}

/// Discover AMD GPUs under the given DRM root directory. Production callers
/// pass `/sys/class/drm`; tests pass a fixture tree.
fn discover_gpus_in(drm: &Path) -> Vec<AmdGpu> {
    let Ok(entries) = fs::read_dir(drm) else {
        return Vec::new();
    };

    let mut gpus = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();

        // Match cardN (but not cardN-connector)
        if !name_str.starts_with("card") || name_str.contains('-') {
            continue;
        }

        let device_dir = entry.path().join("device");
        let uevent_path = device_dir.join("uevent");

        let Ok(uevent) = fs::read_to_string(&uevent_path) else {
            continue;
        };

        // Check DRIVER=amdgpu
        if !uevent.lines().any(|l| l == "DRIVER=amdgpu") {
            continue;
        }

        // Extract card index
        let Ok(index) = name_str[4..].parse::<u32>() else {
            continue;
        };

        // Find PCI_ID
        let pci_id = uevent
            .lines()
            .find(|l| l.starts_with("PCI_ID="))
            .map(|l| l.trim_start_matches("PCI_ID=").to_string())
            .unwrap_or_else(|| "unknown".into());

        // Find hwmon directory (None if absent or unreadable)
        let hwmon = fs::read_dir(device_dir.join("hwmon"))
            .ok()
            .and_then(|mut rd| rd.find_map(|e| e.ok().map(|e| e.path())));

        let device_name = read_device_name(&device_dir);
        let vbios = read_sysfs_string(&device_dir.join("vbios_version"))
            .unwrap_or_else(|| "unknown".into());

        gpus.push(AmdGpu {
            index,
            card_name: name_str.into(),
            sysfs: device_dir,
            hwmon,
            pci_id,
            device_name,
            vbios,
        });
    }

    gpus.sort_by_key(|g| g.index);
    gpus
}

/// Try to read the GPU human-readable name from PCI modalias or sysfs.
fn read_device_name(device_dir: &Path) -> String {
    // Try modalias first for a clean identification
    if let Ok(modalias) = fs::read_to_string(device_dir.join("modalias")) {
        // e.g. pci:v00001002d00001586sv00001F4Csd0000B026bc03sc80i00
        if let Some(id) = modalias
            .trim()
            .strip_prefix("pci:v00001002d0000")
            .and_then(|s| s.split('s').next())
        {
            return format!("AMD GPU [0x{}]", id.to_uppercase());
        }
    }
    "AMD GPU".into()
}

// ─── Sysfs readers ─────────────────────────────────────────

/// Read a sysfs file to a trimmed String.
fn read_sysfs_string(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok().map(|s| s.trim().to_string())
}

/// Read a sysfs file as u64.
fn read_sysfs_u64(path: &Path) -> Option<u64> {
    read_sysfs_string(path).and_then(|s| s.parse().ok())
}

/// Read a sysfs file as f64.
fn read_sysfs_f64(path: &Path) -> Option<f64> {
    read_sysfs_string(path).and_then(|s| s.parse().ok())
}

/// Read a hwmon-relative sysfs file as f64, returning None if hwmon is absent.
fn read_hwmon_f64(hwmon: Option<&PathBuf>, file: &str) -> Option<f64> {
    hwmon.and_then(|h| read_sysfs_f64(&h.join(file)))
}

// ─── Metric emission ───────────────────────────────────────

/// Escape a Prometheus label value per the text exposition format.
fn escape_prom_label_value(value: &str) -> String {
    value
        .replace('\\', r"\\")
        .replace('\n', r"\n")
        .replace('"', r#"\""#)
}

/// Format a label set as `{k1="v1",k2="v2"}` (or empty string if no labels).
fn format_labels(labels: &[(&str, &str)]) -> String {
    if labels.is_empty() {
        return String::new();
    }
    let mut out = String::with_capacity(64);
    out.push('{');
    for (i, (k, v)) in labels.iter().enumerate() {
        if i > 0 {
            out.push(',');
        }
        out.push_str(k);
        out.push_str("=\"");
        out.push_str(&escape_prom_label_value(v));
        out.push('"');
    }
    out.push('}');
    out
}

/// Format a Prometheus float value: NaN, +Inf, -Inf, or finite.
fn format_value(v: f64) -> String {
    if v.is_nan() {
        "NaN".into()
    } else if v.is_infinite() {
        if v.is_sign_positive() {
            "+Inf".into()
        } else {
            "-Inf".into()
        }
    } else {
        // Use Rust's default float formatting; always finite here.
        format!("{v}")
    }
}

/// A sample within a metric family: labels + value.
struct Sample<'a> {
    labels: Vec<(&'a str, String)>,
    value: f64,
}

/// Write one metric family with the given Prometheus metric type.
fn write_family_typed(
    out: &mut String,
    name: &str,
    metric_type: &str,
    help: &str,
    samples: &[Sample],
) {
    let _ = writeln!(out, "# HELP {name} {help}");
    let _ = writeln!(out, "# TYPE {name} {metric_type}");
    for s in samples {
        let labels: Vec<(&str, &str)> = s.labels.iter().map(|(k, v)| (*k, v.as_str())).collect();
        let _ = writeln!(
            out,
            "{name}{} {}",
            format_labels(&labels),
            format_value(s.value)
        );
    }
}

/// Write a gauge metric family.
fn write_family(out: &mut String, name: &str, help: &str, samples: &[Sample]) {
    write_family_typed(out, name, "gauge", help, samples);
}

/// Write a counter metric family. Caller is responsible for using a `_total`
/// suffix per Prometheus convention.
fn write_counter(out: &mut String, name: &str, help: &str, samples: &[Sample]) {
    write_family_typed(out, name, "counter", help, samples);
}

// ─── Per-GPU snapshot ──────────────────────────────────────

/// One scrape's worth of telemetry for a single GPU. Missing readings → NaN
/// (Prometheus convention for "unknown / not applicable").
struct Snapshot {
    temp_c: f64,
    power_w: f64,
    power_avg_w: f64,
    sclk_hz: f64,
    gpu_util_ratio: f64,
    vram_util_ratio: f64,
    vram_total: f64,
    vram_used: f64,
    vram_free: f64,
    vis_vram_total: f64,
    vis_vram_used: f64,
    gtt_total: f64,
    gtt_used: f64,
    vddgfx_v: f64,
    vddnb_v: f64,
    power_state: String,
    dpm_level: String,
    dpm_state: String,
}

fn snapshot(gpu: &AmdGpu) -> Snapshot {
    let h = gpu.hwmon.as_ref();
    let nan = f64::NAN;

    let temp_c = read_hwmon_f64(h, "temp1_input")
        .map(|m| m / 1000.0)
        .unwrap_or(nan);
    let power_w = read_hwmon_f64(h, "power1_input")
        .map(|uw| uw / 1_000_000.0)
        .unwrap_or(nan);
    let power_avg_w = read_hwmon_f64(h, "power1_average")
        .map(|uw| uw / 1_000_000.0)
        .unwrap_or(nan);
    let sclk_hz = read_hwmon_f64(h, "freq1_input").unwrap_or(nan);
    let vddgfx_v = read_hwmon_f64(h, "in0_input")
        .map(|mv| mv / 1000.0)
        .unwrap_or(nan);
    let vddnb_v = read_hwmon_f64(h, "in1_input")
        .map(|mv| mv / 1000.0)
        .unwrap_or(nan);

    let gpu_util_ratio = read_sysfs_u64(&gpu.sysfs.join("gpu_busy_percent"))
        .map(|p| p as f64 / 100.0)
        .unwrap_or(nan);

    let vram_total = read_sysfs_u64(&gpu.sysfs.join("mem_info_vram_total"))
        .map(|v| v as f64)
        .unwrap_or(nan);
    let vram_used = read_sysfs_u64(&gpu.sysfs.join("mem_info_vram_used"))
        .map(|v| v as f64)
        .unwrap_or(nan);
    let vram_free = if vram_total.is_finite() && vram_used.is_finite() {
        (vram_total - vram_used).max(0.0)
    } else {
        nan
    };
    let vram_util_ratio = if vram_total.is_finite() && vram_total > 0.0 && vram_used.is_finite() {
        vram_used / vram_total
    } else {
        nan
    };

    let vis_vram_total = read_sysfs_u64(&gpu.sysfs.join("mem_info_vis_vram_total"))
        .map(|v| v as f64)
        .unwrap_or(nan);
    let vis_vram_used = read_sysfs_u64(&gpu.sysfs.join("mem_info_vis_vram_used"))
        .map(|v| v as f64)
        .unwrap_or(nan);
    let gtt_total = read_sysfs_u64(&gpu.sysfs.join("mem_info_gtt_total"))
        .map(|v| v as f64)
        .unwrap_or(nan);
    let gtt_used = read_sysfs_u64(&gpu.sysfs.join("mem_info_gtt_used"))
        .map(|v| v as f64)
        .unwrap_or(nan);

    let power_state =
        read_sysfs_string(&gpu.sysfs.join("power_state")).unwrap_or_else(|| "unknown".into());
    let dpm_level = read_sysfs_string(&gpu.sysfs.join("power_dpm_force_performance_level"))
        .unwrap_or_else(|| "unknown".into());
    let dpm_state =
        read_sysfs_string(&gpu.sysfs.join("power_dpm_state")).unwrap_or_else(|| "unknown".into());

    Snapshot {
        temp_c,
        power_w,
        power_avg_w,
        sclk_hz,
        gpu_util_ratio,
        vram_util_ratio,
        vram_total,
        vram_used,
        vram_free,
        vis_vram_total,
        vis_vram_used,
        gtt_total,
        gtt_used,
        vddgfx_v,
        vddnb_v,
        power_state,
        dpm_level,
        dpm_state,
    }
}

// ─── Metric collection ─────────────────────────────────────

/// Helper: build the per-GPU `gpu="N"` label sample list for a numeric series.
fn series<'a, F: Fn(&Snapshot) -> f64>(
    gpus: &'a [AmdGpu],
    snaps: &[Snapshot],
    f: F,
) -> Vec<Sample<'a>> {
    gpus.iter()
        .zip(snaps.iter())
        .map(|(g, s)| Sample {
            labels: vec![("gpu", g.index.to_string())],
            value: f(s),
        })
        .collect()
}

/// Collect all GPU metrics into a Prometheus text-format string.
fn collect_metrics(gpus: &[AmdGpu]) -> String {
    let mut out = String::with_capacity(4096);
    let snaps: Vec<Snapshot> = gpus.iter().map(snapshot).collect();

    // Count of detected GPUs.
    write_family(
        &mut out,
        "amdgpu_count",
        "Number of AMD GPUs detected.",
        &[Sample {
            labels: vec![],
            value: gpus.len() as f64,
        }],
    );

    // Identity (info-style: value=1, identity in labels).
    let info: Vec<Sample> = gpus
        .iter()
        .map(|g| Sample {
            labels: vec![
                ("gpu", g.index.to_string()),
                ("pci_id", g.pci_id.clone()),
                ("device", g.device_name.clone()),
                ("vbios", g.vbios.clone()),
                ("card", g.card_name.clone()),
            ],
            value: 1.0,
        })
        .collect();
    write_family(
        &mut out,
        "amdgpu_info",
        "AMD GPU identity (constant 1; identity in labels).",
        &info,
    );

    // Numeric series.
    write_family(
        &mut out,
        "amdgpu_temperature_celsius",
        "GPU edge temperature in degrees Celsius.",
        &series(gpus, &snaps, |s| s.temp_c),
    );
    write_family(
        &mut out,
        "amdgpu_power_draw_watts",
        "GPU instantaneous power draw in watts.",
        &series(gpus, &snaps, |s| s.power_w),
    );
    write_family(
        &mut out,
        "amdgpu_power_average_watts",
        "GPU average power draw in watts.",
        &series(gpus, &snaps, |s| s.power_avg_w),
    );
    write_family(
        &mut out,
        "amdgpu_sclk_hertz",
        "GPU shader (graphics) clock frequency in hertz.",
        &series(gpus, &snaps, |s| s.sclk_hz),
    );
    write_family(
        &mut out,
        "amdgpu_gpu_utilization_ratio",
        "GPU utilization as a ratio in [0, 1].",
        &series(gpus, &snaps, |s| s.gpu_util_ratio),
    );
    write_family(
        &mut out,
        "amdgpu_vram_utilization_ratio",
        "VRAM utilization as a ratio in [0, 1].",
        &series(gpus, &snaps, |s| s.vram_util_ratio),
    );
    write_family(
        &mut out,
        "amdgpu_vram_total_bytes",
        "GPU VRAM total in bytes.",
        &series(gpus, &snaps, |s| s.vram_total),
    );
    write_family(
        &mut out,
        "amdgpu_vram_used_bytes",
        "GPU VRAM used in bytes.",
        &series(gpus, &snaps, |s| s.vram_used),
    );
    write_family(
        &mut out,
        "amdgpu_vram_free_bytes",
        "GPU VRAM free in bytes.",
        &series(gpus, &snaps, |s| s.vram_free),
    );
    write_family(
        &mut out,
        "amdgpu_vis_vram_total_bytes",
        "Visible (CPU-mappable) VRAM total in bytes.",
        &series(gpus, &snaps, |s| s.vis_vram_total),
    );
    write_family(
        &mut out,
        "amdgpu_vis_vram_used_bytes",
        "Visible (CPU-mappable) VRAM used in bytes.",
        &series(gpus, &snaps, |s| s.vis_vram_used),
    );
    write_family(
        &mut out,
        "amdgpu_gtt_total_bytes",
        "GTT (system-to-GPU) memory total in bytes.",
        &series(gpus, &snaps, |s| s.gtt_total),
    );
    write_family(
        &mut out,
        "amdgpu_gtt_used_bytes",
        "GTT (system-to-GPU) memory used in bytes.",
        &series(gpus, &snaps, |s| s.gtt_used),
    );
    write_family(
        &mut out,
        "amdgpu_vddgfx_volts",
        "GPU core voltage (VDDGFX) in volts.",
        &series(gpus, &snaps, |s| s.vddgfx_v),
    );
    write_family(
        &mut out,
        "amdgpu_vddnb_volts",
        "Northbridge voltage (VDDNB) in volts.",
        &series(gpus, &snaps, |s| s.vddnb_v),
    );

    // Info-style state metrics: value=1, label encodes current state.
    let power_state_samples: Vec<Sample> = gpus
        .iter()
        .zip(snaps.iter())
        .map(|(g, s)| Sample {
            labels: vec![
                ("gpu", g.index.to_string()),
                ("state", s.power_state.clone()),
            ],
            value: 1.0,
        })
        .collect();
    write_family(
        &mut out,
        "amdgpu_power_state_info",
        "GPU ACPI power state (D0/D1/D2/D3hot/D3cold). Value is constant 1; current state in label.",
        &power_state_samples,
    );

    let dpm_level_samples: Vec<Sample> = gpus
        .iter()
        .zip(snaps.iter())
        .map(|(g, s)| Sample {
            labels: vec![("gpu", g.index.to_string()), ("level", s.dpm_level.clone())],
            value: 1.0,
        })
        .collect();
    write_family(
        &mut out,
        "amdgpu_dpm_performance_level_info",
        "DPM performance level (auto/low/high/manual/etc). Value is constant 1; current level in label.",
        &dpm_level_samples,
    );

    let dpm_state_samples: Vec<Sample> = gpus
        .iter()
        .zip(snaps.iter())
        .map(|(g, s)| Sample {
            labels: vec![("gpu", g.index.to_string()), ("state", s.dpm_state.clone())],
            value: 1.0,
        })
        .collect();
    write_family(
        &mut out,
        "amdgpu_dpm_state_info",
        "DPM power state (battery/balanced/performance). Value is constant 1; current state in label.",
        &dpm_state_samples,
    );

    out
}

// ─── Exporter state & self-metrics ─────────────────────────

/// Process-wide state shared across HTTP handlers: discovery cache, scrape
/// counters, last-scrape signals.
struct ExporterState {
    drm_root: PathBuf,
    cache_ttl: Duration,
    cached_gpus: Mutex<Option<(Instant, Vec<AmdGpu>)>>,
    total_scrapes: AtomicU64,
    last_scrape_duration_seconds: Mutex<f64>,
    last_scrape_succeeded: AtomicBool,
}

impl ExporterState {
    fn new(drm_root: PathBuf, cache_ttl: Duration) -> Self {
        Self {
            drm_root,
            cache_ttl,
            cached_gpus: Mutex::new(None),
            total_scrapes: AtomicU64::new(0),
            last_scrape_duration_seconds: Mutex::new(0.0),
            last_scrape_succeeded: AtomicBool::new(false),
        }
    }

    /// Get the cached GPU list, refreshing if the cache is older than `cache_ttl`.
    fn gpus(&self) -> Vec<AmdGpu> {
        let mut cache = self.cached_gpus.lock().unwrap();
        if let Some((at, gpus)) = cache.as_ref()
            && at.elapsed() < self.cache_ttl
        {
            return gpus.clone();
        }
        let gpus = discover_gpus_in(&self.drm_root);
        *cache = Some((Instant::now(), gpus.clone()));
        gpus
    }

    fn record_scrape(&self, duration: Duration, success: bool) {
        self.total_scrapes.fetch_add(1, Ordering::Relaxed);
        *self.last_scrape_duration_seconds.lock().unwrap() = duration.as_secs_f64();
        self.last_scrape_succeeded.store(success, Ordering::Relaxed);
    }

    fn is_ready(&self) -> bool {
        // Ready means: at least one GPU known and last scrape (if any) succeeded.
        let has_gpus = self
            .cached_gpus
            .lock()
            .unwrap()
            .as_ref()
            .is_some_and(|(_, g)| !g.is_empty());
        let scraped_ok = self.total_scrapes.load(Ordering::Relaxed) == 0 // never scraped is OK at startup
                || self.last_scrape_succeeded.load(Ordering::Relaxed);
        has_gpus && scraped_ok
    }
}

/// Emit exporter self-metrics (build info, scrape counters, etc).
fn collect_exporter_metrics(state: &ExporterState, out: &mut String) {
    write_family(
        out,
        "amdgpu_exporter_build_info",
        "Build information about this exporter (constant 1; identity in labels).",
        &[Sample {
            labels: vec![("version", env!("CARGO_PKG_VERSION").to_string())],
            value: 1.0,
        }],
    );
    write_counter(
        out,
        "amdgpu_exporter_scrapes_total",
        "Cumulative number of /metrics scrapes served.",
        &[Sample {
            labels: vec![],
            value: state.total_scrapes.load(Ordering::Relaxed) as f64,
        }],
    );
    let last_dur = *state.last_scrape_duration_seconds.lock().unwrap();
    write_family(
        out,
        "amdgpu_exporter_last_scrape_duration_seconds",
        "Wall-clock time of the most recent /metrics scrape, in seconds.",
        &[Sample {
            labels: vec![],
            value: last_dur,
        }],
    );
    write_family(
        out,
        "amdgpu_exporter_last_scrape_succeeded",
        "1 if the most recent /metrics scrape succeeded, 0 otherwise.",
        &[Sample {
            labels: vec![],
            value: if state.last_scrape_succeeded.load(Ordering::Relaxed) {
                1.0
            } else {
                0.0
            },
        }],
    );
}

// ─── CLI ──────────────────────────────────────────────────

fn parse_args() -> (String, u16) {
    let mut addr = String::from("0.0.0.0");
    let mut port = 9836u16;

    let mut args = std::env::args().peekable();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--addr" => {
                if let Some(next) = args.next() {
                    addr = next;
                }
            }
            "--port" => {
                if let Some(next) = args.next() {
                    port = next.parse().unwrap_or(9836);
                }
            }
            "--help" | "-h" => {
                println!(
                    "amdgpu-exporter — Prometheus metrics exporter for AMD GPUs\n\
                     \n\
                     Reads GPU telemetry from Linux sysfs (/sys/class/drm/).\n\
                     Zero runtime dependencies — no ROCm, no libdrm.\n\
                     \n\
                     Usage: amdgpu-exporter [OPTIONS]\n\
                     \n\
                     Options:\n\
                       --addr <IP>     Listen address (default: 0.0.0.0)\n\
                       --port <PORT>   Listen port (default: 9836)\n\
                       --help, -h      Show this help\n\
                       --version, -V   Show version"
                );
                std::process::exit(0);
            }
            "--version" | "-V" => {
                println!(concat!("amdgpu-exporter ", env!("CARGO_PKG_VERSION")));
                std::process::exit(0);
            }
            _ => {}
        }
    }

    (addr, port)
}

// ─── HTTP helpers ─────────────────────────────────────────

fn ok_response(body: String, content_type: &str) -> Response<std::io::Cursor<Vec<u8>>> {
    let header = Header::from_bytes("Content-Type", content_type).unwrap();
    Response::from_string(body).with_header(header)
}

fn error_response(body: String) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_string(body)
        .with_status_code(500)
        .with_header(Header::from_bytes("Content-Type", "text/plain").unwrap())
}

// ─── Main ──────────────────────────────────────────────────

fn main() {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let (addr, port) = parse_args();
    let listen_addr = format!("{addr}:{port}");

    let state = ExporterState::new(PathBuf::from("/sys/class/drm"), Duration::from_secs(30));
    let initial = state.gpus();
    if initial.is_empty() {
        log::error!("No AMD GPUs found in /sys/class/drm/");
        std::process::exit(1);
    }
    for gpu in &initial {
        log::info!(
            "Found GPU {}: {} (PCI: {}, VBIOS: {})",
            gpu.index,
            gpu.device_name,
            gpu.pci_id,
            gpu.vbios,
        );
    }

    let server = match Server::http(listen_addr.as_str()) {
        Ok(server) => server,
        Err(e) => {
            eprintln!("Failed to start HTTP server on {listen_addr}: {e}");
            std::process::exit(1);
        }
    };

    log::info!("Listening on {listen_addr}, press Ctrl+C to stop");

    for request in server.incoming_requests() {
        let url = request.url().to_string();
        let method = request.method().to_string();
        let is_get_or_head = method == "GET" || method == "HEAD";

        let response = match (url.as_str(), is_get_or_head) {
            ("/metrics", true) => {
                let started = Instant::now();
                let gpus = state.gpus();
                let mut body = collect_metrics(&gpus);
                collect_exporter_metrics(&state, &mut body);
                state.record_scrape(started.elapsed(), true);
                ok_response(body, "text/plain; version=0.0.4; charset=utf-8")
            }
            ("/healthz" | "/health", true) => ok_response("OK".to_string(), "text/plain"),
            ("/readyz", true) => {
                if state.is_ready() {
                    ok_response("READY".to_string(), "text/plain")
                } else {
                    Response::from_string("NOT READY".to_string())
                        .with_status_code(503)
                        .with_header(Header::from_bytes("Content-Type", "text/plain").unwrap())
                }
            }
            ("/", true) => {
                let body = "<h1>amdgpu-exporter</h1>\
                    <p>Prometheus metrics exporter for AMD GPUs</p>\
                    <p><a href=\"/metrics\">/metrics</a> | \
                    <a href=\"/healthz\">/healthz</a> | \
                    <a href=\"/readyz\">/readyz</a></p>"
                    .to_string();
                ok_response(body, "text/html; charset=utf-8")
            }
            (_, false) => error_response("Method Not Allowed".to_string()),
            _ => Response::from_string("Not Found".to_string())
                .with_status_code(404)
                .with_header(Header::from_bytes("Content-Type", "text/plain").unwrap()),
        };

        if let Err(e) = request.respond(response) {
            log::warn!("Failed to send response for {url}: {e}");
        }
    }
}

// ─── Tests ─────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn fixture_drm_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tests")
            .join("fixtures")
            .join("sysfs_drm")
    }

    #[test]
    fn discover_finds_amdgpu_card_in_fixture() {
        let gpus = discover_gpus_in(&fixture_drm_root());
        assert_eq!(gpus.len(), 1, "expected exactly one fixture GPU");
        let g = &gpus[0];
        assert_eq!(g.index, 0);
        assert_eq!(g.card_name, "card0");
        assert_eq!(g.pci_id, "1002:1586");
        assert_eq!(g.vbios, "TEST-VBIOS-1");
        assert_eq!(g.device_name, "AMD GPU [0x1586]");
        assert!(g.hwmon.is_some(), "hwmon directory should be discovered");
    }

    #[test]
    fn discover_returns_empty_for_missing_root() {
        let gpus = discover_gpus_in(Path::new("/nonexistent/drm/root"));
        assert!(gpus.is_empty());
    }

    #[test]
    fn collect_metrics_format_invariants() {
        let gpus = discover_gpus_in(&fixture_drm_root());
        let body = collect_metrics(&gpus);

        // Each metric family must appear with HELP and TYPE exactly once.
        let mut help_count: HashMap<&str, u32> = HashMap::new();
        let mut type_count: HashMap<&str, u32> = HashMap::new();
        for line in body.lines() {
            if let Some(rest) = line.strip_prefix("# HELP ") {
                let name = rest.split_whitespace().next().unwrap();
                *help_count.entry(name).or_default() += 1;
            } else if let Some(rest) = line.strip_prefix("# TYPE ") {
                let name = rest.split_whitespace().next().unwrap();
                *type_count.entry(name).or_default() += 1;
            }
        }
        for (name, count) in &help_count {
            assert_eq!(
                *count, 1,
                "HELP for {name} should appear once, found {count}"
            );
        }
        for (name, count) in &type_count {
            assert_eq!(
                *count, 1,
                "TYPE for {name} should appear once, found {count}"
            );
        }
        assert_eq!(
            help_count.keys().collect::<std::collections::HashSet<_>>(),
            type_count.keys().collect::<std::collections::HashSet<_>>(),
            "every HELP must have a matching TYPE"
        );

        // Every sample line must match the exposition grammar.
        for line in body.lines() {
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let (head, value) = line.rsplit_once(' ').expect("sample needs name and value");
            // Value: number, NaN, +Inf, or -Inf.
            assert!(
                value == "NaN"
                    || value == "+Inf"
                    || value == "-Inf"
                    || value.parse::<f64>().is_ok(),
                "unparseable sample value: {line:?}"
            );
            // Head: metric name, optionally followed by {labels}.
            let metric_name = head.split('{').next().unwrap();
            assert!(
                metric_name
                    .chars()
                    .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
                "metric name must be lowercase snake_case: {metric_name:?}"
            );
        }
    }

    #[test]
    fn collect_metrics_emits_expected_values() {
        let gpus = discover_gpus_in(&fixture_drm_root());
        let body = collect_metrics(&gpus);
        let lines: Vec<&str> = body.lines().collect();
        let has = |needle: &str| {
            assert!(
                lines.contains(&needle),
                "expected line `{needle}` not found in:\n{body}"
            );
        };

        has("amdgpu_count 1");
        has(
            r#"amdgpu_info{gpu="0",pci_id="1002:1586",device="AMD GPU [0x1586]",vbios="TEST-VBIOS-1",card="card0"} 1"#,
        );
        has(r#"amdgpu_temperature_celsius{gpu="0"} 65"#);
        has(r#"amdgpu_power_draw_watts{gpu="0"} 25"#);
        has(r#"amdgpu_power_average_watts{gpu="0"} 24"#);
        has(r#"amdgpu_sclk_hertz{gpu="0"} 2000000000"#);
        has(r#"amdgpu_gpu_utilization_ratio{gpu="0"} 0.5"#);
        has(r#"amdgpu_vram_utilization_ratio{gpu="0"} 0.5"#);
        has(r#"amdgpu_vram_total_bytes{gpu="0"} 1073741824"#);
        has(r#"amdgpu_vram_used_bytes{gpu="0"} 536870912"#);
        has(r#"amdgpu_vram_free_bytes{gpu="0"} 536870912"#);
        has(r#"amdgpu_vddgfx_volts{gpu="0"} 1"#);
        has(r#"amdgpu_vddnb_volts{gpu="0"} 0"#);
        has(r#"amdgpu_power_state_info{gpu="0",state="D0"} 1"#);
        has(r#"amdgpu_dpm_performance_level_info{gpu="0",level="auto"} 1"#);
        has(r#"amdgpu_dpm_state_info{gpu="0",state="balanced"} 1"#);
    }

    #[test]
    fn missing_sysfs_files_emit_nan_not_zero() {
        // Construct an AmdGpu that points to a non-existent sysfs tree.
        let gpu = AmdGpu {
            index: 0,
            card_name: "card0".into(),
            sysfs: PathBuf::from("/nonexistent/dev"),
            hwmon: Some(PathBuf::from("/nonexistent/hwmon")),
            pci_id: "0000:0000".into(),
            device_name: "test".into(),
            vbios: "test".into(),
        };
        let body = collect_metrics(&[gpu]);
        assert!(
            body.contains(r#"amdgpu_temperature_celsius{gpu="0"} NaN"#),
            "expected NaN for missing temperature reading; got:\n{body}"
        );
        assert!(
            body.contains(r#"amdgpu_vram_total_bytes{gpu="0"} NaN"#),
            "expected NaN for missing vram reading; got:\n{body}"
        );
    }

    #[test]
    fn exporter_state_caches_discovery() {
        let state = ExporterState::new(fixture_drm_root(), Duration::from_secs(60));
        let g1 = state.gpus();
        assert_eq!(g1.len(), 1);
        // Second call must hit the cache (not re-walk sysfs); we observe by
        // confirming the cache was populated.
        let cache = state.cached_gpus.lock().unwrap();
        assert!(
            cache.is_some(),
            "cache should be populated after first gpus()"
        );
        drop(cache);
        let g2 = state.gpus();
        assert_eq!(g1[0].pci_id, g2[0].pci_id);
    }

    #[test]
    fn collect_exporter_metrics_emits_self_metrics() {
        let state = ExporterState::new(fixture_drm_root(), Duration::from_secs(60));
        let _ = state.gpus(); // populate cache
        state.record_scrape(Duration::from_millis(7), true);
        state.record_scrape(Duration::from_millis(9), true);

        let mut out = String::new();
        collect_exporter_metrics(&state, &mut out);

        assert!(
            out.contains(&format!(
                r#"amdgpu_exporter_build_info{{version="{}"}} 1"#,
                env!("CARGO_PKG_VERSION")
            )),
            "missing build_info; got:\n{out}"
        );
        assert!(
            out.contains("amdgpu_exporter_scrapes_total 2"),
            "got:\n{out}"
        );
        assert!(
            out.contains("amdgpu_exporter_last_scrape_succeeded 1"),
            "got:\n{out}"
        );
        assert!(
            out.lines()
                .any(|l| l.starts_with("amdgpu_exporter_last_scrape_duration_seconds ")),
            "missing last scrape duration sample; got:\n{out}"
        );
    }

    #[test]
    fn readyz_logic() {
        let state = ExporterState::new(fixture_drm_root(), Duration::from_secs(60));
        // Before any gpus() call: cache is None → not ready
        assert!(!state.is_ready());
        let _ = state.gpus();
        // After successful discovery, before any scrape: still ready (zero-scrape grace)
        assert!(state.is_ready());
        // After a failed scrape: not ready
        state.record_scrape(Duration::from_millis(1), false);
        assert!(!state.is_ready());
        // After a recovery: ready again
        state.record_scrape(Duration::from_millis(1), true);
        assert!(state.is_ready());
    }

    #[test]
    fn label_value_escaping() {
        let escaped = escape_prom_label_value(r#"a\b"c"#);
        assert_eq!(escaped, r#"a\\b\"c"#);
        let escaped_nl = escape_prom_label_value("line1\nline2");
        assert_eq!(escaped_nl, r"line1\nline2");
    }
}

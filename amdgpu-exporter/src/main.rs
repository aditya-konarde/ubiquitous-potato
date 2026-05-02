//! amdgpu-exporter — Prometheus metrics exporter for AMD GPUs
//!
//! Reads telemetry from Linux sysfs (`/sys/class/drm/card*/device/`).
//! Zero external dependencies at runtime — no ROCm, no libdrm.
//! Optimized for Strix Halo / Radeon 8060S iGPUs and all amdgpu cards.

use std::fmt::Write;
use std::fs;
use std::path::{Path, PathBuf};
use tiny_http::{Header, Response, Server};

// ─── GPU detection ─────────────────────────────────────────

/// A discovered AMD GPU with its sysfs base path.
#[derive(Debug)]
struct AmdGpu {
    index: u32,
    card_name: String,
    sysfs: PathBuf,
    hwmon: PathBuf,
    pci_id: String,
    device_name: String,
    vbios: String,
}

/// Discover all AMD GPUs via `/sys/class/drm/card*/device/uevent`.
fn discover_gpus() -> Vec<AmdGpu> {
    let drm = Path::new("/sys/class/drm");
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

        // Find hwmon
        let hwmon_dir = device_dir.join("hwmon");
        let hwmon = fs::read_dir(&hwmon_dir)
            .ok()
            .and_then(|mut rd| rd.next())
            .map(|e| e.ok().unwrap().path())
            .unwrap_or_else(|| hwmon_dir.join("hwmon0"));

        // Read device name from PCI (best effort)
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

/// Read a sysfs file as f64 (supports millidegrees, microwatts, etc.).
fn read_sysfs_f64(path: &Path) -> Option<f64> {
    read_sysfs_string(path).and_then(|s| s.parse().ok())
}

// ─── Metric collection ─────────────────────────────────────

/// Escape a Prometheus label value according to the text exposition format.
fn escape_prom_label_value(value: &str) -> String {
    value
        .replace('\\', r"\\")
        .replace('\n', r"\n")
        .replace('"', r#"\""#)
}

/// Write a Prometheus gauge metric.
macro_rules! gauge {
    ($out:expr, $name:expr, $value:expr, $help:expr) => {
        let _ = write!(
            $out,
            "# HELP {} {}\n# TYPE {} gauge\n{} {}\n",
            $name, $help, $name, $name, $value
        );
    };
    ($out:expr, $name:expr, $value:expr, $help:expr, $($key:ident = $val:expr),* $(,)?) => {{
        let mut labels = String::with_capacity(64);
        $(
            if !labels.is_empty() {
                labels.push(',');
            }
            labels.push_str(concat!(stringify!($key), "=\""));
            let value = $val.to_string();
            labels.push_str(&escape_prom_label_value(&value));
            labels.push('"');
        )*
        let _ = write!(
            $out,
            "# HELP {} {}\n# TYPE {} gauge\n{}{{{}}} {}\n",
            $name, $help, $name, $name, labels, $value
        );
    }};
}

/// Collect all GPU metrics into a Prometheus text-format string.
fn collect_metrics(gpus: &[AmdGpu]) -> String {
    let mut out = String::with_capacity(4096);

    write!(
        out,
        "# HELP amdgpu_count Number of AMD GPUs detected.\n# TYPE amdgpu_count gauge\namdgpu_count {}\n\n",
        gpus.len()
    )
    .ok();

    for gpu in gpus {
        let i = gpu.index;

        // ─── Temperature (hwmon temp1_input is in millidegrees) ───
        let temp_c = read_sysfs_f64(&gpu.hwmon.join("temp1_input"))
            .map(|m| m / 1000.0)
            .unwrap_or(0.0);

        // ─── Power (hwmon power1_input is in microwatts) ───
        let power_w = read_sysfs_f64(&gpu.hwmon.join("power1_input"))
            .map(|uw| uw / 1_000_000.0)
            .unwrap_or(0.0);

        // ─── Average power ───
        let power_avg_w = read_sysfs_f64(&gpu.hwmon.join("power1_average"))
            .map(|uw| uw / 1_000_000.0)
            .unwrap_or(0.0);

        // ─── Clock frequencies ───
        // sclk from hwmon freq1_input (Hz)
        let sclk_mhz = read_sysfs_f64(&gpu.hwmon.join("freq1_input"))
            .map(|hz| hz / 1_000_000.0)
            .unwrap_or(0.0);

        // GPU busy percent
        let gpu_util = read_sysfs_u64(&gpu.sysfs.join("gpu_busy_percent")).unwrap_or(0);

        // ─── Memory ───
        let vram_total = read_sysfs_u64(&gpu.sysfs.join("mem_info_vram_total")).unwrap_or(0);
        let vram_used = read_sysfs_u64(&gpu.sysfs.join("mem_info_vram_used")).unwrap_or(0);
        let vram_free = vram_total.saturating_sub(vram_used);
        let vis_vram_total =
            read_sysfs_u64(&gpu.sysfs.join("mem_info_vis_vram_total")).unwrap_or(0);
        let vis_vram_used = read_sysfs_u64(&gpu.sysfs.join("mem_info_vis_vram_used")).unwrap_or(0);
        let gtt_total = read_sysfs_u64(&gpu.sysfs.join("mem_info_gtt_total")).unwrap_or(0);
        let gtt_used = read_sysfs_u64(&gpu.sysfs.join("mem_info_gtt_used")).unwrap_or(0);

        // ─── Voltage ───
        let vddgfx = read_sysfs_f64(&gpu.hwmon.join("in0_input")).unwrap_or(0.0);
        let vddnb = read_sysfs_f64(&gpu.hwmon.join("in1_input")).unwrap_or(0.0);

        // ─── Power state / DPM ───
        let power_state =
            read_sysfs_string(&gpu.sysfs.join("power_state")).unwrap_or_else(|| "unknown".into());
        let dpm_level = read_sysfs_string(&gpu.sysfs.join("power_dpm_force_performance_level"))
            .unwrap_or_else(|| "unknown".into());
        let dpm_state = read_sysfs_string(&gpu.sysfs.join("power_dpm_state"))
            .unwrap_or_else(|| "unknown".into());

        // DPM level as info metric
        gauge!(
            &mut out,
            "amdgpu_dpm_performance_level",
            1,
            "DPM performance level setting",
            gpu = i,
            level = &dpm_level
        );
        gauge!(
            &mut out,
            "amdgpu_dpm_state",
            1,
            "DPM power state",
            gpu = i,
            state = &dpm_state
        );

        // VRAM usage percent
        let vram_util_pct = if vram_total > 0 {
            (vram_used as f64 / vram_total as f64) * 100.0
        } else {
            0.0
        };

        // ─── Emit metrics ───
        // Identity
        gauge!(
            &mut out,
            "amdgpu_info",
            1,
            "AMD GPU information (value=1 for each GPU)",
            gpu = i,
            pci_id = &gpu.pci_id,
            device = &gpu.device_name,
            vbios = &gpu.vbios,
            card = &gpu.card_name
        );

        // Temperature
        gauge!(
            &mut out,
            "amdgpu_temperature_celsius",
            temp_c,
            "GPU edge temperature in Celsius",
            gpu = i
        );

        // Power
        gauge!(
            &mut out,
            "amdgpu_power_draw_watts",
            power_w,
            "GPU instantaneous power draw in watts",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_power_average_watts",
            power_avg_w,
            "GPU average power draw in watts",
            gpu = i
        );

        // Clocks
        gauge!(
            &mut out,
            "amdgpu_sclk_mhz",
            sclk_mhz,
            "GPU shader clock in MHz",
            gpu = i
        );

        // Utilization
        gauge!(
            &mut out,
            "amdgpu_gpu_utilization_percent",
            gpu_util,
            "GPU utilization in percent",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_vram_utilization_percent",
            vram_util_pct,
            "VRAM utilization in percent",
            gpu = i
        );

        // Memory
        gauge!(
            &mut out,
            "amdgpu_vram_total_bytes",
            vram_total,
            "GPU VRAM total in bytes",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_vram_used_bytes",
            vram_used,
            "GPU VRAM used in bytes",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_vram_free_bytes",
            vram_free,
            "GPU VRAM free in bytes",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_vis_vram_total_bytes",
            vis_vram_total,
            "Visible VRAM total in bytes",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_vis_vram_used_bytes",
            vis_vram_used,
            "Visible VRAM used in bytes",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_gtt_total_bytes",
            gtt_total,
            "GTT (system-to-GPU) memory total in bytes",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_gtt_used_bytes",
            gtt_used,
            "GTT (system-to-GPU) memory used in bytes",
            gpu = i
        );

        // Voltage
        gauge!(
            &mut out,
            "amdgpu_vddgfx_mv",
            vddgfx,
            "GPU core voltage in mV",
            gpu = i
        );
        gauge!(
            &mut out,
            "amdgpu_vddnb_mv",
            vddnb,
            "Northbridge voltage in mV",
            gpu = i
        );

        // Power state (info metric — value encodes state)
        let ps_val = match power_state.as_str() {
            "D0" => 0,
            "D1" => 1,
            "D2" => 2,
            "D3hot" => 3,
            "D3cold" => 4,
            _ => -1,
        };
        gauge!(
            &mut out,
            "amdgpu_power_state",
            ps_val,
            "GPU power state (D0=0, D1=1, D2=2, D3hot=3, D3cold=4)",
            gpu = i,
            state = &power_state
        );

        out.push('\n');
    }

    out
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
                println!("amdgpu-exporter 0.1.0");
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

    let gpus = discover_gpus();
    if gpus.is_empty() {
        log::error!("No AMD GPUs found in /sys/class/drm/");
        std::process::exit(1);
    }

    for gpu in &gpus {
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

        let response = match url.as_str() {
            "/metrics" => {
                if method != "GET" && method != "HEAD" {
                    error_response("Method Not Allowed".to_string())
                } else {
                    // Re-discover GPUs on each scrape to handle hotplug
                    let gpus = discover_gpus();
                    let body = collect_metrics(&gpus);
                    ok_response(body, "text/plain; version=0.0.4; charset=utf-8")
                }
            }
            "/health" => {
                if method != "GET" && method != "HEAD" {
                    error_response("Method Not Allowed".to_string())
                } else {
                    ok_response("OK".to_string(), "text/plain")
                }
            }
            "/" => {
                if method != "GET" && method != "HEAD" {
                    error_response("Method Not Allowed".to_string())
                } else {
                    let body = "<h1>amdgpu-exporter</h1>\
                        <p>Prometheus metrics exporter for AMD GPUs</p>\
                        <p><a href=\"/metrics\">Metrics</a> | \
                        <a href=\"/health\">Health</a></p>"
                        .to_string();
                    ok_response(body, "text/html; charset=utf-8")
                }
            }
            _ => Response::from_string("Not Found".to_string())
                .with_status_code(404)
                .with_header(Header::from_bytes("Content-Type", "text/plain").unwrap()),
        };

        if let Err(e) = request.respond(response) {
            log::warn!("Failed to send response for {url}: {e}");
        }
    }
}

<div align="center">

# amdgpu-exporter

<br/>

Prometheus metrics exporter for AMD GPUs — pure Rust, minimal dependencies, zero runtime requirements.

<br/>

<img src="https://img.shields.io/badge/License-MIT-green?style=flat&labelColor=555" alt="License MIT">
<img src="https://img.shields.io/badge/1.3MB_binary-darkgray?style=flat&labelColor=555" alt="1.3MB binary">
<img src="https://img.shields.io/badge/No_ROCm_required-orange?style=flat&labelColor=555" alt="No ROCm">
<img src="https://img.shields.io/badge/sysfs_only-blue?style=flat&labelColor=555" alt="sysfs only">

</div>

---

## ✨ Features

Reads all telemetry from Linux sysfs (`/sys/class/drm/card*/device/`). No ROCm, no libdrm, no external libraries — just a single static binary.

All standard GPU telemetry via sysfs hwmon + amdgpu:

- **Temperature** — edge sensor (°C)
- **Power** — instantaneous and average draw (watts)
- **Clocks** — shader clock (MHz)
- **Utilization** — GPU busy %, VRAM usage %
- **Memory** — VRAM total/used/free, visible VRAM, GTT (system-to-GPU) memory
- **Voltage** — GPU core (VDDGFX) and northbridge (VDDNB)
- **Power state** — ACPI power state (D0–D3cold) and DPM performance level
- **Identity** — PCI ID, VBIOS version, card name

Optimized for **AMD Strix Halo** (Radeon 8060S / 8050S) iGPUs, works with any amdgpu card.

## ⚙️ Requirements

- Linux with AMD GPU (amdgpu driver)
- Rust 1.85+ (for building)

## 🚀 Build & Run

```bash
cargo build --release
./target/release/amdgpu-exporter
```

## 📟 CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `--addr <ADDR>` | `0.0.0.0` | Bind address |
| `--port <PORT>` | `9836` | Bind port |
| `-h, --help` | — | Show help |
| `-V, --version` | — | Show version |

## 🔌 Endpoints

| Endpoint | Description |
|----------|-------------|
| `/metrics` | Prometheus text exposition format |
| `/health` | Returns `OK` |
| `/` | Info page with links |

## 📊 Metrics (16 numeric gauges + 4 info metrics)

All metric names use Prometheus base units (seconds, bytes, hertz, volts, ratio).
Per-GPU metrics carry a `gpu` label with the card index. Readings missing from
sysfs are emitted as `NaN`.

### Numeric series (gauges)

| Metric | Labels | Description |
|--------|--------|-------------|
| `amdgpu_count` | — | Number of detected AMD GPUs |
| `amdgpu_temperature_celsius` | `gpu` | Edge temperature (°C) |
| `amdgpu_power_draw_watts` | `gpu` | Instantaneous power draw (W) |
| `amdgpu_power_average_watts` | `gpu` | Average power draw (W) |
| `amdgpu_sclk_hertz` | `gpu` | Shader (graphics) clock frequency (Hz) |
| `amdgpu_gpu_utilization_ratio` | `gpu` | GPU utilization, ratio in [0, 1] |
| `amdgpu_vram_utilization_ratio` | `gpu` | VRAM utilization, ratio in [0, 1] |
| `amdgpu_vram_total_bytes` | `gpu` | VRAM total (bytes) |
| `amdgpu_vram_used_bytes` | `gpu` | VRAM used (bytes) |
| `amdgpu_vram_free_bytes` | `gpu` | VRAM free (bytes) |
| `amdgpu_vis_vram_total_bytes` | `gpu` | Visible (CPU-mappable) VRAM total (bytes) |
| `amdgpu_vis_vram_used_bytes` | `gpu` | Visible VRAM used (bytes) |
| `amdgpu_gtt_total_bytes` | `gpu` | GTT (system-to-GPU) memory total (bytes) |
| `amdgpu_gtt_used_bytes` | `gpu` | GTT memory used (bytes) |
| `amdgpu_vddgfx_volts` | `gpu` | GPU core voltage VDDGFX (V) |
| `amdgpu_vddnb_volts` | `gpu` | Northbridge voltage VDDNB (V) |

### Info metrics (constant 1; current state in label)

| Metric | Labels | Description |
|--------|--------|-------------|
| `amdgpu_info` | `gpu`, `pci_id`, `device`, `vbios`, `card` | GPU identity |
| `amdgpu_power_state_info` | `gpu`, `state` | ACPI power state (D0/D1/D2/D3hot/D3cold) |
| `amdgpu_dpm_performance_level_info` | `gpu`, `level` | DPM performance level |
| `amdgpu_dpm_state_info` | `gpu`, `state` | DPM power state |

## 📈 Grafana Dashboard

Import the dashboard JSON from [`dashboard.json`](dashboard.json).

## ⚡ Prometheus Config

```yaml
scrape_configs:
  - job_name: 'amd-gpu'
    static_configs:
      - targets: ['localhost:9836']
    scrape_interval: 5s
    metrics_path: '/metrics'
```

## 🛠️ Systemd Service

```ini
[Unit]
Description=amdgpu-exporter — AMD GPU Exporter for Prometheus
After=network.target

[Service]
Type=simple
ExecStart=/opt/amdgpu-exporter/amdgpu-exporter
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 🔧 How It Works

Instead of shelling out to `rocm-smi` or depending on libdrm, the exporter reads telemetry directly from the Linux kernel's sysfs interface:

- **hwmon** (`/sys/class/drm/card*/device/hwmon/hwmon*/`) — temperature, power, clocks, voltages
- **amdgpu sysfs** (`/sys/class/drm/card*/device/`) — memory info, GPU busy %, power states, VBIOS

This means:
- Zero overhead — just file reads
- Works on any Linux kernel with amdgpu driver
- No proprietary libraries or build dependencies
- Handles GPU hotplug (re-discovers on each scrape)

## 📄 License

MIT

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

## 📊 Metrics (22 total)

All metrics carry a `gpu` label with the card index.

| Metric | Labels | Description |
|--------|--------|-------------|
| `amdgpu_count` | — | Number of GPUs |
| `amdgpu_info` | `gpu`, `pci_id`, `device`, `vbios`, `card` | GPU identity (value=1) |
| `amdgpu_temperature_celsius` | `gpu` | Edge temperature (°C) |
| `amdgpu_power_draw_watts` | `gpu` | Instantaneous power (W) |
| `amdgpu_power_average_watts` | `gpu` | Average power (W) |
| `amdgpu_sclk_mhz` | `gpu` | Shader clock (MHz) |
| `amdgpu_gpu_utilization_percent` | `gpu` | GPU utilization (%) |
| `amdgpu_vram_utilization_percent` | `gpu` | VRAM utilization (%) |
| `amdgpu_vram_total_bytes` | `gpu` | Total VRAM (bytes) |
| `amdgpu_vram_used_bytes` | `gpu` | Used VRAM (bytes) |
| `amdgpu_vram_free_bytes` | `gpu` | Free VRAM (bytes) |
| `amdgpu_vis_vram_total_bytes` | `gpu` | Visible VRAM total (bytes) |
| `amdgpu_vis_vram_used_bytes` | `gpu` | Visible VRAM used (bytes) |
| `amdgpu_gtt_total_bytes` | `gpu` | GTT memory total (bytes) |
| `amdgpu_gtt_used_bytes` | `gpu` | GTT memory used (bytes) |
| `amdgpu_vddgfx_mv` | `gpu` | GPU core voltage (mV) |
| `amdgpu_vddnb_mv` | `gpu` | Northbridge voltage (mV) |
| `amdgpu_power_state` | `gpu`, `state` | ACPI power state |
| `amdgpu_dpm_performance_level` | `gpu`, `level` | DPM performance level |
| `amdgpu_dpm_state` | `gpu`, `state` | DPM power state |

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

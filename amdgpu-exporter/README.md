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

**Works on Strix Halo today. No ROCm setup. No drama.**

Reads telemetry directly from the Linux kernel's sysfs interface
(`/sys/class/drm/card*/device/`). No ROCm, no libdrm, no external libraries —
just a single static binary that runs anywhere amdgpu does.

Telemetry surfaced:

- **Temperature** — edge sensor (°C)
- **Power** — instantaneous and average draw (W)
- **Clocks** — shader (sclk) and memory (mclk) frequencies (Hz)
- **Fan** — RPM, when present (NaN on fanless APUs)
- **PCIe link** — current and max negotiated speed (GT/s) and width (lanes)
- **Utilization** — GPU and VRAM, as a ratio in `[0, 1]`
- **Memory** — VRAM total/used/free, visible VRAM, GTT (system-to-GPU) memory
- **Voltage** — GPU core (VDDGFX) and northbridge (VDDNB)
- **Power state** — ACPI power state (D0–D3cold), DPM performance level, DPM state
- **Identity** — PCI ID, VBIOS version, card name
- **Kernel `gpu_metrics` blob version** — so dashboards know what layout the kernel exposes
- **Self-metrics** — build version, scrape duration, scrape counter, last-scrape success

Designed and tuned for **AMD Strix Halo** (Radeon 8060S / 8050S) iGPUs. Works
on any amdgpu-driven card from RDNA1 onward.

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
| `/healthz` (alias `/health`) | Returns `OK` if the process is alive (for liveness probes) |
| `/readyz` | Returns `READY` (200) once at least one GPU is known and the most recent scrape succeeded; `NOT READY` (503) otherwise |
| `/` | Info page with links |

## 📊 Metrics

All metric names use Prometheus base units (seconds, bytes, hertz, volts,
ratio). Per-GPU metrics carry a `gpu` label with the card index. Readings
missing from sysfs are emitted as `NaN` (so genuine zeros, e.g. an idle iGPU,
are distinguishable from absent sensors).

### Per-GPU gauges

| Metric | Labels | Description |
|--------|--------|-------------|
| `amdgpu_count` | — | Number of detected AMD GPUs |
| `amdgpu_temperature_celsius` | `gpu` | Edge temperature (°C) |
| `amdgpu_power_draw_watts` | `gpu` | Instantaneous power draw (W) |
| `amdgpu_power_average_watts` | `gpu` | Average power draw (W) |
| `amdgpu_sclk_hertz` | `gpu` | Shader (graphics) clock frequency (Hz) |
| `amdgpu_mclk_hertz` | `gpu` | Memory clock frequency (Hz) |
| `amdgpu_fan_rpm` | `gpu` | Fan speed in RPM (NaN on fanless APUs) |
| `amdgpu_pcie_link_speed_gts` | `gpu` | Current PCIe link speed (GT/s) |
| `amdgpu_pcie_link_width` | `gpu` | Current PCIe link width (lanes) |
| `amdgpu_pcie_max_link_speed_gts` | `gpu` | Max PCIe link speed the card can negotiate (GT/s) |
| `amdgpu_pcie_max_link_width` | `gpu` | Max PCIe link width the card can negotiate (lanes) |
| `amdgpu_gpu_utilization_ratio` | `gpu` | GPU utilization, `[0, 1]` |
| `amdgpu_vram_utilization_ratio` | `gpu` | VRAM utilization, `[0, 1]` |
| `amdgpu_vram_total_bytes` | `gpu` | VRAM total (bytes) |
| `amdgpu_vram_used_bytes` | `gpu` | VRAM used (bytes) |
| `amdgpu_vram_free_bytes` | `gpu` | VRAM free (bytes) |
| `amdgpu_vis_vram_total_bytes` | `gpu` | Visible (CPU-mappable) VRAM total (bytes) |
| `amdgpu_vis_vram_used_bytes` | `gpu` | Visible VRAM used (bytes) |
| `amdgpu_gtt_total_bytes` | `gpu` | GTT memory total (bytes) |
| `amdgpu_gtt_used_bytes` | `gpu` | GTT memory used (bytes) |
| `amdgpu_vddgfx_volts` | `gpu` | GPU core voltage VDDGFX (V) |
| `amdgpu_vddnb_volts` | `gpu` | Northbridge voltage VDDNB (V) |

### Info metrics (constant 1; identity / state in labels)

| Metric | Labels | Description |
|--------|--------|-------------|
| `amdgpu_info` | `gpu`, `pci_id`, `device`, `vbios`, `card` | GPU identity |
| `amdgpu_power_state_info` | `gpu`, `state` | ACPI power state (D0/D1/D2/D3hot/D3cold) |
| `amdgpu_dpm_performance_level_info` | `gpu`, `level` | DPM performance level |
| `amdgpu_dpm_state_info` | `gpu`, `state` | DPM power state |
| `amdgpu_gpu_metrics_info` | `gpu`, `format_revision`, `content_revision`, `structure_size_bytes` | Header of the kernel `gpu_metrics` binary blob |

### Exporter self-metrics

| Metric | Type | Description |
|--------|------|-------------|
| `amdgpu_exporter_build_info` | gauge | Build version (constant 1; `version` label) |
| `amdgpu_exporter_scrapes_total` | counter | Cumulative `/metrics` scrapes served |
| `amdgpu_exporter_last_scrape_duration_seconds` | gauge | Wall-clock time of most recent scrape |
| `amdgpu_exporter_last_scrape_succeeded` | gauge | `1` if last scrape succeeded, else `0` |

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

The exporter only ever reads from `/sys` and binds an HTTP port. No root, no
write access. The unit below runs unprivileged and locks down everything else.

```ini
[Unit]
Description=amdgpu-exporter — AMD GPU exporter for Prometheus
After=network.target

[Service]
Type=simple
DynamicUser=yes
ExecStart=/usr/local/bin/amdgpu-exporter
Restart=always
RestartSec=10

# Hardening — read-only world, no privileges.
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=false   # need /sys/class/drm
RestrictAddressFamilies=AF_INET AF_INET6
RestrictNamespaces=true
LockPersonality=true
MemoryDenyWriteExecute=true
SystemCallArchitectures=native

[Install]
WantedBy=multi-user.target
```

## 🔧 How it works

The exporter reads telemetry from the Linux kernel's sysfs interface:

- **hwmon** (`/sys/class/drm/card*/device/hwmon/hwmon*/`) — temperature, power,
  clocks, fan, voltages
- **amdgpu sysfs** (`/sys/class/drm/card*/device/`) — memory info, GPU busy %,
  power states, VBIOS, PCIe link state, DPM tables, `gpu_metrics` blob header

GPU discovery is cached for 30 seconds (re-walked on cache miss). Hotplug works
within that window. The `/metrics` handler also records a wall-clock duration
and increments the scrape counter every time it's hit.

## 🩺 Troubleshooting

### `amdgpu_vddgfx_volts` reads `0`

Strix Halo and other APUs do not expose voltage sensors via `in0_input` /
`in1_input` — the kernel surfaces the file but reports `0`. This is the actual
value, not an error.

### `amdgpu_fan_rpm` is `NaN`

The card has no fan (typical for APUs), or the kernel doesn't expose
`fan1_input` for this driver. NaN is the correct "absent sensor" signal.

### `amdgpu_count` reports more cards than I have

A second `cardN` entry that ships with the GPU but isn't a render device
(e.g. a connector node) shouldn't match — discovery filters out paths
containing `-` and only matches `cardN` where N is an integer with
`DRIVER=amdgpu` in `uevent`. If you still see overcounting, please open an
issue with the contents of `/sys/class/drm/card*/device/uevent`.

### `vram_total` on Strix Halo doesn't match my system RAM

Strix Halo (and other unified-memory APUs) carve out a **dynamic** GTT region
from system memory. `mem_info_vram_total` reports the kernel's current
allocation ceiling for that region, not the silicon's fixed limit. It can
change after a reboot if `amdgpu.gttsize=` is set or the BIOS UMA budget
changes.

### Why is `amdgpu_gpu_metrics_info` only an info metric?

The kernel exposes a binary blob (`/sys/class/drm/cardN/device/gpu_metrics`)
whose layout depends on the ASIC's firmware. Different versions are not
ABI-compatible. The exporter parses the universally-stable 4-byte header so
dashboards know which `gpu_metrics_v*_*` layout to expect. Field-level parsing
is intentionally deferred until each version's offsets are individually
verified across multiple ASIC families.

## 🔒 Metric stability

This exporter is pre-1.0. Metric names may break on minor versions until then;
each rename is documented in [`CHANGELOG.md`](CHANGELOG.md).

After v1.0.0: no breaking metric or label changes without a major-version bump.

## 📄 License

MIT

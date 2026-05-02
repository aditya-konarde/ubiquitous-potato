# Changelog

All notable changes to this project will be documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Once this exporter reaches **v1.0.0**, metric names and label keys will follow a
stability commitment: no breaking renames without a major-version bump.
Pre-1.0 minor versions may break metric names; the changelog will always document
the mapping.

## [Unreleased]

## [0.2.0] - 2026-05-02

### Added — metric coverage

- `amdgpu_mclk_hertz` — memory clock; reads `freq2_input` (dGPU) or parses the
  active marker in `pp_dpm_mclk` (APU/iGPU).
- `amdgpu_fan_rpm` — cooling fan speed; `NaN` on cards without a fan.
- `amdgpu_pcie_link_speed_gts` / `amdgpu_pcie_link_width` — current PCIe link
  state.
- `amdgpu_pcie_max_link_speed_gts` / `amdgpu_pcie_max_link_width` — link
  negotiation ceiling.
- `amdgpu_gpu_metrics_info` — header of the kernel's `gpu_metrics` binary blob
  (format/content revision and structure size). Field-level parsing of the
  blob is intentionally deferred until per-version layouts are verified.

### Added — exporter self-metrics

- `amdgpu_exporter_build_info` (constant 1; `version` label).
- `amdgpu_exporter_scrapes_total` (counter).
- `amdgpu_exporter_last_scrape_duration_seconds` (gauge).
- `amdgpu_exporter_last_scrape_succeeded` (gauge, 0 / 1).
- `/readyz` endpoint (503 if no GPUs known or last scrape failed).
- `/healthz` endpoint (alias for `/health`, kept for backward compat).

### Added — quality

- 17 unit tests covering discovery, format invariants, expected sample values,
  NaN handling, label escaping, DPM/PCIe parsers, gpu_metrics header, and
  exporter state.
- Sysfs fixture tree at `tests/fixtures/sysfs_drm/` for hermetic testing.
- GitHub Actions workflow: `cargo fmt --check`, `cargo build --release`,
  `cargo clippy --all-targets -- -D warnings`, `cargo test`.
- 30-second discovery cache to avoid re-walking `/sys/class/drm` on every
  scrape.

### Breaking — metric renames

All conversions follow Prometheus base-unit conventions (seconds, bytes, hertz,
volts, ratio).

| Old (v0.1.0) | New (v0.2.0) | Notes |
|---|---|---|
| `amdgpu_sclk_mhz` | `amdgpu_sclk_hertz` | Value is now Hz, not MHz |
| `amdgpu_gpu_utilization_percent` | `amdgpu_gpu_utilization_ratio` | Range is now `[0, 1]`, not `[0, 100]` |
| `amdgpu_vram_utilization_percent` | `amdgpu_vram_utilization_ratio` | Range is now `[0, 1]`, not `[0, 100]` |
| `amdgpu_vddgfx_mv` | `amdgpu_vddgfx_volts` | Value is now V, not mV |
| `amdgpu_vddnb_mv` | `amdgpu_vddnb_volts` | Value is now V, not mV |
| `amdgpu_power_state` | `amdgpu_power_state_info` | Constant-1 info metric; state in label |
| `amdgpu_dpm_performance_level` | `amdgpu_dpm_performance_level_info` | Constant-1 info metric |
| `amdgpu_dpm_state` | `amdgpu_dpm_state_info` | Constant-1 info metric |

### Fixed

- `# HELP`/`# TYPE` lines are now emitted once per metric family. Previously
  they were duplicated for every GPU when more than one card was present, which
  violates the Prometheus exposition format.
- Missing sysfs readings now emit `NaN` instead of `0`, so genuine zeros (idle
  iGPU) can be distinguished from absent sensors.
- `discover_gpus` no longer panics if a `hwmon` directory entry yields an
  `Err` from the OS during enumeration.

### Changed

- `amdgpu_info` description clarified ("constant 1; identity in labels").
- Bundled `dashboard.json` rewrites Prometheus expressions for renamed metrics
  (`* 100` for ratios, `/ 1e6` for sclk_hertz) so existing Grafana panel units
  still work without configuration changes.

## [0.1.0] - 2026-05-02

Initial release. Sysfs-only AMD GPU metrics exporter.

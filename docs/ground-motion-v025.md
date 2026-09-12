# AstraStruct v0.25 — Ground-motion processing and bidirectional seismic input

## Scope
The v0.25 seismic path extends v0.24 without changing the linear structural mass/stiffness formulation. Uniform support acceleration may act in X, Y or X+Y simultaneously.

## Pre-processing
For each component the pipeline is: sanitize time axis → optional mean or least-squares linear baseline removal → cosine taper → optional uniform resampling → optional first-order RC high-pass/low-pass applied forward and backward (zero phase) → scale factor. Raw and processed PGA, mean acceleration, sampling metrics and final integrated velocity/displacement are reported. The RC implementation is intentionally transparent and is not a substitute for a validated signal-processing package in regulatory work.

## Bidirectional base motion
The relative-coordinate equation is

`M u¨ + C u˙ + K u = -M (r_x a_gx(t) + r_y a_gy(t))`.

This is uniform base motion. Differential support excitation and wave-passage effects remain outside scope.

## Response spectra
Each component generates Sd, pseudo-Sv and pseudo-Sa by Newmark average acceleration. Modal responses are combined first (SRSS or CQC), then orthogonal component peaks are combined by either SRSS or the generic envelope `max(Rx + 0.3 Ry, 0.3 Rx + Ry)`. The latter is exposed as `100-30` but is not automatic code compliance.

For X+Y record characterization, the displayed record spectrum is the geometric mean of the X and Y pseudo-spectral ordinates.

## Target comparison
A user-supplied target curve `(T, Sa[g])` is interpolated over the common period range. AstraStruct reports min/max ratio, geometric-mean ratio, RMS log error and a geometric scale factor that centers the record spectrum on the target. It does not automatically enforce any national code acceptance band.

## Record library
Up to 12 record pairs can be stored in project settings and therefore travel with exported/imported AstraStruct JSON. No external upload is required.

## Validation
The permanent v0.25 smoke test checks detrending/resampling/filter limits, X+Y base-motion metadata, target-spectrum metrics, SRSS/100-30 directional combination and bidirectional response-spectrum solution. Browser E2E covers X+Y time history and target-spectrum workflow.

## Limitations
Linear elastic dynamics only; rigid frame-element ends in the dynamic kernel; no nonlinear time-history, soil-structure interaction, multiple-support differential motion, automatic record matching, code-specific design spectra, rotational ground motion or vertical/horizontal code combination rules.

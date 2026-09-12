# AstraStruct v0.26 — 3D Structural Foundation

## Scope
The v0.26 kernel is linear-elastic and supports `frame3d`, `truss3d`, and mixed assemblies of those two element types. Each node owns the six global DOFs `[Ux, Uy, Uz, Rx, Ry, Rz]`.

## Local axes and transformation
For an element joining points **x1** and **x2**, local `ex` follows the chord. A user `orientation.up` vector may define the local-y reference; otherwise a robust global fallback is selected and orthogonalized. `ez = ex × ey`. The block transformation maps global translations and rotations to the local triad and the element stiffness is transformed as `Kg = Tᵀ Kl T`.

## Frame stiffness
The 12×12 Euler–Bernoulli local matrix contains axial `EA/L`, Saint-Venant torsion `GJ/L`, bending about local z with `EIz`, and bending about local y with `EIy`. Shear deformation and warping torsion are outside v0.26.

## Loading and scenarios
Nodal actions support `[Fx,Fy,Fz,Mx,My,Mz]`. Frame members support uniform local `[qx,qy,qz]`. Existing load cases/combinations are resolved before the spatial solver, so all 3D load components are scaled by scenario factors. Truss-member distributed loading remains intentionally unsupported.

## Recovery
`frame3d` returns the two-end local generalized forces `N, Vy, Vz, T, My, Mz`; `truss3d` returns its axial force. Reactions are recovered in global axes.

## Protected scope
v0.26 does not claim 3D P-Delta, co-rotational analysis, material nonlinearity, dynamics, shells, solids, contact, member releases, rigid offsets, shear deformation, or warping. Those capabilities must be introduced and validated separately.

## Validation
Permanent tests cover two orthogonal cantilever bending planes, torsion, arbitrary spatial orientation, 3D truss axial response, uniform member load equilibrium, stiffness symmetry, registries/contracts, load combinations, and browser delivery of 3D results.

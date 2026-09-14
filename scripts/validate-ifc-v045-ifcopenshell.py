#!/usr/bin/env python3
import json
import sys
from collections import Counter
from pathlib import Path

import ifcopenshell
import ifcopenshell.validate as ifc_validate


def fail(message, details=None):
    payload = {"status": "failed", "message": message}
    if details is not None:
        payload["details"] = details
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    raise SystemExit(1)


def main():
    if len(sys.argv) != 2:
        fail("usage: validate-ifc-v045-ifcopenshell.py <model.ifc>")
    path = Path(sys.argv[1])
    if not path.is_file():
        fail(f"IFC file not found: {path}")

    try:
        model = ifcopenshell.open(str(path))
    except Exception as exc:
        fail("IfcOpenShell could not parse the IFC-SPF file", str(exc))

    if model.schema != "IFC4X3":
        fail(f"Unexpected schema: {model.schema}; expected IFC4X3")

    required = {
        "IfcProject": 1,
        "IfcStructuralAnalysisModel": 1,
        "IfcStructuralPointConnection": 4,
        "IfcStructuralCurveMember": 1,
        "IfcStructuralSurfaceMember": 1,
        "IfcRelAssociatesMaterial": 2,
        "IfcOwnerHistory": 1,
        "IfcApplication": 1,
        "IfcMaterialProperties": 4,
        "IfcPropertySingleValue": 7,
        "IfcStructuralLoadCase": 2,
        "IfcStructuralPointAction": 2,
        "IfcStructuralLinearAction": 1,
        "IfcStructuralLoadSingleForce": 2,
        "IfcStructuralLoadLinearForce": 1,
        "IfcRelAssignsToGroupByFactor": 2,
        "IfcRelConnectsStructuralActivity": 3,
    }
    counts = {name: len(model.by_type(name)) for name in required}
    wrong = {name: {"expected": required[name], "actual": count} for name, count in counts.items() if count != required[name]}
    if wrong:
        fail("Unexpected IFC entity population", wrong)

    property_sets = model.by_type("IfcMaterialProperties")
    pset_counts = Counter(getattr(pset, "Name", None) for pset in property_sets)
    expected_psets = {"Pset_MaterialMechanical": 2, "Pset_MaterialSteel": 1, "Pset_MaterialConcrete": 1}
    if dict(pset_counts) != expected_psets:
        fail("Unexpected IfcMaterialProperties names", {"expected": expected_psets, "actual": dict(pset_counts)})

    def names_for(pset_name):
        matches = [pset for pset in property_sets if getattr(pset, "Name", None) == pset_name]
        return [sorted(getattr(prop, "Name", None) for prop in getattr(pset, "Properties", ()) or ()) for pset in matches]

    steel_props = names_for("Pset_MaterialSteel")
    if steel_props != [["UltimateStress", "YieldStress"]]:
        fail("Unexpected Pset_MaterialSteel properties", steel_props)
    concrete_props = names_for("Pset_MaterialConcrete")
    if concrete_props != [["CompressiveStrength"]]:
        fail("Unexpected Pset_MaterialConcrete properties", concrete_props)
    if any("TensileStrength" in names for names in names_for("Pset_MaterialConcrete")):
        fail("fctm must not be mapped to TensileStrength in Pset_MaterialConcrete")

    analysis = model.by_type("IfcStructuralAnalysisModel")[0]
    loaded_by = list(getattr(analysis, "LoadedBy", ()) or ())
    if len(loaded_by) != 1:
        fail("IfcStructuralAnalysisModel.LoadedBy must contain exactly the top-level load combination", [str(x) for x in loaded_by])
    combination = loaded_by[0]
    if combination.is_a() != "IfcStructuralLoadGroup" or str(getattr(combination, "PredefinedType", "")) != "LOAD_COMBINATION":
        fail("LoadedBy does not reference an IfcStructuralLoadGroup/LOAD_COMBINATION", str(combination))

    load_cases = model.by_type("IfcStructuralLoadCase")
    if any(case in loaded_by for case in load_cases):
        fail("Load cases must not appear directly in LoadedBy when a load combination exists")

    point_actions = model.by_type("IfcStructuralPointAction")
    if any(str(getattr(action, "GlobalOrLocal", "")) != "GLOBAL_COORDS" for action in point_actions):
        fail("All nodal point actions must use GLOBAL_COORDS")
    linear_actions = model.by_type("IfcStructuralLinearAction")
    if any(str(getattr(action, "GlobalOrLocal", "")) != "LOCAL_COORDS" for action in linear_actions):
        fail("All uniform curve actions must use LOCAL_COORDS")
    if any(str(getattr(action, "PredefinedType", "")) != "CONST" for action in linear_actions):
        fail("All v0.48 linear actions must use CONST predefined type")

    all_actions = [*point_actions, *linear_actions]
    for action in all_actions:
        assignments = [rel for rel in getattr(action, "HasAssignments", ()) or () if rel.is_a("IfcRelAssignsToGroup")]
        if len(assignments) != 1 or assignments[0].RelatingGroup.is_a() != "IfcStructuralLoadCase":
            fail(f"Structural action #{action.id()} is not assigned to exactly one load case", [str(x) for x in assignments])
        activity_links = list(getattr(action, "AssignedToStructuralItem", ()) or ())
        if len(activity_links) != 1:
            fail(f"Structural action #{action.id()} is not connected to exactly one structural target", [str(x) for x in activity_links])

    factor_relations = model.by_type("IfcRelAssignsToGroupByFactor")
    factors = sorted(round(float(rel.Factor), 10) for rel in factor_relations)
    if factors != [1.2, 1.5]:
        fail("Unexpected load combination factors", factors)
    for rel in factor_relations:
        if rel.RelatingGroup != combination:
            fail("Factored relation does not target the top-level combination", str(rel))
        related = list(rel.RelatedObjects or ())
        if len(related) != 1 or related[0].is_a() != "IfcStructuralLoadCase":
            fail("Factored relation must contain exactly one IfcStructuralLoadCase", str(rel))

    logger = ifc_validate.json_logger()
    try:
        ifc_validate.validate(str(path), logger, express_rules=True)
        ifc_validate.validate_ifc_header(model, logger)
        ifc_validate.validate_ifc_applications(model, logger)
    except Exception as exc:
        fail("IfcOpenShell validation raised an exception", str(exc))

    statements = list(logger.statements)
    if statements:
        fail("IfcOpenShell reported schema / EXPRESS / application validation findings", statements)

    global_ids = []
    for root in model.by_type("IfcRoot"):
        gid = getattr(root, "GlobalId", None)
        if not gid:
            fail(f"IfcRoot #{root.id()} is missing GlobalId")
        guid_error = ifc_validate.validate_guid(gid)
        if guid_error:
            fail(f"Invalid GlobalId on #{root.id()}", guid_error)
        global_ids.append(gid)
    if len(global_ids) != len(set(global_ids)):
        fail("Duplicate IfcRoot GlobalId detected")

    result = {
        "status": "valid",
        "ifcopenshell_version": getattr(ifcopenshell, "version", None),
        "schema": model.schema,
        "entities": len(list(model)),
        "root_entities": len(global_ids),
        "counts": counts,
        "material_property_sets": dict(pset_counts),
        "loaded_by": [x.id() for x in loaded_by],
        "combination_factors": factors,
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

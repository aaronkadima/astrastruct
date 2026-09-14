#!/usr/bin/env python3
import json
import sys
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
    }
    counts = {name: len(model.by_type(name)) for name in required}
    wrong = {name: {"expected": required[name], "actual": count} for name, count in counts.items() if count != required[name]}
    if wrong:
        fail("Unexpected IFC entity population", wrong)

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
    }
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
